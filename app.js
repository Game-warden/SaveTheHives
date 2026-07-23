// ═══════════════════════════════════════
// SERVICE WORKER (offline app-shell caching — Phase 3, v2.6)
// ═══════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service worker registration failed (app still works fully online):', err);
    });
  });
}

// ═══════════════════════════════════════
// MULTI-TAB DETECTION (Fable audit 1a)
// ═══════════════════════════════════════
// supabase-js's default cross-tab Web Lock means a stale tab sitting on an
// expired session can block a fresh sign-in attempt in another tab (silent
// hang, no client-side error). We can't remove the lock without trading it
// for a different race (see audit notes), so instead: warn the user right
// when they go to sign in if another tab of this app is currently open —
// that's the exact moment this failure mode bites.
let _tabChannel = null;
if ('BroadcastChannel' in window) {
  _tabChannel = new BroadcastChannel('savethehives-tabs');
  _tabChannel.onmessage = (e) => {
    if (e.data === 'ping') _tabChannel.postMessage('pong');
  };
}
function checkForOtherTabs(callback) {
  if (!_tabChannel) { callback(false); return; }
  let heard = false;
  const onMsg = (e) => { if (e.data === 'pong') heard = true; };
  _tabChannel.addEventListener('message', onMsg);
  _tabChannel.postMessage('ping');
  setTimeout(() => {
    _tabChannel.removeEventListener('message', onMsg);
    callback(heard);
  }, 200);
}

// ═══════════════════════════════════════
// XSS ESCAPING — v2.9.5, see FABLE_AUDIT_FINDINGS_2026-07-23.md 2a
// ═══════════════════════════════════════
// Escapes untrusted strings before they're interpolated into innerHTML/
// bindPopup template strings. Covers hive name/description/city/state
// (rendered in addMarker + openRecords) and idea title/description
// (renderIdeas). NOT a general sanitizer — do not use for values that
// need to contain real HTML.
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ═══════════════════════════════════════
// SUPABASE CONFIG
// ═══════════════════════════════════════
const SUPABASE_URL = 'https://nsujmizdawyoictpawxt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zdWptaXpkYXd5b2ljdHBhd3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NDEyNDgsImV4cCI6MjA5ODMxNzI0OH0.VOXEk4uyFq1jH0mvRW83LPPW8ZJp3MbylY6KiPKixTc';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let pendingAction = null; // resumes after sign-in: 'add' | 'validate' | 'checkin'
let pendingCheckinHiveId = null; // only set when pendingAction === 'checkin'
db.auth.getSession().then(({ data: { session } }) => {
  if (session) { currentUser = session.user; updateAuthUI(); }
});
db.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
  updateAuthUI();
  if (_event === 'SIGNED_IN' && pendingAction === 'add') {
    pendingAction = null;
    closeSignInModal();
    setTimeout(() => openAddPanelUnified({}), 300);
  } else if (_event === 'SIGNED_IN' && pendingAction === 'validate') {
    pendingAction = null;
    closeSignInModal();
    setTimeout(() => openValidate(), 300);
  } else if (_event === 'SIGNED_IN' && pendingAction === 'checkin') {
    pendingAction = null;
    const hiveId = pendingCheckinHiveId;
    pendingCheckinHiveId = null;
    closeSignInModal();
    setTimeout(() => openCheckin(hiveId), 300);
  }
  // Bug fix: once a session is parsed out of the URL's #access_token=...
  // hash, strip that hash from the address bar. Otherwise it lingers, and
  // if a later sign-in request captures window.location.href (see
  // emailRedirectTo in submitSignIn()) while the old hash is still present,
  // the next magic-link redirect ends up with a corrupted double hash that
  // fails to parse — the intermittent "click the link, still not signed in"
  // bug.
  if (_event === 'SIGNED_IN' && window.location.hash.includes('access_token')) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
});

const TYPE_COLORS = {
  'Live Tree':  '#4caf50',
  'Dead Tree':  '#795548',
  'Man Made':   '#2196f3',
  'Ground':     '#ff9800',
};
const TYPE_ICONS = {
  'Live Tree':'🌳','Dead Tree':'🪵','Man Made':'🏠','Ground':'🌿'
};

// Normalize legacy types to new categories
function normalizeType(t) {
  if (!t) return 'Live Tree';
  if (t === 'Living Tree') return 'Live Tree';
  if (['Building','Managed','Manmade Beehive','Manmade structure',
       'Manmade Structure','Man Made'].includes(t)) return 'Man Made';
  if (t === 'In the ground') return 'Ground';
  return t;
}

const MATING_RADIUS_M = 4828; // 3 miles in meters

// ═══════════════════════════════════════
// STATE
// ═══════════════════════════════════════
let map, clusterGroup;
let allHives = [];
let visibleHives = []; // always mirrors what's actually in the cluster group
let radiusCircles = [];
let showRadii = false;
let activeFilter = 'all';
let selectedType = 'Live Tree';
let pendingLat = null, pendingLng = null;
let validateActive = false; // v2.9 — Validate mode temporarily narrows the visible pins to a radius; never mutates activeFilter/activeNotesQuery so exiting restores exactly what was there before

// ═══════════════════════════════════════
// FIRST-VISIT ON-RAMP OVERLAY (v2.8)
// ═══════════════════════════════════════
const ONRAMP_SEEN_KEY = 'onrampSeen';
function maybeShowOnramp() {
  const overlay = document.getElementById('onramp-overlay');
  if (!overlay) return;
  if (localStorage.getItem(ONRAMP_SEEN_KEY)) return; // stays hidden (default state)
  overlay.classList.remove('hidden');
}
function dismissOnramp() {
  localStorage.setItem(ONRAMP_SEEN_KEY, '1');
  const overlay = document.getElementById('onramp-overlay');
  if (overlay) overlay.classList.add('hidden');
}

// ═══════════════════════════════════════
// FLOATING SEARCH (v2.8) — morphs the map-search icon into an inline field
// ═══════════════════════════════════════
function toggleMapSearch(open) {
  const wrap = document.getElementById('map-search');
  if (!wrap) return;
  wrap.classList.toggle('collapsed', !open);
  // Expanded search now spans the bottom row (v2.8.1 — moved off Leaflet's
  // top-left zoom control), overlapping the radius/filter stack (top-right)
  // and fab-locate (same bottom-left row). Hide them rather than truly
  // removing them, so nothing reflows.
  const filters = document.getElementById('map-filters');
  const radius = document.getElementById('radius-toggle');
  const locate = document.getElementById('fab-locate');
  if (filters) filters.style.visibility = open ? 'hidden' : '';
  if (radius) radius.style.visibility = open ? 'hidden' : '';
  if (locate) locate.style.visibility = open ? 'hidden' : '';
  if (open) {
    const input = document.getElementById('smart-search-input');
    if (input) setTimeout(() => input.focus(), 60);
  }
}

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
async function init() {
  initDarkMode();
  maybeShowOnramp();

  // Init map — start at US overview, then fly to user location
  map = L.map('map', {
    center: [38.5, -96],
    zoom: 5,
    zoomControl: true,
  });
  // Geolocate on first load (silently, no prompt)
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => map.setView([pos.coords.latitude, pos.coords.longitude], 10),
      () => {} // denied / unavailable — stay at US overview
    );
  }

  // Zoom-adaptive basemap — muted overview at low zoom, more street-level
  // reference detail (buildings, road color) once someone zooms into a
  // neighborhood looking for a specific hive. Two tiers only in production:
  // CartoDB Positron -> Voyager. (Raw OSM Standard tiles were used in the
  // Raleigh demo but tile.openstreetmap.org's usage policy asks heavy-traffic
  // sites not to hit it directly, so we stay inside the CARTO tile family here.)
  const basemapAttr = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';
  const basemapLayers = {
    positron: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: basemapAttr, subdomains: 'abcd', maxZoom: 20
    }),
    voyager: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: basemapAttr, subdomains: 'abcd', maxZoom: 20
    })
  };
  let activeBasemap = 'positron';
  basemapLayers.positron.addTo(map);

  function basemapForZoom(z) { return z >= 15 ? 'voyager' : 'positron'; }
  map.on('zoomend', () => {
    const key = basemapForZoom(map.getZoom());
    if (key !== activeBasemap) {
      map.removeLayer(basemapLayers[activeBasemap]);
      basemapLayers[key].addTo(map);
      activeBasemap = key;
    }
  });

  // Cluster group
  clusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
  });
  map.addLayer(clusterGroup);

  // Crosshair coords — update live as map moves
  function updateCrosshairCoords() {
    const c = map.getCenter();
    const el = document.getElementById('map-coords');
    if (el) el.textContent = c.lat.toFixed(5) + ', ' + c.lng.toFixed(5);
  }
  map.on('move', updateCrosshairCoords);
  map.on('load', updateCrosshairCoords);
  updateCrosshairCoords();

  // Hide crosshair/radius overlay when any popup is open
  map.on('popupopen',  () => document.body.classList.add('checkin-open'));
  map.on('popupclose', () => {
    // Only remove if check-in modal isn't also open
    if (!document.getElementById('checkin-modal').classList.contains('open')) {
      document.body.classList.remove('checkin-open');
    }
  });

  await loadHivesFromSupabase();
  visibleHives = [...allHives];
  updateCounts();
}

// ═══════════════════════════════════════
// INDEXEDDB CACHE (delta sync — Phase 3 v2.6)
// ═══════════════════════════════════════
// Minimal wrapper, no libraries. Two object stores: "hives" (raw Supabase
// rows, keyed by id) and "meta" (small key/value bookkeeping — just
// lastSync for now). Every read/write is wrapped in try/catch — if
// IndexedDB is unavailable or fails for any reason, we silently fall back
// to the old always-full-fetch behavior rather than breaking the app.
const IDB_NAME = 'savethehives-cache';
const IDB_VERSION = 1;

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const dbi = req.result;
      if (!dbi.objectStoreNames.contains('hives')) dbi.createObjectStore('hives', { keyPath: 'id' });
      if (!dbi.objectStoreNames.contains('meta')) dbi.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAllHives() {
  try {
    const dbi = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = dbi.transaction('hives', 'readonly');
      const req = tx.objectStore('hives').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('IndexedDB read failed, falling back to full load:', e);
    return [];
  }
}

