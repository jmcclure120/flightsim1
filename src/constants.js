import * as THREE from 'three';

export const GOOGLE_API_KEY = 'AIzaSyAFeCiQWLT5yKn8En6xiir_EjKeciu0dz0';
export const MAPBOX_TOKEN = 'pk.eyJ1Ijoiam1jY2x1cmUxMjAiLCJhIjoiY21sajEwOTIxMDk1YzNlcHIxenJuZXZxZSJ9.AfhswuMdToVnIu1rBf_dcA';
export const FT2M = 0.3048, M2FT = 3.28084, KT2MS = 0.514444, MS2KT = 1.94384;
export const DEG = Math.PI / 180, RAD = 180 / Math.PI, G = 9.81, MLAT = 111320;

export const LOCS = [
  { name: 'Goldstream Valley, AK', lat: 64.938194, lng: -147.763778, hdg: 270, def: true },
  { name: 'Denali, AK', lat: 63.0692, lng: -151.007 },
  { name: 'Cicero, IL', lat: 41.815222, lng: -87.751722, hdg: 180 },
  { name: 'Seattle, WA', lat: 47.6062, lng: -122.3321 },
  { name: 'Philadelphia, PA', lat: 39.9526, lng: -75.1652 }
];

export const F16 = {
  mass: 12000, S: 27.87, Tmil: 76300, Tab: 127000, Cd0: 0.022, K: 0.12,
  Cla: 4.0, Clmax: 1.4, stallA: 18 * DEG, maxG: 9, minG: -3,
  rollMax: 50 * DEG, pitchMax: 25 * DEG, yawMax: 8 * DEG,
  gearD: 0.04, flapL: 0.3, flapD: 0.03, brakeD: 0.06
};

export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }

export function airDensity(h) {
  if (h < 11000) { const T = 288.15 - 0.0065 * h; return 1.225 * Math.pow(T / 288.15, 4.2559); }
  return 0.3639 * Math.exp(-(h - 11000) / 6341.62);
}

export function soundSpd(h) {
  return Math.sqrt(1.4 * 287.05 * (h < 11000 ? 288.15 - 0.0065 * h : 216.65));
}

export function eulerQ(q) {
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q), e = m.elements;
  return {
    pitch: Math.asin(clamp(-e[9], -1, 1)),
    yaw: Math.atan2(e[8], e[10]),
    roll: Math.atan2(e[1], e[5])
  };
}
