// pathfinder.js — extracted from index.html (Phase 2, v2.6 split)
// Depends on globals defined in app.js, loaded before this file: map, haversine,
// showToast, and other shared app helpers/state. Do not convert to a module —
// this and index.html's inline onclick="..." handlers require global scope.

// ═══════════════════════════════════════════════════════════════════════════
// TUNING GUIDE — every field-adjustable constant lives in PF_TUNE below.
// Each entry: what it controls → symptom if too LOW → symptom if too HIGH.
//
// ── Anchor capture (Point A / Point B GPS lock) ──
// ANCHOR_TARGET_FIXES      How many accuracy-gated fixes to average before
//                          locking an anchor. LOW: anchors lock fast but jitter
//                          survives into the triangulation baseline. HIGH: user
//                          stands around waiting >15s at every point.
// ANCHOR_ACCEPT_ACCURACY_M Fixes worse than this (meters) are ignored during
//                          the averaging window. LOW: under tree canopy almost
//                          no fix qualifies and capture always times out. HIGH:
//                          garbage fixes poison the average.
// ANCHOR_MAX_WAIT_MS       Hard cap on the capture window. On timeout we fall
//                          back to the best fixes seen so far (any accuracy)
//                          rather than failing. LOW: fallback fires before good
//                          fixes arrive. HIGH: user thinks the app is hung.
// ANCHOR_FALLBACK_BEST_N   How many best-accuracy raw fixes the timeout
//                          fallback averages. Only matters when the gate was
//                          never satisfied (bad sky view).
//
// ── Alpha-beta position filter (walk + nav tracking) ──
// FILTER_PROCESS_NOISE_MPS How fast we believe the walker's true position can
//                          change, in m/s. This is the single most important
//                          knob: it sets how quickly the filter trusts new
//                          fixes over its own prediction. LOW: the v1.7/v1.8
//                          symptom returns — path lags and cuts corners on
//                          turns. HIGH: filter chases every GPS burp; path
//                          gets jittery again. Brisk walk ≈ 1.5–2 m/s.
// FILTER_MIN_ACCURACY_M    Floor for reported coords.accuracy. Phones
//                          sometimes claim 1–3m optimistically; trusting that
//                          fully makes the filter twitchy. Raise if the dot
//                          vibrates while standing still.
// FILTER_MAX_SPEED_MPS     Velocity estimate clamp. Prevents one wild fix from
//                          launching the predicted position across the field.
//                          Keep ≥ 2× real walking speed.
// FILTER_RESET_GAP_S       If no fix arrives for this many seconds, the filter
//                          re-initializes from the next fix instead of
//                          predicting through the gap. LOW: filter resets (and
//                          momentarily jumps) on routine fix hiccups. HIGH:
//                          after a real signal loss the dot sails off on stale
//                          velocity before recovering.
// ═══════════════════════════════════════════════════════════════════════════
const PF_TUNE = {
  // Anchor capture
  ANCHOR_TARGET_FIXES: 6,        // ~6s of fixes at typical 1Hz GPS
  ANCHOR_ACCEPT_ACCURACY_M: 12,  // matches the "good/fair" boundary shown in the accuracy banner
  ANCHOR_MAX_WAIT_MS: 20000,
  ANCHOR_FALLBACK_BEST_N: 3,
  // Alpha-beta filter
  FILTER_PROCESS_NOISE_MPS: 1.8, // brisk walking pace
  FILTER_MIN_ACCURACY_M: 5,
  FILTER_MAX_SPEED_MPS: 4,       // ~2× walking speed; jogging with the phone still tracks
  FILTER_RESET_GAP_S: 10,
};

// Meters per degree of latitude (WGS-84 mean). Longitude shrinks by cos(lat) —
// computed where needed. Used only for unit conversion inside the filter.
const M_PER_DEG_LAT = 111320;

// ── ALPHA-BETA POSITION FILTER ──
// Replaces the old smoothPosition() 5-fix moving average (removed in Phase 5).
// The moving average treated every fix equally and always answered with the
// average of the last ~5 positions — i.e. where you were ~2.5 fixes AGO. That
// lag is what made the drawn path curve through corners in v1.7/v1.8.
//
// This filter instead keeps a position + velocity estimate per axis:
//   1. PREDICT  — advance position by estimated velocity × dt
//   2. CORRECT  — blend the new fix in, weighted by how much we trust it
// The blend weight (alpha) is not fixed: it's recomputed every fix from the
// filter's own uncertainty vs. the fix's reported coords.accuracy — an
// accurate fix pulls hard, a poor fix barely nudges. beta (the velocity
// correction gain) is derived from alpha via the standard critically-damped
// relation beta = alpha² / (2 − alpha), so the two gains never fight.
function createGpsFilter() {
  return {
    lat: null, lng: null, // filtered position (degrees)
    vLat: 0, vLng: 0,     // estimated velocity (degrees/second, per axis)
    variance: -1,          // position uncertainty (m²); -1 = uninitialized
    t: 0,                  // timestamp of last accepted fix (ms)
    lastAlpha: 0,          // exposed for the debug panel
  };
}