async function idbPutHives(rows) {
  if (!rows || !rows.length) return;
  try {
    const dbi = await idbOpen();
    await new Promise((resolve, reject) => {
      const tx = dbi.transaction('hives', 'readwrite');
      const store = tx.objectStore('hives');
      rows.forEach(r => store.put(r));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('IndexedDB write failed (cache not updated, app still works from network):', e);
  }
}

async function idbGetMeta(key) {
  try {
    const dbi = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = dbi.transaction('meta', 'readonly');
      const req = tx.objectStore('meta').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return null;
  }
}

async function idbSetMeta(key, value) {
  try {
    const dbi = await idbOpen();
    await new Promise((resolve, reject) => {
      const tx = dbi.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('IndexedDB meta write failed:', e);
  }
}

// Latest updated_at among a batch of raw rows, for advancing the sync
// cursor. Falls back to the current cursor if a row is missing it.
function latestUpdatedAt(rows, fallback) {
  return rows.reduce((max, r) => (r.updated_at && r.updated_at > max) ? r.updated_at : max, fallback);
}

// ═══════════════════════════════════════
// LOAD DATA FROM SUPABASE
// ═══════════════════════════════════════
// Only the columns dbRowToHive() actually reads — not '*' — to keep both
// the full load and every delta sync as light as possible.
// 'year' was briefly excluded here after a live 400 ("column hives.year
// does not exist") broke every hive load — the column has since been
// added for real via add_year_column.sql, so it's back in this list.
const HIVE_COLUMNS = 'id, legacy_id, name, latitude, longitude, hivetype, description, city, state, zip, notes, submitted_at, created_at, photo_url, status, last_verified_at, user_added, year, updated_at';

async function loadHivesFromSupabase() {
  const cached = await idbGetAllHives();
  const lastSync = await idbGetMeta('lastSync');

  if (cached.length && lastSync) {
    // Render from cache immediately — instant paint on repeat visits.
    cached.forEach(row => { const h = dbRowToHive(row); allHives.push(h); addMarker(h); });
    visibleHives = [...allHives];
    updateCounts();
    showToast(`🐝 ${cached.length.toLocaleString()} hives loaded`);

    // Then fetch only what changed since last sync and merge it in.
    const { data, error } = await db.from('hives').select(HIVE_COLUMNS)
      .gt('updated_at', lastSync).order('updated_at');
    if (error) {
      console.warn('Delta sync fetch failed (showing cached data only):', error);
      return;
    }
    if (data && data.length) {
      await idbPutHives(data);
      await idbSetMeta('lastSync', latestUpdatedAt(data, lastSync));
      data.forEach(row => {
        const h = dbRowToHive(row);
        const idx = allHives.findIndex(x => x.id === h.id);
        if (idx === -1) {
          allHives.push(h);
          addMarker(h);
        } else {
          if (allHives[idx]._marker) clusterGroup.removeLayer(allHives[idx]._marker);
          allHives[idx] = h;
          addMarker(h);
        }
      });
      filterType(activeFilter); // re-applies current filter/keyword + refreshes counts
    }
    return;
  }

  // First-ever load (no cache yet): existing full paginated fetch.
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await db.from('hives').select(HIVE_COLUMNS).range(from, from+999).order('id');
    if (error || !data || !data.length) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  all.forEach(row => { const h = dbRowToHive(row); allHives.push(h); addMarker(h); });
  showToast(`🐝 ${all.length.toLocaleString()} hives loaded`);

  if (all.length) {
    await idbPutHives(all);
    await idbSetMeta('lastSync', latestUpdatedAt(all, '1970-01-01T00:00:00Z'));
  }
}

function dbRowToHive(row) {
  return {
    id: row.id,
    legacy_id: row.legacy_id,
    name: row.name || 'Anonymous Observer',
    lat: row.latitude,
    lng: row.longitude,
    type: normalizeType(row.hivetype || 'Live Tree'),
    description: row.description || '',
    city: row.city || '',
    state: row.state || '',
    zip: row.zip || '',
    notes: row.notes || '',
    date: row.submitted_at ? row.submitted_at.slice(0,10) : (row.created_at ? row.created_at.slice(0,10) : null),
    photo_url: row.photo_url || null,
    status: row.status || 'unverified',
    last_verified_at: row.last_verified_at || null,
    userAdded: row.user_added || false,
    year: row.year || null,
  };
}

async function uploadPhoto(file) {
  if (!file || !currentUser) return null;
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await db.storage.from('hive-photos').upload(path, file);
  if (error) { console.warn('Upload error:', error); return null; }
  return db.storage.from('hive-photos').getPublicUrl(path).data.publicUrl;
}

// ═══════════════════════════════════════
// MARKERS
// ═══════════════════════════════════════
function makeIcon(type) {
  const color = TYPE_COLORS[type] || '#f5a623';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0z" fill="${color}" opacity="0.95"/>
    <circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -38],
  });
}

function addMarker(hive) {
  const marker = L.marker([hive.lat, hive.lng], {icon: makeIcon(hive.type)});
  marker.hiveData = hive;

  const color = TYPE_COLORS[hive.type] || '#f5a623';
  const icon = TYPE_ICONS[hive.type] || '🐝';
  const _locParts = v => v && v.trim() && v.toLowerCase() !== 'unknown';
  const loc = escapeHtml([hive.city, hive.state].filter(_locParts).join(', ') ||
    (hive.lat && hive.lng ? `${hive.lat.toFixed(2)}°, ${hive.lng.toFixed(2)}°` : 'Location unknown'));
  const desc = escapeHtml(hive.description || '');
  const safeName = escapeHtml(hive.name) || 'Anonymous Observer';

  marker.bindPopup(`
    <div class="hive-popup">
      <div class="popup-type">
        <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></div>
        ${icon} ${hive.type}
      </div>
      <div class="popup-name">${safeName}</div>
      ${hive.date ? `<div style="font-size:0.7rem;color:var(--text-muted);opacity:0.8;margin-bottom:6px;">🗓 Logged ${formatDate(hive.date)}</div>` : ''}
      ${hive.status && hive.status !== 'unverified' ? `<div style="font-size:0.72rem;font-weight:600;margin-bottom:2px;color:${hive.status==='active'?'#4caf50':hive.status==='gone'?'#e57373':'#f5a623'}">● ${hive.status.charAt(0).toUpperCase()+hive.status.slice(1)}</div>` : ''}
      ${hive.last_verified_at ? `<div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:6px;">Verified ${new Date(hive.last_verified_at).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}</div>` : ''}
      <div id="ci-note-${hive.id}" style="font-size:0.72rem;color:var(--text-muted);font-style:italic;margin-bottom:6px;"></div>
      ${hive.photo_url ? `<img src="${hive.photo_url}" style="width:100%;border-radius:8px;margin-bottom:8px;max-height:160px;object-fit:cover;" loading="lazy">` : ''}
      ${desc ? `<div class="popup-desc">${desc}</div>` : ''}
      <div class="popup-meta">📍 ${loc}</div>
      <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:6px;font-family:monospace;">${hive.lat.toFixed(2)}, ${hive.lng.toFixed(2)}</div>
      <button class="popup-radius-btn" onclick="toggleSingleRadius(${hive.id},${hive.lat},${hive.lng})">◎ 3-Mile Mating Radius</button>
      <button class="popup-radius-btn" style="margin-top:6px;background:rgba(76,175,80,0.15);color:#4caf50;border-color:rgba(76,175,80,0.3);" onclick="openCheckin(${hive.id})">✅ Update / Check In</button>
      <button class="popup-radius-btn" style="margin-top:6px;background:rgba(33,150,243,0.15);color:#2196f3;border-color:rgba(33,150,243,0.3);" onclick="shareHive(${hive.id})">↗ Share This Hive</button>
    </div>
  `, {maxWidth: 300, minWidth: 200, autoPanPadding: [16, 70]});

  // Lazy-load most recent check-in note when popup opens
  marker.on('popupopen', async () => {
    const el = document.getElementById('ci-note-' + hive.id);
    if (!el || el.dataset.loaded) return;
    el.dataset.loaded = '1';
    const { data } = await db.from('checkins')
      .select('notes, created_at')
      .eq('hive_id', hive.id)
      .not('notes', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    if (data?.[0]?.notes) {
      el.textContent = `"${data[0].notes}"`;
    }
  });

  marker.hiveId = hive.id;
  clusterGroup.addLayer(marker);
  hive._marker = marker;
}

// ═══════════════════════════════════════
// RADII
// ═══════════════════════════════════════
const singleRadii = {};

function toggleSingleRadius(id, lat, lng) {
  if (singleRadii[id]) {
    map.removeLayer(singleRadii[id]);
    delete singleRadii[id];
  } else {
    singleRadii[id] = L.circle([lat, lng], {
      radius: MATING_RADIUS_M,
      color: '#f5a623',
      fillColor: '#f5a623',
      fillOpacity: 0.06,
      weight: 1.5,
      dashArray: '6 4',
    }).addTo(map);
  }
}

function toggleRadii() {
  showRadii = !showRadii;
  const btn = document.getElementById('radius-toggle');
  btn.classList.toggle('active', showRadii);

  // Clear existing
  radiusCircles.forEach(c => map.removeLayer(c));
  radiusCircles = [];

  if (showRadii) {
    // Draw radii ONLY for hives that are currently visible in the cluster
    visibleHives.forEach(h => {
      const c = L.circle([h.lat, h.lng], {
        radius: MATING_RADIUS_M,
        color: TYPE_COLORS[h.type] || '#f5a623',
        fillColor: TYPE_COLORS[h.type] || '#f5a623',
        fillOpacity: 0.03,
        weight: 1,
        dashArray: '4 4',
      }).addTo(map);
      radiusCircles.push(c);
    });
    showToast(`${visibleHives.length} mating radius circles shown`);
  }
}

// ═══════════════════════════════════════
// FILTER
// ═══════════════════════════════════════
function filterType(type) {
  activeFilter = type;

  // Update pills
  document.querySelectorAll('.stat-pill').forEach(p => p.classList.remove('active'));
  document.getElementById('filter-' + type)?.classList.add('active');

  // Clear cluster
  clusterGroup.clearLayers();

  // Re-add filtered (also respect keyword search)
  let filtered = type === 'all' ? allHives : allHives.filter(h => h.type === type);
  const kw = (document.getElementById('keyword-input')?.value || '').trim().toLowerCase();
  if (kw) {
    filtered = filtered.filter(h =>
      (h.name && h.name.toLowerCase().includes(kw)) ||
      (h.description && h.description.toLowerCase().includes(kw)) ||
      (h.city && h.city.toLowerCase().includes(kw)) ||
      (h.state && h.state.toLowerCase().includes(kw))
    );
  }
  filtered.forEach(h => clusterGroup.addLayer(h._marker));
  visibleHives = filtered; // keep in sync

  // Redraw radii if on
  if (showRadii) {
    radiusCircles.forEach(c => map.removeLayer(c));
    radiusCircles = [];
    visibleHives.forEach(h => {
      const c = L.circle([h.lat, h.lng], {
        radius: MATING_RADIUS_M,
        color: TYPE_COLORS[h.type] || '#f5a623',
        fillColor: TYPE_COLORS[h.type] || '#f5a623',
        fillOpacity: 0.03,
        weight: 1,
        dashArray: '4 4',
      }).addTo(map);
      radiusCircles.push(c);
    });
  }

  updateCounts();
}

function updateCounts() {
  const types = ['all','Live Tree','Dead Tree','Man Made','Ground'];
  types.forEach(t => {
    const el = document.getElementById('count-' + t);
    if (!el) return;
    if (t === 'all') {
      el.textContent = allHives.length.toLocaleString();
    } else {
      el.textContent = allHives.filter(h => h.type === t).length.toLocaleString();
    }
  });
}

// ═══════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════
async function doSearch() {
  const query = document.getElementById('zip-input').value.trim();
  const radius = parseInt(document.getElementById('radius-select').value);
  if (!query) { showToast('Enter a city, landmark, or address'); return; }

  if (radius === 0) {
    // Show all — reset cluster to full filtered set
    clusterGroup.clearLayers();
    if (singleRadii['search']) { map.removeLayer(singleRadii['search']); delete singleRadii['search']; }
    const all = activeFilter === 'all' ? allHives : allHives.filter(h => h.type === activeFilter);
    all.forEach(h => clusterGroup.addLayer(h._marker));
    showToast('Showing all ' + all.length.toLocaleString() + ' records');
    return;
  }

  showToast('Searching...');

  try {
    // Geocode using Nominatim — city/landmark/address, worldwide
    // ZIP codes are unreliable globally; placeholder text guides users to city names
    let centerLat, centerLng;
    try {
      const url = 'https://nominatim.openstreetmap.org/search?' +
        'q=' + encodeURIComponent(query) +
        '&format=json&limit=5&addressdetails=1';
      const resp = await fetch(url, {
        headers: { 'Accept-Language': 'en' }
      });
      if (!resp.ok) throw new Error('Network error');
      const data = await resp.json();
      if (!data || !data.length) {
        showToast('Location not found — try a city or landmark name');
        return;
      }
      // Prefer city/town/village over administrative regions
      const preferred = data.find(r =>
        ['city','town','village','suburb','neighbourhood','amenity','tourism','natural'].includes(r.type)
      ) || data[0];
      centerLat = parseFloat(preferred.lat);
      centerLng = parseFloat(preferred.lon);
    } catch(e2) {
      showToast('Search failed — check your connection');
      return;
    }
    const radiusM = radius * 1609.34;

    // Filter hives within radius
    clusterGroup.clearLayers();
    radiusCircles.forEach(c => map.removeLayer(c));
    radiusCircles = [];

    const inRange = allHives.filter(h => {
      if (activeFilter !== 'all' && h.type !== activeFilter) return false;
      const d = haversine(centerLat, centerLng, h.lat, h.lng);
      return d <= radiusM;
    });

    inRange.forEach(h => clusterGroup.addLayer(h._marker));
    visibleHives = inRange; // keep in sync

    // Pan to center
    map.setView([centerLat, centerLng], radius <= 10 ? 11 : radius <= 25 ? 9 : 7);

    // Search radius ring
    if (singleRadii['search']) map.removeLayer(singleRadii['search']);
    singleRadii['search'] = L.circle([centerLat, centerLng], {
      radius: radiusM,
      color: '#f5a623',
      fillColor: '#f5a623',
      fillOpacity: 0.05,
      weight: 2,
      dashArray: '8 4',
    }).addTo(map);

    if (inRange.length === 0) {
      showToast('No hives found here yet — be the first to add one! 🐝');
    } else {
      showToast(`${inRange.length} hive${inRange.length !== 1 ? 's' : ''} within ${radius} mi`);
    }
  } catch(e) {
    showToast('Search failed — check your connection');
  }
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Format a date string (YYYY-MM-DD or just YYYY) into a readable stamp
function formatDate(dateStr) {
  if (!dateStr) return '';
  if (/^\d{4}$/.test(dateStr)) return dateStr; // year only
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ═══════════════════════════════════════
// ADD HIVE
// ═══════════════════════════════════════
function selectType(type, el) {
  selectedType = type;
  document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

function closeAddModal() {
  document.getElementById('add-modal').classList.remove('open');
  // Switch bottom tab back to map
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-btn')[0].classList.add('active');
}

function openAddPanel() {
  if (!currentUser) {
    pendingAction = 'add';
    showToast('Sign in to log a hive 🐝');
    handleAuth();
    return;
  }
  openAddPanelUnified({});
}

// Single entry point used by BOTH the manual "+ Hive" button and Pathfinder's
// "Save as Hive Record" handoff — same form, different starting data.
function openAddPanelUnified(options) {
  const banner = document.getElementById('form-source-banner');
  const radiusSpan = document.getElementById('form-source-radius');

  if (options.lat != null && options.lng != null) {
    document.getElementById('form-lat').value = options.lat.toFixed(6);
    document.getElementById('form-lng').value = options.lng.toFixed(6);
  } else {
    // Default: auto-fill from current map crosshair center
    const center = map.getCenter();
    document.getElementById('form-lat').value = center.lat.toFixed(6);
    document.getElementById('form-lng').value = center.lng.toFixed(6);
  }

  if (options.description) {
    document.getElementById('form-desc').value = options.description;
  }

  if (options.source === 'pathfinder') {
    if (radiusSpan) radiusSpan.textContent = Math.round(options.confidenceRadius || 0);
    if (banner) banner.style.display = 'block';
  } else if (banner) {
    banner.style.display = 'none';
  }

  document.getElementById('add-modal').classList.add('open');
  // Highlight the Add tab
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-btn')[1].classList.add('active');
}

function getMyLocation() {
  if (!navigator.geolocation) {
    showToast('GPS not available — enter coordinates manually');
    return;
  }
  showToast('Getting location...');
  navigator.geolocation.getCurrentPosition(
    pos => {
      document.getElementById('form-lat').value = pos.coords.latitude.toFixed(6);
      document.getElementById('form-lng').value = pos.coords.longitude.toFixed(6);
      showToast('📍 Location captured!');
    },
    err => {
      // Graceful — never block the user
      showToast('GPS unavailable — enter lat/lng manually or use Google Maps to find coordinates');
    },
    { timeout: 8000, maximumAge: 60000 }
  );
}

async function submitHive() {
  const lat = parseFloat(document.getElementById('form-lat').value);
  const lng = parseFloat(document.getElementById('form-lng').value);
  if (isNaN(lat) || isNaN(lng)) { showToast('⚠ Please enter coordinates or use GPS'); return; }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) { showToast('⚠ Invalid coordinates'); return; }

  const submitBtn = document.querySelector('[onclick="submitHive()"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

  const now = new Date();
  const { data: saved, error } = await db.from('hives').insert({
    name: document.getElementById('form-name').value || 'Field Observer',
    latitude: lat, longitude: lng, hivetype: selectedType,
    description: document.getElementById('form-desc').value,
    city: document.getElementById('form-city').value,
    state: document.getElementById('form-state').value,
    zip: document.getElementById('form-zip').value,
    photo_url: null, user_added: true,
    submitted_by: currentUser?.id || null,
    submitted_at: now.toISOString(),
    year: parseInt(document.getElementById('form-year').value) || null,
  }).select().single();

  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '🐝 Submit Hive Record'; }
  if (error) { showToast('⚠ ' + error.message); return; }

  const hive = dbRowToHive(saved);
  allHives.push(hive); visibleHives.push(hive);
  addMarker(hive); updateCounts();
  map.setView([lat, lng], 13);
  document.getElementById('add-modal').classList.remove('open');
  ['form-name','form-lat','form-lng','form-year','form-desc','form-city','form-state','form-zip'].forEach(id => {
    document.getElementById(id).value = '';
  });
  showToast('🐝 Hive saved to the global map! Thank you.');
  setTab('map');
}

// ═══════════════════════════════════════
// RECORDS LIST
// ═══════════════════════════════════════
function openRecords() {
  const list = document.getElementById('records-list');
  const toShow = allHives.filter(h => activeFilter === 'all' || h.type === activeFilter).slice(0, 50);
  list.innerHTML = toShow.map(h => {
    const color = TYPE_COLORS[h.type] || '#f5a623';
    const icon = TYPE_ICONS[h.type] || '🐝';
    const _lp = v => v && v.trim() && v.toLowerCase() !== 'unknown';
    const loc = escapeHtml([h.city, h.state].filter(_lp).join(', ') ||
      (h.lat && h.lng ? `${h.lat.toFixed(2)}°, ${h.lng.toFixed(2)}°` : ''));
    const safeName = escapeHtml(h.name) || 'Anonymous';
    const rawDesc = h.description || '';
    const safeDescExcerpt = escapeHtml(rawDesc.substring(0, 100));
    return `
      <div style="background:rgba(255,255,255,0.04);border:1.5px solid var(--border);border-radius:var(--radius-md);padding:14px;cursor:pointer;box-shadow:var(--shadow-sm);transition:transform 0.15s,box-shadow 0.15s;"
           onclick="flyTo(${h.lat},${h.lng})">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
          <span style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">${icon} ${h.type}</span>
          ${h.userAdded ? '<span style="font-size:0.7rem;background:rgba(245,166,35,0.2);color:var(--honey);padding:2px 6px;border-radius:4px;">New</span>' : ''}
        </div>
        <div style="font-weight:bold;color:var(--honey);margin-bottom:4px;">${safeName}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);">📍 ${loc || 'Location unknown'} ${h.date ? '· 🗓 ' + formatDate(h.date) : ''}</div>
        ${rawDesc ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;line-height:1.4;">${safeDescExcerpt}${rawDesc.length > 100 ? '…' : ''}</div>` : ''}
      </div>
    `;
  }).join('');
  if (toShow.length === 50) {
    list.innerHTML += `<div style="text-align:center;color:var(--text-muted);font-size:0.8rem;padding:10px;">Showing first 50 of ${allHives.length} records. Use search to filter by area.</div>`;
  }
  document.getElementById('list-modal').classList.add('open');
}

// ═══════════════════════════════════════
// IDEAS & VOTING
// ═══════════════════════════════════════
let ideasLoaded = false;
async function loadIdeas() {
  const list = document.getElementById('ideas-list');
  const hint = document.getElementById('ideas-signin-hint');
  if (!list) return;
  hint.style.display = currentUser ? 'none' : 'block';
  try {
    const { data: ideas, error } = await db.from('feature_ideas_with_votes').select('*').order('score', { ascending: false });
    if (error) throw error;
    let myVotes = {};
    if (currentUser) {
      const { data: votes } = await db.from('feature_idea_votes').select('idea_id, vote').eq('user_id', currentUser.id);
      (votes || []).forEach(v => myVotes[v.idea_id] = v.vote);
    }
    renderIdeas(ideas || [], myVotes);
    ideasLoaded = true;
  } catch (e) {
    list.innerHTML = `<div style="font-size:0.8rem;color:var(--text-muted);">Ideas &amp; voting isn't set up yet.</div>`;
  }
}

function renderIdeas(ideas, myVotes) {
  const list = document.getElementById('ideas-list');
  if (!ideas.length) {
    list.innerHTML = `<div style="font-size:0.82rem;color:var(--text-muted);">No ideas yet.</div>`;
    return;
  }
  list.innerHTML = ideas.map(idea => {
    const mine = myVotes[idea.id] || 0;
    const disabled = currentUser ? '' : 'disabled';
    return `
      <div style="display:flex;align-items:flex-start;gap:10px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;">
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;">
          <button ${disabled} onclick="voteIdea('${idea.id}',1)" style="background:none;border:none;cursor:${currentUser?'pointer':'not-allowed'};color:${mine===1?'var(--honey)':'var(--text-muted)'};font-size:1rem;line-height:1;padding:2px;">▲</button>
          <span style="font-size:0.8rem;font-weight:600;color:var(--text);">${idea.score}</span>
          <button ${disabled} onclick="voteIdea('${idea.id}',-1)" style="background:none;border:none;cursor:${currentUser?'pointer':'not-allowed'};color:${mine===-1?'var(--honey)':'var(--text-muted)'};font-size:1rem;line-height:1;padding:2px;">▼</button>
        </div>
        <div>
          <div style="font-size:0.85rem;font-weight:600;color:var(--text);">${escapeHtml(idea.title)}</div>
          ${idea.description ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;line-height:1.4;">${escapeHtml(idea.description)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function voteIdea(ideaId, vote) {
  if (!currentUser) return;
  await db.from('feature_idea_votes').upsert(
    { idea_id: ideaId, user_id: currentUser.id, vote },
    { onConflict: 'idea_id,user_id' }
  );
  loadIdeas();
}

function flyTo(lat, lng) {
  document.getElementById('list-modal').classList.remove('open');
  map.setView([lat, lng], 15);
  setTab('map');
}

// ═══════════════════════════════════════
// LOCATION
// ═══════════════════════════════════════
function locateMe() {
  if (!navigator.geolocation) { showToast('GPS not available on this device'); return; }
  showToast('Getting location...');
  navigator.geolocation.getCurrentPosition(
    pos => {
      map.setView([pos.coords.latitude, pos.coords.longitude], 12);
      showToast('📍 Centered on your location');
    },
    () => showToast('GPS access denied — search by ZIP instead'),
    { timeout: 8000 }
  );
}

// ═══════════════════════════════════════
// TABS & MODALS
// ═══════════════════════════════════════
function hideSearchUI() {
  const ms = document.getElementById('map-search');
  const mf = document.getElementById('map-filters');
  if (ms) ms.style.display = 'none';
  if (mf) mf.style.display = 'none';
}
function showSearchUI() {
  const ms = document.getElementById('map-search');
  const mf = document.getElementById('map-filters');
  if (ms) ms.style.display = '';
  if (mf) mf.style.display = '';
}

// ═══════════════════════════════════════
// VALIDATE (v2.9) — narrows the existing map to hives within driving
// distance instead of a separate screen; see the Validate tab button.
// ═══════════════════════════════════════
const VALIDATE_RADIUS_MILES = 50; // straight-line approximation of "about
                                   // an hour's drive" — a true isochrone
                                   // needs a routing API, deferred for now

function openValidate() {
  if (!currentUser) {
    pendingAction = 'validate';
    showToast('Sign in to validate hives 🐝');
    handleAuth();
    return;
  }
  showToast('Finding hives near you…');
  // The banner spans nearly the full top row (same as the expanded search
  // field), which would overlap the radius/filter stack in the top-right —
  // hide them for the duration, same visibility trick used there.
  const filters = document.getElementById('map-filters');
  const radius = document.getElementById('radius-toggle');
  if (filters) filters.style.visibility = 'hidden';
  if (radius) radius.style.visibility = 'hidden';
  if (!navigator.geolocation) {
    runValidateFilter(map.getCenter().lat, map.getCenter().lng);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => runValidateFilter(pos.coords.latitude, pos.coords.longitude),
    () => {
      showToast('Location access denied — showing hives near the current map view instead');
      runValidateFilter(map.getCenter().lat, map.getCenter().lng);
    },
    { timeout: 8000 }
  );
}

function runValidateFilter(lat, lng) {
  validateActive = true;
  const radiusM = VALIDATE_RADIUS_MILES * 1609.34;

  // Deliberately ignores activeFilter/activeNotesQuery (v2.9 §"Validate
  // never mutates activeFilter") — Validate shows every type within
  // range so exiting can restore the prior filter state untouched.
  clusterGroup.clearLayers();
  const nearby = allHives.filter(h => h.lat && h.lng && haversine(lat, lng, h.lat, h.lng) <= radiusM);
  nearby.forEach(h => clusterGroup.addLayer(h._marker));
  visibleHives = nearby;

  if (singleRadii['validate']) map.removeLayer(singleRadii['validate']);
  singleRadii['validate'] = L.circle([lat, lng], {
    radius: radiusM, color: '#c8821a', fillColor: '#c8821a', fillOpacity: 0.04, weight: 2, dashArray: '8 4',
  }).addTo(map);
  map.setView([lat, lng], 9);

  const FIVE_YEARS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const stale = nearby.filter(h => !h.last_verified_at || (now - new Date(h.last_verified_at).getTime()) > FIVE_YEARS_MS).length;
  updateValidateBanner(nearby.length, stale);
}

function updateValidateBanner(total, stale) {
  const banner = document.getElementById('validate-banner');
  const title = document.getElementById('validate-banner-title');
  const sub = document.getElementById('validate-banner-sub');
  if (!banner || !title || !sub) return;
  if (total === 0) {
    title.textContent = `No hives within ${VALIDATE_RADIUS_MILES} miles yet`;
    sub.textContent = 'Be the first to log one nearby, or zoom out to explore further.';
  } else {
    title.textContent = `${total} hive${total !== 1 ? 's' : ''} within about an hour of you`;
    sub.textContent = stale > 0
      ? `${stale} haven't been checked in 5+ years — tap a pin to see its details`
      : 'Tap any pin to see its details and check in';
  }
  banner.style.display = 'flex';
}

function exitValidate() {
  validateActive = false;
  const banner = document.getElementById('validate-banner');
  if (banner) banner.style.display = 'none';
  if (singleRadii['validate']) { map.removeLayer(singleRadii['validate']); delete singleRadii['validate']; }
  const filters = document.getElementById('map-filters');
  const radius = document.getElementById('radius-toggle');
  if (filters) filters.style.visibility = '';
  if (radius) radius.style.visibility = '';
  reapplyFilters(); // restores whatever activeFilter/activeNotesQuery already were — Validate never touched them
}

// Exit via the banner's own ✕ (as opposed to switching to a different
// bottom-nav tab, which already triggers the same cleanup in setTab()).
function exitValidateToMap() {
  setTab('map');
}

function setTab(tab) {
  // Leaving Validate mode for any other tab restores the normal view.
  if (validateActive && tab !== 'validate') exitValidate();

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  // DECIDED: reuse the hidden Records nav slot for Learn (brief §1). 'list'
  // (Records) has no nav button anymore but stays reachable by calling
  // setTab('list') directly — kept out of this array on purpose so no
  // button index points at it.
  const tabs = ['map','add','validate','pathfinder','learn','about'];
  const idx = tabs.indexOf(tab);
  if (idx >= 0) document.querySelectorAll('.tab-btn')[idx]?.classList.add('active');

  if (tab === 'pathfinder' || tab === 'learn') hideSearchUI();
  else showSearchUI();

  // Bottom nav floats over the map now (v2.8), which means it would
  // otherwise sit on top of the pathfinder panel's lower controls once
  // that panel expands to the true screen bottom. Hide it while
  // Pathfinder is active; exitPathfinder() (pathfinder.js) restores it.
  const bottomTabs = document.getElementById('bottom-tabs');
  if (bottomTabs) bottomTabs.style.display = (tab === 'pathfinder') ? 'none' : '';

  // Learn is a full-screen replacement for the map (not an overlay like
  // Pathfinder), so hide/show #map-container alongside it. Validate
  // stays on the map itself, same as the 'map' tab.
  const mapEl = document.getElementById('map-container');
  const learnEl = document.getElementById('learn-view');
  if (tab === 'learn') {
    if (mapEl) mapEl.style.display = 'none';
    if (learnEl) learnEl.style.display = 'flex';
    openLearnHub();
  } else {
    if (mapEl) mapEl.style.display = '';
    if (learnEl) learnEl.style.display = 'none';
    if ((tab === 'map' || tab === 'validate') && map) setTimeout(() => map.invalidateSize(), 50);
  }

  if (tab === 'add') openAddPanel();
  else if (tab === 'validate') openValidate();
  else if (tab === 'pathfinder') openPathfinder();
  else if (tab === 'list') openRecords();
  else if (tab === 'about') { document.getElementById('about-modal').classList.add('open'); loadIdeas(); updateInstallUI(); }
}

function closeModal(e, id) {
  if (e.target.classList.contains('modal-overlay')) {
    document.getElementById(id).classList.remove('open');
  }
}

// ═══════════════════════════════════════
// DARK / LIGHT MODE
// ═══════════════════════════════════════
function toggleDarkMode(on) {
  document.body.classList.toggle('dark-mode', on);
  localStorage.setItem('darkMode', on ? '1' : '0');
  const thumb = document.getElementById('dark-mode-thumb');
  const track = document.getElementById('dark-mode-track');
  if (thumb) thumb.style.transform = on ? 'translateX(22px)' : 'translateX(0)';
  if (thumb) thumb.style.background = on ? '#f5a623' : '#fff';
  if (track) track.style.background = on ? 'rgba(245,166,35,0.55)' : '#c8b89a';
  // Bug fix: label used to always read "Dark Mode" regardless of which mode
  // was actually active. Now it names whichever mode is currently on.
  const label = document.getElementById('dark-mode-label');
  if (label) label.textContent = on ? '🌙 Dark Mode' : '☀️ Light Mode';
}

function initDarkMode() {
  const saved = localStorage.getItem('darkMode');
  const on = saved === '1';
  const toggle = document.getElementById('dark-mode-toggle');
  if (toggle) toggle.checked = on;
  toggleDarkMode(on);
}

function closeAboutModal() {
  document.getElementById('about-modal').classList.remove('open');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-btn')[0].classList.add('active');
}

// ═══════════════════════════════════════
// DEBUG PANEL (temporary, for field testing)
// ═══════════════════════════════════════
let debugPanelOpen = false;
function toggleDebugPanel() {
  debugPanelOpen = !debugPanelOpen;
  document.getElementById('debug-panel').classList.toggle('pf-hidden', !debugPanelOpen);
}

function updateDebugPanel(fields) {
  if (!debugPanelOpen) return;
  const map = {
    step: 'dbg-step',
    heading: 'dbg-heading',
    accuracy: 'dbg-accuracy',
    position: 'dbg-position',
    readings: 'dbg-readings',
    pointA: 'dbg-pointA',
    pointB: 'dbg-pointB',
    candidate: 'dbg-candidate',
    targetBearing: 'dbg-targetbearing',
    relative: 'dbg-relative',
    rotation: 'dbg-rotation',
    filter: 'dbg-filter',   // Pathfinder Phase 5 — alpha-beta filter state
    anchor: 'dbg-anchor',   // Pathfinder Phase 5 — last anchor capture quality
    rays: 'dbg-rays',       // Pathfinder Phase 5 — triangulation geometry (γ, εA, εB)
    compassAcc: 'dbg-compass-acc', // Pathfinder Phase 5 — OS compass-error estimate
  };
  Object.entries(fields).forEach(([key, val]) => {
    const el = document.getElementById(map[key]);
    if (el) el.textContent = val;
  });
}

// ═══════════════════════════════════════
// TOAST
// ═══════════════════════════════════════
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ═══════════════════════════════════════
// KEYWORD / NOTES SEARCH
// ═══════════════════════════════════════
let keywordActive = false;

function doKeywordSearch(query) {
  const q = query.trim().toLowerCase();
  keywordActive = q.length > 0;

  clusterGroup.clearLayers();

  const typeFiltered = activeFilter === 'all' ? allHives : allHives.filter(h => h.type === activeFilter);

  const results = q ? typeFiltered.filter(h => {
    return (
      (h.name        && h.name.toLowerCase().includes(q)) ||
      (h.description && h.description.toLowerCase().includes(q)) ||
      (h.city        && h.city.toLowerCase().includes(q)) ||
      (h.state       && h.state.toLowerCase().includes(q)) ||
      (h.zip         && h.zip.toLowerCase().includes(q))
    );
  }) : typeFiltered;

  results.forEach(h => clusterGroup.addLayer(h._marker));
  visibleHives = results; // keep in sync

  const kEl = document.getElementById('keyword-input');
  if (kEl) kEl.style.borderColor = q ? 'var(--honey)' : 'var(--border)';

  // Update count display
  const countEl = document.getElementById('count-all');
  if (countEl && q) countEl.textContent = results.length.toLocaleString() + ' found';
  else updateCounts();

  if (q && results.length === 0) showToast('No hives match "' + query.trim() + '"');
}

function clearKeyword() {
  const el = document.getElementById('keyword-input');
  if (el) { el.value = ''; el.style.borderColor = 'var(--border)'; }
  keywordActive = false;
  doKeywordSearch('');
  // visibleHives gets reset inside doKeywordSearch('')
  updateCounts();
}

// ═══════════════════════════════════════
// ZIP SEARCH ON ENTER
// ═══════════════════════════════════════
// Smart search bar — Enter key triggers geocode search
document.getElementById('smart-search-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') doSmartSearch();
});

