// Filter vocabularies for the design finder. Used by the content schema, the
// finder page and keystatic.config.ts — keep all three in sync via this file.
export const occasions = ['daily', 'office', 'festive', 'wedding-guest', 'bridal', 'party'] as const;
export const sareeTypes = ['silk', 'cotton', 'georgette-chiffon', 'lehenga', 'half-saree'] as const;
export const bodyNotes = [
  'broad-shoulders', 'narrow-shoulders', 'short-neck', 'long-neck',
  'fuller-bust', 'petite', 'fuller-arms', 'slim-arms',
] as const;
