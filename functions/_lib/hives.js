// functions/_lib/hives.js — shared helpers for the Part 1 SEO Functions
// (functions/hive/[id].js, functions/sitemap.xml.js, functions/rss.xml.js,
// functions/api/hives.js). Not itself a route — Cloudflare Pages Functions
// bundles relative imports automatically, no build step required.
//
// Added 2026-08-15 as part of SEO_IDENTITY_MIGRATION_PLAN.md Phase 1.

// Same project URL + anon key already shipped client-side in app/app.js
// (SUPABASE_ANON_KEY there is a public, RLS-scoped key — every browser
// that loads the app already has it). Reusing it here server-side adds no
// new exposure; it just moves the same public read to the edge.
export const SUPABASE_URL = 'https://nsujmizdawyoictpawxt.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zdWptaXpkYXd5b2ljdHBhd3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NDEyNDgsImV4cCI6MjA5ODMxNzI0OH0.VOXEk4uyFq1jH0mvRW83LPPW8ZJp3MbylY6KiPKixTc';

// Deliberately the SAME safe column subset app.js already fetches via
// HIVE_COLUMNS (app/app.js) — no email, phone, address, zip, or consent.
// Those fields are already public-readable at the RLS layer (hives_public_read,
// qual: true — RLS is row-level, not column-level), but the app has always
// chosen not to surface them, and these new public/indexable surfaces
// should hold the same line, not loosen it.
export const SAFE_COLUMNS = 'id,name,latitude,longitude,hivetype,description,notes,city,state,status,submitted_at,last_verified_at,year,allow_contact,photo_url';

// Coordinate rounding — SEO_IDENTITY_MIGRATION_PLAN.md Phase 0 precondition.
// The existing app only rounds coordinates for display; the API/DB layer
// still returns full precision (documented gap, SAVETHEHIVES_SPEC.md §9).
// That underlying gap isn't fixed by this change — it's a separate, more
// invasive RLS/view-level fix. What Phase 1 must not do is make the gap
// worse by publishing full-precision coordinates into permanent, indexable,
// scrapable HTML/XML/JSON. So every new surface in this file rounds before
// it ever renders, independent of whatever the DB layer eventually does.
export function roundCoord(n) {
  if (n === null || n === undefined) return null;
  return Math.round(n * 100) / 100; // ~1.1km precision, matches app UI rounding
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Fetches all matching rows via PostgREST directly (Range-header pagination
// in 1000-row pages — Supabase's default max-rows-per-request), no SDK
// import needed. `filter` is an optional raw PostgREST query-string
// fragment, e.g. "status=neq.gone".
export async function fetchAllHives(filter = '', orderBy = 'id') {
  const rows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/hives?select=${SAFE_COLUMNS}${filter ? '&' + filter : ''}&order=${orderBy}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Range: `${from}-${from + pageSize - 1}`,
      },
    });
    if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

export async function fetchHiveById(id) {
  const url = `${SUPABASE_URL}/rest/v1/hives?select=${SAFE_COLUMNS}&id=eq.${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0] || null;
}

export function hiveDisplayTitle(hive) {
  const place = [hive.city, hive.state].filter(Boolean).join(', ');
  return place ? `Wild honeybee hive near ${place}` : `Wild honeybee hive #${hive.id}`;
}

export const STATUS_LABELS = {
  active: 'Verified — active',
  uncertain: 'Uncertain',
  gone: 'No longer active',
  unverified: 'Unverified',
};
