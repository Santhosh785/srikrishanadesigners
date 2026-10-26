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

## Content structure

- **Tools** (`src/pages/tools/`, `/designs/`): cost estimator, measurement card, bridal timeline planner,
  design finder. Results go to WhatsApp or the bookings Sheet (`source` column = tool).
- **Prices**: blouse types, extras, embroidery levels and express % live in Keystatic → *Price list*
  (`src/data/pricing.json`); neck/sleeve add-ons live on each design (`src/content/designs/*.md`).
- **Blog clusters**: blouse design & fit (pillar `blouse-design-guide`), bridal planning
  (`bridal-blouse-planning-guide`), fabrics & care (`blouse-fabric-guide`), salwar/kurti
  (`salwar-kurti-styles-guide`). New posts should link to their pillar, one tool and one service.

### Brief for a new blog post (aim for ~2 a month)

1. **Question** — the exact thing customers ask (WhatsApp/phone is the best source).
2. **Short answer** — 40–60 words, answer in the first sentence (Keystatic "Short answer").
3. **Sections** — 4–6 H2s phrased as questions; include one list and, where natural, a table.
4. **Links** — its cluster pillar, one tool (`/tools/...` or `/designs/`), one service page.
5. **FAQs** — 3–4 follow-up questions with 1–3 sentence answers.
6. **Proof** — a photo of the studio's own work beats any stock image.

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
    b.submittedAt, b.source, b.name, b.phone, b.service, b.date, b.occasion, b.message, b.details, b.page,
  ]);
  return ContentService.createTextOutput('ok');
}
```

### After the real domain is live

- Verify **Google Search Console** and **Bing Webmaster Tools** (Bing feeds ChatGPT search and
  Copilot); paste the tokens into `site.verification` and submit `/sitemap-index.xml`.
- Ping IndexNow after each deploy: `node scripts/indexnow.mjs`.
- Put the site URL in the Google Business Profile "Website" field.
