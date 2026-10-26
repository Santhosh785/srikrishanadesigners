// Notify IndexNow (Bing, Yandex, Seznam…; Bing feeds ChatGPT search and
// Copilot) that the site's URLs changed. Run after a production deploy:
//   node scripts/indexnow.mjs [https://www.example.com]
const KEY = '5f0c2d8e7b4a4c1f9e3d6a2b8c7f1e04'; // must match site.indexNowKey and public/<KEY>.txt

const origin = (process.argv[2] ?? process.env.SITE_URL ?? '').replace(/\/$/, '');
if (!origin) {
  console.error('Usage: node scripts/indexnow.mjs https://www.yourdomain.com');
  process.exit(1);
}

const locs = async (url) => {
  const xml = await (await fetch(url)).text();
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
};

const sitemaps = await locs(`${origin}/sitemap-index.xml`);
const urls = (await Promise.all(sitemaps.map(locs))).flat();

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: new URL(origin).host,
    key: KEY,
    keyLocation: `${origin}/${KEY}.txt`,
    urlList: urls,
  }),
});
console.log(`IndexNow: submitted ${urls.length} URLs → HTTP ${res.status}`);
