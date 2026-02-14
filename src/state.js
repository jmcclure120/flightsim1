import * as THREE from 'three';
import { LOCS } from './constants.js';

export const game = {
  state: 'START',
  selLoc: LOCS[0],
  spLat: 0, spLng: 0, mPerDLng: 0, spGnd: 0,
  scene: null, cam: null, renderer: null, clock: null,
  sunLight: null, ambLight: null,
  skyMesh: null,
  camMode: 0, freeLk: false, flYaw: 0, flPitch: 0,
  gpActive: false, ctrlInit: false,
  audioCtx: null, sndInit: false,
  bombCam: false, bombCamTarget: null, bombCamReturnTimer: 0,
};

export const ac = {
  pos: null, quat: null, vel: null, lat: 0, lng: 0, alt: 0,
  thr: 0.7, gear: false, flap: false, brake: false,
  wep: 0, gunN: 511, misN: 2, bomN: 4,
  mdl: null, cs: {}, wm: { mis: [], bom: [] }, abMesh: null,
  spd: 0, mach: 0, gF: 1, aoa: 0, gAlt: 0,
  ailD: 0, eleD: 0, rudD: 0, firing: false, fireTmr: 0,
  rollRate: 0, pitchRate: 0, yawRate: 0,
  pitchTrim: 0, rollTrim: 0
};

export const snd = {};
export const keys = {};
export const flybyP = new THREE.Vector3();
export const chaseS = new THREE.Vector3();
export const projs = [];
export const expls = [];
export const smokes = [];

// Function registry — avoids circular dependencies between modules
export const fns = {};

// ===== Object Pools =====
const smokePool = [], tracerPool = [], debrisPool = [], fireballPool = [], dustPool = [];
export const MAX_PARTICLES = 500;
export let activeParticles = 0;
export function incPart() { activeParticles++; }
export function decPart() { activeParticles--; }
export function canSpawn() { return activeParticles < MAX_PARTICLES; }

// Active scorch/crater marks (limit 20)
export const scorchMarks = [];
export const MAX_SCORCHES = 20;

function createSmokeMesh() {
  return new THREE.Mesh(new THREE.SphereGeometry(1, 4, 4), new THREE.MeshBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.5, depthWrite: false }));
}
function createTracerMesh() {
  return new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 5), new THREE.MeshBasicMaterial({ color: 0xffdd44, toneMapped: false }));
}
function createDebrisMesh() {
  return new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, blending: THREE.AdditiveBlending }));
}
function createFireballMesh() {
  return new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
}
function createDustMesh() {
  const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff });
  return new THREE.Sprite(mat);
}

// Pre-allocate pools
for (let i = 0; i < 100; i++) smokePool.push(createSmokeMesh());
for (let i = 0; i < 200; i++) tracerPool.push(createTracerMesh());
for (let i = 0; i < 200; i++) debrisPool.push(createDebrisMesh());
for (let i = 0; i < 100; i++) fireballPool.push(createFireballMesh());
for (let i = 0; i < 50; i++) dustPool.push(createDustMesh());

export function getSmoke() {
  if (smokePool.length > 0) {
    const m = smokePool.pop(); m.visible = true; m.material.opacity = 0.5; m.scale.set(1, 1, 1); incPart(); return m;
  }
  incPart();
  return createSmokeMesh();
}
export function retSmoke(m) {
  m.visible = false; if (game.scene) game.scene.remove(m); decPart();
  if (smokePool.length < 100) smokePool.push(m); else { m.geometry.dispose(); m.material.dispose(); }
}

export function getTracer() {
  if (tracerPool.length > 0) { const m = tracerPool.pop(); m.visible = true; incPart(); return m; }
  incPart();
  return createTracerMesh();
}
export function retTracer(m) {
  m.visible = false; if (game.scene) game.scene.remove(m); decPart();
  if (tracerPool.length < 200) tracerPool.push(m); else { m.geometry.dispose(); m.material.dispose(); }
}

export function getDebris() {
  if (debrisPool.length > 0) { const m = debrisPool.pop(); m.visible = true; m.material.opacity = 1; incPart(); return m; }
  incPart();
  return createDebrisMesh();
}
export function retDebris(m) {
  m.visible = false; if (game.scene) game.scene.remove(m); decPart();
  if (debrisPool.length < 200) debrisPool.push(m); else { m.geometry.dispose(); m.material.dispose(); }
}

export function getFireball() {
  if (fireballPool.length > 0) { const m = fireballPool.pop(); m.visible = true; m.material.opacity = 1; m.scale.set(1,1,1); incPart(); return m; }
  incPart();
  return createFireballMesh();
}
export function retFireball(m) {
  m.visible = false; if (game.scene) game.scene.remove(m); decPart();
  if (fireballPool.length < 100) fireballPool.push(m); else { m.geometry.dispose(); m.material.dispose(); }
}

export function getDust() {
  if (dustPool.length > 0) { const m = dustPool.pop(); m.visible = true; m.material.opacity = 0.4; m.scale.set(1,1,1); incPart(); return m; }
  incPart();
  return createDustMesh();
}
export function retDust(m) {
  m.visible = false; if (game.scene) game.scene.remove(m); decPart();
  if (dustPool.length < 50) dustPool.push(m); else { m.material.dispose(); }
}
