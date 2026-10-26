import { getCollection, type CollectionEntry } from 'astro:content';

export type Design = CollectionEntry<'designs'>;

// Inline SVG illustrations, keyed by design slug (src/assets/designs/<slug>.svg).
const svgs = import.meta.glob<string>('../assets/designs/*.svg', { query: '?raw', import: 'default', eager: true });

export function designSvg(slug: string) {
  return svgs[`../assets/designs/${slug}.svg`] ?? '';
}

export async function getDesigns(kind?: 'neck' | 'sleeve'): Promise<Design[]> {
  const all = await getCollection('designs', ({ data }) => !kind || data.kind === kind);
  return all.sort((a, b) => (a.data.kind === b.data.kind ? a.data.order - b.data.order : a.data.kind === 'neck' ? -1 : 1));
}

export { labels } from './designs-labels';
import { labels } from './designs-labels';

export const label = (key: string) => labels[key] ?? key;
