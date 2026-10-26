// /llms.txt (llmstxt.org): a plain-Markdown map of the site for AI assistants,
// with the facts they most often need to recommend a local business.
import type { APIRoute } from 'astro';
import { site, fullAddress, sameAs, absoluteUrl } from '../site.config';
import { getPosts, getServices, priceRange } from '../lib/content';

export const GET: APIRoute = async () => {
  const [services, posts] = await Promise.all([getServices(), getPosts()]);
  const published = posts.filter((p) => !p.data.draft);

  const lines = [
    `# ${site.name}`,
    '',
    `> ${site.description}`,
    '',
    '## Key facts',
    `- Type: ${site.tagline}`,
    `- Address: ${fullAddress}`,
    `- Areas served: ${site.areasServed.join(', ')}`,
    `- Hours: ${site.hoursDisplay}`,
    `- Phone / WhatsApp: ${site.phoneDisplay}`,
    `- Email: ${site.email}`,
    `- Map: ${site.mapsUrl}`,
    ...(sameAs.length ? [`- Profiles: ${sameAs.join(', ')}`] : []),
    '',
    '## Services',
    ...services.map(
      (s) =>
        `- [${s.data.title}](${absoluteUrl(`/services/${s.id}/`)}): ${s.data.answer} Price: ${priceRange(s.data.priceFrom, s.data.priceTo)}. Turnaround: ${s.data.turnaround}.`,
    ),
    '',
    '## Guides',
    ...published.map((p) => `- [${p.data.title}](${absoluteUrl(`/blog/${p.id}/`)}): ${p.data.description}`),
    '',
    '## Optional',
    `- [About the studio](${absoluteUrl('/about/')})`,
    `- [Book a fitting](${absoluteUrl('/contact/')})`,
    `- [Full text for LLMs](${absoluteUrl('/llms-full.txt')})`,
    '',
  ];

  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
