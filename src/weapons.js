import * as THREE from 'three';
import { ac, game, projs, expls, smokes, keys,
  getSmoke, retSmoke, getTracer, retTracer, getDebris, retDebris,
  getFireball, retFireball, getDust, retDust,
  canSpawn, scorchMarks, MAX_SCORCHES } from './state.js';
import { G, DEG, clamp } from './constants.js';
import { groundElevRaycast, projectileRaycast } from './terrain.js';
import { playFx, createBombWhistle, stopBombWhistle, updateBombWhistle } from './audio.js';

// Frame counter for tracer spacing
let gunFrameCount = 0;

// Muzzle flash light tracking
const muzzleLights = [];

export function fireWep() {
  const fw = new THREE.Vector3(0, 0, -1).applyQuaternion(ac.quat);

  if (ac.wep === 0) {
    // M61A1 Vulcan 20mm cannon
    if (ac.gunN <= 0) { console.log('[GUN] Out of ammo'); return; }
    ac.gunN = Math.max(0, ac.gunN - 5); // consume 5 rounds per tracer (simulates 100rps)
    gunFrameCount++;

    const sp = 0.008;
    const dir = fw.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * sp,
      (Math.random() - 0.5) * sp,
      (Math.random() - 0.5) * sp
    )).normalize();

    const gunPos = ac.pos.clone().add(fw.clone().multiplyScalar(9));

    // Create visible tracer every shot
    if (canSpawn()) {
      const tr = getTracer();
      tr.position.copy(gunPos);
      tr.visible = true;
      // Orient tracer along velocity direction
      const lookTarget = gunPos.clone().add(dir);
      tr.lookAt(lookTarget);
      game.scene.add(tr);
      projs.push({ type: 'bul', mesh: tr, vel: dir.clone().multiplyScalar(1050 + ac.spd), life: 2, age: 0 });

      // Muzzle flash
      createMuzzleFlash(gunPos);
      console.log('[GUN] Fired tracer at', gunPos.x.toFixed(0), gunPos.y.toFixed(0), gunPos.z.toFixed(0), 'ammo:', ac.gunN);
    }
    // Gun sound is now sustained in audio.js updateAudio, no per-bullet playFx

  } else if (ac.wep === 1) {
    // AIM-9 Sidewinder
    if (ac.misN <= 0) return;
    ac.misN--;
    const mi = 2 - ac.misN - 1;
    if (ac.wm.mis[mi]) ac.wm.mis[mi].visible = false;

    // Launch flash at rail
    const launchPos = ac.pos.clone();
    createLaunchFlash(launchPos);

    const mg = new THREE.Group();
    const mb = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6),
      new THREE.MeshPhongMaterial({ color: 0xcccccc })
    );
    mb.rotation.x = Math.PI / 2;
    mg.add(mb);

    // Drop 2m below aircraft initially
    const dropOffset = new THREE.Vector3(0, -2, 0);
    mg.position.copy(ac.pos).add(dropOffset);
    mg.quaternion.copy(ac.quat);
    game.scene.add(mg);

    projs.push({
      type: 'mis', mesh: mg,
      vel: fw.clone().multiplyScalar(ac.spd + 50), // slower initial, motor ramps up
      life: 15, age: 0, sTmr: 0,
      motorBurnout: false, motorTime: 0,
      accel: 150 // m/s²
    });
    playFx('mis');

  } else {
    // MK-82 500lb Bomb
    if (ac.bomN <= 0) return;
    ac.bomN--;
    const bi = 4 - ac.bomN - 1;
    if (ac.wm.bom[bi]) ac.wm.bom[bi].visible = false;

    const bg = new THREE.Group();
    const bb = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.1, 1.2, 8),
      new THREE.MeshPhongMaterial({ color: 0x556b2f })
    );
    bb.rotation.x = Math.PI / 2;
    bg.add(bb);
    bg.position.copy(ac.pos);
    bg.quaternion.copy(ac.quat);
    game.scene.add(bg);

    const proj = {
      type: 'bom', mesh: bg, vel: ac.vel.clone(), life: 60, age: 0,
      whistleOsc: null, whistleGain: null
    };

    // Create bomb whistle sound
    createBombWhistle(proj);

    // Activate bomb cam if Digit3 is held
    if (keys['Digit3']) {
      game.bombCam = true;
      game.bombCamTarget = proj;
      game.camMode = 3;
      game.bombCamReturnTimer = 0;
    }

    projs.push(proj);
    playFx('mis');
  }
}

