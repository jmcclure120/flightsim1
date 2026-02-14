import { game, ac, snd } from './state.js';
import { clamp, MS2KT } from './constants.js';

export function initAudio() {
  try {
    game.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    game.sndInit = true;
    const audioCtx = game.audioCtx;

    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 10; comp.ratio.value = 4;
    comp.attack.value = 0.01; comp.release.value = 0.1;
    const masterG = audioCtx.createGain(); masterG.gain.value = 0.45;
    comp.connect(masterG); masterG.connect(audioCtx.destination);

    // Noise buffers
    const bs = audioCtx.sampleRate * 2;
    const nBuf = audioCtx.createBuffer(1, bs, audioCtx.sampleRate);
    const nd = nBuf.getChannelData(0); for (let i = 0; i < bs; i++) nd[i] = Math.random() * 2 - 1;
    const bBuf = audioCtx.createBuffer(1, bs, audioCtx.sampleRate);
    const bd = bBuf.getChannelData(0); let bv = 0;
    for (let i = 0; i < bs; i++) { bv += (Math.random() * 2 - 1) * 0.02; bv = clamp(bv, -1, 1); bd[i] = bv; }

    // Engine Layer 1: Low rumble (brown noise → lowpass)
    const engLowN = audioCtx.createBufferSource(); engLowN.buffer = bBuf; engLowN.loop = true;
    const engLowF = audioCtx.createBiquadFilter(); engLowF.type = 'lowpass'; engLowF.frequency.value = 150; engLowF.Q.value = 0.7;
    const engLowG = audioCtx.createGain(); engLowG.gain.value = 0;
    engLowN.connect(engLowF); engLowF.connect(engLowG); engLowG.connect(comp); engLowN.start();

    // Engine Layer 2: Mid roar (white noise → bandpass)
    const engMidN = audioCtx.createBufferSource(); engMidN.buffer = nBuf; engMidN.loop = true;
    const engMidF = audioCtx.createBiquadFilter(); engMidF.type = 'bandpass'; engMidF.frequency.value = 400; engMidF.Q.value = 0.5;
    const engMidG = audioCtx.createGain(); engMidG.gain.value = 0;
    engMidN.connect(engMidF); engMidF.connect(engMidG); engMidG.connect(comp); engMidN.start();

    // Engine Layer 3: High turbine (sine → lowpass)
    const engHiO = audioCtx.createOscillator(); engHiO.type = 'sine'; engHiO.frequency.value = 900;
    const engHiF = audioCtx.createBiquadFilter(); engHiF.type = 'lowpass'; engHiF.frequency.value = 2000; engHiF.Q.value = 0.5;
    const engHiG = audioCtx.createGain(); engHiG.gain.value = 0;
    engHiO.connect(engHiF); engHiF.connect(engHiG); engHiG.connect(comp); engHiO.start();

    // Afterburner Layer 1: sub-bass rumble
    const abLowN = audioCtx.createBufferSource(); abLowN.buffer = bBuf; abLowN.loop = true;
    const abLowF = audioCtx.createBiquadFilter(); abLowF.type = 'lowpass'; abLowF.frequency.value = 100; abLowF.Q.value = 0.7;
    const abLowG = audioCtx.createGain(); abLowG.gain.value = 0;
    abLowN.connect(abLowF); abLowF.connect(abLowG); abLowG.connect(comp); abLowN.start();

    // Afterburner Layer 2: crackling roar
    const abMidN = audioCtx.createBufferSource(); abMidN.buffer = nBuf; abMidN.loop = true;
    const abMidF = audioCtx.createBiquadFilter(); abMidF.type = 'bandpass'; abMidF.frequency.value = 300; abMidF.Q.value = 0.5;
    const abMidG = audioCtx.createGain(); abMidG.gain.value = 0;
    abMidN.connect(abMidF); abMidF.connect(abMidG); abMidG.connect(comp); abMidN.start();

    // Wind Layer 1: airflow
    const wndLoN = audioCtx.createBufferSource(); wndLoN.buffer = nBuf; wndLoN.loop = true;
    const wndLoF = audioCtx.createBiquadFilter(); wndLoF.type = 'highpass'; wndLoF.frequency.value = 800; wndLoF.Q.value = 0.5;
    const wndLoG = audioCtx.createGain(); wndLoG.gain.value = 0;
    wndLoN.connect(wndLoF); wndLoF.connect(wndLoG); wndLoG.connect(comp); wndLoN.start();

    // Wind Layer 2: canopy howl
    const wndHiN = audioCtx.createBufferSource(); wndHiN.buffer = nBuf; wndHiN.loop = true;
    const wndHiF = audioCtx.createBiquadFilter(); wndHiF.type = 'bandpass'; wndHiF.frequency.value = 3000; wndHiF.Q.value = 0.7;
    const wndHiG = audioCtx.createGain(); wndHiG.gain.value = 0;
    wndHiN.connect(wndHiF); wndHiF.connect(wndHiG); wndHiG.connect(comp); wndHiN.start();

    // ===== GUN BRRRRT — Multi-layer sustained sound =====
    // Layer 1: White noise → bandpass (800Hz, Q=2) → gun gain
    const gunBrrtN = audioCtx.createBufferSource(); gunBrrtN.buffer = nBuf; gunBrrtN.loop = true;
    const gunBrrtF = audioCtx.createBiquadFilter(); gunBrrtF.type = 'bandpass'; gunBrrtF.frequency.value = 800; gunBrrtF.Q.value = 2;
    const gunBrrtG = audioCtx.createGain(); gunBrrtG.gain.value = 0;
    gunBrrtN.connect(gunBrrtF); gunBrrtF.connect(gunBrrtG);

    // Layer 2: LFO (100Hz sine) modulating Layer 1 gain for BRRRRT buzz
    const gunLFO = audioCtx.createOscillator(); gunLFO.type = 'sine'; gunLFO.frequency.value = 100;
    const gunLFOG = audioCtx.createGain(); gunLFOG.gain.value = 0.8;
    gunLFO.connect(gunLFOG); gunLFOG.connect(gunBrrtG.gain);
    gunLFO.start();

    // Layer 3: Brown noise → lowpass 100Hz (mechanical rumble)
    const gunRumbleN = audioCtx.createBufferSource(); gunRumbleN.buffer = bBuf; gunRumbleN.loop = true;
    const gunRumbleF = audioCtx.createBiquadFilter(); gunRumbleF.type = 'lowpass'; gunRumbleF.frequency.value = 100;
    const gunRumbleG = audioCtx.createGain(); gunRumbleG.gain.value = 0;
    gunRumbleN.connect(gunRumbleF); gunRumbleF.connect(gunRumbleG);

    // Gun bus: combine all layers
    const gunBusG = audioCtx.createGain(); gunBusG.gain.value = 0;
    gunBrrtG.connect(gunBusG);
    gunRumbleG.connect(gunBusG);
    gunBusG.connect(comp);
    gunBrrtN.start(); gunRumbleN.start();

    // Explosion FX nodes (reusable)
    const expO = audioCtx.createOscillator(); expO.type = 'sine'; expO.frequency.value = 50;
    const expOG = audioCtx.createGain(); expOG.gain.value = 0;
    expO.connect(expOG); expOG.connect(comp); expO.start();
    const expN = audioCtx.createBufferSource(); expN.buffer = nBuf; expN.loop = true;
    const expNF = audioCtx.createBiquadFilter(); expNF.type = 'bandpass'; expNF.frequency.value = 2000; expNF.Q.value = 1;
    const expNG = audioCtx.createGain(); expNG.gain.value = 0;
    expN.connect(expNF); expNF.connect(expNG); expNG.connect(comp); expN.start();

    // Missile launch whoosh
    const misN = audioCtx.createBufferSource(); misN.buffer = nBuf; misN.loop = true;
    const misF = audioCtx.createBiquadFilter(); misF.type = 'bandpass'; misF.frequency.value = 600; misF.Q.value = 2;
    const misG = audioCtx.createGain(); misG.gain.value = 0;
    misN.connect(misF); misF.connect(misG); misG.connect(comp); misN.start();

    audioCtx.suspend();

    Object.assign(snd, {
      comp, masterG, nBuf, bBuf,
      engLowF, engLowG, engMidF, engMidG, engHiO, engHiF, engHiG,
      abLowG, abMidF, abMidG,
      wndLoG, wndHiG,
      gunBusG, gunBrrtG, gunRumbleG,
      expO, expOG, expNF, expNG, misF, misG
    });
  } catch (e) { console.warn('Audio:', e); }
}

