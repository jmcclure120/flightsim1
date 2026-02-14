import * as THREE from 'three';
import { game, ac, fns, chaseS, projs, expls, smokes, scorchMarks } from './state.js';
import { LOCS, MAPBOX_TOKEN, FT2M, KT2MS, DEG, MLAT } from './constants.js';
import { buildF16 } from './aircraft.js';
import { buildAtmo } from './atmosphere.js';
import { initCtrl } from './controls.js';
import { initTerrain, updateTerrain, groundElevRaycast, disposeTerrain, getTilesRenderer } from './terrain.js';
import { createLocationMarkers } from './markers.js';
import { initAudio, resetAudioGains } from './audio.js';

export function initStart() {
  const grid = document.getElementById('locationsGrid');
  LOCS.forEach(loc => {
    const c = document.createElement('div');
    c.className = 'loc-card' + (loc.def ? ' selected' : '');
    c.innerHTML = `<div class="name-row"><svg class="pin-icon" viewBox="0 0 24 24" fill="none" stroke="${loc.def ? '#00d4ff' : '#3d4f66'}" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg><span class="name">${loc.name}</span><span class="sel-dot"></span></div><div class="coords">${Math.abs(loc.lat).toFixed(4)}\u00B0${loc.lat >= 0 ? 'N' : 'S'} ${Math.abs(loc.lng).toFixed(4)}\u00B0${loc.lng >= 0 ? 'E' : 'W'}</div>`;
    c.onclick = () => {
      grid.querySelectorAll('.loc-card').forEach(d => { d.classList.remove('selected'); d.querySelector('.pin-icon').setAttribute('stroke', '#3d4f66'); });
      c.classList.add('selected');
      c.querySelector('.pin-icon').setAttribute('stroke', '#00d4ff');
      game.selLoc = loc;
      document.getElementById('startBtn').disabled = false;
    };
    grid.appendChild(c);
  });
  document.getElementById('startBtn').disabled = false;

  // Search
  let stm;
  const inp = document.getElementById('searchInput'), dd = document.getElementById('searchDropdown');
  inp.addEventListener('input', () => {
    clearTimeout(stm);
    const q = inp.value.trim();
    if (q.length < 2) { dd.classList.remove('active'); return; }
    stm = setTimeout(() => geoSearch(q), 350);
  });
  document.getElementById('startBtn').onclick = startFlight;
  document.getElementById('resumeBtn').onclick = resume;
  document.getElementById('rearmBtn').onclick = () => {
    ac.gunN = 511;
    ac.misN = 2;
    ac.bomN = 4;
    if (ac.wm.mis) ac.wm.mis.forEach(m => { if (m) m.visible = true; });
    if (ac.wm.bom) ac.wm.bom.forEach(m => { if (m) m.visible = true; });
  };
  document.getElementById('restartBtn').onclick = toMenu;

  // Controls modal
  const modal = document.getElementById('controlsModal');
  document.getElementById('viewControlsBtn').onclick = () => modal.classList.add('active');
  document.getElementById('closeControlsBtn').onclick = () => modal.classList.remove('active');
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('active')) { modal.classList.remove('active'); e.stopPropagation(); } }, true);

  // F-16 parallax
  const hero = document.getElementById('f16Hero');
  if (hero) {
    document.getElementById('startScreen').addEventListener('mousemove', e => {
      const cx = e.clientX / innerWidth - 0.5, cy = e.clientY / innerHeight - 0.5;
      hero.style.transform = `translateX(${cx * 12}px) translateY(${cy * 8}px)`;
    });
  }

  // Register resume for controls.js to access via fns
  fns.resume = resume;
}

