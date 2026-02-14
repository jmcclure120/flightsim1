import * as THREE from 'three';
import { DEG } from './constants.js';
import { game, fns } from './state.js';
import { updatePhys } from './physics.js';
import { updateProjs } from './weapons.js';
import { updateCam } from './camera.js';
import { updateMarkers } from './markers.js';
import { updateHUD } from './hud.js';
import { updateAudio } from './audio.js';
import { updateTerrain } from './terrain.js';
import { initStart } from './ui.js';

function initScene() {
  game.scene = new THREE.Scene();
  game.scene.fog = new THREE.FogExp2(0x8aacc4, 0.0000008);
  game.cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 1, 1000000);
  game.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  game.renderer.setSize(innerWidth, innerHeight);
  game.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  game.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  game.renderer.toneMappingExposure = 1.2;
  game.renderer.domElement.style.cssText = 'position:fixed;top:0;left:0;z-index:0;';
  document.body.appendChild(game.renderer.domElement);

  const sa = (90 - Math.abs(game.spLat)) * DEG * 0.5;
  game.sunLight = new THREE.DirectionalLight(0xfff4e0, 1.8);
  game.sunLight.position.set(Math.cos(sa) * 50000, Math.sin(sa) * 50000 + 20000, -30000);
  game.scene.add(game.sunLight);
  game.ambLight = new THREE.AmbientLight(0x6688aa, 0.6);
  game.scene.add(game.ambLight);

  window.onresize = () => {
    if (!game.cam || !game.renderer) return;
    game.cam.aspect = innerWidth / innerHeight;
    game.cam.updateProjectionMatrix();
    game.renderer.setSize(innerWidth, innerHeight);
  };
}

function gameLoop() {
  if (game.state === 'START') return;
  requestAnimationFrame(gameLoop);
  if (!game.clock) return;
  const dt = Math.min(game.clock.getDelta(), 0.1);
  if (game.state === 'FLYING') {
    updatePhys(dt);
    updateProjs(dt);
    updateCam(dt);
    updateMarkers(game.cam);
    updateHUD();
    updateAudio();
    updateTerrain(game.cam, game.renderer);
  }
  if (game.skyMesh && game.cam) game.skyMesh.position.copy(game.cam.position);
  if (game.renderer && game.scene && game.cam) game.renderer.render(game.scene, game.cam);
}

// Register functions for cross-module access
fns.initScene = initScene;
fns.gameLoop = gameLoop;

// Bootstrap
initStart();
