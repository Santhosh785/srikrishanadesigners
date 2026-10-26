// /llms.txt (llmstxt.org): a plain-Markdown map of the site for AI assistants,
// with the facts they most often need to recommend a local business.
import type { APIRoute } from 'astro';
import { site, fullAddress, sameAs, absoluteUrl } from '../site.config';
import { getPosts, getServices, priceRange } from '../lib/content';
import { getDesigns } from '../lib/designs';
import { tools } from '../lib/tools';

export const GET: APIRoute = async () => {
  const [services, posts, designs] = await Promise.all([getServices(), getPosts(), getDesigns()]);
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
    '## Free tools',
    ...tools.map((t) => `- [${t.name}](${absoluteUrl(t.path)}): ${t.blurb}`),
    '',
    '## Blouse designs',
    ...designs.map((d) => `- [${d.data.title}](${absoluteUrl(`/designs/${d.id}/`)}): ${d.data.answer}`),
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
