import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import keystatic from '@keystatic/astro';
import { readdirSync } from 'node:fs';
import { site } from './src/site.config.ts';

// /gallery/ is noindex while it has no photos, so keep it out of the sitemap too.
const hasGallery = readdirSync('./src/content/gallery').some((f) => f.endsWith('.yaml'));

// Pages are prerendered to static HTML. Only Keystatic's admin/API routes and
// /api/booking run on demand, which is why the Node adapter is needed.
export default defineConfig({
  site: site.url,
  trailingSlash: 'always',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  // React is only used by the Keystatic admin UI; public pages ship no React.
  integrations: [
    react(),
    keystatic(),
    sitemap({
      filter: (page) =>
        !page.includes('/keystatic') &&
        !page.includes('/api/') &&
        !page.includes('/admin/') &&
        !page.includes('/contact/thanks/') &&
        !page.includes('/blog/tag/') &&
        !page.includes('/dresses/') && // on-demand; listed in /sitemap-dresses.xml
        (hasGallery || !page.endsWith('/gallery/')),
      i18n: { defaultLocale: 'en', locales: { en: 'en-IN' } },
    }),
  ],
  // Coolify's proxy terminates TLS; trusting X-Forwarded-Host/Proto for the
  // real domain keeps Astro.url (and the form-submission origin check) on https.
  security: {
    allowedDomains: [{ protocol: 'https', hostname: new URL(site.url).hostname }],
  },
  // English only at launch. A regional language (e.g. 'ta') is added by
  // listing it here and creating src/pages/ta/ — URLs for English stay put.
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
    routing: { prefixDefaultLocale: false },
  },
  env: {
    schema: {
      // Build-time: set on staging so nothing gets indexed before launch.
      SITE_NOINDEX: envField.boolean({ context: 'server', access: 'public', default: false }),
      // Runtime secret: Google Apps Script web-app URL that appends booking rows.
      BOOKING_SHEET_WEBHOOK_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Supabase (dress catalogue). Public URL + anon key are safe in the browser.
      PUBLIC_SUPABASE_URL: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_SUPABASE_ANON_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      // RelayOne WhatsApp alert to the owner; alert is skipped when any is missing.
      RELAYONE_API_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      RELAYONE_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      RELAYONE_TEMPLATE: envField.string({ context: 'server', access: 'secret', optional: true }),
      OWNER_WHATSAPP: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