function gpsFilterUpdate(f, lat, lng, accuracyM, timestampMs) {
  // Floor the reported accuracy — phones over-promise (see TUNING guide)
  const acc = Math.max(accuracyM || PF_TUNE.FILTER_MIN_ACCURACY_M, PF_TUNE.FILTER_MIN_ACCURACY_M);

  const dt = (timestampMs - f.t) / 1000;
  // First fix ever, or the signal dropped long enough that our velocity
  // estimate is stale → start over from this fix rather than predicting
  // through the gap on old momentum.
  if (f.variance < 0 || dt > PF_TUNE.FILTER_RESET_GAP_S || dt <= 0) {
    f.lat = lat; f.lng = lng;
    f.vLat = 0; f.vLng = 0;
    f.variance = acc * acc;
    f.t = timestampMs;
    f.lastAlpha = 1;
    return [lat, lng];
  }
  f.t = timestampMs;

  // 1. PREDICT — dead-reckon forward on current velocity estimate, and grow
  //    our uncertainty by how far a walker could plausibly have strayed from
  //    that straight-line prediction in dt seconds (process noise).
  const predLat = f.lat + f.vLat * dt;
  const predLng = f.lng + f.vLng * dt;
  const drift = PF_TUNE.FILTER_PROCESS_NOISE_MPS * dt; // meters
  const predVariance = f.variance + drift * drift;

  // 2. CORRECT — adaptive gain: ratio of our uncertainty to total uncertainty.
  //    Both terms are in m², so alpha is dimensionless and safe to apply to
  //    residuals measured in degrees.
  const alpha = predVariance / (predVariance + acc * acc);
  const beta = (alpha * alpha) / (2 - alpha); // critically damped companion gain
  f.lastAlpha = alpha;

  const resLat = lat - predLat;
  const resLng = lng - predLng;
  f.lat = predLat + alpha * resLat;
  f.lng = predLng + alpha * resLng;
  f.vLat += (beta * resLat) / dt;
  f.vLng += (beta * resLng) / dt;
  f.variance = (1 - alpha) * predVariance;

  // Clamp the velocity estimate so one wild fix can't launch the prediction
  // across the field (compare in m/s — lng degrees shrink by cos(lat)).
  const mPerDegLng = M_PER_DEG_LAT * Math.cos(toRad(f.lat));
  const speed = Math.sqrt((f.vLat * M_PER_DEG_LAT) ** 2 + (f.vLng * mPerDegLng) ** 2);
  if (speed > PF_TUNE.FILTER_MAX_SPEED_MPS) {
    const scale = PF_TUNE.FILTER_MAX_SPEED_MPS / speed;
    f.vLat *= scale;
    f.vLng *= scale;
  }

  return [f.lat, f.lng];
}

// ── ANCHOR POINT CAPTURE ──
// Replaces the single getCurrentPosition() call that used to lock Point A/B.
// One fix is a coin toss — under canopy it can be 20m+ off, and both anchor
// errors feed straight into the triangulation baseline. Instead: watch the
// GPS for a short stationary window, keep only fixes that pass the accuracy
// gate, and average them weighted by 1/accuracy² (a 5m fix counts 4× a 10m
// fix). If the gate is never satisfied before the timeout, fall back to the
// best few fixes seen at any accuracy — a degraded anchor beats a dead end,
// and the toast tells the user which kind they got.
let anchorCapture = null; // { watchId, timer, actionBtn, originalLabel } while a capture window is open

function stopAnchorCapture() {
  if (!anchorCapture) return;
  navigator.geolocation.clearWatch(anchorCapture.watchId);
  clearTimeout(anchorCapture.timer);
  // Restore the action button label here (not just in finish) so cancelling
  // mid-capture via reset/exit doesn't leave it stuck on "Averaging GPS…"
  if (anchorCapture.actionBtn) anchorCapture.actionBtn.textContent = anchorCapture.originalLabel;
  anchorCapture = null;
}

function captureAnchorPoint(onDone) {
  if (anchorCapture) return; // a window is already open — ignore double-taps
  if (!navigator.geolocation) { showToast('GPS unavailable on this device'); return; }

  const gated = [];  // fixes that passed the accuracy gate
  const all = [];    // every fix, for the timeout fallback
  const actionBtn = document.getElementById('pf-action-btn');
  const originalLabel = actionBtn ? actionBtn.textContent : '';
  showToast('📡 Hold still — averaging GPS fixes…');

  const finish = (fixes, degraded) => {
    stopAnchorCapture(); // also restores the action button label
    if (!fixes.length) {
      showToast('⚠️ No GPS fixes received — check location permission and try again');
      return;
    }
    // Inverse-variance weighted average: trust each fix ∝ 1/accuracy²
    let wSum = 0, latSum = 0, lngSum = 0;
    fixes.forEach(fx => {
      const w = 1 / (fx.acc * fx.acc);
      wSum += w; latSum += fx.lat * w; lngSum += fx.lng * w;
    });
    const lat = latSum / wSum, lng = lngSum / wSum;
    // Effective accuracy of the weighted mean, shown so the field tester can
    // judge anchor quality: sqrt(1/Σw) — shrinks as good fixes accumulate.
    const effAcc = Math.sqrt(1 / wSum);
    updateDebugPanel({ anchor: `${fixes.length} fixes, ±${effAcc.toFixed(1)}m${degraded ? ' (fallback)' : ''}` });
    showToast(degraded
      ? `⚠️ GPS accuracy stayed poor — anchor averaged from best ${fixes.length} fixes (±${Math.round(effAcc)}m). Consider re-locking from a clearing.`
      : `✅ Anchor locked from ${fixes.length} fixes (±${Math.round(effAcc)}m)`);
    onDone({ lat, lng });
  };

  const watchId = navigator.geolocation.watchPosition(pos => {
    PF.gpsAccuracy = pos.coords.accuracy;
    updateAccuracyBanner();
    const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.max(pos.coords.accuracy || 99, PF_TUNE.FILTER_MIN_ACCURACY_M) };
    all.push(fix);
    if (fix.acc <= PF_TUNE.ANCHOR_ACCEPT_ACCURACY_M) gated.push(fix);
    if (actionBtn) actionBtn.textContent = `📡 Averaging GPS… ${gated.length}/${PF_TUNE.ANCHOR_TARGET_FIXES}`;
    if (gated.length >= PF_TUNE.ANCHOR_TARGET_FIXES) finish(gated, false);
  },
  () => {}, // per-fix errors are fine — the timeout fallback handles a dead stream
  { enableHighAccuracy: true, maximumAge: 0, timeout: PF_TUNE.ANCHOR_MAX_WAIT_MS });

  const timer = setTimeout(() => {
    // Gate never filled — take whatever gated fixes exist, else the best
    // ANCHOR_FALLBACK_BEST_N raw fixes by accuracy.
    if (gated.length) finish(gated, true);
    else finish(all.sort((a, b) => a.acc - b.acc).slice(0, PF_TUNE.ANCHOR_FALLBACK_BEST_N), true);
  }, PF_TUNE.ANCHOR_MAX_WAIT_MS);

  anchorCapture = { watchId, timer, actionBtn, originalLabel };
}

