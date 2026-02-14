import * as THREE from 'three';
import { ac, game, flybyP, chaseS } from './state.js';
import { groundElevRaycast } from './terrain.js';

export function resetFlyby() {
  const fw = new THREE.Vector3(0, 0, -1).applyQuaternion(ac.quat);
  flybyP.copy(ac.pos).add(fw.multiplyScalar(500)).add(new THREE.Vector3(200, 50, 0));
}

export function updateCam(dt) {
  dt = dt || 0.016;
  const p = ac.pos, q = ac.quat;
  const fw = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const rt = new THREE.Vector3(1, 0, 0).applyQuaternion(q);

  if (game.camMode === 0) {
    const behindVec = fw.clone().multiplyScalar(-20);
    const aboveVec = up.clone().multiplyScalar(4);
    const camOffset = behindVec.add(aboveVec);
    const tgt = p.clone().add(camOffset);
    const lerpF = Math.min(5.0 * dt, 1.0);
    chaseS.lerp(tgt, lerpF);
    const cGnd = groundElevRaycast(chaseS);
    if (chaseS.y < cGnd + 5) chaseS.y = cGnd + 5;
    game.cam.position.copy(chaseS);
    const camUp = new THREE.Vector3(0, 1, 0).lerp(up, 0.2).normalize();
    game.cam.up.copy(camUp);
    const lookPt = p.clone().add(fw.clone().multiplyScalar(30)).add(new THREE.Vector3(0, 1, 0));
    game.cam.lookAt(lookPt);
    if (ac.mdl) ac.mdl.visible = true;
  } else if (game.camMode === 1) {
    game.cam.position.copy(p).add(new THREE.Vector3(0, 0.5, -4).applyQuaternion(q));
    if (game.freeLk) {
      const ld = fw.clone().add(rt.clone().multiplyScalar(Math.sin(game.flYaw))).add(up.clone().multiplyScalar(Math.sin(game.flPitch)));
      game.cam.lookAt(game.cam.position.clone().add(ld));
    } else game.cam.lookAt(game.cam.position.clone().add(fw));
    game.cam.up.copy(up);
    if (ac.mdl) ac.mdl.visible = false;
  } else if (game.camMode === 2) {
    game.cam.position.copy(flybyP); game.cam.lookAt(p);
    if (ac.mdl) ac.mdl.visible = true;
    if (game.cam.position.distanceTo(p) > 2000) resetFlyby();
  } else if (game.camMode === 3 && game.bombCamTarget) {
    // Bomb cam — follows bomb looking down
    const bomb = game.bombCamTarget;
    if (bomb.mesh) {
      game.cam.position.copy(bomb.mesh.position).add(new THREE.Vector3(0, 5, 0));
      game.cam.lookAt(bomb.mesh.position.x, 0, bomb.mesh.position.z);
      game.cam.up.set(0, 0, -1);
    }
    if (ac.mdl) ac.mdl.visible = true;
  }
}
