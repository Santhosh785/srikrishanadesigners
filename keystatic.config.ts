import { collection, config, fields } from '@keystatic/core';

// Browser editor at /keystatic. In production it commits to GitHub, which
// triggers a Coolify redeploy; in `astro dev` it edits files on disk.
// Field shapes mirror src/content.config.ts — change both together.

const faqs = fields.array(
  fields.object({
    question: fields.text({ label: 'Question', validation: { isRequired: true } }),
    answer: fields.text({ label: 'Answer', multiline: true, validation: { isRequired: true } }),
  }),
  {
    label: 'FAQs',
    description: 'Real questions customers ask. Shown on the page and as FAQ rich results.',
    itemLabel: (props) => props.fields.question.value || 'Question',
  },
);

const answer = fields.text({
  label: 'Short answer (40–60 words)',
  description:
    'Answer the main question directly in the first sentence. Google and AI assistants quote this.',
  multiline: true,
  validation: { isRequired: true, length: { min: 120, max: 500 } },
});

const description = fields.text({
  label: 'Meta description',
  description: 'Shown in Google results. 140–160 characters.',
  multiline: true,
  validation: { isRequired: true, length: { min: 50, max: 170 } },
});

export default config({
  storage: import.meta.env.PROD
    ? { kind: 'github', repo: { owner: 'Santhosh785', name: 'srikrishanadesigners' } }
    : { kind: 'local' },
  ui: {
    brand: { name: 'Sri Krishna Designers' },
    navigation: {
      Content: ['blog', 'services'],
      Proof: ['reviews', 'gallery'],
      People: ['authors'],
    },
  },
  collections: {
    blog: collection({
      label: 'Blog posts',
      slugField: 'title',
      path: 'src/content/blog/*',
      format: { contentField: 'content' },
      entryLayout: 'content',
      columns: ['title', 'pubDate'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description,
        answer,
        pubDate: fields.date({ label: 'Published', defaultValue: { kind: 'today' }, validation: { isRequired: true } }),
        updatedDate: fields.date({ label: 'Last updated' }),
        author: fields.relationship({ label: 'Author', collection: 'authors', validation: { isRequired: true } }),
        cover: fields.image({
          label: 'Cover image',
          directory: 'src/assets/blog',
          publicPath: '../../assets/blog/',
        }),
        coverAlt: fields.text({ label: 'Cover image description (alt text)' }),
        tags: fields.array(fields.text({ label: 'Tag' }), {
          label: 'Tags',
          itemLabel: (props) => props.value,
        }),
        services: fields.array(fields.relationship({ label: 'Service', collection: 'services' }), {
          label: 'Related services',
          description: 'The post links to these service pages and is listed on them.',
          itemLabel: (props) => props.value ?? 'Service',
        }),
        faqs,
        draft: fields.checkbox({ label: 'Draft (hidden from the site)', defaultValue: false }),
        content: fields.markdoc({ label: 'Content', extension: 'md' }),
      },
    }),
    services: collection({
      label: 'Services',
      slugField: 'title',
      path: 'src/content/services/*',
      format: { contentField: 'content' },
      entryLayout: 'content',
      schema: {
        title: fields.slug({ name: { label: 'Service name' } }),
        seoTitle: fields.text({ label: 'SEO title', validation: { isRequired: true, length: { max: 65 } } }),
        description,
        answer,
        order: fields.integer({ label: 'Order on the site', defaultValue: 0 }),
        priceFrom: fields.integer({ label: 'Price from (₹)', validation: { isRequired: true } }),
        priceTo: fields.integer({ label: 'Price up to (₹)' }),
        priceNote: fields.text({ label: 'Price note' }),
        turnaround: fields.text({ label: 'Turnaround time', validation: { isRequired: true } }),
        includes: fields.array(fields.text({ label: 'Item' }), {
          label: 'What we make / includes',
          itemLabel: (props) => props.value,
        }),
        image: fields.image({
          label: 'Main photo',
          directory: 'src/assets/services',
          publicPath: '../../assets/services/',
        }),
        imageAlt: fields.text({ label: 'Photo description (alt text)' }),
        faqs,
        updatedDate: fields.date({ label: 'Last updated', defaultValue: { kind: 'today' }, validation: { isRequired: true } }),
        content: fields.markdoc({ label: 'Page content', extension: 'md' }),
      },
    }),
    authors: collection({
      label: 'Authors',
      slugField: 'name',
      path: 'src/content/authors/*',
      schema: {
        name: fields.slug({ name: { label: 'Name' } }),
        role: fields.text({ label: 'Role', validation: { isRequired: true } }),
        bio: fields.text({ label: 'Bio', multiline: true, validation: { isRequired: true } }),
        yearsExperience: fields.integer({ label: 'Years of experience' }),
        photo: fields.image({
          label: 'Photo',
          directory: 'src/assets/authors',
          publicPath: '../../assets/authors/',
        }),
      },
    }),
    reviews: collection({
      label: 'Customer reviews',
      slugField: 'author',
      path: 'src/content/reviews/*',
      columns: ['author', 'rating'],
      schema: {
        author: fields.slug({
          name: { label: 'Customer name', description: 'Real review only, copied with permission.' },
        }),
        rating: fields.integer({ label: 'Rating (1–5)', defaultValue: 5, validation: { min: 1, max: 5, isRequired: true } }),
        text: fields.text({ label: 'Review text', multiline: true, validation: { isRequired: true } }),
        date: fields.date({ label: 'Review date', validation: { isRequired: true } }),
        source: fields.select({
          label: 'Source',
          options: [
            { label: 'Google', value: 'Google' },
            { label: 'Instagram', value: 'Instagram' },
            { label: 'Justdial', value: 'Justdial' },
            { label: 'WhatsApp', value: 'WhatsApp' },
            { label: 'Other', value: 'Other' },
          ],
          defaultValue: 'Google',
        }),
        service: fields.relationship({ label: 'Service', collection: 'services' }),
      },
    }),
    gallery: collection({
      label: 'Gallery photos',
      slugField: 'alt',
      path: 'src/content/gallery/*',
      schema: {
        alt: fields.slug({
          name: { label: 'Photo description', description: 'e.g. "Maroon bridal blouse with gold aari work on the sleeves"' },
        }),
        image: fields.image({
          label: 'Photo',
          directory: 'src/assets/gallery',
          publicPath: '../../assets/gallery/',
          validation: { isRequired: true },
        }),
        caption: fields.text({ label: 'Caption' }),
        service: fields.relationship({ label: 'Service', collection: 'services' }),
        order: fields.integer({ label: 'Order', defaultValue: 0 }),
      },
    }),
  },
});
