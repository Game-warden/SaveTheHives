// functions/rss.xml.js — Cloudflare Pages Function, SEO_IDENTITY_MIGRATION_PLAN.md
// Phase 1. RSS 2.0 feed of the most recently reported hives — also the
// feed Soro's "custom RSS integration" path (see plan doc's Soro section)
// would consume, if that thread gets picked back up later.
//
// Added 2026-08-15.

import { fetchAllHives, escapeXml, roundCoord, hiveDisplayTitle } from './_lib/hives.js';

const FEED_SIZE = 50;

export async function onRequestGet() {
  let hives = [];
  try {
    hives = await fetchAllHives('status=neq.gone', 'submitted_at.desc');
  } catch (e) {
    return new Response('Feed temporarily unavailable', { status: 503 });
  }

  const items = hives.slice(0, FEED_SIZE).map((h) => {
    const title = hiveDisplayTitle(h);
    const link = `https://savethehives.org/hive/${h.id}`;
    const pubDate = h.submitted_at ? new Date(h.submitted_at).toUTCString() : new Date().toUTCString();
    const lat = roundCoord(h.latitude);
    const lon = roundCoord(h.longitude);
    const desc = h.description || `A citizen-reported wild honeybee colony${h.city ? ' near ' + h.city + (h.state ? ', ' + h.state : '') : ''}.`;
    return `  <item>
    <title>${escapeXml(title)}</title>
    <link>${link}</link>
    <guid isPermaLink="true">${link}</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${escapeXml(desc)}</description>
    ${lat && lon ? `<geo:lat>${lat}</geo:lat>\n    <geo:long>${lon}</geo:long>` : ''}
  </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:geo="http://www.w3.org/2003/01/geo/wgs84_pos#">
<channel>
  <title>SaveTheHives — recently reported wild honeybee colonies</title>
  <link>https://savethehives.org/</link>
  <description>Citizen-reported wild honeybee colonies, most recent first.</description>
  <language>en-us</language>
${items.join('\n')}
</channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/rss+xml; charset=UTF-8',
      'cache-control': 'public, max-age=1800, s-maxage=3600',
    },
  });
}
