# Sri Krishna Designers — website

Astro 7 site for a women's tailoring studio, built to rank in local search and be cited by AI
assistants (SEO + GEO + AEO). Pages are prerendered static HTML; only the Keystatic editor and the
booking endpoint run on the Node server.

## Stack

- **Astro 7** (`output: 'static'` + `@astrojs/node` standalone), zero client JS except the mobile
  menu, booking form and optional GA4.
- **Content collections** in `src/content/` (`blog`, `services`, `authors`, `reviews`, `gallery`),
  typed in `src/content.config.ts`.
- **Keystatic** browser editor at `/keystatic` — commits to GitHub in production (→ Coolify redeploy),
  edits local files in `npm run dev`. Schema in `keystatic.config.ts` mirrors the content config.
- **Self-hosted fonts** (Fontsource) and `astro:assets` image optimisation.

## Where things live

| What | File |
|---|---|
| Business facts (name, address, phone, hours, socials, domain) | `src/site.config.ts` |
| JSON-LD builders (LocalBusiness, Service, BlogPosting, FAQPage, Breadcrumbs) | `src/lib/schema.ts` |
| `<head>` SEO, site-wide schema, layout | `src/layouts/BaseLayout.astro` |
| AI crawler access, sitemap pointer | `src/pages/robots.txt.ts` |
| LLM summaries | `src/pages/llms.txt.ts`, `src/pages/llms-full.txt.ts` |
| Booking form → Google Sheet | `src/pages/contact/index.astro`, `src/pages/api/booking.ts` |

## Before launch

1. Fill every placeholder: `grep -rn TODO_FILL src` must print nothing. NAP must match the Google
   Business Profile character for character.
2. Replace `src/assets/photos/hero.jpg` (stock photo) with an original photo of the studio's work.
3. Add real reviews and gallery photos through `/keystatic`.
4. Confirm prices in `src/content/services/*.md`, then publish `blog/blouse-stitching-cost-guide.md`
   (`draft: false`).

## Develop

Requires Node ≥ 22.23.4.

```sh
npm install
npm run dev        # http://localhost:4321, editor at /keystatic
npm run build
npm run preview    # serves dist/ with the Node server
```

## Deploy (Coolify)

Dockerfile build, port 4321. Environment variables (see `.env.example`):

- `SITE_NOINDEX=true` as a **build** variable on staging only.
- `BOOKING_SHEET_WEBHOOK_URL` — runtime.
- `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET`,
  `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` — created by visiting `/keystatic` once on the deployed site and
  following the "Create GitHub App" flow (callback URL: `https://<domain>/api/keystatic/github/oauth/callback`).

### Booking Sheet webhook

In the bookings Google Sheet: Extensions → Apps Script, paste, then Deploy → Web app (execute as
*Me*, access *Anyone*) and put the URL in `BOOKING_SHEET_WEBHOOK_URL`.

```js
function doPost(e) {
  const b = JSON.parse(e.postData.contents);
  SpreadsheetApp.getActiveSheet().appendRow([
    b.submittedAt, b.name, b.phone, b.service, b.date, b.occasion, b.message, b.page,
  ]);
  return ContentService.createTextOutput('ok');
}
```

### After the real domain is live

- Verify **Google Search Console** and **Bing Webmaster Tools** (Bing feeds ChatGPT search and
  Copilot); paste the tokens into `site.verification` and submit `/sitemap-index.xml`.
- Ping IndexNow after each deploy: `node scripts/indexnow.mjs`.
- Put the site URL in the Google Business Profile "Website" field.
