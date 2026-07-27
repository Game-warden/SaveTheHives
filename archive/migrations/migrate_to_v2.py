#!/usr/bin/env python3
"""
SaveTheHives — v2.0 Migration Script
Adds Supabase backend, photo uploads, magic-link auth, and check-in system.

Run from your project folder:
  python3 migrate_to_v2.py

Reads:  savethehives.html  (your current file)
Writes: savethehives_v2.html  (new file — review before replacing)
"""

import re, sys, os

SRC  = 'savethehives.html'
DEST = 'savethehives_v2.html'

SUPABASE_URL = 'https://nsujmizdawyoictpawxt.supabase.co'
SUPABASE_KEY = ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
                '.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zdWptaXpkYXd5b2ljdHBhd3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NDEyNDgsImV4cCI6MjA5ODMxNzI0OH0'
                '.VOXEk4uyFq1jH0mvRW83LPPW8ZJp3MbylY6KiPKixTc')

if not os.path.exists(SRC):
    sys.exit(f'ERROR: {SRC} not found. Run this script from your SaveTheHives project folder.')

print(f'Reading {SRC}...')
content = open(SRC, encoding='utf-8').read()
original_len = len(content)
changes = []

def replace(old, new, label, count=1):
    global content
    result = content.replace(old, new, count)
    if result == content:
        print(f'  ✗ NOT FOUND: {label}')
    else:
        content = result
        changes.append(label)
        print(f'  ✓ {label}')

# ── 1. Supabase CDN ──────────────────────────────────────────────────────────
replace(
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.min.js"></script>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.min.js"></script>\n'
    '<!-- Supabase -->\n'
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>',
    'Supabase CDN'
)

# ── 2. Replace LEGACY_DATA + DATES_BY_ID with Supabase config ───────────────
SUPABASE_BLOCK = f"""// ═══════════════════════════════════════
// SUPABASE CONFIG
// ═══════════════════════════════════════
const SUPABASE_URL = '{SUPABASE_URL}';
const SUPABASE_ANON_KEY = '{SUPABASE_KEY}';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
db.auth.getSession().then(({{ data: {{ session }} }}) => {{
  if (session) {{ currentUser = session.user; updateAuthUI(); }}
}});
db.auth.onAuthStateChange((_event, session) => {{
  currentUser = session?.user || null; updateAuthUI();
}});"""

new_content, n = re.subn(
    r'// ═+\n// DATA\n// ═+\nconst LEGACY_DATA = \[.*?\];\n\nconst DATES_BY_ID = \{.*?\};',
    SUPABASE_BLOCK, content, flags=re.DOTALL)
if n:
    content = new_content
    changes.append('DATA → Supabase config')
    print('  ✓ DATA → Supabase config')
else:
    print('  ✗ NOT FOUND: DATA section')

# ── 3. Expand normalizeType ──────────────────────────────────────────────────
replace(
    """function normalizeType(t) {
  if (t === 'Building' || t === 'Managed') return 'Man Made';
  return t;
}""",
    """function normalizeType(t) {
  if (!t) return 'Live Tree';
  if (t === 'Living Tree') return 'Live Tree';
  if (['Building','Managed','Manmade Beehive','Manmade structure',
       'Manmade Structure','Man Made'].includes(t)) return 'Man Made';
  if (t === 'In the ground') return 'Ground';
  return t;
}""",
    'normalizeType expanded'
)

# ── 4. Make init() async ─────────────────────────────────────────────────────
replace('function init() {', 'async function init() {', 'init async', 1)

replace(
    """  // Load data
  loadLegacyData();

  // Load user hives from localStorage
  loadUserHives();

  // Sync visible hives (start with all)
  visibleHives = [...allHives];

  // Update counts
  updateCounts();
}""",
    """  await loadHivesFromSupabase();
  visibleHives = [...allHives];
  updateCounts();
}""",
    'init body → async Supabase load'
)

