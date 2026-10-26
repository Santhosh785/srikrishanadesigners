// The studio's price list (edited in Keystatic → "Price list"). Neck and
// sleeve add-ons live on each design entry, not here, so every price has
// exactly one home.
import { z } from 'astro/zod';
import raw from '../data/pricing.json';

const item = z.object({ key: z.string(), label: z.string() });

const schema = z.object({
  rangePercent: z.number().min(0).max(50),
  blouseTypes: z.array(item.extend({ base: z.number().int().min(0) })).min(1),
  extras: z.array(item.extend({ price: z.number().int().min(0) })),
  workLevels: z.array(item.extend({ from: z.number().int().min(0), to: z.number().int().min(0) })).min(1),
  express: z.object({ percent: z.number().min(0), label: z.string() }),
});

export const pricing = schema.parse(raw);
export type Pricing = typeof pricing;

/** Price range for a configuration; mirrored by the estimator's client script. */
export function estimate(opts: { base: number; addOns: number; work: { from: number; to: number }; express: boolean }) {
  const stitching = opts.base + opts.addOns;
  const r = pricing.rangePercent / 100;
  const x = opts.express ? 1 + pricing.express.percent / 100 : 1;
  const round = (n: number) => Math.round(n / 50) * 50;
  return {
    low: round((stitching * (1 - r) + opts.work.from) * x),
    high: round((stitching * (1 + r) + opts.work.to) * x),
  };
}
