import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;
export type Service = CollectionEntry<'services'>;

// Drafts are visible in `astro dev` so editors can preview them.
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getServices(): Promise<Service[]> {
  const services = await getCollection('services');
  return services.sort((a, b) => a.data.order - b.data.order);
}

export async function getReviews() {
  const reviews = await getCollection('reviews');
  return reviews.map((r) => r.data).sort((a, b) => b.date.valueOf() - a.date.valueOf());
}

export function tagSlug(tag: string) {
  return tag.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function wordCount(markdown: string | undefined) {
  return (markdown ?? '').split(/\s+/).filter(Boolean).length;
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export function priceRange(from: number, to?: number | null) {
  return to ? `${inr.format(from)} – ${inr.format(to)}` : `From ${inr.format(from)}`;
}

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export function formatDate(d: Date) {
  return dateFmt.format(d);
}
