import * as THREE from 'three';
import { F16, DEG, RAD, G, KT2MS, clamp, lerp, airDensity, soundSpd, eulerQ } from './constants.js';
import { ac, game, keys } from './state.js';
import { sceneToLatLngAlt } from './coordinates.js';
import { groundElevRaycast } from './terrain.js';
import { createExplosion } from './weapons.js';

export function updatePhys(dt) {
  dt = Math.min(dt, 0.05);
  const p = ac.pos, q = ac.quat, v = ac.vel;
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  const rt = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);

  const spd = v.length(); ac.spd = spd;
  const vDir = spd > 1 ? v.clone().normalize() : fwd.clone();
  const aoa = spd > 1 ? Math.asin(clamp(-vDir.dot(up), -1, 1)) : 0;
  ac.aoa = aoa;
  const ss = spd > 1 ? Math.asin(clamp(vDir.dot(rt), -1, 1)) : 0;

  const rho = airDensity(p.y), sos = soundSpd(p.y);
  ac.mach = spd / sos;
  const qP = 0.5 * rho * spd * spd;

  let Cl = F16.Cla * aoa; if (ac.flap) Cl += F16.flapL;
  Cl = clamp(Cl, -F16.Clmax, F16.Clmax);
  if (Math.abs(aoa) > F16.stallA) Cl *= Math.max(0.3, 1 - (Math.abs(aoa) - F16.stallA) / (10 * DEG));

  let Cd = F16.Cd0 + F16.K * Cl * Cl;
  if (ac.gear) Cd += F16.gearD; if (ac.flap) Cd += F16.flapD; if (ac.brake) Cd += F16.brakeD;
  if (ac.mach > 0.85) Cd += 0.1 * Math.pow(ac.mach - 0.85, 2) * 100;

  const lMag = qP * F16.S * Cl;
  const lDir = spd > 5 ? rt.clone().cross(vDir).normalize() : up.clone();
  const lift = lDir.multiplyScalar(lMag);
  const drag = spd > 1 ? vDir.clone().multiplyScalar(-qP * F16.S * Cd) : new THREE.Vector3();

  let tMag = ac.thr <= 1 ? ac.thr * F16.Tmil : F16.Tmil + (ac.thr - 1) * (F16.Tab - F16.Tmil);
  tMag *= rho / 1.225 * 0.7 + 0.3;
  const thrust = fwd.clone().multiplyScalar(tMag);
  const grav = new THREE.Vector3(0, -F16.mass * G, 0);

  const total = new THREE.Vector3().add(lift).add(drag).add(thrust).add(grav);
  const acc = total.divideScalar(F16.mass);

  const ngF = new THREE.Vector3().add(lift).add(drag).add(thrust);
  ac.gF = ngF.dot(up) / (F16.mass * G);

  v.add(acc.clone().multiplyScalar(dt));
  if (v.length() > 420) v.normalize().multiplyScalar(420);
  p.add(v.clone().multiplyScalar(dt));

  // Update lat/lng from scene position
  const ll = sceneToLatLngAlt(p);
  ac.lat = ll.lat; ac.lng = ll.lng; ac.alt = p.y;

  // Ground collision
  ac.gAlt = groundElevRaycast(p);
  if (p.y < ac.gAlt + 2) {
    if (v.y < -5) {
      createExplosion(p.clone(), 50);
      p.y = ac.gAlt + 500; v.set(0, 0, -(200 * KT2MS)); q.identity();
      ac.rollRate = 0; ac.pitchRate = 0; ac.yawRate = 0; ac.pitchTrim = 0; ac.rollTrim = 0;
    } else {
      p.y = ac.gAlt + 2; if (v.y < 0) v.y = 0;
    }
  }
  if (p.y > 50000 * 0.3048) { p.y = 50000 * 0.3048; if (v.y > 0) v.y *= 0.9; }

  // === FLY-BY-WIRE RATE COMMAND SYSTEM ===
  let pi2 = 0, ri = 0, yi = 0;
  if (keys.ArrowUp) pi2 = -1; if (keys.ArrowDown) pi2 = 1;
  if (keys.ArrowLeft) ri = -1; if (keys.ArrowRight) ri = 1;
  if (keys.KeyQ || keys.q) yi = -1; if (keys.KeyE || keys.e) yi = 1;

  if (game.gpActive) {
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (gp) {
      const dz = 0.15;
      if (Math.abs(gp.axes[0]) > dz) ri += gp.axes[0];
      if (Math.abs(gp.axes[1]) > dz) pi2 += gp.axes[1];
      if (Math.abs(gp.axes[2]) > dz) yi += gp.axes[2];
      if (gp.buttons[7]) ac.thr = clamp(gp.buttons[7].value * 1.5, 0, 1.5);
      if (gp.buttons[0] && gp.buttons[0].pressed) ac.firing = true;
    }
  }

  const ctrlEff = clamp(spd / (300 * KT2MS), 0.2, 1.5);
  const trimPR = ac.pitchTrim * 0.5 * DEG;
  const trimRR = ac.rollTrim * 0.5 * DEG;
  const tgtPitch = pi2 !== 0 ? pi2 * 30 * DEG * ctrlEff : trimPR;
  const tgtRoll = ri !== 0 ? ri * 180 * DEG * ctrlEff : trimRR;
  const tgtYaw = yi * 20 * DEG * ctrlEff;

  const euler = eulerQ(q);
  const wlSpd = 15 * DEG;
  const wingsLevelRate = (ri === 0 && Math.abs(ac.rollTrim) < 0.1) ? clamp(-euler.roll * 1.5, -wlSpd, wlSpd) : 0;
  const finalTgtRoll = ri === 0 ? tgtRoll + wingsLevelRate : tgtRoll;
  const autoYaw = Math.sin(euler.roll) * 0.03 * spd / 200;

  ac.rollRate = lerp(ac.rollRate, finalTgtRoll, 5.0 * dt);
  ac.pitchRate = lerp(ac.pitchRate, tgtPitch, 3.0 * dt);
  ac.yawRate = lerp(ac.yawRate, tgtYaw + autoYaw, 2.0 * dt);
  ac.rollRate *= (1.0 - 2.0 * dt);
  ac.pitchRate *= (1.0 - 1.5 * dt);
  ac.yawRate *= (1.0 - 1.5 * dt);

  const aoaLimit = F16.stallA * 0.75;
  if (Math.abs(aoa) > aoaLimit) {
    const excess = (Math.abs(aoa) - aoaLimit) / (F16.stallA - aoaLimit);
    const pushback = -Math.sign(aoa) * excess * 15 * DEG;
    ac.pitchRate += pushback;
  }

  const localRight = new THREE.Vector3(1, 0, 0);
  const localUp = new THREE.Vector3(0, 1, 0);
  const localFwd = new THREE.Vector3(0, 0, -1);
  q.multiply(new THREE.Quaternion().setFromAxisAngle(localRight, ac.pitchRate * dt));
  q.multiply(new THREE.Quaternion().setFromAxisAngle(localFwd, ac.rollRate * dt));
  q.multiply(new THREE.Quaternion().setFromAxisAngle(localUp, -ac.yawRate * dt));
  q.normalize();

  ac.ailD = lerp(ac.ailD, ri * 20 * DEG, 5 * dt);
  ac.eleD = lerp(ac.eleD, pi2 * 25 * DEG, 5 * dt);
  ac.rudD = lerp(ac.rudD, yi * 25 * DEG, 5 * dt);

  if (keys.ShiftLeft || keys.ShiftRight || keys.Shift) ac.thr = clamp(ac.thr + dt * 0.5, 0, 1.5);
  if (keys.ControlLeft || keys.ControlRight || keys.Control) ac.thr = clamp(ac.thr - dt * 0.5, 0, 1.5);

  if (ac.mdl) {
    ac.mdl.position.copy(p); ac.mdl.quaternion.copy(q);
    if (ac.cs.ra) ac.cs.ra.rotation.x = ac.ailD;
    if (ac.cs.la) ac.cs.la.rotation.x = -ac.ailD;
    if (ac.cs.rs) ac.cs.rs.rotation.x = ac.eleD;
    if (ac.cs.ls) ac.cs.ls.rotation.x = ac.eleD;
    if (ac.cs.rud) ac.cs.rud.rotation.y = ac.rudD;
    if (ac.abMesh) {
      const abOn = ac.thr > 1;
      ac.abMesh.material.opacity = abOn ? 0.3 + Math.random() * 0.4 : 0;
      ac.abMesh.scale.setScalar(abOn ? 0.8 + Math.random() * 0.4 : 0.001);
    }
  }
}
