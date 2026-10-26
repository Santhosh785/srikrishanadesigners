import type { APIRoute } from 'astro';
import { SITE_NOINDEX } from 'astro:env/server';
import { absoluteUrl } from '../site.config';

// Search and AI-assistant crawlers are welcomed by name: being readable by
// them is how the studio gets cited in ChatGPT, Claude, Perplexity, Gemini
// and Copilot answers.
const aiAndSearchBots = [
  'Googlebot', 'Bingbot', 'Google-Extended', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User',
  'Applebot', 'Applebot-Extended', 'DuckDuckBot', 'Amazonbot', 'meta-externalagent', 'CCBot',
];

export const GET: APIRoute = () => {
  const body = SITE_NOINDEX
    ? 'User-agent: *\nDisallow: /\n'
    : [
        ...aiAndSearchBots.map((ua) => `User-agent: ${ua}`),
        'Allow: /',
        'Disallow: /keystatic/',
        'Disallow: /api/',
        '',
        'User-agent: *',
        'Allow: /',
        'Disallow: /keystatic/',
        'Disallow: /api/',
        '',
        `Sitemap: ${absoluteUrl('/sitemap-index.xml')}`,
        '',
      ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