// ═══════════════════════════════════════
// PATHFINDER — Beelining Triangulation Tool
// ═══════════════════════════════════════
const PF = {
  step: 'idle',        // idle | sensorsReady | pointA | walking | pointB | result | navigating
  permissionGranted: false,
  manualMode: false,
  heading: null,        // current compass heading in degrees
  gpsAccuracy: null,
  flightCount: 0,
  bearingReadings: [],   // individual captured bearings for the current point (before averaging)
  pointA: null,         // {lat, lng, bearing}
  pointB: null,         // {lat, lng, bearing}
  candidate: null,      // {lat, lng, confidenceRadius}
  watchId: null,
  walkPath: [],          // array of [lat,lng] recorded while walking to B
  walkPolyline: null,
  markers: [],            // leaflet layers created by pathfinder, cleared on reset
  navWatchId: null,
  needleRotation: 0,     // cumulative rotation in degrees — avoids the "spins all the way around" CSS bug
  navTrail: [],           // path walked during the final navigate-to-hive step
  navTrailPolyline: null,
  directLine: null,        // live straight line from current position to candidate
  youAreHereMarker: null,    // live "you are here" marker, shown while walking/navigating
  rayA: null,                 // Point A's original bearing sightline (dimmed once navigating starts)
  rayB: null,                 // Point B's original bearing sightline
  directionArrow: null,        // fixed-distance arrow that stays visible even up close
};

// Rotate the compass needle by the shortest path, accumulating rotation so the
// CSS transition never has to spin the "long way around" when heading wraps
// past 0°/360° (this was the cause of the needle appearing to spin wildly).
function rotateNeedleTo(targetDeg) {
  const current = PF.needleRotation % 360;
  let delta = ((targetDeg - current) + 540) % 360 - 180; // shortest signed delta, -180..+180
  PF.needleRotation += delta;
  const needle = document.getElementById('pf-compass-needle');
  if (needle) needle.style.transform = `rotate(${PF.needleRotation}deg)`;
  return PF.needleRotation;
}

// Live "you are here" marker — shown on the map during walking/navigation so
// the beeliner can see their own position relative to the candidate hive site.
function updateYouAreHereMarker(lat, lng) {
  if (!PF.youAreHereMarker) {
    const icon = L.divIcon({
      html: `<div class="you-are-here-dot"><div class="you-are-here-pulse"></div></div>`,
      className: '', iconSize: [20, 20], iconAnchor: [10, 10],
    });
    PF.youAreHereMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map);
    PF.markers.push(PF.youAreHereMarker);
  } else {
    PF.youAreHereMarker.setLatLng([lat, lng]);
  }
}

// A direction arrow that sits a fixed visual distance ahead of "you are here",
// always pointing at the candidate. Unlike the direct line itself — which
// shrinks to nothing as you approach — this stays clearly visible the whole way.
function updateDirectionArrow(here, candidateLat, candidateLng, bearingDeg) {
  // Place it 1/3 of the way from "you" toward the candidate, but never
  // further than ~12m ahead, so it doesn't overshoot on a short remaining distance.
  const remaining = haversine(here[0], here[1], candidateLat, candidateLng);
  const aheadDist = Math.min(remaining * 0.33, 12);
  const pos = aheadDist > 0.5 ? destinationPoint(here[0], here[1], bearingDeg, aheadDist) : { lat: candidateLat, lng: candidateLng };

  if (!PF.directionArrow) {
    const icon = L.divIcon({
      html: `<div class="direct-line-arrow" style="transform:rotate(${bearingDeg}deg)"></div>`,
      className: '', iconSize: [18, 16], iconAnchor: [9, 8],
    });
    PF.directionArrow = L.marker([pos.lat, pos.lng], { icon, zIndexOffset: 950 }).addTo(map);
    PF.markers.push(PF.directionArrow);
  } else {
    PF.directionArrow.setLatLng([pos.lat, pos.lng]);
    const el = PF.directionArrow.getElement();
    const inner = el && el.querySelector('.direct-line-arrow');
    if (inner) inner.style.transform = `rotate(${bearingDeg}deg)`;
  }
}

function openPathfinder() {
  document.getElementById('pathfinder-panel').classList.remove('pf-hidden');
  if (PF.step === 'idle') {
    updatePathfinderUI();
  }
}

function exitPathfinder() {
  document.getElementById('pathfinder-panel').classList.add('pf-hidden');
  document.getElementById('pathfinder-panel').classList.remove('pf-compact');
  showSearchUI();
  // Switch bottom tab back to map, but keep any drawn pathfinder layers visible
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-btn')[0].classList.add('active');
  stopCompass();
  stopAnchorCapture(); // abort any in-flight Point A/B averaging window
  stopWalkTracking();
  stopNavTracking();
}

function pathfinderReset() {
  // Clear all pathfinder map layers
  PF.markers.forEach(m => map.removeLayer(m));
  PF.markers = [];
  if (PF.walkPolyline) { map.removeLayer(PF.walkPolyline); PF.walkPolyline = null; }
  PF.navTrailPolyline = null; // already removed via PF.markers loop above
  PF.directLine = null;
  PF.youAreHereMarker = null;
  PF.rayA = null;
  PF.rayB = null;
  PF.directionArrow = null;
  PF.navTrail = [];
  PF.lastWalkPos = null;
  PF.walkFilter = null;
  PF.lastNavPos = null;
  PF.navFilter = null;
  PF.needleRotation = 0;
  document.getElementById('pathfinder-panel').classList.remove('pf-compact');
  stopAnchorCapture(); // abort any in-flight Point A/B averaging window
  stopWalkTracking();
  stopNavTracking();
  PF.step = 'sensorsReady';
  PF.flightCount = 0;
  PF.bearingReadings = [];
  PF.pointA = null;
  PF.pointB = null;
  PF.candidate = null;
  PF.walkPath = [];
  document.querySelectorAll('.pf-dot').forEach(dot => dot.classList.remove('pf-dot-filled'));
  const readingsEl = document.getElementById('pf-readings');
  if (readingsEl) readingsEl.innerHTML = '';
  updatePathfinderUI();
}

