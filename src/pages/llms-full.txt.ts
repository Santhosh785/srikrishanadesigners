// /llms-full.txt: the full Markdown of every service page and published post,
// so an AI assistant can read the whole site in one request.
import type { APIRoute } from 'astro';
import { site, fullAddress, absoluteUrl } from '../site.config';
import { getPosts, getServices, priceRange } from '../lib/content';

const faqText = (faqs: { question: string; answer: string }[]) =>
  faqs.length ? ['### FAQs', ...faqs.map((f) => `**${f.question}**\n${f.answer}\n`)].join('\n') : '';

export const GET: APIRoute = async () => {
  const [services, posts] = await Promise.all([getServices(), getPosts()]);

  const sections = [
    `# ${site.name}\n\n> ${site.description}\n\nAddress: ${fullAddress}. Hours: ${site.hoursDisplay}. Phone/WhatsApp: ${site.phoneDisplay}.`,
    ...services.map((s) =>
      [
        `## ${s.data.title}`,
        `URL: ${absoluteUrl(`/services/${s.id}/`)}`,
        `Price: ${priceRange(s.data.priceFrom, s.data.priceTo)} · Turnaround: ${s.data.turnaround}`,
        '',
        s.data.answer,
        '',
        s.body ?? '',
        faqText(s.data.faqs),
      ].join('\n'),
    ),
    ...posts
      .filter((p) => !p.data.draft)
      .map((p) =>
        [
          `## ${p.data.title}`,
          `URL: ${absoluteUrl(`/blog/${p.id}/`)} · Updated: ${(p.data.updatedDate ?? p.data.pubDate).toISOString().slice(0, 10)}`,
          '',
          p.data.answer,
          '',
          p.body ?? '',
          faqText(p.data.faqs),
        ].join('\n'),
      ),
  ];

  return new Response(sections.join('\n\n---\n\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