// ═══════════════════════════════════════
// START
// ═══════════════════════════════════════
init();

// ── DEEP-LINK TAB SUPPORT (added Jul 22 2026) ──
// Lets external links (Facebook posts, etc.) open directly on a specific
// tab, e.g. savethehives.org/?tab=learn or ?tab=validate. Validated against
// the same tab list setTab() already uses; 'pathfinder' deliberately
// excluded — that stays gated behind ?pf=1 (see pathfinder.js) since it's
// not ready for general links yet. Runs after init() kicks off; setTab()
// itself doesn't depend on hive data being loaded yet, so no need to await.
(function deepLinkTab() {
  const requested = new URLSearchParams(location.search).get('tab');
  const allowed = ['map', 'add', 'validate', 'learn', 'about'];
  if (requested && allowed.includes(requested)) setTab(requested);
})();

// ═══════════════════════════════════════
// SHARE (v2.9.2) — Web Share API where supported, clipboard-copy fallback
// otherwise. Two entry points: shareApp() for the app itself (About modal),
// shareHive(id) for a single hive (popup). Neither deep-links to a specific
// pin — the app has no URL-based hive routing yet — so shareHive() shares
// the app URL plus hive-specific text rather than promising a link that
// wouldn't actually open to that pin.
// ═══════════════════════════════════════
async function doShare(shareData) {
  if (navigator.share) {
    try { await navigator.share(shareData); } catch (e) { /* user cancelled the native share sheet — no-op */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(shareData.url);
    showToast('Link copied — paste it anywhere to share');
  } catch (e) {
    showToast('Share this link: ' + shareData.url);
  }
}

function shareApp() {
  doShare({
    title: 'SaveTheHives',
    text: "There's probably a wild honeybee colony within a mile of you. Help map them — SaveTheHives is a citizen-science project tracking feral bee colonies across North America.",
    url: window.location.origin + window.location.pathname,
  });
}

function shareHive(id) {
  const hive = allHives.find(h => h.id === id);
  const loc = hive && hive.city ? ` near ${hive.city}${hive.state ? ', ' + hive.state : ''}` : '';
  doShare({
    title: 'SaveTheHives',
    text: `Found on SaveTheHives: a ${hive ? hive.type.toLowerCase() : 'wild'} hive${loc}. Help map feral honeybee colonies near you too.`,
    url: window.location.origin + window.location.pathname,
  });
}

// ═══════════════════════════════════════
// INSTALL PROMPT (v2.9.2) — platform-aware install nudge, shown inside the
// About modal rather than as a new floating overlay on the map. Deliberate:
// the map's floating UI (search FAB, locate FAB, radius toggle, filter
// drawer, Validate banner) has a real history of collision bugs from
// adding "just one more" floating element — see Known Gotchas. iOS Safari
// has no beforeinstallprompt API at all (Apple doesn't implement it), so
// its only path is showing the manual Share -> Add to Home Screen steps;
// browsers that do support the API get a real one-tap Install button.
// ═══════════════════════════════════════
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  updateInstallUI();
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  updateInstallUI();
});

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function updateInstallUI() {
  const box = document.getElementById('install-box');
  if (!box) return;
  if (isStandalone()) {
    box.innerHTML = '<div style="font-size:0.82rem;color:var(--text-muted);">✓ Installed — you\'re using the installed app.</div>';
  } else if (deferredInstallPrompt) {
    box.innerHTML = '<button class="btn btn-outline" style="width:100%;" onclick="promptInstall()">📲 Install SaveTheHives</button>';
  } else if (isIOS()) {
    box.innerHTML = '<div style="font-size:0.82rem;color:var(--text-muted);line-height:1.5;">📲 <strong style="color:var(--text);">Install for offline field use:</strong> tap the Share icon in Safari\'s toolbar, then "Add to Home Screen."</div>';
  } else {
    box.innerHTML = '<div style="font-size:0.82rem;color:var(--text-muted);">📲 Install for offline field use from your browser\'s menu (usually "Add to Home Screen" or "Install App").</div>';
  }
}