// ── COMPASS (DeviceOrientationEvent) ──
let compassHandler = null;
function startCompass() {
  compassHandler = (e) => {
    let heading = null;
    if (typeof e.webkitCompassHeading === 'number') {
      heading = e.webkitCompassHeading; // iOS Safari — true heading, 0=N clockwise
    } else if (e.absolute && typeof e.alpha === 'number') {
      heading = (360 - e.alpha) % 360; // Android approximation
    } else if (typeof e.alpha === 'number') {
      heading = (360 - e.alpha) % 360;
    }
    if (heading !== null) {
      PF.heading = heading;
      renderCompassNeedle(heading);
    }
  };
  window.addEventListener('deviceorientation', compassHandler, true);
}
function stopCompass() {
  if (compassHandler) {
    window.removeEventListener('deviceorientation', compassHandler, true);
    compassHandler = null;
  }
}
function renderCompassNeedle(heading) {
  const readout = document.getElementById('pf-heading-readout');
  // During navigation, the needle is driven by startNavTracking's relative-angle
  // logic instead — don't fight over the transform here.
  if (PF.step !== 'navigating') {
    rotateNeedleTo(heading);
  }
  if (readout) readout.textContent = Math.round(heading) + '°';
  updateDebugPanel({ heading: Math.round(heading) + '°', rotation: Math.round(PF.needleRotation) + '°' });
}

async function enableSensors() {
  // Request compass permission (iOS 13+ requires user gesture)
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result !== 'granted') {
        showToast('Compass permission denied — use manual bearing entry');
        toggleManualBearing(true);
      } else {
        startCompass();
      }
    } else {
      // Android / older iOS — no permission gate needed
      startCompass();
    }
  } catch (e) {
    showToast('Compass unavailable — use manual bearing entry');
    toggleManualBearing(true);
  }

  // Request GPS permission + start watching accuracy
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        PF.gpsAccuracy = pos.coords.accuracy;
        updateAccuracyBanner();
      },
      () => showToast('GPS permission denied — Pathfinder needs location access'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  PF.permissionGranted = true;
  PF.bearingReadings = [];
  PF.flightCount = 0;
  PF.step = 'pointA';
  updatePathfinderUI();
}

function updateAccuracyBanner() {
  const el = document.getElementById('pf-accuracy');
  if (!el) return;
  if (PF.gpsAccuracy == null) {
    el.textContent = '📡 GPS: waiting for signal...';
    el.className = 'pf-accuracy';
  } else if (PF.gpsAccuracy <= 10) {
    el.textContent = `📡 GPS accuracy: ${Math.round(PF.gpsAccuracy)}m — good`;
    el.className = 'pf-accuracy pf-good';
  } else if (PF.gpsAccuracy <= 20) {
    el.textContent = `📡 GPS accuracy: ${Math.round(PF.gpsAccuracy)}m — fair`;
    el.className = 'pf-accuracy pf-warn';
  } else {
    el.textContent = `⚠️ GPS accuracy: ${Math.round(PF.gpsAccuracy)}m — poor (tree canopy?). Try a clearing.`;
    el.className = 'pf-accuracy pf-warn';
  }
}

function toggleManualBearing(forceOn) {
  PF.manualMode = forceOn === true ? true : !PF.manualMode;
  document.getElementById('pf-manual-row').style.display = PF.manualMode ? 'block' : 'none';
  document.getElementById('pf-compass-dial').style.display = PF.manualMode ? 'none' : 'flex';
  document.getElementById('pf-manual-toggle').textContent = PF.manualMode
    ? 'Use phone compass instead'
    : 'Enter bearing manually instead';
}

function toggleHowTo() {
  document.getElementById('pf-howto-box').classList.toggle('pf-howto-collapsed');
}

// Capture ONE bearing reading at the moment a bee is released and flies off.
// This is the actual measurement — not just a counter. Each tap reads
// whatever direction the phone is currently pointed RIGHT NOW.
function logBeeFlight() {
  const reading = getCurrentBearing();
  if (reading === null) {
    showToast("⚠️ No compass reading yet — point your phone in the bee's flight direction");
    return;
  }
  if (PF.bearingReadings.length >= 3) return; // cap at 3

  PF.bearingReadings.push(reading);
  PF.flightCount = PF.bearingReadings.length;

  document.querySelectorAll('.pf-dot').forEach(dot => {
    dot.classList.toggle('pf-dot-filled', parseInt(dot.dataset.n) <= PF.flightCount);
  });

  const readingsEl = document.getElementById('pf-readings');
  if (readingsEl) {
    readingsEl.innerHTML = PF.bearingReadings
      .map(b => `<span class="pf-reading-chip">${Math.round(b)}°</span>`)
      .join('');
  }

  if (PF.flightCount >= 3) {
    const avg = circularMeanBearing(PF.bearingReadings);
    showToast(`✅ 3 bearings recorded — averaged to ${Math.round(avg)}°. Ready to lock.`);
  } else {
    showToast(`🐝 Bearing ${Math.round(reading)}° recorded (${PF.flightCount}/3)`);
  }
  updatePathfinderUI();
}

// Circular mean — correctly averages bearings that wrap around 0°/360°
// (a plain average of e.g. 350° and 10° would wrongly give 180° instead of 0°)
function circularMeanBearing(readings) {
  let sumSin = 0, sumCos = 0;
  readings.forEach(b => {
    sumSin += Math.sin(toRad(b));
    sumCos += Math.cos(toRad(b));
  });
  const mean = toDeg(Math.atan2(sumSin, sumCos));
  return (mean + 360) % 360;
}

function getCurrentBearing() {
  if (PF.manualMode) {
    const v = parseFloat(document.getElementById('pf-manual-bearing').value);
    return isNaN(v) ? null : ((v % 360) + 360) % 360;
  }
  return PF.heading;
}

