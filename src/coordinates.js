import * as THREE from 'three';
import { WGS84_ELLIPSOID } from '3d-tiles-renderer';
import { RAD, DEG } from './constants.js';

let tileGroup = null;
const _invMatrix = new THREE.Matrix4();
const _vec = new THREE.Vector3();
const _result = {};

export function setTileGroup(group) {
  tileGroup = group;
}

export function sceneToLatLngAlt(scenePos) {
  if (!tileGroup) return { lat: 0, lng: 0, alt: 0 };
  _invMatrix.copy(tileGroup.matrixWorld).invert();
  _vec.copy(scenePos).applyMatrix4(_invMatrix);
  WGS84_ELLIPSOID.getPositionToCartographic(_vec, _result);
  return { lat: _result.lat * RAD, lng: _result.lon * RAD, alt: _result.height };
}

export function latLngAltToScene(lat, lng, alt) {
  if (!tileGroup) return new THREE.Vector3(0, alt, 0);
  const ecef = new THREE.Vector3();
  WGS84_ELLIPSOID.getCartographicToPosition(lat * DEG, lng * DEG, alt, ecef);
  return ecef.applyMatrix4(tileGroup.matrixWorld);
}
