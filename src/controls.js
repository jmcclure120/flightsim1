import { ac, game, keys, fns } from './state.js';
import { clamp, RAD } from './constants.js';
import { resetFlyby } from './camera.js';

export function initCtrl() {
  if (game.ctrlInit) return; game.ctrlInit = true;

  document.addEventListener('keydown', e => {
    keys[e.code] = true; keys[e.key] = true;
    if (e.code === 'Escape') {
      if (game.state === 'FLYING') {
        game.state = 'PAUSED';
        document.getElementById('pauseMenu').classList.add('active');
        if (game.audioCtx && game.audioCtx.state === 'running') game.audioCtx.suspend();
      } else if (game.state === 'PAUSED') {
        fns.resume();
      }
    }
    if (e.code.startsWith('Arrow')) e.preventDefault();
    if (game.state !== 'FLYING') return;
    if (e.code === 'Space') { ac.firing = true; e.preventDefault(); }
    if (e.code === 'Digit1') ac.wep = 0;
    if (e.code === 'Digit2') ac.wep = 1;
    if (e.code === 'Digit3') ac.wep = 2;
    if (e.code === 'KeyG') ac.gear = !ac.gear;
    if (e.code === 'KeyF') ac.flap = !ac.flap;
    if (e.code === 'KeyB') ac.brake = !ac.brake;
    if (e.code === 'KeyC') {
      game.camMode = (game.camMode + 1) % 3; // cycle 0-1-2, skip 3 (bomb cam is auto only)
      if (game.camMode === 2) resetFlyby();
      game.bombCam = false; game.bombCamTarget = null;
    }
    if (e.code === 'KeyV') game.freeLk = true;
    if (e.code === 'Equal' || e.code === 'NumpadAdd') ac.pitchTrim = clamp(ac.pitchTrim + 0.5, -10, 10);
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') ac.pitchTrim = clamp(ac.pitchTrim - 0.5, -10, 10);
    if (e.code === 'BracketLeft') ac.rollTrim = clamp(ac.rollTrim - 0.3, -5, 5);
    if (e.code === 'BracketRight') ac.rollTrim = clamp(ac.rollTrim + 0.3, -5, 5);
    if (e.code === 'Digit0') { ac.pitchTrim = 0; ac.rollTrim = 0; }
    if (e.code === 'KeyT') { ac.pitchTrim = clamp(ac.rollRate * RAD * 2, -10, 10); ac.rollTrim = clamp(ac.rollRate * RAD * 2, -5, 5); }
  });

  document.addEventListener('keyup', e => {
    keys[e.code] = false; keys[e.key] = false;
    if (e.code === 'Space') ac.firing = false;
    if (e.code === 'KeyV') { game.freeLk = false; game.flYaw = 0; game.flPitch = 0; }
  });

  document.addEventListener('mousemove', e => {
    if (game.freeLk && document.pointerLockElement) {
      game.flYaw -= e.movementX * 0.003;
      game.flPitch = clamp(game.flPitch - e.movementY * 0.003, -Math.PI / 2, Math.PI / 2);
    }
  });

  game.renderer.domElement.addEventListener('click', () => {
    if (game.state === 'FLYING') game.renderer.domElement.requestPointerLock();
  });

  window.addEventListener('gamepadconnected', () => { game.gpActive = true; });
}
