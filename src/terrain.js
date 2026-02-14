import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer';
import {
  GoogleCloudAuthPlugin,
  TileCompressionPlugin,
  GLTFExtensionsPlugin,
  ReorientationPlugin,
  TilesFadePlugin
} from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GOOGLE_API_KEY, DEG } from './constants.js';
import { setTileGroup } from './coordinates.js';

let tilesRenderer = null;
const _raycaster = new THREE.Raycaster();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3(0, -1, 0);

export function initTerrain(scene, camera, renderer, lat, lng) {
  tilesRenderer = new TilesRenderer();
  tilesRenderer.registerPlugin(new GoogleCloudAuthPlugin({
    apiToken: GOOGLE_API_KEY,
    autoRefreshToken: true
  }));
  tilesRenderer.registerPlugin(new TileCompressionPlugin());
  tilesRenderer.registerPlugin(new TilesFadePlugin());
  tilesRenderer.registerPlugin(new GLTFExtensionsPlugin({
    dracoLoader: new DRACOLoader().setDecoderPath(
      'https://unpkg.com/three@0.172.0/examples/jsm/libs/draco/gltf/'
    )
  }));
  tilesRenderer.registerPlugin(new ReorientationPlugin({
    lat: lat * DEG,
    lon: lng * DEG
  }));

  scene.add(tilesRenderer.group);
  setTileGroup(tilesRenderer.group);

  tilesRenderer.setCamera(camera);
  tilesRenderer.setResolutionFromRenderer(camera, renderer);
}

export function updateTerrain(camera, renderer) {
  if (!tilesRenderer) return;
  tilesRenderer.setCamera(camera);
  tilesRenderer.setResolutionFromRenderer(camera, renderer);
  camera.updateMatrixWorld();
  tilesRenderer.update();
}

export function groundElevRaycast(pos) {
  if (!tilesRenderer) return 0;
  _rayOrigin.set(pos.x, pos.y + 5000, pos.z);
  _raycaster.set(_rayOrigin, _rayDir);
  _raycaster.far = 50000;
  _raycaster.firstHitOnly = true;
  const hits = _raycaster.intersectObject(tilesRenderer.group, true);
  if (hits.length > 0) return hits[0].point.y;
  return 0;
}

export function disposeTerrain() {
  if (tilesRenderer) {
    tilesRenderer.dispose();
    tilesRenderer = null;
  }
  setTileGroup(null);
}

export function projectileRaycast(origin, direction, maxDist) {
  if (!tilesRenderer) return null;
  _raycaster.set(origin, direction);
  _raycaster.far = maxDist;
  _raycaster.firstHitOnly = true;
  const hits = _raycaster.intersectObject(tilesRenderer.group, true);
  if (hits.length > 0) return hits[0];
  return null;
}

export function getTilesRenderer() {
  return tilesRenderer;
}
