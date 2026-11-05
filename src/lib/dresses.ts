// Server-only reads of the public dress catalogue (Supabase `dresses` table).
// Only published rows are visible to the anon key (RLS), and we filter on
// `published` too. Results are cached in memory for 60 s so a newly published
// dress shows up within a minute without a rebuild. Every function returns
// [] / null instead of throwing when Supabase is not configured or errors,
// so builds and pages keep working without the env vars.
import { createPublicClient } from './supabase';
import type { Dress, DressCategory } from './dress-types';
import { getServices } from './content';

const TTL_MS = 60 * 1000;
// Give up on Supabase after this long so server islands don't hang when it is unreachable.
const FETCH_TIMEOUT_MS = 3000;
const cache = new Map<string, { at: number; value: unknown }>();

// Failed loads (thrown errors) return the fallback and are not cached, so a
// transient Supabase error doesn't hide the catalogue for a whole minute.
async function cached<T>(key: string, fallback: T, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  try {
    const value = await load();
    // Keys include visitor-supplied slugs/tags, so keep the map bounded.
    if (cache.size >= 500) {
      for (const [k, v] of cache) if (Date.now() - v.at >= TTL_MS) cache.delete(k);
      if (cache.size >= 500) cache.clear();
    }
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return fallback;
  }
}

const COLUMNS = 'id, slug, name, category, description, tags, photos, published, sort, created_at, updated_at';

function baseQuery() {
  const client = createPublicClient({ timeoutMs: FETCH_TIMEOUT_MS });
  if (!client) return null;
  return client
    .from('dresses')
    .select(COLUMNS)
    .eq('published', true)
    .order('sort', { ascending: true })
    .order('created_at', { ascending: false });
}

function normalise(row: Dress): Dress {
  return {
    ...row,
    tags: Array.isArray(row.tags) ? row.tags : [],
    photos: Array.isArray(row.photos) ? row.photos : [],
  };
}

async function fetchList(opts: { category?: DressCategory; tag?: string; limit?: number }): Promise<Dress[]> {
  let q = baseQuery();
  if (!q) return [];
  if (opts.category) q = q.eq('category', opts.category);
  if (opts.tag) q = q.contains('tags', [opts.tag]);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as Dress[]).map(normalise);
}

/** Published dresses, optionally filtered by category and/or tag. */
export function listDresses(opts: { category?: DressCategory; tag?: string } = {}): Promise<Dress[]> {
  const { category, tag } = opts;
  return cached(`list:${category ?? ''}:${tag ?? ''}`, [], () => fetchList({ category, tag }));
}

/** One published dress by slug, or null. */
export function getDress(slug: string): Promise<Dress | null> {
  return cached<Dress | null>(`dress:${slug}`, null, async () => {
    const q = baseQuery();
    if (!q) return null;
    const { data, error } = await q.eq('slug', slug).limit(1);
    if (error) throw error;
    return data && data.length > 0 ? normalise(data[0] as Dress) : null;
  });
}

/** The first `n` published dresses (catalogue order), optionally in one category. */
export function latestDresses(category?: DressCategory, n = 6): Promise<Dress[]> {
  return cached(`latest:${category ?? ''}:${n}`, [], () => fetchList({ category, limit: n }));
}

/** Every tag used on a published dress, sorted alphabetically. */
export function allTags(): Promise<string[]> {
  return cached<string[]>('tags', [], async () => {
    const dresses = await fetchList({});
    return [...new Set(dresses.flatMap((d) => d.tags))].sort((a, b) => a.localeCompare(b));
  });
}

export type CategoryInfo = { id: DressCategory; label: string; url: string };

/** Dress categories are the `services` collection ids; label and URL come from there. */
export async function dressCategories(): Promise<CategoryInfo[]> {
  const services = await getServices();
  return services.map((s) => ({ id: s.id as DressCategory, label: s.data.title, url: `/services/${s.id}/` }));
}

/** Label + service-page URL for a category id (falls back to the id itself). */
export async function categoryInfo(id: string): Promise<{ label: string; url: string }> {
  const match = (await dressCategories()).find((c) => c.id === id);
  return match ? { label: match.label, url: match.url } : { label: id, url: `/services/${id}/` };
}

export function isDressCategory(value: string | null | undefined, categories: CategoryInfo[]): value is DressCategory {
  return !!value && categories.some((c) => c.id === value);
}
