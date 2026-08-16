// functions/sitemap.xml.js — Cloudflare Pages Function, replaces the static
// sitemap.xml at repo root (Functions take priority over static assets at
// the same path, so this shadows it automatically). Adds one <url> per
// hive on top of the existing static top-level pages.
//
// SEO_IDENTITY_MIGRATION_PLAN.md Phase 1. Added 2026-08-15.

import { fetchAllHives, escapeXml } from './_lib/hives.js';

const STATIC_URLS = [
  { loc: 'https://savethehives.org/', lastmod: '2026-08-15', changefreq: 'weekly', priority: '1.0' },
  { loc: 'https://savethehives.org/app/', lastmod: '2026-08-15', changefreq: 'weekly', priority: '0.6' },
  { loc: 'https://savethehives.org/privacy.html', lastmod: '2026-07-25', changefreq: 'yearly', priority: '0.3' },
];

export async function onRequestGet() {
  let hives = [];
  try {
    // "gone" hives get noindex on their own page (see functions/hive/[id].js)
    // — no living colony there anymore, so leave them out of the sitemap too.
    hives = await fetchAllHives('status=neq.gone', 'id');
  } catch (e) {
    // If Supabase is briefly unreachable, still serve the static URLs
    // rather than a 500 — a sitemap missing hive pages for a few minutes
    // is far better than a broken sitemap.
  }

  const hiveUrls = hives.map((h) => {
    const lastmod = (h.last_verified_at || h.submitted_at || '').slice(0, 10);
    return `  <url>
    <loc>https://savethehives.org/hive/${h.id}</loc>
    ${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ''}
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`;
  });

  const staticUrls = STATIC_URLS.map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...hiveUrls].join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=UTF-8',
      'cache-control': 'public, max-age=3600, s-maxage=21600',
    },
  });
}