async function promptInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  updateInstallUI();
}

// ═══════════════════════════════════════
// AUTH — MAGIC LINK
// ═══════════════════════════════════════
function updateAuthUI() {
  const label = document.getElementById('about-auth-label');
  const btn = document.getElementById('about-auth-btn');
  if (!label || !btn) return;
  if (currentUser) {
    label.textContent = '✓ Signed in as ' + (currentUser.email || 'you');
    label.style.color = 'var(--green)';
    btn.textContent = 'Sign Out';
  } else {
    label.textContent = 'Not signed in';
    label.style.color = 'var(--text-muted)';
    btn.textContent = 'Sign In';
  }
}

let _turnstileToken = null;
let _turnstileWidgetId = null;

function handleAuth() {
  if (currentUser) {
    db.auth.signOut();
    showToast('Signed out');
    return;
  }
  document.getElementById('signin-email').value = '';
  _turnstileToken = null;
  document.getElementById('signin-modal').classList.add('open');
  setTimeout(() => document.getElementById('signin-email').focus(), 250);
  checkForOtherTabs(otherTabOpen => {
    if (otherTabOpen) {
      showToast('⚠ SaveTheHives is open in another tab — close it if sign-in isn\'t working.');
    }
  });
}

function getTurnstileToken() {
  return new Promise(resolve => {
    // Already have a fresh token
    if (_turnstileToken) { resolve(_turnstileToken); return; }

    const container = document.getElementById('turnstile-widget');
    if (!container || !window.turnstile) { resolve(null); return; }

    // Remove previous widget instance before re-rendering
    if (_turnstileWidgetId !== null) {
      try { window.turnstile.remove(_turnstileWidgetId); } catch(e) {}
      _turnstileWidgetId = null;
    }

    let resolved = false;
    const done = token => { if (!resolved) { resolved = true; resolve(token); } };

    _turnstileWidgetId = window.turnstile.render(container, {
      sitekey: '0x4AAAAAADtgqmkUZOmib37k',
      size: 'invisible',
      callback: token => { _turnstileToken = token; done(token); },
      'error-callback': () => { console.warn('Turnstile error'); done(null); },
      'expired-callback': () => { _turnstileToken = null; }
    });

    // Execute the invisible challenge
    try { window.turnstile.execute(_turnstileWidgetId); } catch(e) {}

    // Timeout after 15 seconds (bumped from 6s on Jul 22 2026 — the 6s
    // window was losing the race on slower networks/DNS filtering, e.g.
    // home Wi-Fi with a Pi-hole or ad-blocker in the path to
    // challenges.cloudflare.com. Since Supabase Attack Protection requires
    // a captcha token, a race the client lost meant signInWithOtp() got
    // called with no token and was rejected outright — see submitSignIn(),
    // which now also refuses to even attempt the request without a token
    // rather than send a doomed one.
    setTimeout(() => done(null), 15000);
  });
}