export function rampParam(param, val, t) {
  const now = game.audioCtx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(val, now + (t || 0.15));
}

export function updateAudio() {
  if (!game.audioCtx || !snd.engLowG) return;
  if (game.audioCtx.state === 'suspended') return;
  const t = clamp(ac.thr, 0, 1), s = ac.spd;
  rampParam(snd.engLowF.frequency, 150 + t * 150, 0.2);
  rampParam(snd.engLowG.gain, 0.3 + t * 0.4, 0.2);
  rampParam(snd.engMidF.frequency, 400 + t * 400, 0.2);
  rampParam(snd.engMidG.gain, 0.15 + t * 0.25, 0.2);
  rampParam(snd.engHiO.frequency, 900 + t * 600, 0.2);
  rampParam(snd.engHiG.gain, 0.01 + t * 0.04, 0.2);
  const ab = ac.thr > 1 ? clamp((ac.thr - 1) * 3.3, 0, 1) : 0;
  rampParam(snd.abLowG.gain, ab * 0.5, 0.3);
  rampParam(snd.abMidF.frequency, 200 + ab * 200, 0.2);
  rampParam(snd.abMidG.gain, ab * 0.3, 0.3);
  const wSpd = s * MS2KT;
  const wLoGain = wSpd < 100 ? 0 : clamp((wSpd - 100) / 500 * 0.25, 0, 0.25);
  rampParam(snd.wndLoG.gain, wLoGain, 0.2);
  const wHiGain = wSpd < 500 ? 0 : clamp((wSpd - 500) / 300 * 0.12, 0, 0.12);
  rampParam(snd.wndHiG.gain, wHiGain, 0.2);

  // Sustained gun BRRRRT sound
  if (snd.gunBusG) {
    const gunTarget = (ac.firing && ac.wep === 0 && ac.gunN > 0) ? 0.15 : 0;
    const gunRamp = gunTarget > 0 ? 0.02 : 0.05;
    rampParam(snd.gunBusG.gain, gunTarget, gunRamp);
    if (gunTarget > 0) {
      rampParam(snd.gunBrrtG.gain, 0.3, 0.02);
      rampParam(snd.gunRumbleG.gain, 0.15, 0.02);
    } else {
      rampParam(snd.gunBrrtG.gain, 0, 0.05);
      rampParam(snd.gunRumbleG.gain, 0, 0.05);
    }
  }
}

