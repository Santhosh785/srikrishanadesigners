import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Shapes here mirror keystatic.config.ts — change both together.

const faq = z.object({ question: z.string(), answer: z.string() });

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().max(170),
      // 40–60 word direct answer shown first; AI answer engines quote this.
      answer: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().nullish(),
      author: reference('authors'),
      cover: image().nullish(),
      coverAlt: z.string().optional(),
      tags: z.array(z.string()).default([]),
      // Service pages this post should link to and be listed on.
      services: z.array(reference('services')).default([]),
      faqs: z.array(faq).default([]),
      draft: z.boolean().default(false),
    }),
});

const services = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      seoTitle: z.string(),
      description: z.string().max(170),
      answer: z.string(),
      order: z.number().default(0),
      priceFrom: z.number(),
      priceTo: z.number().nullish(),
      priceNote: z.string().optional(),
      turnaround: z.string(),
      includes: z.array(z.string()).default([]),
      image: image().nullish(),
      imageAlt: z.string().optional(),
      faqs: z.array(faq).default([]),
      updatedDate: z.coerce.date(),
    }),
});

const authors = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/authors' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      role: z.string(),
      bio: z.string(),
      yearsExperience: z.number().nullish(),
      photo: image().nullish(),
    }),
});

// Only genuine customer reviews, copied with permission. Review schema is
// generated from these — never add invented ones (Google penalises it).
const reviews = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/reviews' }),
  schema: z.object({
    author: z.string(),
    rating: z.number().min(1).max(5),
    text: z.string(),
    date: z.coerce.date(),
    source: z.enum(['Google', 'Instagram', 'Justdial', 'WhatsApp', 'Other']),
    service: reference('services').nullish(),
  }),
});

// Photos of the studio's own finished work.
const gallery = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/gallery' }),
  schema: ({ image }) =>
    z.object({
      image: image(),
      alt: z.string(),
      caption: z.string().optional(),
      service: reference('services').nullish(),
      order: z.number().default(0),
    }),
});

export const collections = { blog, services, authors, reviews, gallery };