async function geoSearch(q) {
  const dd = document.getElementById('searchDropdown');
  try {
    const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}`);
    const d = await r.json();
    dd.innerHTML = '';
    if (d.features && d.features.length) {
      d.features.forEach(f => {
        const div = document.createElement('div');
        div.className = 'result';
        div.textContent = f.place_name;
        div.onclick = () => {
          game.selLoc = { name: f.place_name, lat: f.center[1], lng: f.center[0] };
          document.querySelectorAll('.loc-card').forEach(c => { c.classList.remove('selected'); const p = c.querySelector('.pin-icon'); if (p) p.setAttribute('stroke', '#3d4f66'); });
          document.getElementById('searchInput').value = f.place_name;
          dd.classList.remove('active');
          document.getElementById('startBtn').disabled = false;
        };
        dd.appendChild(div);
      });
      dd.classList.add('active');
    }
  } catch (e) { console.error('Geocode:', e); }
}

async function startFlight() {
  const btn = document.getElementById('startBtn');
  btn.disabled = true;
  document.getElementById('controlsModal').classList.remove('active');

  // Hide home screen
  const ss = document.getElementById('startScreen');
  ss.classList.add('hidden');

  // Show loading screen immediately (z-index 10000 — above everything)
  const lo = document.getElementById('loadingOverlay');
  const ls = document.getElementById('loadingStatus');
  lo.classList.add('active');
  lo.style.opacity = '1';
  ls.textContent = 'INITIALIZING SYSTEMS...';

  // Timed status messages
  setTimeout(() => { if (lo.classList.contains('active')) ls.textContent = 'LOADING TERRAIN DATA...'; }, 1000);
  setTimeout(() => { if (lo.classList.contains('active')) ls.textContent = 'PREPARING AIRCRAFT...'; }, 2500);
  setTimeout(() => { if (lo.classList.contains('active')) ls.textContent = 'STREAMING 3D TILES...'; }, 4000);

  // Initialize the sim scene in background
  game.spLat = game.selLoc.lat;
  game.spLng = game.selLoc.lng;
  game.mPerDLng = MLAT * Math.cos(game.spLat * DEG);

  fns.initScene();
  buildF16();
  buildAtmo();
  initCtrl();

  initTerrain(game.scene, game.cam, game.renderer, game.spLat, game.spLng);
  game.cam.position.set(0, 3000, 0);
  game.cam.lookAt(0, 0, 0);

  // Pump terrain updates while loading screen is visible
  const pumpTerrain = setInterval(() => {
    updateTerrain(game.cam, game.renderer);
    if (game.renderer && game.scene && game.cam) {
      game.renderer.render(game.scene, game.cam);
    }
  }, 100);

  // Wait minimum 4.5 seconds for loading screen to display
  await new Promise(r => setTimeout(r, 4500));
  clearInterval(pumpTerrain);

  // Create location markers (deferred until tile group matrix is valid)
  try { createLocationMarkers(game.scene); } catch (e) { console.warn('Markers:', e); }

  // Find ground elevation via raycast
  const groundY = groundElevRaycast(new THREE.Vector3(0, 20000, 0));
  const h = Math.max(groundY, 0) + 5000 * FT2M;

  // Aircraft state
  ac.pos = new THREE.Vector3(0, h, 0);
  const spawnHdg = (game.selLoc.hdg != null ? game.selLoc.hdg : 45) * DEG;
  ac.quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spawnHdg);
  const spawnSpd = 300 * KT2MS;
  const spawnFw = new THREE.Vector3(0, 0, -1).applyQuaternion(ac.quat);
  ac.vel = spawnFw.multiplyScalar(spawnSpd);
  ac.lat = game.spLat; ac.lng = game.spLng; ac.alt = h;
  ac.thr = 0.7; ac.gear = false; ac.flap = false; ac.brake = false;
  ac.wep = 0; ac.gunN = 511; ac.misN = 2; ac.bomN = 4;
  ac.gF = 1; ac.gAlt = groundY; ac.firing = false; ac.fireTmr = 0;
  ac.rollRate = 0; ac.pitchRate = 0; ac.yawRate = 0; ac.pitchTrim = 0; ac.rollTrim = 0;

  // Audio init
  if (!game.sndInit) initAudio();
  if (game.audioCtx && game.audioCtx.state === 'suspended') game.audioCtx.resume();

  // Show READY status, then fade out loading screen
  ls.textContent = 'READY';
  await new Promise(r => setTimeout(r, 500));

  // Fade out loading screen
  lo.style.opacity = '0';
  await new Promise(r => setTimeout(r, 500));
  lo.classList.remove('active');
  lo.style.opacity = '';

  // Start the game
  document.getElementById('hud').classList.add('active');
  document.getElementById('flightTransition').classList.remove('active');
  game.state = 'FLYING';
  game.clock = new THREE.Clock();

  // Chase camera initial position
  const cFw = new THREE.Vector3(0, 0, -1).applyQuaternion(ac.quat);
  const cUp = new THREE.Vector3(0, 1, 0).applyQuaternion(ac.quat);
  chaseS.copy(ac.pos).add(cFw.clone().multiplyScalar(-20)).add(cUp.clone().multiplyScalar(4));

  // Show tile hint for 15 seconds
  const hint = document.getElementById('hudTileHint');
  hint.textContent = 'Tiles load dynamically \u2014 circle an area for full detail';
  hint.style.opacity = '1';
  setTimeout(() => { hint.style.opacity = '0'; }, 15000);

  fns.gameLoop();
}

function resume() {
  document.getElementById('pauseMenu').classList.remove('active');
  game.state = 'FLYING'; game.clock.getDelta();
  if (game.audioCtx && game.audioCtx.state === 'suspended') game.audioCtx.resume();
}

function toMenu() {
  document.getElementById('pauseMenu').classList.remove('active');
  document.getElementById('hud').classList.remove('active');
  document.getElementById('flightTransition').classList.remove('active');
  document.getElementById('loadingOverlay').classList.remove('active');
  document.getElementById('hudTileHint').style.opacity = '0';
  document.getElementById('startScreen').classList.remove('hidden');
  document.getElementById('startBtn').innerHTML = 'START FLIGHT <span class="btn-chevrons">&#x25B8;&#x25B8;</span>';
  document.getElementById('startBtn').disabled = false;
  game.state = 'START'; game.skyMesh = null;
  game.bombCam = false; game.bombCamTarget = null; game.bombCamReturnTimer = 0;
  game.camMode = 0;
  if (game.audioCtx) { resetAudioGains(); game.audioCtx.suspend(); }
  if (game.renderer) { game.renderer.dispose(); game.renderer.domElement.remove(); }
  disposeTerrain();
  projs.length = 0; expls.length = 0; smokes.length = 0; scorchMarks.length = 0;
  game.scene = null; game.cam = null; game.renderer = null;
}
