// Booking form endpoint. Validates the submission, drops bots (honeypot +
// per-IP rate limit) and forwards the row to a Google Apps Script web app
// that appends it to the bookings Sheet.
import type { APIRoute } from 'astro';
import { BOOKING_SHEET_WEBHOOK_URL } from 'astro:env/server';

export const prerender = false;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

const field = (form: FormData, key: string, max: number) =>
  String(form.get(key) ?? '').trim().slice(0, max);

export const POST: APIRoute = async ({ request, clientAddress, redirect }) => {
  const wantsJson = request.headers.get('accept')?.includes('application/json');
  const fail = (status: number, error: string) =>
    wantsJson
      ? Response.json({ error }, { status })
      : new Response(`${error} Please go back and try again, or call us.`, { status });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, 'Invalid form submission.');
  }

  // Bots fill every field; humans never see this one. Pretend success.
  if (field(form, 'website', 200)) {
    return wantsJson ? Response.json({ ok: true }) : redirect('/contact/thanks/', 303);
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || clientAddress;
  if (rateLimited(ip)) return fail(429, 'Too many requests.');

  const booking = {
    name: field(form, 'name', 80),
    phone: field(form, 'phone', 20),
    service: field(form, 'service', 80),
    date: field(form, 'date', 10),
    occasion: field(form, 'occasion', 10),
    message: field(form, 'message', 1000),
    submittedAt: new Date().toISOString(),
    page: request.headers.get('referer') ?? '',
  };

  if (!booking.name || !/^[0-9+ ]{10,15}$/.test(booking.phone) || !booking.service) {
    return fail(422, 'Please enter your name, a valid phone number and a service.');
  }

  if (!BOOKING_SHEET_WEBHOOK_URL) {
    console.error('[booking] BOOKING_SHEET_WEBHOOK_URL is not set; submission dropped', booking.service);
    return fail(503, 'Online booking is temporarily unavailable.');
  }

  try {
    // Apps Script answers with a 302 to googleusercontent.com; fetch follows it.
    const res = await fetch(BOOKING_SHEET_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(booking),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Sheet webhook responded ${res.status}`);
  } catch (err) {
    console.error('[booking] forwarding failed:', err);
    return fail(502, 'We could not save your request.');
  }

  return wantsJson ? Response.json({ ok: true }) : redirect('/contact/thanks/', 303);
};