// ── MAIN ACTION BUTTON — state machine ──
function pathfinderAction() {
  if (PF.step === 'sensorsReady' || PF.step === 'idle') {
    enableSensors();
    return;
  }

  if (PF.step === 'pointA') {
    let bearing;
    if (PF.manualMode) {
      bearing = getCurrentBearing();
      if (bearing === null) { showToast('Enter a bearing manually first'); return; }
    } else {
      if (PF.bearingReadings.length < 3) {
        showToast('Record 3 bee flights first (tap "Bee Flew Off" after each release)');
        return;
      }
      bearing = circularMeanBearing(PF.bearingReadings);
    }
    // Phase 5: anchor captured from a stationary accuracy-gated averaging
    // window instead of a single (potentially 20m-off) getCurrentPosition fix.
    captureAnchorPoint(anchor => {
      PF.pointA = { lat: anchor.lat, lng: anchor.lng, bearing };
      drawPathfinderPoint(PF.pointA, 'A');
      drawBearingRay(PF.pointA, 'A');
      PF.step = 'walking';
      startWalkTracking();
      updatePathfinderUI();
    });
    return;
  }

  if (PF.step === 'walking') {
    PF.step = 'pointB';
    PF.flightCount = 0;
    PF.bearingReadings = []; // fresh set of readings for Point B
    document.querySelectorAll('.pf-dot').forEach(dot => dot.classList.remove('pf-dot-filled'));
    const readingsEl = document.getElementById('pf-readings');
    if (readingsEl) readingsEl.innerHTML = '';
    stopWalkTracking();
    updatePathfinderUI();
    return;
  }

  if (PF.step === 'pointB') {
    let bearing;
    if (PF.manualMode) {
      bearing = getCurrentBearing();
      if (bearing === null) { showToast('Enter a bearing manually first'); return; }
    } else {
      if (PF.bearingReadings.length < 3) {
        showToast('Record 3 bee flights first (tap "Bee Flew Off" after each release)');
        return;
      }
      bearing = circularMeanBearing(PF.bearingReadings);
    }
    // Phase 5: same stationary averaging window as Point A.
    captureAnchorPoint(anchor => {
      PF.pointB = { lat: anchor.lat, lng: anchor.lng, bearing };
      drawPathfinderPoint(PF.pointB, 'B');
      drawBearingRay(PF.pointB, 'B');
      calculateIntersection();
      PF.step = 'result';
      updatePathfinderUI();
    });
    return;
  }

  if (PF.step === 'result') {
    // "Navigate to hive site" — start live nav
    PF.step = 'navigating';
    dimBearingRays();
    startNavTracking();
    updatePathfinderUI();
    return;
  }

  if (PF.step === 'navigating') {
    // "Save as Hive" — hand off to the SAME Add Hive form used by manual entry,
    // just pre-filled with the triangulated location and a confidence-radius banner.
    if (PF.candidate) {
      stopNavTracking();
      document.getElementById('pathfinder-panel').classList.add('pf-hidden');
      openAddPanelUnified({
        lat: PF.candidate.lat,
        lng: PF.candidate.lng,
        description: 'Located via Pathfinder triangulation.',
        source: 'pathfinder',
        confidenceRadius: PF.candidate.confidenceRadius,
      });
    }
    return;
  }
}

// ── WALK TRACKING (Point A → Point B) ──
function startWalkTracking() {
  PF.walkPath = [[PF.pointA.lat, PF.pointA.lng]];
  PF.lastWalkPos = null;
  PF.walkFilter = createGpsFilter();
  if (!navigator.geolocation) return;
  PF.watchId = navigator.geolocation.watchPosition(pos => {
    PF.gpsAccuracy = pos.coords.accuracy;
    updateAccuracyBanner();

    // Phase 5: alpha-beta filter (predict + accuracy-weighted correct)
    // replaced the old 5-fix moving average, which lagged ~2.5 fixes behind
    // and curved the path through turns (the v1.7/v1.8 bug).
    const here = gpsFilterUpdate(PF.walkFilter,
      pos.coords.latitude, pos.coords.longitude,
      pos.coords.accuracy, pos.timestamp);
    updateDebugPanel({ filter: `α ${PF.walkFilter.lastAlpha.toFixed(2)}, σ ${Math.sqrt(PF.walkFilter.variance).toFixed(1)}m` });

    // Only record a path point if we've actually moved ≥8m (filters GPS noise)
    if (PF.lastWalkPos && haversine(PF.lastWalkPos[0], PF.lastWalkPos[1], here[0], here[1]) < 8) {
      updateYouAreHereMarker(here[0], here[1]); // still move the blue dot smoothly
      return;
    }
    PF.lastWalkPos = here;

    PF.walkPath.push(here);
    updateYouAreHereMarker(here[0], here[1]);
    if (!PF.walkPolyline) {
      PF.walkPolyline = L.polyline(PF.walkPath, {
        color: '#4caf50', weight: 3, opacity: 0.8, dashArray: '1 6'
      }).addTo(map);
      PF.markers.push(PF.walkPolyline);
    } else {
      PF.walkPolyline.addLatLng(here);
    }
    const dist = haversine(PF.pointA.lat, PF.pointA.lng, here[0], here[1]);
    const distEl = document.getElementById('pf-walk-distance');
    if (distEl) distEl.textContent = Math.round(dist) + ' m';
  }, () => {}, { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 });
}
function stopWalkTracking() {
  if (PF.watchId !== null) {
    navigator.geolocation.clearWatch(PF.watchId);
    PF.watchId = null;
  }
}