function createMuzzleFlash(pos) {
  // Flickering PointLight
  const lt = new THREE.PointLight(0xffcc44, Math.random() * 4, 20);
  lt.position.copy(pos);
  game.scene.add(lt);
  muzzleLights.push({ lt, age: 0, dur: 0.05 });
}

function createLaunchFlash(pos) {
  if (!canSpawn()) return;
  const dust = getDust();
  dust.position.copy(pos);
  dust.scale.set(3, 3, 3);
  dust.material.opacity = 0.8;
  dust.material.color.setHex(0xffffcc);
  game.scene.add(dust);
  smokes.push({ mesh: dust, age: 0, type: 'flash', dur: 0.3, isDust: true });
}

export function updateProjs(dt) {
  ac.fireTmr -= dt;
  if (ac.firing && ac.wep === 0 && ac.fireTmr <= 0) { fireWep(); ac.fireTmr = 1 / 20; } // 20 visible tracers/sec
  if (ac.firing && ac.wep !== 0) { fireWep(); ac.firing = false; }

  // Update muzzle flash lights
  for (let i = muzzleLights.length - 1; i >= 0; i--) {
    const ml = muzzleLights[i];
    ml.age += dt;
    if (ml.age > ml.dur) {
      game.scene.remove(ml.lt);
      ml.lt.dispose();
      muzzleLights.splice(i, 1);
    }
  }

  // Bomb cam return timer
  if (game.bombCam && game.bombCamReturnTimer > 0) {
    game.bombCamReturnTimer -= dt;
    if (game.bombCamReturnTimer <= 0) {
      game.bombCam = false;
      game.bombCamTarget = null;
      game.camMode = 0;
    }
  }

  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i];
    p.age += dt;

    if (p.type === 'bul') {
      // Gravity on bullets
      p.vel.y -= G * dt;
    }

    if (p.type === 'bom') {
      // Pure gravity, no motor
      p.vel.y -= G * dt;
      // Tumble rotation (visual spin)
      if (p.mesh.children[0]) p.mesh.children[0].rotateX(30 * DEG * dt);
      // Update bomb whistle sound
      updateBombWhistle(p);
    }

    if (p.type === 'mis') {
      p.motorTime = (p.motorTime || 0) + dt;
      // Always apply gravity to missiles (so they arc downward)
      p.vel.y -= G * dt;
      if (p.motorTime < 8 && !p.motorBurnout) {
        // Motor active: accelerate along forward direction
        const f = new THREE.Vector3(0, 0, -1).applyQuaternion(p.mesh.quaternion);
        const accelRate = p.motorTime < 2 ? p.accel : 0; // 150 m/s² for first 2s then constant
        if (accelRate > 0) p.vel.add(f.multiplyScalar(accelRate * dt));
        if (p.vel.length() > 850) p.vel.normalize().multiplyScalar(850);

        // Smoke trail
        p.sTmr -= dt;
        if (p.sTmr <= 0 && canSpawn()) {
          mkSmoke(p.mesh.position.clone());
          p.sTmr = 0.05;
        }
      } else {
        // Motor burnout
        p.motorBurnout = true;
      }
    }

    // Save old position for forward raycast
    const oldPos = p.mesh.position.clone();
    p.mesh.position.add(p.vel.clone().multiplyScalar(dt));

    // Orient missiles and bombs along velocity
    if (p.type !== 'bul') {
      const d = p.vel.clone().normalize();
      p.mesh.lookAt(p.mesh.position.clone().add(d));
    }

    // === COLLISION DETECTION ===
    let hit = false;
    let impactPos = null;

    if (p.type === 'bul') {
      // Bullets: use aircraft cached ground alt (fast, no per-bullet raycast)
      // Also check sea level fallback
      if (p.mesh.position.y <= ac.gAlt + 2 || p.mesh.position.y < 0) {
        hit = true;
        impactPos = p.mesh.position.clone();
        impactPos.y = Math.max(ac.gAlt + 0.5, 0.5);
      }
    } else {
      // Missiles and bombs: forward velocity raycast + downward raycast + fallback
      const moveDir = p.vel.clone().normalize();
      const moveDist = p.vel.length() * dt;

      // Forward raycast along velocity (catches terrain hits)
      const fwdHit = projectileRaycast(oldPos, moveDir, moveDist + 10);
      if (fwdHit) {
        hit = true;
        impactPos = fwdHit.point.clone();
      }

      // Downward raycast (standard ground check)
      if (!hit) {
        const gy = groundElevRaycast(p.mesh.position);
        if (p.mesh.position.y <= gy + 2) {
          hit = true;
          impactPos = p.mesh.position.clone();
          impactPos.y = gy + 0.5;
        }
      }

      // Sea-level fallback
      if (!hit && p.mesh.position.y < 0) {
        hit = true;
        impactPos = p.mesh.position.clone();
        impactPos.y = 0.5;
      }
    }

    if (hit || p.age > p.life) {
      if (hit && impactPos) {
        if (p.type === 'bom') {
          createBombExplosion(impactPos);
          stopBombWhistle(p);
          if (game.bombCam && game.bombCamTarget === p) {
            game.bombCamReturnTimer = 1.0;
          }
        } else if (p.type === 'mis') {
          createMissileExplosion(impactPos);
        } else {
          createBulletImpact(impactPos);
        }
      } else if (!hit) {
        // Timed out — still explode missiles and bombs at current position
        if (p.type === 'bom') {
          createBombExplosion(p.mesh.position.clone());
          stopBombWhistle(p);
          if (game.bombCam && game.bombCamTarget === p) {
            game.bombCamReturnTimer = 1.0;
          }
        } else if (p.type === 'mis') {
          createMissileExplosion(p.mesh.position.clone());
        }
        if (p.type === 'bom') stopBombWhistle(p);
      }

      if (p.type === 'bul') {
        retTracer(p.mesh);
      } else {
        game.scene.remove(p.mesh);
        p.mesh.traverse(c => {
          if (c.geometry) c.geometry.dispose();
          if (c.material) c.material.dispose();
        });
      }
      projs.splice(i, 1);
    }
  }

  // Update smoke particles
  for (let i = smokes.length - 1; i >= 0; i--) {
    const s = smokes[i];
    s.age += dt;

    if (s.type === 'flash') {
      // Launch flash — fade quickly
      s.mesh.material.opacity = Math.max(0, 0.8 * (1 - s.age / s.dur));
      s.mesh.scale.multiplyScalar(1 + dt * 8);
      if (s.age > s.dur) {
        if (s.isDust) retDust(s.mesh); else retSmoke(s.mesh);
        smokes.splice(i, 1);
      }
    } else if (s.type === 'dustPuff') {
      // Bullet dust puff — scale up, fade out
      const t = s.age / s.dur;
      const scale = 0.5 + t * 2.5;
      s.mesh.scale.set(scale, scale, scale);
      s.mesh.material.opacity = Math.max(0, 0.3 * (1 - t));
      if (s.age > s.dur) { retDust(s.mesh); smokes.splice(i, 1); }
    } else if (s.type === 'bigDust') {
      // Large explosion dust cloud
      const t = s.age / s.dur;
      const scale = s.startScale + (s.endScale - s.startScale) * t;
      s.mesh.scale.set(scale, scale, scale);
      s.mesh.material.opacity = Math.max(0, s.startOpacity * (1 - t * t));
      if (s.vel) s.mesh.position.add(s.vel.clone().multiplyScalar(dt));
      if (s.age > s.dur) { retDust(s.mesh); smokes.splice(i, 1); }
    } else if (s.type === 'smokeColumn') {
      // Rising dark smoke
      const t = s.age / s.dur;
      s.mesh.position.y += 5 * dt;
      const scale = s.startScale + (s.endScale - s.startScale) * t;
      s.mesh.scale.set(scale, scale, scale);
      s.mesh.material.opacity = Math.max(0, 0.5 * (1 - t));
      if (s.age > s.dur) { retDust(s.mesh); smokes.splice(i, 1); }
    } else if (s.type === 'dirtBurst') {
      // Dirt particles with gravity
      s.vel.y -= G * dt;
      s.mesh.position.add(s.vel.clone().multiplyScalar(dt));
      const t = s.age / s.dur;
      s.mesh.material.opacity = Math.max(0, 1 - t);
      if (s.age > s.dur) { retDebris(s.mesh); smokes.splice(i, 1); }
    } else {
      // Default missile smoke puffs
      s.mesh.material.opacity = Math.max(0, 0.4 - s.age * 0.13);
      const scale = 0.3 + s.age * 1.35;
      s.mesh.scale.set(scale, scale, scale);
      if (s.age > 3) { retSmoke(s.mesh); smokes.splice(i, 1); }
    }
  }

  // Update scorch marks
  for (let i = scorchMarks.length - 1; i >= 0; i--) {
    const sc = scorchMarks[i];
    sc.age += dt;
    const t = sc.age / sc.dur;
    if (t > 0.8) sc.mesh.material.opacity = Math.max(0, (1 - t) * 5);
    if (sc.age > sc.dur) {
      game.scene.remove(sc.mesh);
      sc.mesh.geometry.dispose();
      sc.mesh.material.dispose();
      scorchMarks.splice(i, 1);
    }
  }

  // Update explosions
  for (let i = expls.length - 1; i >= 0; i--) {
    const ex = expls[i];
    ex.age += dt;
    const t = ex.age / ex.dur;

    // Core flash
    if (ex.core) {
      const coreScale = ex.coreMaxScale * Math.min(t * 10, 1);
      ex.core.scale.setScalar(coreScale);
      ex.core.material.opacity = Math.max(0, 1 - t * 4);
    }

    // Fireball particles
    if (ex.fbParts) {
      for (const fb of ex.fbParts) {
        fb.vel.y -= G * dt * 0.3;
        fb.mesh.position.add(fb.vel.clone().multiplyScalar(dt));
        const ft = fb.age / fb.dur;
        fb.age += dt;
        const s = fb.startScale + (fb.endScale - fb.startScale) * ft;
        fb.mesh.scale.setScalar(Math.max(0.1, s));
        fb.mesh.material.opacity = Math.max(0, 1 - ft);
        if (fb.age > fb.dur) {
          retFireball(fb.mesh);
          fb.done = true;
        }
      }
      ex.fbParts = ex.fbParts.filter(f => !f.done);
    }

    // Shockwave ring
    if (ex.sw) {
      ex.sw.scale.setScalar(ex.swMaxScale * t);
      ex.sw.material.opacity = Math.max(0, 0.7 - t);
    }

    // Point light
    if (ex.lt) ex.lt.intensity = Math.max(0, 8 * Math.pow(1 - t, 3));

    // Debris
    if (ex.deb) {
      for (const d of ex.deb) {
        d.v.y -= G * dt * 0.5;
        d.m.position.add(d.v.clone().multiplyScalar(dt));
        d.m.material.opacity = Math.max(0, 1 - t * 1.2);
      }
    }

    // Camera shake
    if (game.cam) {
      const dist = game.cam.position.distanceTo(ex.p);
      const shakeMul = ex.shakeMul || 1;
      const shakeDur = ex.shakeDur || 1.5;
      if (ex.age < shakeDur) {
        const shakeT = ex.age / shakeDur;
        const shake = Math.max(0, shakeMul * (1 / Math.max(dist / 500, 1)) * (1 - shakeT));
        if (shake > 0.001) {
          game.cam.position.x += (Math.random() - 0.5) * shake;
          game.cam.position.y += (Math.random() - 0.5) * shake;
          game.cam.position.z += (Math.random() - 0.5) * shake * 0.5;
        }
      }
    }

    if (ex.age > ex.dur) {
      if (ex.core) { game.scene.remove(ex.core); ex.core.geometry.dispose(); ex.core.material.dispose(); }
      if (ex.sw) { game.scene.remove(ex.sw); ex.sw.geometry.dispose(); ex.sw.material.dispose(); }
      if (ex.lt) { game.scene.remove(ex.lt); ex.lt.dispose(); }
      if (ex.deb) for (const d of ex.deb) retDebris(d.m);
      // fbParts should all be done already but clean up any stragglers
      if (ex.fbParts) for (const fb of ex.fbParts) retFireball(fb.mesh);
      expls.splice(i, 1);
    }
  }
}

