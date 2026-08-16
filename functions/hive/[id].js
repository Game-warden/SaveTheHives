// functions/hive/[id].js — Cloudflare Pages Function, SEO_IDENTITY_MIGRATION_PLAN.md
// Phase 1. Server-renders a real, indexable HTML page per hive at
// /hive/<id> — real content in the initial response, not injected by
// client JS. Does not touch /app/ or the existing PWA.
//
// Added 2026-08-15.

import { fetchHiveById, roundCoord, escapeHtml, hiveDisplayTitle, STATUS_LABELS } from '../_lib/hives.js';

export async function onRequestGet(context) {
  const { params } = context;
  const id = params.id;

  if (!/^\d+$/.test(String(id))) {
    return new Response('Not found', { status: 404 });
  }

  let hive;
  try {
    hive = await fetchHiveById(id);
  } catch (e) {
    return new Response('Error loading hive data', { status: 500 });
  }

  if (!hive) {
    return new Response(renderNotFound(), {
      status: 404,
      headers: { 'content-type': 'text/html; charset=UTF-8' },
    });
  }

  const html = renderHivePage(hive);
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      // Hive records change rarely (a check-in, a status update) — cache
      // at the edge, but not so long that a fresh check-in takes a day to
      // show up.
      'cache-control': 'public, max-age=3600, s-maxage=21600',
    },
  });
}

function renderHivePage(hive) {
  const title = hiveDisplayTitle(hive);
  const lat = roundCoord(hive.latitude);
  const lon = roundCoord(hive.longitude);
  const place = [hive.city, hive.state].filter(Boolean).join(', ');
  const statusLabel = STATUS_LABELS[hive.status] || 'Unverified';
  const description = hive.description
    ? `${hive.description.slice(0, 220)}${hive.description.length > 220 ? '…' : ''}`
    : `A citizen-reported wild honeybee colony${place ? ' near ' + place : ''}. Part of SaveTheHives, a citizen-science map of non-managed honeybee colonies across the US.`;
  const canonical = `https://savethehives.org/hive/${hive.id}`;
  const reportedDate = hive.submitted_at ? new Date(hive.submitted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
  const noindex = hive.status === 'gone';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: `Hive #${hive.id}${place ? ', ' + place : ''}`,
    description,
    url: canonical,
    ...(lat && lon ? { geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lon } } : {}),
    ...(hive.city || hive.state
      ? { address: { '@type': 'PostalAddress', addressLocality: hive.city || undefined, addressRegion: hive.state || undefined, addressCountry: 'US' } }
      : {}),
    isPartOf: { '@id': 'https://savethehives.org/#organization' },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} — SaveTheHives</title>
<meta name="description" content="${escapeHtml(description)}">
${noindex ? '<meta name="robots" content="noindex, follow">' : ''}
<link rel="canonical" href="${canonical}">
<link rel="icon" href="/logo.jpg" type="image/jpeg">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="SaveTheHives">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="https://savethehives.org/facebook_cover_photo.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  body{font-family:'Outfit',sans-serif;max-width:640px;margin:0 auto;padding:2rem 1.25rem 4rem;color:#2c2c2a;}
  .hv-badges{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:.75rem;}
  .hv-badge{font-size:13px;padding:3px 10px;border-radius:6px;background:#f1efe8;border:1px solid #d3d1c7;}
  .hv-meta{font-size:13px;color:#888780;margin:0 0 1rem;}
  .hv-desc{font-size:16px;line-height:1.7;margin:0 0 1.5rem;}
  .hv-cta{display:inline-block;padding:10px 18px;border-radius:8px;background:#f5a623;color:#2c2c2a;text-decoration:none;font-weight:600;}
  a.hv-back{font-size:13px;color:#888780;text-decoration:none;}
</style>
</head>
<body>
<p><a class="hv-back" href="/">SaveTheHives</a></p>
<div class="hv-badges">
  <span class="hv-badge">${escapeHtml(statusLabel)}</span>
  ${hive.hivetype ? `<span class="hv-badge">${escapeHtml(hive.hivetype)}</span>` : ''}
</div>
<h1>${escapeHtml(title)}</h1>
<p class="hv-meta">${reportedDate ? `Reported ${reportedDate}` : ''}${lat && lon ? ` · Coordinates shown rounded for hive safety` : ''}</p>
<p class="hv-desc">${escapeHtml(hive.description || description)}</p>
${hive.notes ? `<p class="hv-desc">${escapeHtml(hive.notes)}</p>` : ''}
<a class="hv-cta" href="/app/?hive=${hive.id}">View on the live map →</a>
</body>
</html>`;
}

function renderNotFound() {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Hive not found — SaveTheHives</title><meta name="robots" content="noindex"></head>
<body style="font-family:sans-serif;max-width:600px;margin:4rem auto;padding:0 1.25rem;">
<h1>Hive not found</h1>
<p>This hive doesn't exist or may have been removed. <a href="/app/">Browse the live map</a>.</p>
</body>
</html>`;
}