// ── NAV TRACKING (walk toward calculated hive site) ──
function startNavTracking() {
  if (!navigator.geolocation || !PF.candidate) return;

  // Persistent direct-line-to-hive — drawn once, then updated in place each tick
  PF.directLine = L.polyline(
    [[PF.candidate.lat, PF.candidate.lng], [PF.candidate.lat, PF.candidate.lng]],
    { color: '#f5a623', weight: 5, opacity: 0.95, dashArray: '4 9' }
  ).addTo(map);
  PF.markers.push(PF.directLine);

  PF.navTrail = [];
  PF.lastNavPos = null;
  PF.navFilter = createGpsFilter();

  PF.navWatchId = navigator.geolocation.watchPosition(pos => {
    // Phase 5: alpha-beta filter replaced the old moving average here too —
    // same reasoning as startWalkTracking (lag → curved trail on turns).
    const here = gpsFilterUpdate(PF.navFilter,
      pos.coords.latitude, pos.coords.longitude,
      pos.coords.accuracy, pos.timestamp);

    updateYouAreHereMarker(here[0], here[1]);
    const dist = haversine(here[0], here[1], PF.candidate.lat, PF.candidate.lng);
    const distEl = document.getElementById('pf-nav-distance');
    if (distEl) distEl.textContent = dist < 1000 ? Math.round(dist) + ' m' : (dist/1000).toFixed(2) + ' km';

    // Update the persistent direct line from current position to the hive
    if (PF.directLine) PF.directLine.setLatLngs([here, [PF.candidate.lat, PF.candidate.lng]]);

    // Only add to trail if moved ≥8m — keeps the green line straight on straight walks
    if (!PF.lastNavPos || haversine(PF.lastNavPos[0], PF.lastNavPos[1], here[0], here[1]) >= 8) {
      PF.lastNavPos = here;
      PF.navTrail.push(here);
      if (!PF.navTrailPolyline) {
        PF.navTrailPolyline = L.polyline(PF.navTrail, {
          color: '#4caf50', weight: 4, opacity: 0.9, dashArray: '1 6'
        }).addTo(map);
        PF.markers.push(PF.navTrailPolyline);
      } else {
        PF.navTrailPolyline.addLatLng(here);
      }
    }

    // Bearing from here to candidate
    const targetBearing = bearingBetween(here[0], here[1], PF.candidate.lat, PF.candidate.lng);
    updateDirectionArrow(here, PF.candidate.lat, PF.candidate.lng, targetBearing);
    const turnHint = document.getElementById('pf-turn-hint');
    let relative;

    if (PF.heading !== null && !PF.manualMode) {
      // relative = how far to turn from current facing direction to face the target
      relative = ((targetBearing - PF.heading) + 540) % 360 - 180; // -180..+180
      // Needle points at the target, displayed relative to current facing direction
      rotateNeedleTo(((relative % 360) + 360) % 360);

      if (turnHint) {
        const absRel = Math.abs(relative);
        if (absRel <= 8) {
          turnHint.textContent = '✅ On target — walk forward';
        } else if (relative > 0) {
          turnHint.textContent = `↻ Turn right ${Math.round(absRel)}°`;
        } else {
          turnHint.textContent = `↺ Turn left ${Math.round(absRel)}°`;
        }
      }
    } else {
      // Manual mode — no live heading, just show absolute bearing to target
      relative = targetBearing;
      rotateNeedleTo(targetBearing);
      if (turnHint) turnHint.textContent = `Target bearing: ${Math.round(targetBearing)}° (use a compass)`;
    }

    updateDebugPanel({
      step: PF.step,
      position: here[0].toFixed(5) + ', ' + here[1].toFixed(5),
      targetBearing: Math.round(targetBearing) + '°',
      relative: Math.round(relative) + '°',
      rotation: Math.round(PF.needleRotation) + '°',
      accuracy: Math.round(pos.coords.accuracy) + 'm',
      filter: `α ${PF.navFilter.lastAlpha.toFixed(2)}, σ ${Math.sqrt(PF.navFilter.variance).toFixed(1)}m`,
      pointA: PF.pointA ? PF.pointA.lat.toFixed(5) + ', ' + PF.pointA.lng.toFixed(5) + ' @ ' + Math.round(PF.pointA.bearing) + '°' : '—',
      pointB: PF.pointB ? PF.pointB.lat.toFixed(5) + ', ' + PF.pointB.lng.toFixed(5) + ' @ ' + Math.round(PF.pointB.bearing) + '°' : '—',
      candidate: PF.candidate ? PF.candidate.lat.toFixed(5) + ', ' + PF.candidate.lng.toFixed(5) + ' ±' + Math.round(PF.candidate.confidenceRadius) + 'm' : '—',
      readings: PF.bearingReadings && PF.bearingReadings.length ? PF.bearingReadings.map(r => Math.round(r) + '°').join(', ') : '—',
    });
  }, () => {}, { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 });

  if (!PF.manualMode) startCompass();
}
function stopNavTracking() {
  if (PF.navWatchId !== null) {
    navigator.geolocation.clearWatch(PF.navWatchId);
    PF.navWatchId = null;
  }
}

// ── GEOMETRY HELPERS ──
function toRad(d) { return d * Math.PI / 180; }
function toDeg(r) { return r * 180 / Math.PI; }

function bearingBetween(lat1, lng1, lat2, lng2) {
  const φ1 = toRad(lat1), φ2 = toRad(lat2), Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function destinationPoint(lat, lng, bearingDeg, distanceM) {
  const R = 6371000;
  const δ = distanceM / R;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(lat), λ1 = toRad(lng);
  const φ2 = Math.asin(Math.sin(φ1)*Math.cos(δ) + Math.cos(φ1)*Math.sin(δ)*Math.cos(θ));
  const λ2 = λ1 + Math.atan2(
    Math.sin(θ)*Math.sin(δ)*Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1)*Math.sin(φ2)
  );
  return { lat: toDeg(φ2), lng: toDeg(λ2) };
}