export function resetAudioGains() {
  if (!snd.engLowG) return;
  const gains = [snd.engLowG, snd.engMidG, snd.engHiG, snd.abLowG, snd.abMidG, snd.wndLoG, snd.wndHiG, snd.expOG, snd.expNG, snd.misG];
  if (snd.gunBusG) gains.push(snd.gunBusG, snd.gunBrrtG, snd.gunRumbleG);
  gains.forEach(g => {
    g.gain.cancelScheduledValues(0); g.gain.setValueAtTime(0, 0);
  });
}

export function playFx(type, size) {
  if (!game.audioCtx || game.audioCtx.state !== 'running') return;
  const now = game.audioCtx.currentTime;

  if (type === 'mis') {
    snd.misG.gain.cancelScheduledValues(now);
    snd.misG.gain.setValueAtTime(0.2, now);
    snd.misG.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    snd.misF.frequency.cancelScheduledValues(now);
    snd.misF.frequency.setValueAtTime(600, now);
    snd.misF.frequency.linearRampToValueAtTime(1200, now + 0.5);
    snd.misF.frequency.linearRampToValueAtTime(400, now + 1.5);
  }
  if (type === 'exp') {
    const gain = size === 'small' ? 0.08 : 0.25;
    snd.expNG.gain.cancelScheduledValues(now);
    snd.expNG.gain.setValueAtTime(gain, now);
    snd.expNG.gain.linearRampToValueAtTime(gain * 0.3, now + 0.01);
    snd.expNG.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    snd.expOG.gain.cancelScheduledValues(now);
    snd.expO.frequency.cancelScheduledValues(now);
    snd.expO.frequency.setValueAtTime(55, now);
    snd.expOG.gain.setValueAtTime(0.2, now);
    snd.expOG.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    snd.expNF.frequency.cancelScheduledValues(now);
    snd.expNF.frequency.setValueAtTime(2500, now);
    snd.expNF.frequency.linearRampToValueAtTime(1000, now + 1.0);
  }
  if (type === 'expLarge') {
    // Sub-bass 30-50Hz
    snd.expOG.gain.cancelScheduledValues(now);
    snd.expO.frequency.cancelScheduledValues(now);
    snd.expO.frequency.setValueAtTime(40, now);
    snd.expOG.gain.setValueAtTime(0.3, now);
    snd.expOG.gain.exponentialRampToValueAtTime(0.001, now + 3.0);

    // Initial noise burst
    snd.expNG.gain.cancelScheduledValues(now);
    snd.expNG.gain.setValueAtTime(0.3, now);
    snd.expNG.gain.linearRampToValueAtTime(0.1, now + 0.05);
    snd.expNG.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    snd.expNF.frequency.cancelScheduledValues(now);
    snd.expNF.frequency.setValueAtTime(3000, now);
    snd.expNF.frequency.linearRampToValueAtTime(500, now + 1.5);

    // Delayed secondary boom (0.3s delay)
    snd.expO.frequency.linearRampToValueAtTime(30, now + 0.3);
    snd.expOG.gain.setValueAtTime(0.3, now);
    snd.expOG.gain.linearRampToValueAtTime(0.25, now + 0.3);
    snd.expOG.gain.exponentialRampToValueAtTime(0.001, now + 3.5);
  }
}