export function mkSmoke(pos) {
  if (!canSpawn()) return;
  const m = getSmoke();
  m.position.copy(pos);
  m.scale.set(0.3, 0.3, 0.3);
  game.scene.add(m);
  smokes.push({ mesh: m, age: 0 });
}

// ====== BULLET IMPACT ======
function createBulletImpact(pos) {
  // Dirt burst: 5-8 small brown particles
  const dirtCount = 5 + Math.floor(Math.random() * 4);
  for (let j = 0; j < dirtCount; j++) {
    if (!canSpawn()) break;
    const dm = getDebris();
    dm.material.color.setHex([0x8B7355, 0x6B5B3A, 0x9C8A5E, 0x5C4A2E][Math.floor(Math.random() * 4)]);
    dm.material.blending = THREE.NormalBlending;
    dm.position.copy(pos);
    const s = 0.1 + Math.random() * 0.15;
    dm.scale.set(s, s, s);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 8,
      5 + Math.random() * 10,
      (Math.random() - 0.5) * 8
    );
    game.scene.add(dm);
    smokes.push({ mesh: dm, age: 0, vel, type: 'dirtBurst', dur: 0.8 });
  }

  // Dust puff
  if (canSpawn()) {
    const dust = getDust();
    dust.position.copy(pos);
    dust.scale.set(0.5, 0.5, 0.5);
    dust.material.opacity = 0.3;
    dust.material.color.setHex(0xddddcc);
    game.scene.add(dust);
    smokes.push({ mesh: dust, age: 0, type: 'dustPuff', dur: 1.0 });
  }

  // Small flash light
  const lt = new THREE.PointLight(0xffcc44, 2, 15);
  lt.position.copy(pos);
  game.scene.add(lt);
  muzzleLights.push({ lt, age: 0, dur: 0.1 });

  // Scorch mark
  addScorchMark(pos, 0.3, 5);

  playFx('exp', 'small');
}