// Intersection of two great-circle paths given start points + initial bearings
// Standard spherical trigonometry solution (path intersection problem)
function pathIntersection(p1, brng1, p2, brng2) {
  const φ1 = toRad(p1.lat), λ1 = toRad(p1.lng);
  const φ2 = toRad(p2.lat), λ2 = toRad(p2.lng);
  const θ13 = toRad(brng1), θ23 = toRad(brng2);
  const Δφ = φ2 - φ1, Δλ = λ2 - λ1;

  const δ12 = 2 * Math.asin(Math.sqrt(
    Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2
  ));
  if (Math.abs(δ12) < 1e-12) return null;

  let cosθa = (Math.sin(φ2) - Math.sin(φ1)*Math.cos(δ12)) / (Math.sin(δ12)*Math.cos(φ1));
  let cosθb = (Math.sin(φ1) - Math.sin(φ2)*Math.cos(δ12)) / (Math.sin(δ12)*Math.cos(φ2));
  cosθa = Math.min(Math.max(cosθa, -1), 1);
  cosθb = Math.min(Math.max(cosθb, -1), 1);
  const θa = Math.acos(cosθa);
  const θb = Math.acos(cosθb);

  const θ12 = Math.sin(Δλ) > 0 ? θa : 2*Math.PI - θa;
  const θ21 = Math.sin(Δλ) > 0 ? 2*Math.PI - θb : θb;

  const α1 = θ13 - θ12;
  const α2 = θ21 - θ23;

  if (Math.sin(α1) === 0 && Math.sin(α2) === 0) return null; // infinite intersections
  if (Math.sin(α1) * Math.sin(α2) < 0) return null;          // ambiguous / behind start points

  const cosα3 = -Math.cos(α1)*Math.cos(α2) + Math.sin(α1)*Math.sin(α2)*Math.cos(δ12);
  const α3 = Math.acos(Math.min(Math.max(cosα3, -1), 1));
  const δ13 = Math.atan2(
    Math.sin(δ12)*Math.sin(α1)*Math.sin(α2),
    Math.cos(α2) + Math.cos(α1)*Math.cos(α3)
  );
  const φ3 = Math.asin(Math.sin(φ1)*Math.cos(δ13) + Math.cos(φ1)*Math.sin(δ13)*Math.cos(θ13));
  const Δλ13 = Math.atan2(
    Math.sin(θ13)*Math.sin(δ13)*Math.cos(φ1),
    Math.cos(δ13) - Math.sin(φ1)*Math.sin(φ3)
  );
  const λ3 = λ1 + Δλ13;

  return { lat: toDeg(φ3), lng: ((toDeg(λ3) + 540) % 360) - 180 };
}

function calculateIntersection() {
  const result = pathIntersection(PF.pointA, PF.pointA.bearing, PF.pointB, PF.pointB.bearing);
  if (!result) {
    showToast('⚠️ Bearings did not produce a clean intersection — try wider angle between points');
    PF.candidate = null;
    return;
  }
  const baseline = haversine(PF.pointA.lat, PF.pointA.lng, PF.pointB.lat, PF.pointB.lng);
  const distFromA = haversine(PF.pointA.lat, PF.pointA.lng, result.lat, result.lng);
  const distFromB = haversine(PF.pointB.lat, PF.pointB.lng, result.lat, result.lng);

  // Confidence radius: a typical phone compass has ~5-10° of error even when
  // calibrated, and that error gets magnified by the DISTANCE to the candidate
  // (not just the baseline) — a small bearing error over a long sight line
  // swings the result much further than the same error over a short one.
  // Assume a conservative 10° error margin.
  const errorMargin = Math.max(distFromA, distFromB) * Math.tan(10 * Math.PI / 180);
  const confidenceRadius = Math.max(15, errorMargin);
  PF.candidate = { lat: result.lat, lng: result.lng, confidenceRadius };

  // Draw candidate marker + confidence circle
  const candIcon = L.divIcon({
    html: `<div style="width:22px;height:22px;border-radius:50%;background:#f5a623;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-size:11px;">🐝</div>`,
    className: '', iconSize: [22,22], iconAnchor: [11,11],
  });
  const candMarker = L.marker([result.lat, result.lng], { icon: candIcon })
    .bindPopup(`<div class="hive-popup"><div class="popup-name">🎯 Candidate Hive Site</div><div class="popup-desc">Triangulated from 2 bearings. The dashed circle (~${Math.round(confidenceRadius)}m radius) shows the estimated <strong>error margin</strong> on this location — it is NOT the 3-mile mating radius used elsewhere in the app, just how confident the triangulation is. Baseline between points: ${Math.round(baseline)}m.</div></div>`)
    .addTo(map);
  PF.markers.push(candMarker);

  const confCircle = L.circle([result.lat, result.lng], {
    radius: confidenceRadius,
    color: '#f5a623', fillColor: '#f5a623', fillOpacity: 0.1, weight: 1.5, dashArray: '4 4'
  }).addTo(map);
  PF.markers.push(confCircle);

  // Warn if baseline was short — short baselines amplify small bearing errors a lot
  if (baseline < 30) {
    showToast(`⚠️ Short baseline (${Math.round(baseline)}m) — small compass errors swing results a lot. Longer walks (40m+) give tighter results.`);
  }

  // Fit map to show A, B, and candidate
  const bounds = L.latLngBounds([
    [PF.pointA.lat, PF.pointA.lng],
    [PF.pointB.lat, PF.pointB.lng],
    [result.lat, result.lng]
  ]);
  map.fitBounds(bounds, { padding: [60, 60] });
}

function drawPathfinderPoint(point, label) {
  const color = label === 'A' ? '#2196f3' : '#9c27b0';
  const icon = L.divIcon({
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-weight:bold;color:#fff;font-size:12px;">${label}</div>`,
    className: '', iconSize: [26,26], iconAnchor: [13,13],
  });
  const marker = L.marker([point.lat, point.lng], { icon }).addTo(map);
  PF.markers.push(marker);
}

function drawBearingRay(point, label) {
  const color = label === 'A' ? '#2196f3' : '#9c27b0';
  const end = destinationPoint(point.lat, point.lng, point.bearing, 400); // 400m visual ray
  const ray = L.polyline([[point.lat, point.lng], [end.lat, end.lng]], {
    color, weight: 2, opacity: 0.7, dashArray: '8 6'
  }).addTo(map);
  PF.markers.push(ray);
  if (label === 'A') PF.rayA = ray;
  else PF.rayB = ray;
  return ray;
}

