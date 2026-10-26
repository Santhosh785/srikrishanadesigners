// Single source of truth for business facts. Schema markup, the footer, CTAs,
// llms.txt and robots.txt all read from here, so NAP (name/address/phone) stays
// identical everywhere — it must match the Google Business Profile exactly.
//
// Every line tagged TODO_FILL holds a placeholder. `grep -rn TODO_FILL src`
// must return nothing before the real domain goes live.

export const site = {
  name: 'Sri Krishna Designers',
  legalName: 'Sri Krishna Designers', // TODO_FILL: exact name as on Google Business Profile
  tagline: "Women's tailoring & designer blouse studio",
  description:
    'Sri Krishna Designers is a women’s tailoring studio specialising in designer and bridal blouse stitching, bridal lehengas, and custom salwar, kurti and churidar stitching, with personal consultations and trial fittings.',
  url: 'https://www.srikrishnadesigners.com', // TODO_FILL: real production domain (no trailing slash)
  locale: 'en-IN',
  foundingYear: 2015, // TODO_FILL: year the studio opened

  phone: '+919876543210', // TODO_FILL: E.164 format, same number as GBP
  phoneDisplay: '+91 98765 43210', // TODO_FILL
  whatsapp: '919876543210', // TODO_FILL: digits only, country code first
  email: 'contact@srikrishnadesigners.com', // TODO_FILL

  address: {
    street: '12, Example Street', // TODO_FILL
    locality: 'Example Area', // TODO_FILL: neighbourhood
    city: 'Chennai', // TODO_FILL
    region: 'Tamil Nadu', // TODO_FILL
    regionCode: 'TN', // TODO_FILL: ISO 3166-2:IN state code
    postalCode: '600001', // TODO_FILL
    country: 'IN',
  },
  geo: { lat: 13.0827, lng: 80.2707 }, // TODO_FILL: shop pin from Google Maps
  mapsUrl: 'https://maps.google.com/?cid=0000000000', // TODO_FILL: GBP "Share" link
  mapsEmbedUrl: '', // TODO_FILL: Google Maps embed src (optional; map hidden when empty)
  // Neighbourhoods/towns customers come from — used in areaServed + copy.
  areasServed: ['Chennai'], // TODO_FILL: e.g. ['T. Nagar', 'Mylapore', 'Adyar', 'Chennai']
  priceRange: '₹₹',

  // schema.org openingHoursSpecification. days: Mo Tu We Th Fr Sa Su
  hours: [
    { days: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], opens: '10:00', closes: '20:00' }, // TODO_FILL
  ],
  hoursDisplay: 'Mon–Sat, 10am – 8pm · Sunday by appointment', // TODO_FILL

  social: {
    instagram: 'https://www.instagram.com/TODO_FILL',
    youtube: 'https://www.youtube.com/@TODO_FILL',
    facebook: '', // optional
    justdial: '', // optional
    googleBusiness: 'https://g.page/TODO_FILL', // TODO_FILL
  },

  analytics: {
    ga4Id: '', // e.g. 'G-XXXXXXX'; script is omitted while empty
  },
  // Verification tokens from Google Search Console / Bing Webmaster Tools
  // ("HTML tag" method). Rendered as <meta> tags when set.
  verification: {
    google: '',
    bing: '',
  },
  // IndexNow key; public by design. The matching file lives in public/.
  indexNowKey: '5f0c2d8e7b4a4c1f9e3d6a2b8c7f1e04',
} as const;

export const sameAs = Object.values(site.social).filter(
  (u) => u && !u.includes('TODO_FILL'),
);

export const fullAddress = [
  site.address.street,
  site.address.locality,
  site.address.city,
  `${site.address.region} ${site.address.postalCode}`,
].join(', ');

export const whatsappLink = (message: string) =>
  `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}`;

export const absoluteUrl = (path: string) => new URL(path, site.url).toString();