# ── 5. Replace load/save functions ───────────────────────────────────────────
replace(
    """// ═══════════════════════════════════════
// LOAD DATA
// ═══════════════════════════════════════
function loadLegacyData() {
  LEGACY_DATA.forEach(h => {
    h.type = normalizeType(h.type);
    h.date = DATES_BY_ID[String(h.id)] || (h.year ? `${h.year}` : null);
    allHives.push(h);
    addMarker(h);
  });
}

function loadUserHives() {
  const stored = localStorage.getItem('sth_hives');
  if (!stored) return;
  const userHives = JSON.parse(stored);
  userHives.forEach(h => {
    allHives.push(h);
    addMarker(h);
  });
}

function saveUserHives() {
  const userHives = allHives.filter(h => h.userAdded);
  localStorage.setItem('sth_hives', JSON.stringify(userHives));
}""",
    """// ═══════════════════════════════════════
// LOAD DATA FROM SUPABASE
// ═══════════════════════════════════════
async function loadHivesFromSupabase() {
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await db.from('hives').select('*').range(from, from+999).order('id');
    if (error || !data || !data.length) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  all.forEach(row => { const h = dbRowToHive(row); allHives.push(h); addMarker(h); });
  showToast(`🐝 ${all.length.toLocaleString()} hives loaded`);
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
    userAdded: row.user_added || false,
  };
}

async function uploadPhoto(file) {
  if (!file || !currentUser) return null;
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await db.storage.from('hive-photos').upload(path, file);
  if (error) { console.warn('Upload error:', error); return null; }
  return db.storage.from('hive-photos').getPublicUrl(path).data.publicUrl;
}""",
    'load/save → Supabase'
)

# ── 6. submitHive → async Supabase ───────────────────────────────────────────
replace(
    """function submitHive() {
  const lat = parseFloat(document.getElementById('form-lat').value);
  const lng = parseFloat(document.getElementById('form-lng').value);
  if (isNaN(lat) || isNaN(lng)) { showToast('⚠ Please enter coordinates or use GPS'); return; }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) { showToast('⚠ Invalid coordinates'); return; }

  const now = new Date();
  const hive = {
    id: Date.now(),
    name: document.getElementById('form-name').value || 'Field Observer',
    lat: lat,
    lng: lng,
    type: selectedType,
    description: document.getElementById('form-desc').value,
    city: document.getElementById('form-city').value,
    state: document.getElementById('form-state').value,
    zip: document.getElementById('form-zip').value,
    year: now.getFullYear(),
    date: now.toISOString().slice(0,10), // YYYY-MM-DD
    userAdded: true,
  };

  allHives.push(hive);
  visibleHives.push(hive);
  addMarker(hive);
  saveUserHives();
  updateCounts();

  // Pan to new hive
  map.setView([lat, lng], 13);

  // Close modal
  document.getElementById('add-modal').classList.remove('open');

  // Reset form
  ['form-name','form-lat','form-lng','form-desc','form-city','form-state','form-zip'].forEach(id => {
    document.getElementById(id).value = '';
  });

  showToast('🐝 Hive logged! Thank you.');
  setTab('map');
}""",
    """async function submitHive() {
  const lat = parseFloat(document.getElementById('form-lat').value);
  const lng = parseFloat(document.getElementById('form-lng').value);
  if (isNaN(lat) || isNaN(lng)) { showToast('⚠ Please enter coordinates or use GPS'); return; }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) { showToast('⚠ Invalid coordinates'); return; }

  const submitBtn = document.querySelector('[onclick="submitHive()"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

  let photo_url = null;
  const photoFile = document.getElementById('form-photo')?.files?.[0];
  if (photoFile) {
    if (!currentUser) showToast('📸 Sign in to add photos — saving hive without photo');
    else photo_url = await uploadPhoto(photoFile);
  }

  const now = new Date();
  const { data: saved, error } = await db.from('hives').insert({
    name: document.getElementById('form-name').value || 'Field Observer',
    latitude: lat, longitude: lng, hivetype: selectedType,
    description: document.getElementById('form-desc').value,
    city: document.getElementById('form-city').value,
    state: document.getElementById('form-state').value,
    zip: document.getElementById('form-zip').value,
    photo_url, user_added: true,
    submitted_by: currentUser?.id || null,
    submitted_at: now.toISOString(),
  }).select().single();

  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '🐝 Submit Hive Record'; }
  if (error) { showToast('⚠ ' + error.message); return; }

  const hive = dbRowToHive(saved);
  allHives.push(hive); visibleHives.push(hive);
  addMarker(hive); updateCounts();
  map.setView([lat, lng], 13);
  document.getElementById('add-modal').classList.remove('open');
  ['form-name','form-lat','form-lng','form-desc','form-city','form-state','form-zip'].forEach(id => {
    document.getElementById(id).value = '';
  });
  const photoEl = document.getElementById('form-photo');
  if (photoEl) photoEl.value = '';
  showToast('🐝 Hive saved to the global map! Thank you.');
  setTab('map');
}""",
    'submitHive → async Supabase'
)