// Once navigation starts, the original A/B sightlines have done their job
// (proving the triangulation) — dim them way down so they don't compete
// visually with the live gold direct-line and green walked trail.
function dimBearingRays() {
  if (PF.rayA) PF.rayA.setStyle({ opacity: 0.18, weight: 1 });
  if (PF.rayB) PF.rayB.setStyle({ opacity: 0.18, weight: 1 });
}

// ── UI STATE RENDERER ──
function updatePathfinderUI() {
  const badge = document.getElementById('pf-step-badge');
  const instr = document.getElementById('pf-instruction');
  const actionBtn = document.getElementById('pf-action-btn');
  const secondaryBtn = document.getElementById('pf-secondary-btn');
  const flightCounter = document.getElementById('pf-flight-counter');
  const walkReadout = document.getElementById('pf-walk-readout');
  const navReadout = document.getElementById('pf-nav-readout');
  const compassDial = document.getElementById('pf-compass-dial');
  const manualToggle = document.getElementById('pf-manual-toggle');
  const needleCaption = document.getElementById('pf-needle-caption');
  const flatHint = document.querySelector('.pf-flat-hint');

  // Reset visibility defaults
  flightCounter.style.display = 'none';
  walkReadout.style.display = 'none';
  navReadout.style.display = 'none';
  secondaryBtn.style.display = 'none';
  manualToggle.style.display = 'block';
  compassDial.parentElement.style.display = 'flex';
  flatHint.style.display = 'block';
  document.getElementById('pathfinder-panel').classList.remove('pf-compact');
  updateDebugPanel({ step: PF.step });

  if (PF.step === 'idle' || PF.step === 'sensorsReady') {
    badge.textContent = 'Get Started';
    instr.textContent = "Pathfinder uses your phone's GPS and compass to triangulate a feral hive location from two bee-line bearings. Tap the ℹ️ above for full setup instructions, then tap below to begin.";
    actionBtn.textContent = '📍 Enable GPS & Compass';
    compassDial.parentElement.style.display = 'none';
    manualToggle.style.display = 'none';
    document.getElementById('pf-accuracy').style.display = 'none';
    document.getElementById('pf-howto-box').classList.remove('pf-howto-collapsed');
  }
  else if (PF.step === 'pointA') {
    document.getElementById('pf-accuracy').style.display = 'block';
    document.getElementById('pf-howto-box').classList.add('pf-howto-collapsed');
    badge.textContent = 'Step 1 of 3 — Point A';
    instr.textContent = "Release one bee. The instant it takes off toward home, point your phone's top edge the same direction, then tap \"Bee Flew Off\" below to record that bearing. Repeat for 3 separate bees.";
    needleCaption.textContent = "This shows your phone's current facing direction";
    flightCounter.style.display = 'flex';
    actionBtn.textContent = '🔒 Lock Bearing — Point A';
    updateAccuracyBanner();
  }
  else if (PF.step === 'walking') {
    badge.textContent = 'Step 2 of 3 — Walk';
    instr.textContent = "Walk as far as your space allows — 20m (about 22 yards) is workable, 40m+ is more accurate. Try to move at an angle, not straight along your first bearing. Your path is tracked live on the map below.";
    walkReadout.style.display = 'block';
    flightCounter.style.display = 'none';
    compassDial.parentElement.style.display = 'none';
    manualToggle.style.display = 'none';
    flatHint.style.display = 'none';
    actionBtn.textContent = "✅ I've Arrived — Set Point B";
  }
  else if (PF.step === 'pointB') {
    badge.textContent = 'Step 2 of 3 — Point B';
    instr.textContent = 'Release captured bees again from here. Point your phone the direction each one flies, tap "Bee Flew Off" after each release, then lock this second bearing.';
    needleCaption.textContent = "This shows your phone's current facing direction";
    flightCounter.style.display = 'flex';
    actionBtn.textContent = '🔒 Lock Bearing — Point B';
  }
  else if (PF.step === 'result') {
    badge.textContent = 'Step 3 of 3 — Result';
    compassDial.parentElement.style.display = 'none';
    manualToggle.style.display = 'none';
    flatHint.style.display = 'none';
    if (PF.candidate) {
      instr.textContent = `Triangulation complete! 🔵 blue line = Point A's bearing, 🟣 magenta line = Point B's bearing — they cross at the candidate site. The dashed gold circle (~${Math.round(PF.candidate.confidenceRadius)}m) is the error margin, not a mating radius. Navigate there now, or save it directly.`;
      actionBtn.textContent = '🧭 Navigate to Hive Site';
    } else {
      instr.textContent = "The two bearings didn't produce a usable intersection. Try again with a wider angle between Point A and Point B.";
      actionBtn.textContent = '🔄 Start Over';
    }
    secondaryBtn.style.display = 'block';
  }
  else if (PF.step === 'navigating') {
    badge.textContent = 'Navigating';
    instr.textContent = "Follow the gold arrow below. On the map: 🔵 blue dot = you. 🔺 gold triangle = points the way and stays visible even when you're close. 🟡 gold dashed line = direct distance to the hive (shrinks as you approach). 🟢 green trail = path you've walked. The faint blue/magenta lines are your original Point A/B sightlines, kept dim for reference.";
    needleCaption.textContent = '🎯 This points toward the hive site';
    navReadout.style.display = 'block';
    manualToggle.style.display = 'none';
    actionBtn.textContent = '💾 Save as Hive Record';
    secondaryBtn.style.display = 'block';
    document.getElementById('pathfinder-panel').classList.add('pf-compact');
  }
}

// ── FIELD-TEST ACCESS GATE (Phase 5) ──
// The Pathfinder tab and 🐞 debug button stay hidden in production until the
// v3 polish ships. Visiting https://savethehives.org/?pf=1 unhides both for
// that visit only — lets Phase 5 field testing happen on the live site
// without exposing the unfinished tool to regular visitors.
(function pathfinderFieldTestGate() {
  if (new URLSearchParams(location.search).get('pf') !== '1') return;
  const tab = document.getElementById('tab-pathfinder');
  if (tab) tab.style.display = '';
  const dbg = document.getElementById('debug-toggle-btn');
  if (dbg) dbg.style.display = '';
})();

