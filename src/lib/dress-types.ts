// Shared types for the dress catalogue and quote requests (Supabase tables).
import { PUBLIC_SUPABASE_URL } from 'astro:env/client';

export type DressCategory =
  | 'designer-blouse-stitching'
  | 'bridal-wear-lehenga'
  | 'salwar-kurti-stitching';

export type DressPhoto = { path: string; thumb: string; w: number; h: number };

export type Dress = {
  id: string;
  slug: string;
  name: string;
  category: DressCategory;
  description: string | null;
  tags: string[];
  photos: DressPhoto[];
  published: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
};

export type QuoteRequest = {
  id: string;
  dress_id: string | null;
  dress_name: string;
  name: string;
  phone: string;
  occasion_date: string | null;
  contact_time: 'morning' | 'afternoon' | 'evening' | 'any' | null;
  message: string | null;
  photo_path: string | null;
  status: 'new' | 'contacted' | 'done';
  page: string | null;
  created_at: string;
};

/** Public URL of an object in the `dresses` storage bucket, or null when Supabase is not configured. */
export function dressPhotoUrl(path: string): string | null {
  if (!PUBLIC_SUPABASE_URL) return null;
  return `${PUBLIC_SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/dresses/${path}`;
}