// ====== MISSILE EXPLOSION ======
// Also exported as createExplosion for crash usage by physics.js
export function createExplosion(pos) { createMissileExplosion(pos); }

function createMissileExplosion(pos) {
  // Core flash sphere
  const coreG = new THREE.SphereGeometry(1, 12, 8);
  const coreM = new THREE.MeshBasicMaterial({
    color: 0xffffcc, transparent: true, opacity: 1,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  const core = new THREE.Mesh(coreG, coreM);
  core.position.copy(pos);
  game.scene.add(core);

  // Fireball particles: 40-60
  const fbParts = [];
  const fbCount = 40 + Math.floor(Math.random() * 21);
  const colors = [0xff6600, 0xff4400, 0xff2200, 0xffaa00, 0xffcc33];
  for (let j = 0; j < fbCount; j++) {
    if (!canSpawn()) break;
    const fb = getFireball();
    fb.material.color.setHex(colors[Math.floor(Math.random() * colors.length)]);
    fb.position.copy(pos);
    const startScale = 0.5;
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 60,
      Math.random() * 50,
      (Math.random() - 0.5) * 60
    );
    fb.scale.setScalar(startScale);
    game.scene.add(fb);
    fbParts.push({ mesh: fb, vel, age: 0, dur: 1.5, startScale: 0.5, endScale: 2 });
  }

  // Shockwave ring
  const swG = new THREE.RingGeometry(0.8, 1, 32);
  const swM = new THREE.MeshBasicMaterial({
    color: 0xffaa44, transparent: true, opacity: 0.7,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const sw = new THREE.Mesh(swG, swM);
  sw.position.copy(pos);
  sw.rotation.x = -Math.PI / 2;
  game.scene.add(sw);

  // Point light
  const lt = new THREE.PointLight(0xff8833, 8, 200);
  lt.position.copy(pos);
  game.scene.add(lt);

  // Debris: 10-15 pieces
  const deb = [];
  const debCount = 10 + Math.floor(Math.random() * 6);
  for (let j = 0; j < debCount; j++) {
    if (!canSpawn()) break;
    const dm = getDebris();
    dm.material.color.setHex(colors[Math.floor(Math.random() * colors.length)]);
    dm.material.blending = THREE.AdditiveBlending;
    dm.position.copy(pos);
    const pSz = 0.3 + Math.random() * 1;
    dm.scale.set(pSz, pSz, pSz);
    const dv = new THREE.Vector3(
      (Math.random() - 0.5) * 80,
      Math.random() * 60,
      (Math.random() - 0.5) * 80
    );
    game.scene.add(dm);
    deb.push({ m: dm, v: dv });
  }

  // Dust cloud: 4-6 large tan sprites
  const dustCount = 4 + Math.floor(Math.random() * 3);
  for (let j = 0; j < dustCount; j++) {
    if (!canSpawn()) break;
    const dust = getDust();
    dust.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 5, (Math.random() - 0.5) * 10));
    dust.material.color.setHex(0xBBA577);
    dust.material.opacity = 0.4;
    dust.scale.set(2, 2, 2);
    game.scene.add(dust);
    smokes.push({
      mesh: dust, age: 0, type: 'bigDust', dur: 4,
      startScale: 2, endScale: 20, startOpacity: 0.4,
      vel: new THREE.Vector3((Math.random() - 0.5) * 3, 1, (Math.random() - 0.5) * 3)
    });
  }

  // Smoke column: 3-4 dark sprites rising
  const smokeCount = 3 + Math.floor(Math.random() * 2);
  for (let j = 0; j < smokeCount; j++) {
    if (!canSpawn()) break;
    const dust = getDust();
    dust.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 5, 2, (Math.random() - 0.5) * 5));
    dust.material.color.setHex(0x333333);
    dust.material.opacity = 0.5;
    dust.material.blending = THREE.NormalBlending;
    dust.scale.set(2, 2, 2);
    game.scene.add(dust);
    smokes.push({
      mesh: dust, age: 0, type: 'smokeColumn', dur: 6,
      startScale: 2, endScale: 15
    });
  }

  // Crater
  addScorchMark(pos, 3, 15);

  expls.push({
    p: pos, core, fbParts, sw, lt, deb,
    coreMaxScale: 5, swMaxScale: 40,
    dur: 3.0, age: 0,
    shakeMul: 5, shakeDur: 1.5
  });

  playFx('exp');
}