function closeSignInModal() {
  document.getElementById('signin-modal').classList.remove('open');
}

function showSignInError(msg) {
  const el = document.getElementById('signin-error');
  if (el) { el.textContent = '⚠ ' + msg; el.style.display = 'block'; }
  showToast('⚠ ' + msg);
}

// Re-entrancy guard (Fable audit 1c) — submitSignIn() has two entry points
// (button onclick + Enter keydown on the email field), and getTurnstileToken()
// can take up to 15s. Without this, a double Enter/click can fire two
// signInWithOtp() calls back to back and burn Supabase's ~60s resend
// cooldown, making the second attempt silently no-op.
let _signInInFlight = false;

async function submitSignIn() {
  if (_signInInFlight) return;
  _signInInFlight = true;
  try {
    const email = document.getElementById('signin-email').value.trim();
    if (!email) { document.getElementById('signin-email').focus(); return; }
    const errEl = document.getElementById('signin-error');
    if (errEl) errEl.style.display = 'none';
    const btn = document.getElementById('signin-submit-btn');
    btn.disabled = true; btn.textContent = 'Sending…';

    const captchaToken = await getTurnstileToken();
    if (!captchaToken) {
      // Don't send a request we know Supabase will reject (Attack
      // Protection requires a captcha token) — show a clear, actionable
      // error instead of a confusing rejection from Supabase.
      btn.disabled = false; btn.textContent = 'Send Link';
      showSignInError('Security check failed to load — check your connection (or try disabling any ad-blocker/VPN) and tap Send Link again.');
      return;
    }
    // emailRedirectTo strips query/hash (Fable audit 1b) — window.location.href
    // would carry deep-link params like ?tab=learn, which Supabase's Redirect
    // URL allowlist (exact-match entries) can reject or silently downgrade.
    const otpOptions = { emailRedirectTo: window.location.origin + window.location.pathname, captchaToken };

    const { error } = await db.auth.signInWithOtp({ email, options: otpOptions });
    btn.disabled = false; btn.textContent = 'Send Link';
    if (error) { showSignInError(error.message); return; }
    closeSignInModal();
    showToast('📧 Check your email for a sign-in link!');
  } catch (e) {
    console.error('submitSignIn error:', e);
    const btn = document.getElementById('signin-submit-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Send Link'; }
    showSignInError('Sign-in failed: ' + e.message);
  } finally {
    _signInInFlight = false;
  }
}

// ═══════════════════════════════════════
// CHECK-IN / RE-VERIFICATION
// ═══════════════════════════════════════
let _checkinHiveId = null;
let _checkinStatus = null;

function openCheckin(hiveId) {
  if (!currentUser) {
    pendingAction = 'checkin';
    pendingCheckinHiveId = hiveId;
    showToast('Sign in to check in on a hive 🐝');
    handleAuth();
    return;
  }
  _checkinHiveId = hiveId;
  _checkinStatus = null;
  ['active','gone','uncertain'].forEach(s => {
    document.getElementById('ci-' + s).className = 'checkin-opt';
  });
  document.getElementById('ci-notes').value = '';
  document.getElementById('ci-submit-btn').disabled = true;
  document.getElementById('checkin-modal').classList.add('open');
  document.body.classList.add('checkin-open');
  map.closePopup();
}

function selectCheckin(status) {
  _checkinStatus = status;
  ['active','gone','uncertain'].forEach(s => {
    document.getElementById('ci-' + s).className =
      'checkin-opt' + (s === status ? ' selected-' + s : '');
  });
  document.getElementById('ci-submit-btn').disabled = false;
}

function closeCheckinModal() {
  document.getElementById('checkin-modal').classList.remove('open');
  document.body.classList.remove('checkin-open');
  _checkinHiveId = null;
  _checkinStatus = null;
}

