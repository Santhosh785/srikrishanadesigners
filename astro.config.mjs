import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import keystatic from '@keystatic/astro';
import { site } from './src/site.config.ts';

// Keystatic's browser client calls /api/keystatic/... without a trailing slash,
// which `trailingSlash: 'always'` turns into a 404 in `astro dev` (the local
// editor then fails with a JSON parse error). Dev-only: add the slash before
// Astro routes the request. Public URLs and the production build are untouched.
const keystaticApiSlash = {
  name: 'keystatic-api-trailing-slash',
  enforce: 'post',
  configureServer(server) {
    // Astro puts its own trailing-slash check at the front of the stack in a
    // post hook, so this has to be unshifted ahead of it from a later post hook.
    return () => {
      server.middlewares.stack.unshift({
        route: '',
        handle: (req, _res, next) => {
          const [path, query] = (req.url ?? '').split('?');
          if (path.startsWith('/api/keystatic/') && !path.endsWith('/')) {
            req.url = path + '/' + (query === undefined ? '' : '?' + query);
          }
          next();
        },
      });
    };
  },
};

// Pages are prerendered to static HTML. Only Keystatic's admin/API routes and
// /api/booking run on demand, which is why the Node adapter is needed.
export default defineConfig({
  site: site.url,
  trailingSlash: 'always',
  output: 'static',
  // The old photo gallery was replaced by the dress catalogue. The destination
  // is the route id without its trailing slash so Astro matches it to
  // src/pages/dresses/index.astro: the explicit 301 then applies to every
  // method (HEAD included) and the Location still gets the trailing slash.
  redirects: {
    '/gallery/': { status: 301, destination: '/dresses' },
  },
  adapter: node({ mode: 'standalone' }),
  vite: { plugins: [keystaticApiSlash] },
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
        !page.includes('/dresses/'), // on-demand; listed in /sitemap-dresses.xml
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