# ── 7. Popup: photo + status + check-in button ───────────────────────────────
replace(
    """  marker.bindPopup(`
    <div class="hive-popup">
      <div class="popup-type">
        <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></div>
        ${icon} ${hive.type}
      </div>
      <div class="popup-name">${hive.name || 'Anonymous Observer'}</div>
      ${hive.date ? `<div style="font-size:0.7rem;color:var(--text-muted);opacity:0.8;margin-bottom:6px;">🗓 Logged ${formatDate(hive.date)}</div>` : ''}
      ${desc ? `<div class="popup-desc">${desc}</div>` : ''}
      <div class="popup-meta">
        📍 ${loc}
      </div>
      <button class="popup-radius-btn" onclick="toggleSingleRadius(${hive.id},${hive.lat},${hive.lng})">
        ◎ Toggle 3-Mile Mating Radius
      </button>
    </div>
  `, {maxWidth: 300});""",
    """  marker.bindPopup(`
    <div class="hive-popup">
      <div class="popup-type">
        <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></div>
        ${icon} ${hive.type}
      </div>
      <div class="popup-name">${hive.name || 'Anonymous Observer'}</div>
      ${hive.date ? `<div style="font-size:0.7rem;color:var(--text-muted);opacity:0.8;margin-bottom:6px;">🗓 Logged ${formatDate(hive.date)}</div>` : ''}
      ${hive.status && hive.status !== 'unverified' ? `<div style="font-size:0.72rem;font-weight:600;margin-bottom:6px;color:${hive.status==='active'?'#4caf50':hive.status==='gone'?'#e57373':'#f5a623'}">● ${hive.status.charAt(0).toUpperCase()+hive.status.slice(1)}</div>` : ''}
      ${hive.photo_url ? `<img src="${hive.photo_url}" style="width:100%;border-radius:8px;margin-bottom:8px;max-height:160px;object-fit:cover;" loading="lazy">` : ''}
      ${desc ? `<div class="popup-desc">${desc}</div>` : ''}
      <div class="popup-meta">📍 ${loc}</div>
      <button class="popup-radius-btn" onclick="toggleSingleRadius(${hive.id},${hive.lat},${hive.lng})">◎ 3-Mile Mating Radius</button>
      <button class="popup-radius-btn" style="margin-top:6px;background:rgba(76,175,80,0.15);color:#4caf50;border-color:rgba(76,175,80,0.3);" onclick="openCheckin(${hive.id})">✅ Update / Check In</button>
    </div>
  `, {maxWidth: 300});""",
    'popup: photo + status + check-in'
)

# ── 8. Photo input in Add Hive form ─────────────────────────────────────────
replace(
    """    <div class="form-section-title">📷 Photo</div>
    <div class="form-group">
      <button class="btn btn-outline" disabled style="width:100%;padding:12px;opacity:0.5;cursor:not-allowed;">
        📷 Add Photo — Coming Soon
      </button>
      <div style="font-size:0.72rem;color:var(--text-muted);margin-top:6px;text-align:center;">Photo uploads need cloud storage — on the roadmap</div>
    </div>""",
    """    <div class="form-section-title">📷 Photo</div>
    <div class="form-group">
      <input type="file" id="form-photo" accept="image/*" capture="environment"
        style="width:100%;padding:10px;border-radius:var(--radius-sm);background:rgba(255,255,255,0.06);border:1px solid var(--border);color:var(--text);font-size:0.85rem;cursor:pointer;">
      <div style="font-size:0.72rem;color:var(--text-muted);margin-top:6px;text-align:center;">Sign in to attach a photo to your submission</div>
    </div>""",
    'photo input enabled'
)

# ── 9. Auth button in header ─────────────────────────────────────────────────
replace(
    '<button class="btn btn-outline" id="debug-toggle-btn" onclick="toggleDebugPanel()" style="padding:6px 10px;font-size:0.75rem;margin-right:4px;" title="Toggle debug info">🐞</button>',
    '<button class="btn btn-outline" id="debug-toggle-btn" onclick="toggleDebugPanel()" style="padding:6px 10px;font-size:0.75rem;margin-right:4px;" title="Toggle debug info">🐞</button>\n'
    '  <button class="btn btn-outline" id="auth-btn" onclick="handleAuth()" style="padding:6px 10px;font-size:0.75rem;margin-right:4px;">🔑 Sign In</button>',
    'auth button in header'
)

