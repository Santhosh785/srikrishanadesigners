// schema.org JSON-LD builders. Entities reference each other by @id so search
// engines and AI crawlers see one connected graph: the business, its services,
// the people who write, and the pages that describe them.
import { site, sameAs, absoluteUrl } from '../site.config';

type Faq = { question: string; answer: string };
type Crumb = { name: string; path: string };

export const ids = {
  business: absoluteUrl('/#business'),
  website: absoluteUrl('/#website'),
  author: (slug: string) => absoluteUrl(`/authors/${slug}/#person`),
};

const dayNames: Record<string, string> = {
  Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday',
  Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday',
};

export function businessSchema(opts: {
  logo: string;
  image: string;
  reviews?: { author: string; rating: number; text: string; date: Date }[];
}) {
  const reviews = opts.reviews ?? [];
  return {
    '@type': ['ClothingStore', 'LocalBusiness'],
    '@id': ids.business,
    name: site.name,
    legalName: site.legalName,
    description: site.description,
    url: absoluteUrl('/'),
    logo: opts.logo,
    image: opts.image,
    telephone: site.phone,
    email: site.email,
    priceRange: site.priceRange,
    foundingDate: String(site.foundingYear),
    address: {
      '@type': 'PostalAddress',
      streetAddress: [site.address.street, site.address.locality].join(', '),
      addressLocality: site.address.city,
      addressRegion: site.address.region,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: site.geo.lat, longitude: site.geo.lng },
    hasMap: site.mapsUrl,
    areaServed: site.areasServed.map((name) => ({ '@type': 'Place', name })),
    openingHoursSpecification: site.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days.map((d) => dayNames[d]),
      opens: h.opens,
      closes: h.closes,
    })),
    sameAs,
    knowsAbout: [
      'Blouse stitching', 'Bridal blouse design', 'Aari work', 'Maggam work',
      'Lehenga tailoring', 'Salwar kameez stitching', 'Churidar stitching', 'Alterations',
    ],
    ...(reviews.length > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1),
        reviewCount: reviews.length,
        bestRating: 5,
        worstRating: 1,
      },
      review: reviews.slice(0, 10).map((r) => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: r.author },
        reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
        reviewBody: r.text,
        datePublished: r.date.toISOString().slice(0, 10),
      })),
    }),
  };
}

export function websiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': ids.website,
    url: absoluteUrl('/'),
    name: site.name,
    inLanguage: site.locale,
    publisher: { '@id': ids.business },
  };
}

export function serviceSchema(s: {
  slug: string;
  title: string;
  description: string;
  priceFrom: number;
  priceTo?: number | null;
  image?: string;
}) {
  const url = absoluteUrl(`/services/${s.slug}/`);
  return {
    '@type': 'Service',
    '@id': `${url}#service`,
    name: s.title,
    serviceType: s.title,
    description: s.description,
    url,
    ...(s.image && { image: s.image }),
    provider: { '@id': ids.business },
    areaServed: site.areasServed.map((name) => ({ '@type': 'Place', name })),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      priceSpecification: {
        '@type': 'PriceSpecification',
        priceCurrency: 'INR',
        minPrice: s.priceFrom,
        ...(s.priceTo && { maxPrice: s.priceTo }),
      },
      availability: 'https://schema.org/InStock',
    },
  };
}

export function personSchema(a: { slug: string; name: string; role: string; bio: string; image?: string }) {
  return {
    '@type': 'Person',
    '@id': ids.author(a.slug),
    name: a.name,
    jobTitle: a.role,
    description: a.bio,
    url: absoluteUrl(`/authors/${a.slug}/`),
    ...(a.image && { image: a.image }),
    worksFor: { '@id': ids.business },
  };
}

export function articleSchema(p: {
  slug: string;
  title: string;
  description: string;
  pubDate: Date;
  updatedDate?: Date | null;
  authorSlug: string;
  image: string;
  tags: string[];
  wordCount: number;
}) {
  const url = absoluteUrl(`/blog/${p.slug}/`);
  return {
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: p.title,
    description: p.description,
    url,
    mainEntityOfPage: url,
    image: p.image,
    datePublished: p.pubDate.toISOString(),
    dateModified: (p.updatedDate ?? p.pubDate).toISOString(),
    author: { '@id': ids.author(p.authorSlug) },
    publisher: { '@id': ids.business },
    keywords: p.tags.join(', '),
    wordCount: p.wordCount,
    inLanguage: site.locale,
    isPartOf: { '@id': ids.website },
  };
}

export function faqSchema(faqs: Faq[], pagePath: string) {
  return {
    '@type': 'FAQPage',
    '@id': absoluteUrl(`${pagePath}#faq`),
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

export function toolSchema(t: { name: string; description: string; path: string }) {
  const url = absoluteUrl(t.path);
  return {
    '@type': 'WebApplication',
    '@id': `${url}#app`,
    name: t.name,
    description: t.description,
    url,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Any (web browser)',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'INR' },
    provider: { '@id': ids.business },
    inLanguage: site.locale,
  };
}

export function graph(...nodes: object[]) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
