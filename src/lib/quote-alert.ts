// Server-only: WhatsApp alert to the shop owner when a dress quote request
// arrives, sent through the RelayOne public API (POST /api/v1/messages).
// Only caller: the quote endpoint. Never import this from client code; it
// reads secrets from astro:env/server. The logic lives in ./quote-alert-core
// (tested by tests/quote-alert.test.ts).
//
// Config (runtime secrets, all optional; alerts are skipped when any is empty):
//   RELAYONE_API_URL   e.g. https://app.relayone.io (trailing slash is fine)
//   RELAYONE_API_KEY   relay_live_... key with scope `messages:send`
//   RELAYONE_TEMPLATE  approved WhatsApp template name, e.g. quote_request_alert
//   OWNER_WHATSAPP     owner's number in E.164, e.g. +919876543210
//
// MANUAL STEP: create this WhatsApp template in RelayOne and wait for Meta to
// APPROVE it before live sends succeed:
//   - Category: Utility. Language: English (`en`).
//   - Name: exactly the value of RELAYONE_TEMPLATE (e.g. quote_request_alert).
//   - Header: IMAGE (upload a sample dress photo at submission; RelayOne
//     falls back to that sample when a dress has no cover image).
//   - Body:
//       New quote request from {{1}} ({{2}}) for {{3}}. Occasion: {{4}}. Best time: {{5}}. Open: {{6}}
//     {{1}} customer name, {{2}} phone, {{3}} dress name, {{4}} occasion date
//     ('-' if none), {{5}} contact time ('any' if none), {{6}} admin quote URL.
//   - No buttons.
import {
  OWNER_WHATSAPP,
  RELAYONE_API_KEY,
  RELAYONE_API_URL,
  RELAYONE_TEMPLATE,
} from 'astro:env/server';
import { sendQuoteAlertWith, type QuoteAlertInput, type QuoteAlertResult } from './quote-alert-core';

export type { QuoteAlertInput, QuoteAlertResult } from './quote-alert-core';

/** Alerts the owner on WhatsApp. Never throws; check `sent` and move on. */
export function sendQuoteAlert(input: QuoteAlertInput): Promise<QuoteAlertResult> {
  return sendQuoteAlertWith(
    {
      apiUrl: RELAYONE_API_URL,
      apiKey: RELAYONE_API_KEY,
      template: RELAYONE_TEMPLATE,
      ownerWhatsapp: OWNER_WHATSAPP,
    },
    input,
  );
}
