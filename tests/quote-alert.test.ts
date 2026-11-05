// Tests for src/lib/quote-alert-core.ts (the logic behind sendQuoteAlert).
// No dependencies and no network: globalThis.fetch is replaced by a mock.
//
// Run (Node 24 strips the TypeScript types natively):
//   npx -y node@24 --test tests/quote-alert.test.ts
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  sendQuoteAlertWith,
  type QuoteAlertConfig,
  type QuoteAlertInput,
} from '../src/lib/quote-alert-core.ts';

const config: QuoteAlertConfig = {
  apiUrl: 'https://relay.example.test/',
  apiKey: 'relay_live_testkey123',
  template: 'quote_request_alert',
  ownerWhatsapp: '+919876543210',
};

const input: QuoteAlertInput = {
  customerName: 'Priya Raman',
  phone: '+919000011111',
  dressName: 'Silk Lehenga',
  occasionDate: '2026-12-01',
  contactTime: 'evening',
  adminQuoteUrl: 'https://srikrishnadesigners.in/admin/quotes/abc123',
  coverImageUrl: 'https://cdn.example.test/dress.jpg',
};

type Call = { url: string; init: RequestInit };
let calls: Call[];
let respond: (call: Call) => Promise<Response>;
let logs: { level: string; text: string }[];
const realFetch = globalThis.fetch;
const realWarn = console.warn;
const realError = console.error;
const fresh = () => ({ warnedNotConfigured: false });

beforeEach(() => {
  calls = [];
  logs = [];
  respond = async () =>
    new Response(JSON.stringify({ data: { message_id: 'm1', whatsapp_message_id: 'w1', conversation_id: 'c1', contact_id: 'k1' } }), { status: 201 });
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  console.warn = (...a: unknown[]) => logs.push({ level: 'warn', text: a.map(String).join(' ') });
  console.error = (...a: unknown[]) => logs.push({ level: 'error', text: a.map(String).join(' ') });
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.warn = realWarn;
  console.error = realError;
});

const sentBody = (i = 0) => JSON.parse(String(calls[i].init.body));
const noSecretsLogged = () => {
  for (const l of logs) {
    assert.ok(!l.text.includes(config.apiKey!), 'API key logged');
    assert.ok(!l.text.includes('9876543210') && !l.text.includes('9000011111'), 'phone logged');
  }
};

test('configured: posts the template message and returns sent:true on 201', async () => {
  const result = await sendQuoteAlertWith(config, input, fresh());
  assert.deepEqual(result, { sent: true });
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url, 'https://relay.example.test/api/v1/messages'); // trailing slash stripped
  assert.equal(init.method, 'POST');
  const headers = init.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer relay_live_testkey123');
  assert.equal(headers['Content-Type'], 'application/json');
  assert.ok(init.signal instanceof AbortSignal);
  assert.deepEqual(sentBody(), {
    to: '+919876543210',
    type: 'template',
    template: {
      name: 'quote_request_alert',
      language: 'en',
      params: {
        body: [
          'Priya Raman',
          '+919000011111',
          'Silk Lehenga',
          '2026-12-01',
          'evening',
          'https://srikrishnadesigners.in/admin/quotes/abc123',
        ],
        headerMediaUrl: 'https://cdn.example.test/dress.jpg',
      },
    },
  });
  assert.equal(sentBody().template.params.body.length, 6);
});

test('null handling: date/time fallbacks and no headerMediaUrl', async () => {
  const result = await sendQuoteAlertWith(
    config,
    { ...input, occasionDate: null, contactTime: null, coverImageUrl: null },
    fresh(),
  );
  assert.deepEqual(result, { sent: true });
  const params = sentBody().template.params;
  assert.equal(params.body[3], '-');
  assert.equal(params.body[4], 'any');
  assert.equal(params.body.length, 6);
  assert.ok(!('headerMediaUrl' in params));
});

test('unconfigured: each missing/empty var skips fetch, warns once, never throws', async () => {
  const state = fresh();
  const keys = ['apiUrl', 'apiKey', 'template', 'ownerWhatsapp'] as const;
  for (const key of keys) {
    for (const value of [undefined, '', '   ']) {
      const result = await sendQuoteAlertWith({ ...config, [key]: value }, input, state);
      assert.deepEqual(result, { sent: false, reason: 'not-configured' }, `${key}=${value}`);
    }
  }
  assert.equal(calls.length, 0);
  assert.equal(logs.filter((l) => l.level === 'warn').length, 1);
});

test('non-2xx: 401 invalid_api_key returns http-401 and logs status + code', async () => {
  respond = async () => new Response(JSON.stringify({ error: 'invalid_api_key' }), { status: 401 });
  const result = await sendQuoteAlertWith(config, input, fresh());
  assert.deepEqual(result, { sent: false, reason: 'http-401' });
  const err = logs.find((l) => l.level === 'error');
  assert.ok(err && err.text.includes('401') && err.text.includes('invalid_api_key'), err?.text);
  noSecretsLogged();
});