// ===== BOMB WHISTLE =====
export function createBombWhistle(proj) {
  if (!game.audioCtx || game.audioCtx.state !== 'running') return;
  try {
    const audioCtx = game.audioCtx;
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 200;
    // Bandpass filter to soften the tone into a whistle
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 1;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.08;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(snd.comp);
    osc.start();
    proj.whistleOsc = osc;
    proj.whistleFilter = filter;
    proj.whistleGain = gain;
  } catch (e) { /* ignore */ }
}

export function updateBombWhistle(proj) {
  if (!proj.whistleOsc || !game.audioCtx) return;
  try {
    const spd = proj.vel.length();
    const t = clamp(spd / 400, 0, 1);
    // Ramp from 200Hz to 600Hz as bomb accelerates
    const freq = 200 + t * 400;
    proj.whistleOsc.frequency.value = freq;
    // Center the bandpass on the oscillator frequency
    if (proj.whistleFilter) proj.whistleFilter.frequency.value = freq;
    const gain = 0.08 + t * 0.07; // 0.08 to 0.15
    proj.whistleGain.gain.value = gain;
  } catch (e) { /* ignore */ }
}

export function stopBombWhistle(proj) {
  if (!proj.whistleOsc || !game.audioCtx) return;
  try {
    const now = game.audioCtx.currentTime;
    proj.whistleGain.gain.cancelScheduledValues(now);
    proj.whistleGain.gain.setValueAtTime(proj.whistleGain.gain.value, now);
    proj.whistleGain.gain.linearRampToValueAtTime(0, now + 0.05);
    setTimeout(() => {
      try { proj.whistleOsc.stop(); } catch (e) { /* already stopped */ }
      try { proj.whistleOsc.disconnect(); proj.whistleGain.disconnect(); } catch (e) { /* ignore */ }
    }, 100);
  } catch (e) { /* ignore */ }
}
