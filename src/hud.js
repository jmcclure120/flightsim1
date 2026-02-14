import { ac, game } from './state.js';
import { MS2KT, M2FT, RAD, F16, eulerQ } from './constants.js';

export function updateHUD() {
  const spd = ac.spd * MS2KT, alt = ac.alt * M2FT, agl = (ac.alt - ac.gAlt) * M2FT;
  const eu = eulerQ(ac.quat);
  let hdg = (-eu.yaw * RAD + 360) % 360;
  if (hdg < 0.5) hdg = 360;

  document.getElementById('hudAirspeed').textContent = Math.round(spd);
  document.getElementById('hudAltitude').textContent = Math.round(alt);
  const ra = document.getElementById('hudRadarAlt');
  if (agl < 5000) { ra.textContent = 'R ' + Math.round(agl); ra.style.display = 'block'; }
  else ra.style.display = 'none';
  document.getElementById('hudHeading').textContent = String(Math.round(hdg)).padStart(3, '0');
  document.getElementById('hudGforce').textContent = 'G ' + ac.gF.toFixed(1);

  const tp = Math.min(ac.thr * 100, 100);
  document.getElementById('hudThrottle').textContent = 'THR ' + Math.round(tp) + '%' + (ac.thr > 1 ? ' AB' : '');
  document.getElementById('hudMach').textContent = 'M ' + ac.mach.toFixed(2);

  const wn = ['M61 VULCAN', 'AIM-9', 'MK-82'], wa = [ac.gunN, ac.misN, ac.bomN];
  document.getElementById('hudWeapon').textContent = wn[ac.wep] + '  ' + wa[ac.wep];
  document.getElementById('hudGunCross').style.display = ac.wep === 0 ? 'block' : 'none';

  const la = Math.abs(ac.lat).toFixed(4) + '\u00B0' + (ac.lat >= 0 ? 'N' : 'S');
  const lo = Math.abs(ac.lng).toFixed(4) + '\u00B0' + (ac.lng >= 0 ? 'E' : 'W');
  document.getElementById('hudCoords').textContent = la + ' ' + lo;

  document.getElementById('hudGear').textContent = ac.gear ? 'GEAR DN' : '';
  document.getElementById('hudFlaps').textContent = ac.flap ? 'FLAPS' : '';
  document.getElementById('hudBrake').textContent = ac.brake ? 'SPD BRK' : '';

  const cm = ['CHASE CAM', 'COCKPIT', 'FLYBY', 'BOMB CAM'];
  document.getElementById('hudCamMode').textContent = cm[game.camMode] || cm[0];

  const warn = document.getElementById('hudWarning');
  if (Math.abs(ac.aoa) > F16.stallA && ac.spd * MS2KT < 180) warn.textContent = 'STALL';
  else if (agl < 500 && agl > 0) warn.textContent = 'ALTITUDE';
  else if (ac.gF > 8) warn.textContent = 'OVER G';
  else warn.textContent = '';

  const rollDeg = eu.roll * RAD, pitchOff = eu.pitch * RAD * 3;
  document.getElementById('hudHorizon').style.transform = `translate(-50%,-50%) translateY(${pitchOff}px) rotate(${rollDeg}deg)`;

  const aoaD = ac.aoa * RAD;
  document.getElementById('hudFPM').style.left = `calc(50% + 0px)`;
  document.getElementById('hudFPM').style.top = `calc(50% + ${aoaD * 5}px)`;

  const trimEl = document.getElementById('hudTrim');
  if (Math.abs(ac.pitchTrim) > 0.1 || Math.abs(ac.rollTrim) > 0.1) {
    let ts = '';
    if (Math.abs(ac.pitchTrim) > 0.1) ts += 'TRIM P:' + ac.pitchTrim.toFixed(1) + ' ';
    if (Math.abs(ac.rollTrim) > 0.1) ts += 'R:' + ac.rollTrim.toFixed(1);
    trimEl.textContent = ts;
  } else trimEl.textContent = '';

  updatePL(eu.pitch * RAD, rollDeg);
}

function updatePL(pDeg, rDeg) {
  const c = document.getElementById('hudPitchLadder'); c.innerHTML = '';
  c.style.transform = `translate(-50%,-50%) rotate(${rDeg}deg)`;
  const ppd = 5;
  for (let p = -90; p <= 90; p += 5) {
    if (p === 0) continue;
    const off = (pDeg - p) * ppd; if (Math.abs(off) > 150) continue;
    const l = document.createElement('div');
    l.className = 'pitch-line' + (p < 0 ? ' negative' : '');
    l.style.top = `calc(50% + ${off}px)`;
    l.style.width = (Math.abs(p) % 10 === 0 ? '120px' : '60px');
    l.innerHTML = `<span class="l">${Math.abs(p)}</span><span class="r">${Math.abs(p)}</span>`;
    c.appendChild(l);
  }
}