// ====== BOMB EXPLOSION (MASSIVE) ======
function createBombExplosion(pos) {
  // Core flash — intense white, scale 0→10m
  const coreG = new THREE.SphereGeometry(1, 12, 8);
  const coreM = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 1,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  const core = new THREE.Mesh(coreG, coreM);
  core.position.copy(pos);
  game.scene.add(core);

  // Fireball: 80-100 particles
  const fbParts = [];
  const fbCount = 80 + Math.floor(Math.random() * 21);
  const colors = [0xff6600, 0xff4400, 0xff2200, 0xffaa00, 0xffcc33, 0xff8800];
  for (let j = 0; j < fbCount; j++) {
    if (!canSpawn()) break;
    const fb = getFireball();
    fb.material.color.setHex(colors[Math.floor(Math.random() * colors.length)]);
    fb.position.copy(pos);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 100,
      Math.random() * 80 + 10,
      (Math.random() - 0.5) * 100
    );
    fb.scale.setScalar(1);
    game.scene.add(fb);
    fbParts.push({ mesh: fb, vel, age: 0, dur: 1.5, startScale: 1, endScale: 4 });
  }

  // Shockwave ring 0→60m
  const swG = new THREE.RingGeometry(0.8, 1, 32);
  const swM = new THREE.MeshBasicMaterial({
    color: 0xffaa44, transparent: true, opacity: 0.7,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const sw = new THREE.Mesh(swG, swM);
  sw.position.copy(pos);
  sw.rotation.x = -Math.PI / 2;
  game.scene.add(sw);

  // Intense point light
  const lt = new THREE.PointLight(0xff8833, 15, 500);
  lt.position.copy(pos);
  game.scene.add(lt);

  // Dirt column: 15-20 brown/dark particles ejected mostly upward
  const dirtCount = 15 + Math.floor(Math.random() * 6);
  for (let j = 0; j < dirtCount; j++) {
    if (!canSpawn()) break;
    const dm = getDebris();
    dm.material.color.setHex([0x5C4A2E, 0x3A3020, 0x4A3A1E, 0x6B5B3A][Math.floor(Math.random() * 4)]);
    dm.material.blending = THREE.NormalBlending;
    dm.position.copy(pos);
    const s = 0.3 + Math.random() * 0.8;
    dm.scale.set(s, s, s);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 20,
      30 + Math.random() * 50,
      (Math.random() - 0.5) * 20
    );
    game.scene.add(dm);
    smokes.push({ mesh: dm, age: 0, vel, type: 'dirtBurst', dur: 3.0 });
  }

  // Debris: 20-30 pieces
  const deb = [];
  const debCount = 20 + Math.floor(Math.random() * 11);
  for (let j = 0; j < debCount; j++) {
    if (!canSpawn()) break;
    const dm = getDebris();
    dm.material.color.setHex(colors[Math.floor(Math.random() * colors.length)]);
    dm.material.blending = THREE.AdditiveBlending;
    dm.position.copy(pos);
    const pSz = 0.3 + Math.random() * 1.5;
    dm.scale.set(pSz, pSz, pSz);
    const dv = new THREE.Vector3(
      (Math.random() - 0.5) * 120,
      Math.random() * 80,
      (Math.random() - 0.5) * 120
    );
    game.scene.add(dm);
    deb.push({ m: dm, v: dv });
  }

  // Dust cloud: 8-10 large tan sprites
  const dustCount = 8 + Math.floor(Math.random() * 3);
  for (let j = 0; j < dustCount; j++) {
    if (!canSpawn()) break;
    const dust = getDust();
    dust.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 15, Math.random() * 5, (Math.random() - 0.5) * 15));
    dust.material.color.setHex(0xBBA577);
    dust.material.opacity = 0.5;
    dust.scale.set(3, 3, 3);
    game.scene.add(dust);
    smokes.push({
      mesh: dust, age: 0, type: 'bigDust', dur: 8,
      startScale: 3, endScale: 50, startOpacity: 0.5,
      vel: new THREE.Vector3((Math.random() - 0.5) * 5, 2, (Math.random() - 0.5) * 5)
    });
  }

  // Smoke column: 10-15 dark rising sprites
  const smokeCount = 10 + Math.floor(Math.random() * 6);
  for (let j = 0; j < smokeCount; j++) {
    if (!canSpawn()) break;
    const dust = getDust();
    dust.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 8, 3 + Math.random() * 5, (Math.random() - 0.5) * 8));
    dust.material.color.setHex(0x222222);
    dust.material.opacity = 0.5;
    dust.material.blending = THREE.NormalBlending;
    dust.scale.set(3, 3, 3);
    game.scene.add(dust);
    smokes.push({
      mesh: dust, age: 0, type: 'smokeColumn', dur: 10 + Math.random() * 5,
      startScale: 3, endScale: 15
    });
  }

  // Crater (large, persists 30s)
  addScorchMark(pos, 6, 30);

  expls.push({
    p: pos, core, fbParts, sw, lt, deb,
    coreMaxScale: 10, swMaxScale: 60,
    dur: 4.0, age: 0,
    shakeMul: 15, shakeDur: 2.5
  });

  playFx('expLarge');
}

function addScorchMark(pos, radius, dur) {
  // Evict oldest if at limit
  while (scorchMarks.length >= MAX_SCORCHES) {
    const old = scorchMarks.shift();
    game.scene.remove(old.mesh);
    old.mesh.geometry.dispose();
    old.mesh.material.dispose();
  }

  const sg = new THREE.CircleGeometry(radius, 16);
  const sm = new THREE.MeshBasicMaterial({
    color: 0x111111, transparent: true, opacity: 0.6,
    depthWrite: false, side: THREE.DoubleSide
  });
  const scorch = new THREE.Mesh(sg, sm);
  scorch.position.copy(pos);
  scorch.position.y += 0.1;
  scorch.rotation.x = -Math.PI / 2;
  game.scene.add(scorch);
  scorchMarks.push({ mesh: scorch, age: 0, dur });
}