# ── 10. Auth + check-in JS ───────────────────────────────────────────────────
AUTH_JS = """
// ═══════════════════════════════════════
// AUTH — MAGIC LINK
// ═══════════════════════════════════════
function updateAuthUI() {
  const btn = document.getElementById('auth-btn');
  if (!btn) return;
  if (currentUser) { btn.textContent = '👤 Signed In'; btn.style.color = '#4caf50'; }
  else { btn.textContent = '🔑 Sign In'; btn.style.color = ''; }
}

async function handleAuth() {
  if (currentUser) {
    await db.auth.signOut();
    showToast('Signed out');
    return;
  }
  const email = prompt("Enter your email — we'll send you a magic sign-in link:");
  if (!email) return;
  const { error } = await db.auth.signInWithOtp({
    email, options: { emailRedirectTo: window.location.href }
  });
  if (error) showToast('⚠ ' + error.message);
  else showToast('📧 Check your email for a sign-in link!');
}

// ═══════════════════════════════════════
// CHECK-IN / RE-VERIFICATION
// ═══════════════════════════════════════
async function openCheckin(hiveId) {
  const raw = prompt('Is this hive still here?\\nType: active  gone  uncertain');
  if (!raw) return;
  const status = raw.trim().toLowerCase();
  if (!['active','gone','uncertain'].includes(status)) {
    showToast('⚠ Type: active, gone, or uncertain'); return;
  }
  let photo_url = null;
  if (currentUser) {
    if (confirm('Add a photo?')) {
      const inp = Object.assign(document.createElement('input'), {type:'file', accept:'image/*'});
      inp.setAttribute('capture','environment');
      await new Promise(r => { inp.onchange = r; inp.click(); });
      if (inp.files?.[0]) photo_url = await uploadPhoto(inp.files[0]);
    }
  }
  const ts = new Date().toISOString();
  await db.from('checkins').insert({ hive_id: hiveId, user_id: currentUser?.id||null, status, photo_url });
  await db.from('hives').update({ status, last_verified_at: ts, ...(photo_url ? {photo_url} : {}) }).eq('id', hiveId);
  const hive = allHives.find(h => h.id === hiveId);
  if (hive) {
    hive.status = status;
    if (photo_url) hive.photo_url = photo_url;
    if (hive._marker) { clusterGroup.removeLayer(hive._marker); addMarker(hive); }
  }
  const msgs = { active:'🐝 Active — thank you!', gone:'👻 Gone — noted', uncertain:'🤔 Uncertain — recorded' };
  showToast(msgs[status]);
}
"""

last = content.rfind('</script>')
if last >= 0:
    content = content[:last] + AUTH_JS + '\n</script>' + content[last+9:]
    changes.append('auth + check-in JS')
    print('  ✓ auth + check-in JS')

# ── 11. Version bump ─────────────────────────────────────────────────────────
for old_v in ['v1.6','v1.7','v1.8','v2.0-building']:
    content = content.replace(
        f'class="version-badge">{old_v}</span>',
        'class="version-badge">v2.0</span>'
    )

# ── 12. Update spec lines ────────────────────────────────────────────────────
content = content.replace(
    '║  • Storage: localStorage (Phase 1); Firebase/Supabase planned        ║',
    '║  • Storage: Supabase Postgres + Storage (free tier)                  ║'
)
content = content.replace(
    '║  ✅ PWA shell (installable, offline-capable via localStorage)        ║',
    '║  ✅ PWA shell (installable)                                          ║'
)

# ── Write output ─────────────────────────────────────────────────────────────
with open(DEST, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'\\n{"="*50}')
print(f'Original: {original_len:,} bytes ({original_len//1024}KB)')
print(f'New:      {len(content):,} bytes ({len(content)//1024}KB)')
print(f'Saved:    {original_len - len(content):,} bytes')
print(f'Changes:  {len(changes)}')
print(f'\\nWritten to: {DEST}')
print('\\nNext steps:')
print('  1. Run supabase_schema.sql in Supabase SQL Editor')
print('  2. Run supabase_data.sql in Supabase SQL Editor')
print('  3. cp savethehives_v2.html savethehives.html')
print('  4. Reload in browser — hives now load from Supabase!')
