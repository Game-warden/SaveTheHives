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
// SUPABASE CONFIG
// ═══════════════════════════════════════
const SUPABASE_URL = 'https://nsujmizdawyoictpawxt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zdWptaXpkYXd5b2ljdHBhd3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NDEyNDgsImV4cCI6MjA5ODMxNzI0OH0.VOXEk4uyFq1jH0mvRW83LPPW8ZJp3MbylY6KiPKixTc';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let pendingAction = null; // resumes after sign-in
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

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
async function init() {
  initDarkMode();

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
  const loc = [hive.city, hive.state].filter(_locParts).join(', ') ||
    (hive.lat && hive.lng ? `${hive.lat.toFixed(2)}°, ${hive.lng.toFixed(2)}°` : 'Location unknown');
  const desc = hive.description || '';

  marker.bindPopup(`
    <div class="hive-popup">
      <div class="popup-type">
        <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></div>
        ${icon} ${hive.type}
      </div>
      <div class="popup-name">${hive.name || 'Anonymous Observer'}</div>
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
    const loc = [h.city, h.state].filter(_lp).join(', ') ||
      (h.lat && h.lng ? `${h.lat.toFixed(2)}°, ${h.lng.toFixed(2)}°` : '');
    return `
      <div style="background:rgba(255,255,255,0.04);border:1.5px solid var(--border);border-radius:var(--radius-md);padding:14px;cursor:pointer;box-shadow:var(--shadow-sm);transition:transform 0.15s,box-shadow 0.15s;"
           onclick="flyTo(${h.lat},${h.lng})">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
          <span style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">${icon} ${h.type}</span>
          ${h.userAdded ? '<span style="font-size:0.7rem;background:rgba(245,166,35,0.2);color:var(--honey);padding:2px 6px;border-radius:4px;">New</span>' : ''}
        </div>
        <div style="font-weight:bold;color:var(--honey);margin-bottom:4px;">${h.name || 'Anonymous'}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);">📍 ${loc || 'Location unknown'} ${h.date ? '· 🗓 ' + formatDate(h.date) : ''}</div>
        ${h.description ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;line-height:1.4;">${h.description.substring(0,100)}${h.description.length > 100 ? '…' : ''}</div>` : ''}
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
          <div style="font-size:0.85rem;font-weight:600;color:var(--text);">${idea.title}</div>
          ${idea.description ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;line-height:1.4;">${idea.description}</div>` : ''}
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
  const sw = document.getElementById('search-wrapper');
  const sb = document.getElementById('stats-bar');
  if (sw) sw.style.display = 'none';
  if (sb) sb.style.display = 'none';
}
function showSearchUI() {
  const sw = document.getElementById('search-wrapper');
  const sb = document.getElementById('stats-bar');
  if (sw) sw.style.display = '';
  if (sb) sb.style.display = '';
}

function setTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const tabs = ['map','add','pathfinder','list','about'];
  const idx = tabs.indexOf(tab);
  if (idx >= 0) document.querySelectorAll('.tab-btn')[idx]?.classList.add('active');

  if (tab === 'pathfinder') hideSearchUI();
  else showSearchUI();

  if (tab === 'add') openAddPanel();
  else if (tab === 'pathfinder') openPathfinder();
  else if (tab === 'list') openRecords();
  else if (tab === 'about') { document.getElementById('about-modal').classList.add('open'); loadIdeas(); }
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

    // Timeout after 6 seconds — proceed without token if Turnstile is slow
    setTimeout(() => done(null), 6000);
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

async function submitSignIn() {
  try {
    const email = document.getElementById('signin-email').value.trim();
    if (!email) { document.getElementById('signin-email').focus(); return; }
    const errEl = document.getElementById('signin-error');
    if (errEl) errEl.style.display = 'none';
    const btn = document.getElementById('signin-submit-btn');
    btn.disabled = true; btn.textContent = 'Sending…';

    const captchaToken = await getTurnstileToken();
    const otpOptions = { emailRedirectTo: window.location.href };
    if (captchaToken) otpOptions.captchaToken = captchaToken;

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
  }
}

// ═══════════════════════════════════════
// CHECK-IN / RE-VERIFICATION
// ═══════════════════════════════════════
let _checkinHiveId = null;
let _checkinStatus = null;

function openCheckin(hiveId) {
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

