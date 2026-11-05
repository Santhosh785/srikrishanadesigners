// "Get a quote" endpoint for dress pages. Validates the submission, drops
// bots (honeypot + per-IP rate limit), stores the optional reference photo in
// the private `quote-refs` bucket, saves a `quote_requests` row and then
// alerts the owner on WhatsApp. The alert never changes the response.
import type { APIRoute } from 'astro';
import { createServiceClient } from '../../lib/supabase-server';
import { createRateLimiter } from '../../lib/rate-limit';
import { sendQuoteAlert } from '../../lib/quote-alert';
import { dressPhotoUrl, type Dress, type QuoteRequest } from '../../lib/dress-types';
import { site } from '../../site.config';

export const prerender = false;

// Separate bucket from the booking form's limiter.
const rateLimited = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 });

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const CONTACT_TIMES = ['morning', 'afternoon', 'evening', 'any'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const THANKS = '/contact/thanks/?type=quote';

const field = (form: FormData, key: string, max: number) => {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
};

/** True for a real calendar date in YYYY-MM-DD form, not before yesterday (UTC). */
function validOccasionDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return false;
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return value >= yesterday;
}

/** Image type from the file's magic bytes, or null if it is not an allowed image. */
function sniffImage(b: Uint8Array): { mime: string; ext: string } | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { mime: 'image/png', ext: 'png' };
  }
  const ascii = (start: number, end: number) => String.fromCharCode(...b.subarray(start, end));
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (b.length >= 12 && ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (brand === 'heic' || brand === 'heix') return { mime: 'image/heic', ext: 'heic' };
    if (brand === 'heif' || brand === 'mif1' || brand === 'msf1') return { mime: 'image/heif', ext: 'heif' };
  }
  return null;
}

export const POST: APIRoute = async ({ request, clientAddress, redirect }) => {
  const wantsJson = request.headers.get('accept')?.includes('application/json');
  const fail = (status: number, error: string) =>
    wantsJson
      ? Response.json({ error }, { status })
      : new Response(`${error} Please go back and try again, or call us.`, { status });
  const succeed = () => (wantsJson ? Response.json({ ok: true }) : redirect(THANKS, 303));

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, 'Invalid form submission.');
  }

  // Bots fill every field; humans never see this one. Pretend success.
  if (field(form, 'website', 200)) return succeed();

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || clientAddress;
  if (rateLimited(ip)) return fail(429, 'Too many requests.');

  const supabase = createServiceClient();
  if (!supabase) {
    console.error('[quote] Supabase service-role client is not configured (SUPABASE_SERVICE_ROLE_KEY / PUBLIC_SUPABASE_URL); request dropped');
    return fail(503, 'Quotes are temporarily unavailable.');
  }

  const dressId = field(form, 'dress_id', 64);
  const dressSlug = field(form, 'dress_slug', 120);
  const name = field(form, 'name', 80);
  const phone = field(form, 'phone', 20);
  const occasionDate = field(form, 'occasion_date', 10);
  const contactTime = field(form, 'contact_time', 20);
  const message = field(form, 'message', 1000);

  if (!name || !/^[0-9+ ]{10,15}$/.test(phone)) {
    return fail(422, 'Please enter your name and a valid phone number.');
  }
  if (occasionDate && !validOccasionDate(occasionDate)) {
    return fail(422, 'Please choose a valid occasion date (today or later).');
  }
  if (contactTime && !(CONTACT_TIMES as readonly string[]).includes(contactTime)) {
    return fail(422, 'Please choose a valid time for us to contact you.');
  }

  // Snapshot the dress name and cover so the request still reads correctly if
  // the dress is later renamed or removed.
  let dressName = 'General enquiry';
  let coverUrl: string | null = null;
  let snapshotDressId: string | null = null;
  if (dressId || dressSlug) {
    if (dressId && !UUID_RE.test(dressId)) return fail(422, 'That dress is no longer available.');
    const query = supabase.from('dresses').select('id, name, photos').eq('published', true);
    const { data, error } = await (dressId ? query.eq('id', dressId) : query.eq('slug', dressSlug)).maybeSingle();
    if (error) {
      console.error('[quote] dress lookup failed:', error.message);
      return fail(502, 'We could not save your request.');
    }
    const dress = data as Pick<Dress, 'id' | 'name' | 'photos'> | null;
    if (!dress) return fail(422, 'That dress is no longer available.');
    snapshotDressId = dress.id;
    dressName = dress.name;
    const cover = Array.isArray(dress.photos) ? dress.photos[0] : undefined;
    coverUrl = cover?.path ? dressPhotoUrl(cover.path) : null;
  }

  let photoPath: string | null = null;
  const photo = form.get('photo');
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) return fail(413, 'The photo is too large (max 5 MB).');
    const unsupported = 'Please attach a JPEG, PNG, WebP or HEIC photo.';
    if (!ALLOWED_MIME.includes(photo.type.toLowerCase())) return fail(415, unsupported);
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) return fail(415, unsupported);

    const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${kind.ext}`;
    const { error } = await supabase.storage
      .from('quote-refs')
      .upload(path, bytes, { contentType: kind.mime, upsert: false });
    if (error) {
      console.error('[quote] photo upload failed:', error.message);
      return fail(502, 'We could not save your request.');
    }
    photoPath = path;
  }

  const row: Omit<QuoteRequest, 'id' | 'created_at'> = {
    dress_id: snapshotDressId,
    dress_name: dressName,
    name,
    phone,
    occasion_date: occasionDate || null,
    contact_time: (contactTime || null) as QuoteRequest['contact_time'],
    message: message || null,
    photo_path: photoPath,
    status: 'new',
    page: request.headers.get('referer')?.slice(0, 500) || null,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('quote_requests')
    .insert(row)
    .select('id')
    .single();
  if (insertError || !inserted) {
    console.error('[quote] insert failed:', insertError?.message ?? 'no row returned');
    if (photoPath) {
      const { error: removeError } = await supabase.storage.from('quote-refs').remove([photoPath]);
      if (removeError) console.error('[quote] could not remove orphaned photo', photoPath, removeError.message);
    }
    return fail(502, 'We could not save your request.');
  }

  try {
    const result = await sendQuoteAlert({
      customerName: name,
      phone,
      dressName,
      occasionDate: occasionDate || null,
      contactTime: contactTime || null,
      coverImageUrl: coverUrl,
      adminQuoteUrl: `${site.url.replace(/\/+$/, '')}/admin/quotes/?id=${inserted.id}`,
    });
    if (result.sent) console.info('[quote] owner alert sent for', inserted.id);
    else console.warn('[quote] owner alert not sent for', inserted.id, `(${result.reason})`);
  } catch (err) {
    console.error('[quote] owner alert threw:', err instanceof Error ? err.name : typeof err);
  }

  return succeed();
};
