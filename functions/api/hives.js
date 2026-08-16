// functions/api/hives.js — Cloudflare Pages Function, SEO_IDENTITY_MIGRATION_PLAN.md
// Phase 1 "research API". Read-only, paginated JSON of hive data with
// coordinates rounded the same as every other new public surface in this
// batch — see the Phase 0 note in functions/_lib/hives.js for why.
//
// GET /api/hives?state=NC&status=active&limit=50&offset=0
//
// Added 2026-08-15.

import { fetchAllHives, roundCoord } from '../_lib/hives.js';

const MAX_LIMIT = 200;

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const state = url.searchParams.get('state');
  const status = url.searchParams.get('status');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, MAX_LIMIT);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);

  const filters = [];
  if (state) filters.push(`state=eq.${encodeURIComponent(state)}`);
  if (status) filters.push(`status=eq.${encodeURIComponent(status)}`);

  let hives;
  try {
    hives = await fetchAllHives(filters.join('&'), 'id');
  } catch (e) {
    return jsonResponse({ error: 'Upstream data source unavailable' }, 502);
  }

  const page = hives.slice(offset, offset + limit).map((h) => ({
    id: h.id,
    name: h.name,
    latitude: roundCoord(h.latitude),
    longitude: roundCoord(h.longitude),
    hivetype: h.hivetype,
    status: h.status,
    city: h.city,
    state: h.state,
    submitted_at: h.submitted_at,
    last_verified_at: h.last_verified_at,
    year: h.year,
    url: `https://savethehives.org/hive/${h.id}`,
  }));

  return jsonResponse({
    count: page.length,
    total: hives.length,
    limit,
    offset,
    results: page,
  });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=1800, s-maxage=3600',
    },
  });
}