async function submitCheckin() {
  if (!_checkinStatus || !_checkinHiveId) return;
  const status = _checkinStatus;
  const hiveId = _checkinHiveId;
  const notes = document.getElementById('ci-notes').value.trim();

  const btn = document.getElementById('ci-submit-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const ts = new Date().toISOString();

  // Atomic check-in: logs the check-in AND updates the hive's status in one
  // round trip via the submit_checkin() Postgres function (v2_6_sync.sql),
  // instead of the old two-step insert-then-update that could partially
  // fail and leave the checkin log and hive status out of sync.
  const { error } = await db.rpc('submit_checkin', {
    p_hive_id: hiveId,
    p_status: status,
    p_notes: notes || null
  });
  if (error) {
    console.error('submit_checkin failed:', error);
    showToast(`⚠ Check-in failed: ${error.message}`);
    btn.disabled = false; btn.textContent = 'Submit';
    return;
  }

  // Update local state only after confirmed save
  const hive = allHives.find(h => h.id === hiveId);
  if (hive) {
    hive.status = status;
    hive.last_verified_at = ts;
    if (hive._marker) { clusterGroup.removeLayer(hive._marker); addMarker(hive); }
  }

  btn.disabled = false; btn.textContent = 'Submit';
  closeCheckinModal();
  const msgs = { active:'🐝 Active — thank you!', gone:'👻 Gone — noted', uncertain:'🤔 Uncertain — recorded' };
  showToast(msgs[status]);
}


// ═══════════════════════════════════════
// SMART SEARCH BAR (v2.3)
// ═══════════════════════════════════════
// ═══════════════════════════════════════
// SMART SEARCH (v2.3) — geocode only, no keyword fallback
// ═══════════════════════════════════════
function doSmartSearch() {
  const val = document.getElementById('smart-search-input').value.trim();
  if (!val) return;
  // Bare numeric queries (zip/postal codes) are unreliable worldwide —
  // the same digits can match a real place in an entirely different
  // country, and there's no good way to disambiguate a bare number with
  // no country context. Rather than silently landing somewhere wrong,
  // decline up front and point to a more reliable query type. This
  // matches the same "zip codes are unreliable globally" call already
  // made for the filter-drawer search (see doSearch() below).
  if (/^\d[\d\s-]*$/.test(val)) {
    showToast('Zip codes aren\'t reliable worldwide — try a city or landmark name instead');
    return;
  }
  showToast('Locating…');
  // Bias results toward the map's current center so that, e.g., a search
  // for a common place name prefers the instance nearest the user over
  // a same-named place elsewhere in the world.
  const bias = map.getCenter();
  const biasParams = `&lat=${bias.lat}&lon=${bias.lng}&location_bias_scale=0.5`;
  fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(val)}${biasParams}&limit=1`)
    .then(r => r.json())
    .then(data => {
      if (!data.features?.length) {
        showToast('Location not found — try a city name or landmark');
        return;
      }
      const [lng, lat] = data.features[0].geometry.coordinates;
      map.setView([lat, lng], 11);
      toggleMapSearch(false); // collapse back to the icon on a successful search
    })
    .catch(() => showToast('Search unavailable — check your connection'));
}

// ═══════════════════════════════════════
// FILTER DRAWER (v2.3) — type + notes search
// ═══════════════════════════════════════
let activeNotesQuery = '';

function matchesNotesQuery(hive, q) {
  if (!q) return true;
  return [hive.name, hive.description, hive.city, hive.state, hive.zip, hive.type, hive.notes]
    .filter(Boolean).join(' ').toLowerCase().includes(q);
}

function reapplyFilters() {
  const q = activeNotesQuery.toLowerCase();
  let filtered = activeFilter === 'all' ? allHives : allHives.filter(h => h.type === activeFilter);
  if (q) filtered = filtered.filter(h => matchesNotesQuery(h, q));
  clusterGroup.clearLayers();
  filtered.forEach(h => clusterGroup.addLayer(h._marker));
  visibleHives = filtered;
  if (showRadii) {
    radiusCircles.forEach(c => map.removeLayer(c));
    radiusCircles = [];
    visibleHives.forEach(h => {
      if (h.lat && h.lng) radiusCircles.push(
        L.circle([h.lat, h.lng], { radius: 4828, color:'#2196f3', weight:1, opacity:0.5, fillOpacity:0.05 }).addTo(map)
      );
    });
  }
  updateCounts();
  updateFilterBadge();
}

function updateDrawerCounts() {
  const q = activeNotesQuery.toLowerCase();
  const notesFiltered = allHives.filter(h => matchesNotesQuery(h, q));
  const elAll = document.getElementById('count-all');
  if (elAll) elAll.textContent = notesFiltered.length.toLocaleString();
  ['Live Tree','Dead Tree','Man Made','Ground'].forEach(t => {
    const el = document.getElementById('count-' + t);
    if (el) el.textContent = notesFiltered.filter(h => h.type === t).length;
  });
}

function updateFilterBadge() {
  const isFiltered = activeFilter !== 'all' || activeNotesQuery !== '';
  const btn = document.getElementById('filter-drawer-btn');
  if (btn) {
    btn.classList.toggle('active', isFiltered);
    btn.title = isFiltered ? 'Filtered view active — tap to change' : 'Filter hives';
  }
  const clearBtn = document.getElementById('filter-clear-btn');
  if (clearBtn) clearBtn.style.display = isFiltered ? 'flex' : 'none';
  const drawerClear = document.getElementById('fd-clear-btn');
  if (drawerClear) drawerClear.style.display = isFiltered ? 'block' : 'none';
}

function clearAllFilters() {
  activeNotesQuery = '';
  activeFilter = 'all';
  const ni = document.getElementById('fd-notes-input');
  if (ni) ni.value = '';
  ['all','Live Tree','Dead Tree','Man Made','Ground'].forEach(t => {
    const el = document.getElementById('fd-' + t);
    if (el) el.classList.toggle('active', t === 'all');
  });
  reapplyFilters();
}

function onDrawerNotesInput(val) {
  activeNotesQuery = val.trim();
  updateDrawerCounts();
  reapplyFilters();
}

function openFilterDrawer() {
  const radOn = document.getElementById('fd-radius-toggle');
  if (radOn) radOn.checked = showRadii;
  syncRadiusToggleUI(showRadii);
  const ni = document.getElementById('fd-notes-input');
  if (ni) ni.value = activeNotesQuery;
  updateDrawerCounts();
  updateFilterBadge();
  document.getElementById('filter-drawer').classList.add('open');
}

function closeFilterDrawer() {
  document.getElementById('filter-drawer').classList.remove('open');
}

function fdFilterType(type) {
  activeFilter = type;
  ['all','Live Tree','Dead Tree','Man Made','Ground'].forEach(t => {
    const el = document.getElementById('fd-' + t);
    if (el) el.classList.toggle('active', t === type);
  });
  reapplyFilters();
}

function toggleRadiiFromDrawer(on) {
  syncRadiusToggleUI(on);
  if (on !== showRadii) toggleRadii();
}

function syncRadiusToggleUI(on) {
  const thumb = document.getElementById('fd-radius-thumb');
  const track = document.getElementById('fd-radius-track');
  if (thumb) {
    thumb.style.transform = on ? 'translateX(22px)' : 'translateX(0)';
    thumb.style.background = on ? '#f5a623' : '#fff';
    thumb.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
  }
  if (track) track.style.background = on ? 'rgba(245,166,35,0.55)' : '#c8b89a';
}

// Keep drawer type buttons in sync when filterType() is called externally
const _origFilterType = filterType;
filterType = function(type) {
  _origFilterType(type);
  ['all','Live Tree','Dead Tree','Man Made','Ground'].forEach(t => {
    const el = document.getElementById('fd-' + t);
    if (el) el.classList.toggle('active', t === type);
  });
  updateFilterBadge();
};

// ═══════════════════════════════════════
// LEARN TAB — data-driven hub + module reader
// Content source of truth: BEELINING_GUIDE.md. Every module below is one
// "## MODULE n" from that guide; don't re-author facts here — if the guide
// changes, update the matching module object so the two never drift.
// See LEARN_TAB_BUILD_BRIEF.md §2 for the content-model rationale.
// ═══════════════════════════════════════

// Tiny inline formatter: **bold**, *italic*, and [1][2]-style citation
// markers (rendered as small superscript refs, matching the approved
// learn-module3-sample.html treatment).
function lvFmt(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/((?:\[\d+\])+)/g, '<sup class="ref">$1</sup>');
}

const MODULES = [
  {
    id: 1, title: "What Beelining Is", kicker: "The Hook",
    level: "Beginner", readMin: 2, prereq: [], track: ['curious','tryit'],
    chips: ["Everyone", "Beginner", "No prereqs"], diagram: 'hero',
    blocks: [
      { type:'p', cls:'lead', text:"Somewhere within a mile or two of where you're standing, there is almost certainly a colony of honey bees living wild — inside a hollow tree, a wall cavity, or an old chimney. You can't see it. But the bees visiting the flowers around you know exactly where it is, and if you know the trick, they will lead you straight to it." },
      { type:'p', text:"That trick is called **beelining** (also *bee hunting* or *bee coursing*). You catch a few foraging bees, feed them sugar syrup until they're happy, and let them go. A fed bee flies in a straight, purposeful line directly home — the original \"beeline.\" You note the direction, move along it, and repeat, closing in until you find the colony in its tree.[1][2]" },
      { type:'diagram', id:'hero', caption:"A bee's beeline — from flowers to the colony." },
      { type:'p', text:"It has been described as a blend of orienteering, treasure hunting, and geocaching — a genuine encounter with wild nature that challenges both mind and body.[8] No expensive gear, no need to own bees, and every colony you find is a real scientific data point." },
      { type:'callout', label:"Why it matters to SaveTheHives", text:"Wild colonies that survive winter after winter without any human treatment are living proof of natural disease resistance. They are the untreated control group that honey bee research desperately needs. Every wild hive you locate and log helps map where these survivors are. You are not just having an adventure — you are doing frontline citizen science." },
    ],
  },
  {
    id: 2, title: "A Short History", kicker: "The Story",
    level: "Beginner", readMin: 3, prereq: [], track: ['curious'],
    chips: ["Curious readers", "Beginner", "No prereqs"], diagram: null,
    blocks: [
      { type:'p', cls:'lead', text:"Beelining is old. As early as the 1700s, people used bait, compasses, and patient observation to find wild bee nests.[1] In the days before cheap sugar, a wild \"bee tree\" full of honey was a genuine prize, and in Appalachia bee hunting was a serious occupation — a way to get a season's sweetener, and sometimes to capture a wild colony to keep.[2] Henry David Thoreau went bee hunting; so did countless farmers and woodsmen whose names we'll never know." },
      { type:'p', text:"The craft nearly disappeared as cheap sugar and managed beekeeping made wild honey unnecessary. But it never fully died, and it has had two great chroniclers:" },
      { type:'list', items:[
        "**George Harold Edgell**, a Harvard art historian and bee hunter of fifty years, wrote *The Bee Hunter* (Harvard University Press, 1949) — a slim, witty classic now in the public domain and free to read online.[3] Much of the practical method traces to Edgell.",
        "**Thomas D. Seeley**, a Cornell biologist and one of the world's leading honey bee scientists, revived the pastime for a modern audience in *Following the Wild Bees* (Princeton University Press, 2016), weaving the how-to together with the biology of wild colonies.[8]",
      ]},
      { type:'p', text:"There's also a scientific thread running underneath all of this. In the mid-20th century, **Karl von Frisch** decoded the honey bee \"waggle dance\" — the figure-eight movement by which a returning forager tells her sisters both the *direction* and the *distance* of a food source. He won a Nobel Prize for it in 1973.[6][7] Beelining is, in a sense, you eavesdropping on the same information the bees share with each other." },
      { type:'callout', label:"A living tradition", text:"You are stepping into a genuinely centuries-old tradition. That's part of the fun." },
    ],
  },
  {
    id: 3, title: "Why a Fed Bee Points Home", kicker: "The Theory",
    level: "Beginner–Intermediate", readMin: 4, prereq: [1], track: ['curious','tryit','maker'],
    chips: ["Anyone curious about the why", "Beginner–Intermediate", "Builds on Module 1"], diagram: 'triangulation',
    blocks: [
      { type:'p', cls:'lead', text:"Three simple facts about honey bees make the whole craft possible." },
      { type:'fact', num:1, title:"A fed forager flies straight home.", text:"When a bee finds a rich, reliable food source, she fills her honey crop and returns to the nest by the most direct route she can — a straight line. Watch her leave and you have a *bearing* pointing (roughly) at the colony.[1][2]" },
      { type:'fact', num:2, title:"Bees are fast and steady, so time equals distance.", text:"An unloaded forager flies at roughly 15 mph; loaded with syrup, closer to 12 mph.[5] Because that speed is fairly consistent, the *round-trip time* — from when she leaves your bait to when she comes back for more — is a rough odometer for how far away home is." },
      { type:'table', caption:"Round-trip time → distance to the colony", headers:["Round-trip time","Approx. distance"], rows:[
        ["Under ~3 min","Very close — under ¼ mile, maybe in sight"],
        ["~5 min","Up to about half a mile"],
        ["~10 min","About a mile"],
        ["10–20 min","Up to a couple of miles"],
      ]},
      { type:'note', text:"These are field rules of thumb, not precision instruments — terrain, wind, and the individual bee all matter. Flat open ground gives the fastest, most reliable times; hills and thick woods slow bees down.[4][5]" },
      { type:'fact', num:3, title:"Two lines cross at one point.", text:"A single bearing tells you the *direction* home but not the *distance* along it — the colony could be anywhere on that line. Take a second bearing from a different spot, and the two lines cross. Where they intersect is the colony.[3]" },
      { type:'diagram', id:'triangulation', caption:"<b>Two lines, one answer.</b> Where the bearings cross, the colony waits." },
      { type:'callout', label:"The honest heart of it", text:"You can never get a perfect line from a single bee's departure.[3] Bees circle to orient before settling onto their line; your compass has its own error; the wind nudges things. So beelining is a game of **repetition and refinement** — many bees, several stations, closing in. The colony reveals itself gradually, not in one triumphant measurement." },
    ],
  },
  {
    id: 4, title: "Choose Your Method", kicker: "The Methods",
    level: "Intermediate", readMin: 6, prereq: [1,3], track: ['tryit','maker'],
    chips: ["Ready to try", "Intermediate", "Builds on Modules 1 & 3"], diagram: 'terrain-chooser',
    blocks: [
      { type:'p', cls:'lead', text:"There is no single \"right\" way to beeline. The best method depends on your terrain, how much room you have to move, and how much time you've got. Here are the three main approaches, from simplest to most rigorous. Many hunters combine them." },
      { type:'h3', text:"Method A — Single-Line \"Follow and Leapfrog\"" },
      { type:'sub', text:"Best for: open country, fields, farmland, meadows — anywhere you can see a distance and walk freely." },
      { type:'p', text:"The oldest and most intuitive method. Establish your bait, get bees coming and going, and note the direction they leave. Then pick up your box and **move 100–300 yards along that line**, re-establish the bait, and get a fresh direction from closer in. Repeat. Each move shortens the distance to the colony, so each new bearing is more accurate than the last, until you're close enough to spot the nest entrance.[3][2]" },
      { type:'p', text:"This is the \"leapfrog,\" and it's powerful because triangulation error shrinks as you get closer. Its weakness is that it needs open, walkable ground: if a river, cliff, highway, or fence line sits between you and the bees, you can't follow." },
      { type:'h3', text:"Method B — Two-Station Triangulation" },
      { type:'sub', text:"Best for: broken terrain where you can reach two good vantage points but can't walk a straight line between them." },
      { type:'p', text:"Take a bearing from Station A. Then move a good distance to the side — a quarter mile is classic — and take a bearing on the same colony from Station B. Draw both lines on a map; the colony is where they cross.[3] You never have to walk the bee line itself, which is what makes this the method of choice when the direct path is blocked." },
      { type:'callout', label:"The critical subtlety", text:"the angle between your two lines matters more than the distance you walked. Two bearings that cross at a wide angle (closer to 90°) pin the spot tightly; two that cross at a shallow angle leave a long, uncertain smear. So move *across* the bee line, not along it." },
      { type:'h3', text:"Method C — Timed Distance + Direction" },
      { type:'sub', text:"Best for: adding a distance estimate to any single line, or when you can only work from one spot." },
      { type:'p', text:"Mark a few bees (a dab of paint — see Module 6) and use a stopwatch. The direction of departure gives your line; the round-trip time (Module 3's table) tells you roughly *how far* along it to look.[4] It's the least precise on its own, but it turns a single bearing into a rough \"somewhere about half a mile that-a-way.\"" },
      { type:'table', caption:"Which to choose — a quick guide", headers:["Your situation","Best method"], rows:[
        ["Open fields, can walk freely","A — Follow & leapfrog"],
        ["Rivers/roads/fences blocking the path","B — Two-station triangulation"],
        ["Stuck at one good spot","C — Timed distance + a bearing"],
        ["Hilly, wooded, mixed","Combine B and C, then finish with A"],
        ["You want the tightest possible fix","Start with B, then leapfrog (A) the final stretch"],
      ]},
      { type:'diagram', id:'terrain-chooser', caption:"Match your terrain to a method." },
    ],
  },
  {
    id: 5, title: "Safety, Ethics & the Law", kicker: "Read Before You Go",
    level: "All — mandatory before fieldwork", readMin: 4, prereq: [], track: ['tryit'],
    chips: ["Everyone", "Read before fieldwork", "No prereqs"], diagram: null,
    blocks: [
      { type:'p', cls:'lead', text:"Beelining is gentle, low-impact, and safe when done thoughtfully — but a few things genuinely matter." },
      { type:'callout', label:"Leave the colony where it is", text:"For SaveTheHives, the goal is to *find, log, and study* wild colonies — never to cut, rob, or remove them. A wild colony that has survived on its own is exactly the treatment-free survivor stock that matters most to research. Finding it and marking it on the map is the whole win." },
      { type:'callout', label:"Know whose land you're on", text:"Bees that nest in a tree legally belong to the owner of the land the tree stands on, and you cannot enter someone's property to pursue them without risking trespass.[9] Get permission before following a line onto private land. A friendly knock and an explanation of the citizen-science project goes a long way." },
      { type:'callout', label:"Don't handle a colony you find", text:"Locating a nest is safe. Poking at it is not. Feral colonies in parts of the U.S. — especially the Southwest — can be Africanized and defensive.[9] Observe from a comfortable distance. If a colony needs removing for human safety, that's a job for a licensed professional." },
      { type:'callout', label:"Mind yourself in the field", text:"You'll be watching the sky and walking with your head up. Watch your footing, carry water, tell someone where you're going, and be tick- and terrain-aware. Getting *your* stings while beelining is rare, but a dab of common sense keeps it that way." },
      { type:'callout', label:"A note on the bees you catch", text:"You're borrowing them for a few minutes and feeding them well. Release them unharmed. The paint dot used for marking (Module 6) is a standard, bee-safe beekeeping product and does them no harm." },
    ],
  },
  {
    id: 6, title: "The Bee Box & Your Kit", kicker: "Build or Buy",
    level: "Intermediate", readMin: 6, prereq: [4], track: ['tryit','maker'],
    chips: ["Ready to equip", "Intermediate", "Builds on Module 4"], diagram: 'bee-box',
    blocks: [
      { type:'p', cls:'lead', text:"The **bee box** (or *bee lining box*) is a small wooden box, roughly the size of a paperback, with two compartments and a sliding or hinged lid. The design most people use is patterned on the one in Edgell's *The Bee Hunter*.[3][10] It does three jobs:" },
      { type:'list', items:[
        "**Catch** — you trap a forager from a flower in one compartment.",
        "**Feed** — you slide her through to a second compartment holding a small piece of honeycomb soaked in sugar syrup, scented with anise. She calms, drinks her fill.",
        "**Release & watch** — you open the lid and watch which way she flies home.[10]",
      ]},
      { type:'p', text:"Other bees she recruits will start arriving at the box too, and *their* departure direction is your bee line.[10]" },
      { type:'diagram', id:'bee-box', caption:"Catch chamber, feed chamber with comb, sliding lid — plus the kit." },
      { type:'p', text:"**Buy one:** ready-made bee lining boxes (often sold with the comb and a plug) are available from beekeeping suppliers such as Betterbee and PerfectBee, typically as an inexpensive kit.[10][11] A good starting point if you'd rather not build." },
      { type:'p', text:"**Build one:** it's a genuinely easy weekend woodworking project — untreated pine or cedar, a couple of compartments, a clear or sliding top so you can see the bee, and a way to move her from the catch side to the feed side. (SaveTheHives plans to publish a free printable plan.)[3][10]" },
      { type:'table', caption:"The rest of the kit", headers:["Item","What it's for"], rows:[
        ["Sugar syrup","The bait that fills the bee's crop — roughly 1:1 sugar and water."],
        ["Anise oil (or lemongrass/wintergreen)","Scent that draws more bees to the box.[11] Avoid plain store honey — disease risk."],
        ["Compass","Reading the bee line's bearing — a baseplate compass, or your phone."],
        ["Marking pen","Bee-safe queen-marking pens for timing round trips and telling bees apart.[12]"],
        ["Stopwatch","Timing round trips for distance (Method C). Your phone is fine."],
        ["Notebook or the app","Logging bearings, times, and the find — straight into the SaveTheHives map."],
        ["Water, hat, sturdy shoes","You. Bee season is hot and you'll be out a while."],
      ]},
    ],
  },
  {
    id: 7, title: "Step by Step: Your First Hunt", kicker: "The Walkthrough",
    level: "Intermediate", readMin: 7, prereq: [4,5,6], track: ['tryit'],
    chips: ["Doers", "Intermediate", "Builds on Modules 4, 5 & 6"], diagram: null,
    blocks: [
      { type:'p', cls:'lead', text:"A walkthrough of a classic hunt, combining the methods above. Pick a **warm, calm, sunny day**. Late summer into early fall is prime — bees are working hard to stock up for winter and are eager for an easy food source.[1]" },
      { type:'fact', num:1, title:"Find foragers.", text:"Locate a patch of flowers with honey bees actively working it. Goldenrod, aster, and other late-season bloom are magnets." },
      { type:'fact', num:2, title:"Catch and feed.", text:"Trap a forager in the box, move her to the syrup-and-comb compartment, and let her drink. A calm, fully-fed bee is the goal — a startled one won't give a clean line.[1]" },
      { type:'fact', num:3, title:"Mark her (optional but useful).", text:"A tiny dab of paint on the thorax lets you recognize this individual when she returns, and time her round trip.[12]" },
      { type:'fact', num:4, title:"Release and take the line.", text:"Open the lid. She'll circle a moment to orient, then set off. Sight along her departure with your compass. *Don't trust the very first bee* — take several and average them.[3]" },
      { type:'fact', num:5, title:"Time the round trip (for distance).", text:"Note the clock when she leaves and when she returns for more syrup. Compare to Module 3's table for a rough distance.[4]" },
      { type:'fact', num:6, title:"Establish the line, then close in.", text:"Once several bees agree on a direction, you have your bee line. Open ground → leapfrog (Method A). Blocked path → triangulate (Method B). Repeat, tightening each time." },
      { type:'fact', num:7, title:"Find the nest.", text:"Watch for bees streaming in and out of a knothole, a gap in a wall, a hollow limb. Look on the sunny side of trunks; watch the sky for flight lines converging." },
      { type:'fact', num:8, title:"Log it — don't disturb it.", text:"Mark the location in SaveTheHives: coordinates, the kind of cavity, a photo if you can get one safely from a distance. Then leave it in peace. You've just added a wild survivor colony to the map." },
      { type:'callout', label:"A realistic expectation", text:"Your first hunt may not end in a found tree, and that's normal. Beelining rewards repeat outings and local knowledge. Even a partial line is useful data and a foundation for next time." },
    ],
  },
  {
    id: 8, title: "Beelining Meets Modern Tech", kicker: "Where SaveTheHives Fits",
    level: "Intermediate", readMin: 3, prereq: [3], track: ['maker'],
    chips: ["Tech-curious", "Intermediate", "Builds on Module 3"], diagram: null,
    blocks: [
      { type:'p', cls:'lead', text:"The classic method uses a paper map, a compass, and mental arithmetic. Modern tools can assist — with a big honest caveat." },
      { type:'p', text:"A smartphone gives you GPS coordinates, a compass, and a map in your pocket, which makes recording bearings and logging finds far easier than sketching lines on paper. SaveTheHives has experimented with a built-in **Pathfinder** tool that captures two bearings and triangulates a candidate location on the map automatically." },
      { type:'callout', label:"The honest limitation", text:"a phone can only be as good as its sensors. Phone compasses carry several degrees of error, and GPS under a tree canopy can wander by 10–20 meters. Those errors get *magnified* by distance and by shallow crossing angles — exactly like they do for a human with a handheld compass. **A bearing taken closer to the colony is always worth more than a clever calculation from far away.**" },
      { type:'p', text:"So think of technology as a *logbook and a rough guide*, not an autopilot. The craft is still the craft. The bees still have the last word." },
    ],
  },
  {
    id: 9, title: "The Waggle Dance", kicker: "How Bees Beeline to Each Other",
    level: "Beginner", readMin: 3, prereq: [], track: ['curious','maker'],
    chips: ["Everyone", "Beginner", "Pairs with Module 3"], diagram: 'waggle-decoder',
    blocks: [
      { type:'p', cls:'lead', text:"Here's the wonderful part: bees have been beelining to *each other* for millions of years. When a scout finds a rich patch of flowers, she flies home and — in the pitch dark of the hive, on the vertical face of the comb — she *dances* the directions to her sisters. It's called the **waggle dance**, and decoding it won Karl von Frisch a share of the 1973 Nobel Prize.[6][7]" },
      { type:'p', text:"The dance is a figure-eight with a straight \"waggle run\" up the middle, where she shimmies her abdomen rapidly side to side. Three things are encoded in it, and they are exactly the three things *you* work out when you beeline:[6][7][13]" },
      { type:'fact', num:1, title:"Direction — the angle of the run.", text:"The angle of the waggle run away from straight-up equals the angle of the flowers away from the sun. She translates the sky into gravity, in the dark, and her sisters translate it back into a heading when they fly out." },
      { type:'fact', num:2, title:"Distance — the length of the run.", text:"The longer she waggles, the farther the food. Roughly one second of waggling per kilometre. A quick little run means \"just outside\"; a long one means \"pack a lunch.\"" },
      { type:'fact', num:3, title:"Quality — the vigor of the dance.", text:"The faster she waggles and the more times she repeats the figure-eight, the better the find. The colony effectively *votes with its feet*, sending more foragers to the richest sources.[13]" },
      { type:'diagram', id:'waggle-decoder', caption:"Angle = direction, length = distance, vigor = quality." },
      { type:'p', text:"There's even a simpler version — the **round dance**, a plain little circle with no waggle, which means \"the food is close, just go out and search nearby.\" Near gets a round dance; far gets a waggle dance. Sound familiar? It's the same near/far logic as a bee's round-trip time being under three minutes versus twenty." },
      { type:'callout', label:"Same language", text:"When you stand in a field reading a bee's flight line, you're doing by eye and compass what she does by dance and gravity. Direction, distance, and how good the destination is — that's the actual structure of how bees share a location. SaveTheHives borrows these same three axes to guide you through this very guide. Watch for it." },
    ],
  },
];

const TRACKS = {
  curious: [1,2,9,3],
  tryit:   [1,3,4,5,6,7],
  maker:   [3,9,4,6,8],
};

const TRACK_META = {
  curious: { title:"I'm just curious", desc:"10 min · the wonder of it", icon:'eye' },
  tryit:   { title:"I want to try this", desc:"The full how-to, safety-first", icon:'compass', badge:'Popular' },
  maker:   { title:"I'm a maker / techie", desc:"Theory, kit, and the tech tie-in", icon:'tools' },
};

// End-of-track screen shown after the last module in a guided sequence —
// a deliberate landing point rather than firing a CTA (like opening the Add
// Hive form) straight off the reader's last "Next" tap. Someone who read a
// track just to learn shouldn't be dropped into a form; they land here and
// choose.
const TRACK_END = {
  tryit: {
    kicker: "You're Ready",
    title: "You've Got Everything for a First Hunt",
    body: "Pick a warm, calm day, grab your box, and give it a try. Found a colony? Log it here — every wild survivor you map helps the research. Not heading out today? No rush, the guide's always here to reread.",
    ctaLabel: "🐝 Log a Hive",
    cta: () => setTab('add'),
  },
  curious: {
    kicker: "The Wonder of It",
    title: "That's How Bees Talk to Each Other",
    body: "You now know the same trick the bees use on each other. Want to see it for real? The Try It path walks through everything — safety included — for a first hunt.",
    ctaLabel: "Start the Try-It Path",
    cta: () => learnStartTrack('tryit'),
  },
  maker: {
    kicker: "Theory, Kit & the Tech",
    title: "You've Got the Full Picture",
    body: "From triangulation to the Pathfinder tool's honest limits — you've seen how the pieces fit together and where the app's own edges are.",
    ctaLabel: "Back to Learn",
    cta: () => learnBackToHub(),
  },
};

// Numbered references from BEELINING_GUIDE.md's REFERENCES section — kept
// keyed by the same numbers used inline in module prose ([1], [2], etc.)
// so a module's citations resolve to a real, tappable source list instead
// of dangling superscript numbers.
const REFERENCES = {
  1: { title: "University of Arkansas Division of Agriculture — What is bee lining? | How to find feral bee colonies.", url: "https://www.uaex.uada.edu/farm-ranch/special-programs/beekeeping/beeliner.aspx" },
  2: { title: "Bee Lining: The Oldtimers' Way to Find Wild Beehives, Northern Woodlands.", url: "https://northernwoodlands.org/articles/article/bee-lining-the-oldtimers-way-to-find-wild-beehives" },
  3: { title: "George Harold Edgell, The Bee Hunter (Harvard University Press, 1949) — full public-domain text.", url: "https://www.gutenberg.org/files/65820/65820-h/65820-h.htm" },
  4: { title: "Beesource Beekeeping Forums — Wild bees, distance from bait per minute round trip.", url: "https://www.beesource.com/threads/wild-bees-distance-from-bait-per-minute-round-trip.320013/" },
  5: { title: "How Far Do Bees Travel? The Foraging Range Explained, Apiary Project.", url: "https://apiaryproject.com/blog/how-far-do-bees-travel-foraging-range" },
  6: { title: "Frisch Discovers That Bees Communicate Through Body Movements, EBSCO Research Starters.", url: "https://www.ebsco.com/research-starters/history/frisch-discovers-bees-communicate-through-body-movements" },
  7: { title: "The Honey Bee Dance Language, NC State Extension.", url: "https://content.ces.ncsu.edu/honey-bee-dance-language" },
  8: { title: "Thomas D. Seeley, Following the Wild Bees: The Craft and Science of Bee Hunting (Princeton University Press, 2016).", url: "https://press.princeton.edu/books/paperback/9780691191409/following-the-wild-bees" },
  9: { title: "County of San Diego — Feral Bees (property, liability, Africanized-bee cautions).", url: "https://www.sandiegocounty.gov/content/sdc/awm/bees/feral-bees.html" },
  10: { title: "Betterbee — Bee Lining Box, Comb and Plug.", url: "https://www.betterbee.com/bee-lining-bee-hunting/blb-bee-lining-box.asp" },
  11: { title: "PerfectBee — Bee Lining Box.", url: "https://www.perfectbee.com/store/accessories-and-tools/nucs-and-swarm-retrieval/bee-lining-box" },
  12: { title: "The Apiarist — How to: Queen marking.", url: "https://theapiarist.org/how-to-queen-marking/" },
  13: { title: "The Waggle Dance — How Bees Encode Distance and Direction, Apiary Project / Wikipedia.", url: "https://apiaryproject.com/blog/waggle-dance-how-bees-communicate" },
};

// Scan a module's blocks for every [n] citation actually used in its prose,
// so each module only shows the sources it really cites (not all 13 every
// time).
function lvCitedRefs(m) {
  const nums = new Set();
  const scan = (s) => { if (typeof s === 'string') (s.match(/\[(\d+)\]/g) || []).forEach(tag => nums.add(Number(tag.slice(1, -1)))); };
  m.blocks.forEach(b => {
    scan(b.text); scan(b.label); scan(b.title); scan(b.caption);
    if (b.items) b.items.forEach(scan);
    if (b.rows) b.rows.forEach(row => row.forEach(scan));
  });
  return [...nums].sort((a, b) => a - b);
}

function lvSourcesHTML(m) {
  const nums = lvCitedRefs(m);
  if (!nums.length) return '';
  const items = nums.map(n => {
    const ref = REFERENCES[n];
    return ref ? `<li><sup class="ref">[${n}]</sup> <a href="${ref.url}" target="_blank" rel="noopener noreferrer">${lvFmt(ref.title)}</a></li>` : '';
  }).join('');
  return `<details class="lv-sources">
    <summary>Sources (${nums.length})</summary>
    <ol class="lv-sources-list">${items}</ol>
  </details>`;
}

// ── progress (read state), persisted the same way dark mode is ──
function lvGetProgress() {
  try { return JSON.parse(localStorage.getItem('learnProgress') || '{}'); }
  catch { return {}; }
}
function lvMarkRead(id) {
  const p = lvGetProgress();
  p[id] = true;
  localStorage.setItem('learnProgress', JSON.stringify(p));
}
function lvIsRead(id) { return !!lvGetProgress()[id]; }
function lvModule(id) { return MODULES.find(m => m.id === id); }

// ── current reading session (either a guided track or free browsing) ──
let lvSession = { track: null, index: 0, moduleId: null };

function lvIconSVG(name) {
  const icons = {
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polygon points="12,7 14.5,12 12,17 9.5,12" fill="currentColor" stroke="none"/></svg>',
    tools: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 005.4-5.4l-2.1 2.1-2-2z"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  };
  return icons[name] || '';
}

// ── Diagrams ──
// Commissioned watercolor/gouache illustrations (naturalist field-guide
// style), matching learn-module3-sample.html's approved reference. See
// misc/LEARN_TAB_ILLUSTRATION_BRIEF.md for the prompts these came from.
// Files live in images/learn-*.jpg. A tiny inline-SVG fallback covers any
// future/unreferenced diagram id so a typo never renders a blank card.
function lvMiniBee(x, y, rotate) {
  return `<g transform="translate(${x} ${y}) rotate(${rotate})">
    <ellipse cx="0" cy="0" rx="5.4" ry="3.2" fill="none" stroke="var(--honey-dark)" stroke-width="1.4"/>
    <line x1="-2.2" y1="-3.2" x2="-2.2" y2="3.2" stroke="var(--honey-dark)" stroke-width="1"/>
    <line x1="1.6" y1="-3.2" x2="1.6" y2="3.2" stroke="var(--honey-dark)" stroke-width="1"/>
    <ellipse cx="-1" cy="-4.6" rx="4.6" ry="2.4" fill="none" stroke="var(--honey)" stroke-width="1"/>
  </g>`;
}

function lvDiagramSVG(id) {
  if (id === 'hero') {
    return `<img src="images/learn-hero.jpg" alt="A honeybee flying a dead-straight line from a wildflower meadow to a distant oak with a wild colony inside." loading="lazy">`;
  }
  if (id === 'triangulation') {
    return `<img src="images/learn-triangulation.jpg" alt="Two observer stations, A and B, each sighting a straight bearing line; the lines cross at the same wild-colony tree." loading="lazy">`;
  }
  if (id === 'terrain-chooser') {
    return `<div class="lv-terrain-grid">
      <div class="lv-terrain-cell"><img src="images/learn-terrain-a.jpg" alt="Open hayfield, method A: follow and leapfrog." loading="lazy"></div>
      <div class="lv-terrain-cell"><img src="images/learn-terrain-b.jpg" alt="Blocked by a winding river, method B: two-station triangulation." loading="lazy"></div>
      <div class="lv-terrain-cell"><img src="images/learn-terrain-c.jpg" alt="Single vantage hilltop, method C: timed distance and direction." loading="lazy"></div>
      <div class="lv-terrain-cell"><img src="images/learn-terrain-woods.jpg" alt="Dense woods, combine methods B then A." loading="lazy"></div>
    </div>`;
  }
  if (id === 'bee-box') {
    return `<img src="images/learn-bee-box.jpg" alt="An open two-compartment wooden bee box with catch and feed chambers, next to a compass, marking pen, syrup jar, and stopwatch." loading="lazy">`;
  }
  if (id === 'waggle-decoder') {
    return `<img src="images/learn-waggle-decoder.jpg" alt="A honeybee mid-waggle-dance on the comb inside the hive, with the sun's angle and the dance run's angle shown as matching lines." loading="lazy">`;
  }
  // Fallback for any future/unreferenced diagram id (e.g. the optional
  // round-trip strip, or the Tier-B Waggle Compass) — small and honest
  // about being a placeholder, not a big empty box.
  return `<svg viewBox="0 0 120 90" role="img" aria-label="Illustration coming soon">
    <path d="M40 20 L60 8 L80 20 L80 44 L60 56 L40 44 Z" fill="none" stroke="var(--border)" stroke-width="2"/>
    ${lvMiniBee(60, 32, 0)}
    <text x="60" y="76" text-anchor="middle" font-family="Outfit, sans-serif" font-size="9" fill="var(--text-muted)">illustration soon</text>
  </svg>`;
}

// ── Hub ──
function renderLearnHub() {
  const hero = document.getElementById('lv-hero');
  if (hero) {
    hero.innerHTML = `
      <div class="diagram" style="margin-bottom:16px;">${lvDiagramSVG('hero')}</div>
      <h1 class="lv-hero-title">Could there be a wild bee colony within a mile of you right now?</h1>
      <p class="lv-hero-sub">The bees know where. Learn beelining — the 300-year-old craft of making them show you.</p>
    `;
  }

  const cards = document.getElementById('lv-path-cards');
  if (cards) {
    cards.innerHTML = Object.keys(TRACKS).map(key => {
      const meta = TRACK_META[key];
      return `
        <div class="lv-card" onclick="learnStartTrack('${key}')">
          <div class="lv-card-icon">${lvIconSVG(meta.icon)}</div>
          <div class="lv-card-body">
            <div class="lv-card-title">${meta.title}${meta.badge ? `<span class="lv-card-badge">${meta.badge}</span>` : ''}</div>
            <div class="lv-card-desc">${meta.desc}</div>
          </div>
          <div class="lv-card-chevron">${lvIconSVG('chevron')}</div>
        </div>`;
    }).join('');
  }

  const sub = document.getElementById('lv-checklist-sub');
  const readCount = MODULES.filter(m => lvIsRead(m.id)).length;
  if (sub) sub.textContent = `${readCount} of ${MODULES.length} read`;

  const list = document.getElementById('lv-checklist');
  if (list) {
    const firstUnreadId = (MODULES.find(m => !lvIsRead(m.id)) || {}).id;
    list.innerHTML = MODULES.map(m => {
      const done = lvIsRead(m.id);
      const isCurrent = !done && m.id === firstUnreadId;
      const softLocked = !done && m.prereq.length && !m.prereq.every(p => lvIsRead(p));
      const stateGlyph = done ? '✓' : (softLocked ? '🔒' : (isCurrent ? '▶' : ''));
      const rowClass = done ? 'done' : (isCurrent ? 'current' : (softLocked ? 'locked' : ''));
      return `
        <div class="lv-row ${rowClass}" onclick="learnOpenModule(${m.id})">
          <div class="lv-row-num">${m.id}</div>
          <div class="lv-row-body">
            <div class="lv-row-title">${m.title}</div>
            <div class="lv-row-meta">
              <span class="lv-row-chip">${m.readMin} min</span>
              <span class="lv-row-chip">${m.level.split(' ')[0].split('–')[0]}</span>
            </div>
          </div>
          <div class="lv-row-state">${stateGlyph}</div>
        </div>`;
    }).join('');
  }
}

function openLearnHub() {
  document.getElementById('learn-hub').style.display = '';
  document.getElementById('learn-reader').style.display = 'none';
  renderLearnHub();
}
function learnBackToHub() {
  lvSession = { track: null, index: 0, moduleId: null };
  openLearnHub();
}

function learnStartTrack(trackKey) {
  const seq = TRACKS[trackKey];
  if (!seq || !seq.length) return;
  lvSession = { track: trackKey, index: 0, moduleId: seq[0] };
  learnRenderReader();
}

// Freely browse a single module from the checklist (no track context).
function learnOpenModule(id) {
  lvSession = { track: null, index: 0, moduleId: id };
  learnRenderReader();
}

function lvBlockHTML(b) {
  switch (b.type) {
    case 'p': return `<p class="${b.cls || ''}">${lvFmt(b.text)}</p>`;
    case 'h3': return `<h3 class="lv-h3" style="font-size:1.05rem;font-weight:700;margin:22px 0 4px;color:var(--text);">${lvFmt(b.text)}</h3>`;
    case 'sub': return `<p class="note" style="margin-top:-2px;">${lvFmt(b.text)}</p>`;
    case 'note': return `<p class="note">${lvFmt(b.text)}</p>`;
    case 'list': return `<ul class="lv-list">${b.items.map(i => `<li>${lvFmt(i)}</li>`).join('')}</ul>`;
    case 'fact': return `<div class="fact"><div class="num">${b.num}</div><div class="body"><strong>${lvFmt(b.title)}</strong><p>${lvFmt(b.text)}</p></div></div>`;
    case 'callout': return `<div class="callout"><p style="margin:0"><strong>${lvFmt(b.label)}:</strong> ${lvFmt(b.text)}</p></div>`;
    case 'table': return `<div class="tbl-wrap"><table><caption>${lvFmt(b.caption)}</caption><thead><tr>${b.headers.map(h => `<th>${lvFmt(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${lvFmt(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    case 'diagram': return `<figure><div class="diagram">${lvDiagramSVG(b.id)}</div><figcaption>${lvFmt(b.caption)}</figcaption></figure>`;
    default: return '';
  }
}

function learnRenderTrackEnd() {
  const t = TRACK_END[lvSession.track];
  if (!t) { learnBackToHub(); return; }

  document.getElementById('learn-hub').style.display = 'none';
  document.getElementById('learn-reader').style.display = '';

  document.getElementById('lv-modcount').textContent = 'Track complete';
  document.getElementById('lv-readchip-text').textContent = 'Done';
  document.getElementById('lv-progress-fill').style.width = '100%';

  document.getElementById('lv-reader-body').innerHTML = `
    <p class="kicker">${t.kicker}</p>
    <h1 class="title">${t.title}</h1>
    <p class="lead">${lvFmt(t.body)}</p>
  `;
  document.getElementById('lv-reader-body').scrollTop = 0;
  const scroller = document.getElementById('learn-reader');
  if (scroller) scroller.scrollTop = 0;

  const prevBtn = document.getElementById('lv-prev-btn');
  const nextBtn = document.getElementById('lv-next-btn');
  const nextLabel = document.getElementById('lv-next-label');
  prevBtn.style.visibility = '';
  nextLabel.textContent = t.ctaLabel;
  nextBtn.onclick = t.cta;
}

function learnRenderReader() {
  if (lvSession.moduleId === 'end') { learnRenderTrackEnd(); return; }
  const m = lvModule(lvSession.moduleId);
  if (!m) return;
  lvMarkRead(m.id);

  document.getElementById('learn-hub').style.display = 'none';
  document.getElementById('learn-reader').style.display = '';

  const seq = lvSession.track ? TRACKS[lvSession.track] : null;
  const posInSeq = seq ? seq.indexOf(m.id) : -1;
  const totalInSeq = seq ? seq.length : MODULES.length;
  const displayN = seq ? posInSeq + 1 : m.id;

  document.getElementById('lv-modcount').textContent = `Module ${displayN} of ${totalInSeq}`;
  document.getElementById('lv-readchip-text').textContent = `${m.readMin} min`;
  document.getElementById('lv-progress-fill').style.width = `${Math.round((displayN / totalInSeq) * 100)}%`;

  const chipsHTML = m.chips.map((c, i) => `<span class="chip${i === 1 ? ' level' : ''}">${c}</span>`).join('');
  const bodyHTML = m.blocks.map(lvBlockHTML).join('') + lvSourcesHTML(m);
  document.getElementById('lv-reader-body').innerHTML = `
    <p class="kicker">${m.kicker}</p>
    <h1 class="title">${m.title}</h1>
    <div class="chips">${chipsHTML}</div>
    ${bodyHTML}
  `;
  document.getElementById('lv-reader-body').scrollTop = 0;
  const scroller = document.getElementById('learn-reader');
  if (scroller) scroller.scrollTop = 0;

  // Prev / Next wiring
  const prevBtn = document.getElementById('lv-prev-btn');
  const nextBtn = document.getElementById('lv-next-btn');
  const nextLabel = document.getElementById('lv-next-label');

  if (seq) {
    prevBtn.style.visibility = posInSeq > 0 ? '' : 'hidden';
    if (posInSeq < seq.length - 1) {
      const nm = lvModule(seq[posInSeq + 1]);
      nextLabel.textContent = `Next: ${nm.title}`;
      nextBtn.onclick = learnNext;
    } else {
      // Last real module in the track — Continue takes you to a dedicated
      // completion screen (learnRenderTrackEnd), not straight into a CTA/
      // form. Someone just reading through shouldn't be dropped into
      // "Log a Hive" without a deliberate choice to do so.
      nextLabel.textContent = 'Continue';
      nextBtn.onclick = learnNext;
    }
  } else {
    // Free browsing — walk sequential module order, wrap to hub at the end.
    prevBtn.style.visibility = m.id > 1 ? '' : 'hidden';
    if (m.id < MODULES.length) {
      nextLabel.textContent = `Next: ${lvModule(m.id + 1).title}`;
      nextBtn.onclick = learnNext;
    } else {
      nextLabel.textContent = 'Done — Back to Learn';
      nextBtn.onclick = learnBackToHub;
    }
  }
}

function learnNext() {
  if (lvSession.track) {
    if (lvSession.moduleId === 'end') return; // the end screen's own button is the way forward from here
    const seq = TRACKS[lvSession.track];
    const idx = seq.indexOf(lvSession.moduleId);
    if (idx < seq.length - 1) {
      lvSession.index = idx + 1;
      lvSession.moduleId = seq[idx + 1];
    } else {
      lvSession.moduleId = 'end'; // last module done — land on the completion screen, not a CTA
    }
    learnRenderReader();
  } else if (lvSession.moduleId < MODULES.length) {
    lvSession.moduleId += 1;
    learnRenderReader();
  }
}

function learnPrev() {
  if (lvSession.track) {
    const seq = TRACKS[lvSession.track];
    if (lvSession.moduleId === 'end') {
      lvSession.moduleId = seq[seq.length - 1];
      learnRenderReader();
      return;
    }
    const idx = seq.indexOf(lvSession.moduleId);
    if (idx > 0) {
      lvSession.index = idx - 1;
      lvSession.moduleId = seq[idx - 1];
      learnRenderReader();
    } else {
      learnBackToHub();
    }
  } else if (lvSession.moduleId > 1) {
    lvSession.moduleId -= 1;
    learnRenderReader();
  } else {
    learnBackToHub();
  }
}

