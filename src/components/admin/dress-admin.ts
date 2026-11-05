// Pure helpers for the admin dress manager: labels, tag vocabulary, slugs,
// browser image processing and storage cleanup.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DressCategory } from '../../lib/dress-types';
import { DRESS_BUCKET } from './supabase-admin';

export const CATEGORY_LABELS: Record<DressCategory, string> = {
  'designer-blouse-stitching': 'Designer blouse',
  'bridal-wear-lehenga': 'Bridal & lehenga',
  'salwar-kurti-stitching': 'Salwar & kurti',
};
export const CATEGORIES = Object.keys(CATEGORY_LABELS) as DressCategory[];

export const OCCASION_TAGS = ['wedding', 'reception', 'festive', 'party', 'office', 'daily'];
export const COLOUR_TAGS = ['red', 'maroon', 'pink', 'green', 'blue', 'gold', 'pastel', 'black', 'white'];

export const MAX_TAGS = 10;
export const MAX_PHOTOS = 6;
export const MAX_DESCRIPTION = 300;
const MAX_TAG_LENGTH = 30;

export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH).trim();
}

/** Adds tags (normalised, de-duplicated) up to MAX_TAGS. */
export function addTags(current: string[], raw: string[]): string[] {
  const next = [...current];
  for (const r of raw) {
    const t = normalizeTag(r);
    if (t && !next.includes(t) && next.length < MAX_TAGS) next.push(t);
  }
  return next;
}

/** Lower-case ASCII kebab slug; `dress` when nothing usable is left. */
export function slugify(name: string): string {
  const s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return s || 'dress';
}

/** First free slug among base, base-2, base-3, ... checked against existing rows. */
export async function uniqueSlug(supabase: SupabaseClient, name: string): Promise<string> {
  const base = slugify(name);
  const { data, error } = await supabase.from('dresses').select('slug').like('slug', `${base}%`);
  if (error) throw error;
  const taken = new Set((data ?? []).map((r: { slug: string }) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export type EncodedImage = { blob: Blob; w: number; h: number; ext: 'webp' | 'jpg'; type: string };
export type ProcessedPhoto = { full: EncodedImage; thumb: EncodedImage };

export const FULL_EDGE = 1600;
export const THUMB_EDGE = 600;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encode(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  maxEdge: number,
  quality: number,
): Promise<{ img: EncodedImage; canvas: HTMLCanvasElement }> {
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH)); // never upscale
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  let blob = await canvasToBlob(canvas, 'image/webp', quality);
  // Browsers without a WebP encoder silently return PNG; fall back to JPEG
  // (the bucket accepts it) rather than storing a PNG named .webp.
  if (blob && blob.type === 'image/webp') return { img: { blob, w, h, ext: 'webp', type: 'image/webp' }, canvas };
  blob = await canvasToBlob(canvas, 'image/jpeg', quality + 0.05);
  if (!blob) throw new Error('Could not encode the image.');
  return { img: { blob, w, h, ext: 'jpg', type: 'image/jpeg' }, canvas };
}

/** Decodes a photo upright (EXIF orientation applied) and exports full + thumb. */
export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This file could not be read as an image (HEIC? try a JPEG).');
  }
  try {
    const full = await encode(bitmap, bitmap.width, bitmap.height, FULL_EDGE, 0.82);
    // The thumb is drawn from the already-reduced full canvas: faster, same quality.
    const thumb = await encode(full.canvas, full.img.w, full.img.h, THUMB_EDGE, 0.75);
    full.canvas.width = full.canvas.height = 0;
    thumb.canvas.width = thumb.canvas.height = 0;
    return { full: full.img, thumb: thumb.img };
  } finally {
    bitmap.close();
  }
}

/** Removes the given bucket-relative paths; errors are logged, never thrown. */
export async function removeFiles(supabase: SupabaseClient, paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(DRESS_BUCKET).remove(paths);
  if (error) console.error('Could not remove files', paths, error);
}

/** Removes every object under `<dressId>/` in the bucket. */
export async function removeDressFolder(supabase: SupabaseClient, dressId: string): Promise<void> {
  for (let round = 0; round < 10; round++) {
    const { data, error } = await supabase.storage.from(DRESS_BUCKET).list(dressId, { limit: 1000 });
    if (error) throw error;
    const paths = (data ?? []).filter((o) => o.name).map((o) => `${dressId}/${o.name}`);
    if (!paths.length) return;
    const { error: rmError } = await supabase.storage.from(DRESS_BUCKET).remove(paths);
    if (rmError) throw rmError;
  }
}
