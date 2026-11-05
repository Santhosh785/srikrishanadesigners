// Sitemap for the on-demand dress pages. @astrojs/sitemap only lists
// prerendered routes, so dresses get their own sitemap (linked from robots.txt).
import type { APIRoute } from 'astro';
import { absoluteUrl } from '../site.config';
import { listDresses } from '../lib/dresses';

export const prerender = false;

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const isoDate = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? null : d.toISOString();
};

export const GET: APIRoute = async () => {
  const dresses = await listDresses();
  // /dresses/ is noindex while the catalogue is empty, so it is listed only once there are dresses.
  const urls = dresses.length === 0 ? [] : [
    `  <url><loc>${xmlEscape(absoluteUrl('/dresses/'))}</loc></url>`,
    ...dresses.map((d) => {
      const lastmod = isoDate(d.updated_at);
      const loc = xmlEscape(absoluteUrl(`/dresses/${encodeURIComponent(d.slug)}/`));
      return `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
    }),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `${u}\n`).join('')}</urlset>\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
  });
};
