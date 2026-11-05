// Booking form endpoint. Validates the submission, drops bots (honeypot +
// per-IP rate limit) and forwards the row to a Google Apps Script web app
// that appends it to the bookings Sheet.
import type { APIRoute } from 'astro';
import { BOOKING_SHEET_WEBHOOK_URL } from 'astro:env/server';
import { createRateLimiter } from '../../lib/rate-limit';

export const prerender = false;

const rateLimited = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 });

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
    // Set by the tools (cost estimator, measurement card, …) so the Sheet
    // shows where a lead came from and what they worked out.
    source: field(form, 'source', 40) || 'booking-form',
    details: field(form, 'details', 2000),
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
