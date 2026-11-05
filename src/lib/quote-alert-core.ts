// Pure logic behind sendQuoteAlert() (see ./quote-alert.ts). It takes its
// config as a parameter and never imports astro:env, so the tests in
// tests/quote-alert.test.ts can run it with plain Node and a mocked fetch.
//
// Contract: sendQuoteAlertWith() NEVER throws or rejects. Every failure comes
// back as { sent: false, reason }, so a quote request is never lost because
// WhatsApp is down.

export type QuoteAlertInput = {
  customerName: string;
  phone: string;
  dressName: string;
  occasionDate: string | null;
  contactTime: string | null;
  adminQuoteUrl: string;
  coverImageUrl: string | null;
};

export type QuoteAlertResult = { sent: true } | { sent: false; reason: string };

export type QuoteAlertConfig = {
  apiUrl: string | undefined;
  apiKey: string | undefined;
  template: string | undefined;
  ownerWhatsapp: string | undefined;
};

/** Per-process state; tests pass a fresh object to check "warn once". */
export type QuoteAlertState = { warnedNotConfigured: boolean };

const MAX_PARAM = 100;
const TIMEOUT_MS = 8000;
const LOG = '[quote-alert]';

const defaultState: QuoteAlertState = { warnedNotConfigured: false };

/** Collapse whitespace/control chars to single spaces and trim. */
export function collapseWhitespace(value: unknown): string {
  return String(value ?? '')
    .replace(/[\s\u0000-\u001f\u007f]+/g, ' ')
    .trim();
}

/**
 * WhatsApp rejects template params containing \n, \t or 4+ consecutive
 * spaces. Collapse them, trim, cap at 100 chars; empty becomes '-'.
 */
export function sanitiseParam(value: unknown): string {
  let s = collapseWhitespace(value);
  if (s.length > MAX_PARAM) {
    s = s.slice(0, MAX_PARAM);
    // Don't leave half of a surrogate pair (emoji) at the cut.
    if (/[\ud800-\udbff]$/.test(s)) s = s.slice(0, -1);
    s = s.trimEnd();
  }
  return s || '-';
}

/** Builds the 6 body params ({{1}}..{{6}}), or null if the URL is too long. */
export function buildBodyParams(input: QuoteAlertInput): string[] | null {
  // The admin URL must never be cut: a truncated link is worse than no alert.
  const url = collapseWhitespace(input.adminQuoteUrl) || '-';
  if (url.length > MAX_PARAM) return null;
  return [
    sanitiseParam(input.customerName),
    sanitiseParam(input.phone),
    sanitiseParam(input.dressName),
    sanitiseParam(input.occasionDate ?? '-'),
    sanitiseParam(input.contactTime ?? 'any'),
    url,
  ];
}

function errorCode(text: string): string {
  try {
    const body = JSON.parse(text) as { error?: unknown };
    const err = body?.error;
    // RelayOne v1 sends { error: { code, message } }; tolerate { error: "code" }.
    const code =
      typeof err === 'string'
        ? err
        : err && typeof err === 'object' && typeof (err as { code?: unknown }).code === 'string'
          ? (err as { code: string }).code
          : '';
    return collapseWhitespace(code).slice(0, 80) || 'unknown';
  } catch {
    return 'non-json-body';
  }
}

export async function sendQuoteAlertWith(
  config: QuoteAlertConfig,
  input: QuoteAlertInput,
  state: QuoteAlertState = defaultState,
): Promise<QuoteAlertResult> {
  try {
    const apiUrl = config.apiUrl?.trim();
    const apiKey = config.apiKey?.trim();
    const template = config.template?.trim();
    const to = config.ownerWhatsapp?.trim();
    if (!apiUrl || !apiKey || !template || !to) {
      if (!state.warnedNotConfigured) {
        state.warnedNotConfigured = true;
        console.warn(
          `${LOG} WhatsApp quote alerts are off: set RELAYONE_API_URL, RELAYONE_API_KEY, RELAYONE_TEMPLATE and OWNER_WHATSAPP.`,
        );
      }
      return { sent: false, reason: 'not-configured' };
    }

    const body = buildBodyParams(input);
    if (!body) {
      console.error(`${LOG} adminQuoteUrl is longer than ${MAX_PARAM} chars; alert not sent.`);
      return { sent: false, reason: 'param-too-long' };
    }

    const params: { body: string[]; headerMediaUrl?: string } = { body };
    const cover = input.coverImageUrl?.trim();
    if (cover) params.headerMediaUrl = cover;

    let res: Response;
    try {
      res = await fetch(`${apiUrl.replace(/\/+$/, '')}/api/v1/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          type: 'template',
          template: { name: template, language: 'en', params },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : typeof err;
      console.error(`${LOG} RelayOne request failed: ${name}`);
      // The only abort source is our own timeout signal.
      const timedOut = name === 'TimeoutError' || name === 'AbortError';
      return { sent: false, reason: timedOut ? 'timeout' : 'network' };
    }

    if (res.ok) {
      // Success is 201 { data: { message_id, ... } }; nothing in it is needed.
      res.body?.cancel().catch(() => {});
      return { sent: true };
    }

    let text = '';
    try {
      text = await res.text();
    } catch {
      // Body unreadable (e.g. timed out mid-stream); the status is enough.
    }
    console.error(`${LOG} RelayOne responded ${res.status} (error: ${errorCode(text)})`);
    return { sent: false, reason: `http-${res.status}` };
  } catch (err) {
    // Belt and braces: never let an alert failure break the caller.
    console.error(`${LOG} unexpected error: ${err instanceof Error ? err.name : typeof err}`);
    return { sent: false, reason: 'error' };
  }
}