test('non-2xx: RelayOne v1 { error: { code } } shape and non-JSON body', async () => {
  respond = async () =>
    new Response(JSON.stringify({ error: { code: 'forbidden', message: 'missing scope' } }), { status: 403 });
  assert.deepEqual(await sendQuoteAlertWith(config, input, fresh()), { sent: false, reason: 'http-403' });
  assert.ok(logs.at(-1)!.text.includes('403') && logs.at(-1)!.text.includes('forbidden'));

  respond = async () => new Response('<html>Bad Gateway</html>', { status: 502 });
  assert.deepEqual(await sendQuoteAlertWith(config, input, fresh()), { sent: false, reason: 'http-502' });
  assert.ok(logs.at(-1)!.text.includes('502'));
  noSecretsLogged();
});

test('timeout/abort returns sent:false reason timeout, no throw', async () => {
  respond = async () => {
    throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  };
  assert.deepEqual(await sendQuoteAlertWith(config, input, fresh()), { sent: false, reason: 'timeout' });
  respond = async () => {
    throw new DOMException('This operation was aborted', 'AbortError');
  };
  assert.deepEqual(await sendQuoteAlertWith(config, input, fresh()), { sent: false, reason: 'timeout' });
  assert.ok(logs.some((l) => l.level === 'error' && l.text.includes('TimeoutError')));
  noSecretsLogged();
});

test('timeout signal: uses AbortSignal.timeout(8000) and a hanging fetch resolves as timeout', async () => {
  // Swap AbortSignal.timeout for a controller we fire ourselves (no 8 s wait).
  const realTimeout = AbortSignal.timeout;
  const controller = new AbortController();
  let requestedMs = 0;
  AbortSignal.timeout = (ms: number) => {
    requestedMs = ms;
    return controller.signal;
  };
  try {
    // A fetch that only settles when its signal aborts, like real fetch.
    respond = ({ init }) =>
      new Promise((_, reject) => {
        init.signal!.addEventListener('abort', () => reject(init.signal!.reason));
      });
    const pending = sendQuoteAlertWith(config, input, fresh());
    controller.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    assert.deepEqual(await pending, { sent: false, reason: 'timeout' });
    assert.equal(requestedMs, 8000);
    assert.equal(calls[0].init.signal, controller.signal);
  } finally {
    AbortSignal.timeout = realTimeout;
  }
});

test('network rejection returns sent:false reason network, no throw', async () => {
  respond = async () => {
    throw new TypeError('fetch failed');
  };
  assert.deepEqual(await sendQuoteAlertWith(config, input, fresh()), { sent: false, reason: 'network' });
  assert.ok(logs.some((l) => l.level === 'error' && l.text.includes('TypeError')));
  noSecretsLogged();
});

test('sanitising: \\n, \\t, long runs of spaces and 200-char inputs', async () => {
  const long = 'x'.repeat(200);
  await sendQuoteAlertWith(
    config,
    {
      customerName: 'Priya\n\nRaman\t\tK',
      phone: '  +91 90000\t11111  ',
      dressName: long,
      occasionDate: 'Dec    1\r\n2026',
      contactTime: `${'a'.repeat(150)}\n${'b'.repeat(60)}`,
      adminQuoteUrl: ' https://example.test/admin/q/1\n',
      coverImageUrl: null,
    },
    fresh(),
  );
  const body: string[] = sentBody().template.params.body;
  assert.equal(body.length, 6);
  for (const s of body) {
    assert.ok(!/[\n\r\t]/.test(s), JSON.stringify(s));
    assert.ok(!/ {2,}/.test(s), JSON.stringify(s));
    assert.ok(s.length <= 100 && s.length > 0, `${s.length}`);
    assert.equal(s, s.trim());
  }
  assert.equal(body[0], 'Priya Raman K');
  assert.equal(body[1], '+91 90000 11111');
  assert.equal(body[2], 'x'.repeat(100));
  assert.equal(body[3], 'Dec 1 2026');
  assert.equal(body[5], 'https://example.test/admin/q/1');
});

test('empty strings become "-"', async () => {
  await sendQuoteAlertWith(config, { ...input, customerName: ' \n\t ', dressName: '' }, fresh());
  const body: string[] = sentBody().template.params.body;
  assert.equal(body[0], '-');
  assert.equal(body[2], '-');
});

test('adminQuoteUrl over 100 chars fails loudly instead of truncating', async () => {
  const result = await sendQuoteAlertWith(
    config,
    { ...input, adminQuoteUrl: `https://example.test/${'a'.repeat(100)}` },
    fresh(),
  );
  assert.deepEqual(result, { sent: false, reason: 'param-too-long' });
  assert.equal(calls.length, 0);
});

test('garbage input never throws', async () => {
  const result = await sendQuoteAlertWith(config, null as unknown as QuoteAlertInput, fresh());
  assert.equal(result.sent, false);
});
