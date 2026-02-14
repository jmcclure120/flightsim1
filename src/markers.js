import * as THREE from 'three';
import { latLngAltToScene } from './coordinates.js';

const MARKERS = [
  { name: 'GOLDSTREAM VALLEY', lat: 64.913278, lng: -147.904806, color: 0x00ddff },
  { name: 'CICERO, IL', lat: 41.842556, lng: -87.753167, color: 0xff4422 },
];

const markerData = [];
const clock = new THREE.Clock();

function createLabelTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  // Semi-transparent dark background
  ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
  ctx.beginPath();
  ctx.roundRect(20, 20, 984, 472, 24);
  ctx.fill();
  // Colored border
  const hex = '#' + color.toString(16).padStart(6, '0');
  ctx.strokeStyle = hex;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(20, 20, 984, 472, 24);
  ctx.stroke();
  // Text
  ctx.fillStyle = 'white';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 512, 256);
  return new THREE.CanvasTexture(canvas);
}

export function createLocationMarkers(scene) {
  markerData.length = 0;

  for (const mk of MARKERS) {
    const base = latLngAltToScene(mk.lat, mk.lng, 0);
    const elevated = latLngAltToScene(mk.lat, mk.lng, 1);
    const localUp = elevated.clone().sub(base).normalize();

    // Quaternion to orient Y-axis along localUp
    const orientQ = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), localUp
    );

    // Flat rotation quaternion (for rings — rotate X 90 to lay flat)
    const flatQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0), Math.PI / 2
    );
    const ringOrientQ = orientQ.clone().multiply(flatQ);

    // === INNER BEAM — 2000m tall, radius 10 ===
    const beamGeo = new THREE.CylinderGeometry(10, 10, 2000, 12);
    const beamMat = new THREE.MeshBasicMaterial({
      color: mk.color, transparent: true, opacity: 0.7, depthWrite: false
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.copy(base).add(localUp.clone().multiplyScalar(1000));
    beam.quaternion.copy(orientQ);
    scene.add(beam);

    // === OUTER AURA BEAM — 2000m tall, radius 30, faint ===
    const auraGeo = new THREE.CylinderGeometry(30, 30, 2000, 12);
    const auraMat = new THREE.MeshBasicMaterial({
      color: mk.color, transparent: true, opacity: 0.15, depthWrite: false
    });
    const aura = new THREE.Mesh(auraGeo, auraMat);
    aura.position.copy(base).add(localUp.clone().multiplyScalar(1000));
    aura.quaternion.copy(orientQ);
    scene.add(aura);

    // === TOP POSITION (2000m above ground) ===
    const topPos = base.clone().add(localUp.clone().multiplyScalar(2000));

    // === POINT LIGHT at top ===
    const light = new THREE.PointLight(mk.color, 20, 20000);
    light.position.copy(topPos);
    scene.add(light);

    // === PULSING GLOW SPHERE at top — 50m radius ===
    const sphereGeo = new THREE.SphereGeometry(50, 16, 12);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: mk.color, transparent: true, opacity: 0.6, depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.copy(topPos);
    scene.add(sphere);

    // === BILLBOARD LABEL — 200m x 100m, positioned 200m above beam top ===
    const tex = createLabelTexture(mk.name, mk.color);
    const labelMat = new THREE.MeshBasicMaterial({
      map: tex, side: THREE.DoubleSide, transparent: true, depthWrite: false
    });
    const labelGeo = new THREE.PlaneGeometry(200, 100);
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.position.copy(base).add(localUp.clone().multiplyScalar(2200));
    label.up.copy(localUp);
    scene.add(label);

    // === OUTER GROUND RING — 1500m radius, 15m tube ===
    const outerRingGeo = new THREE.TorusGeometry(1500, 15, 8, 96);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: mk.color, transparent: true, opacity: 0.5, depthWrite: false
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.position.copy(base);
    outerRing.quaternion.copy(ringOrientQ);
    scene.add(outerRing);

    // === INNER GROUND RING — 750m radius, 8m tube ===
    const innerRingGeo = new THREE.TorusGeometry(750, 8, 8, 64);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: mk.color, transparent: true, opacity: 0.35, depthWrite: false
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.position.copy(base);
    innerRing.quaternion.copy(ringOrientQ);
    scene.add(innerRing);

    markerData.push({
      label, sphere, outerRing, innerRing,
      localUp: localUp.clone(),
      baseOrientQ: orientQ.clone(),
      ringOrientQ: ringOrientQ.clone(),
    });
  }
}

export function updateMarkers(camera) {
  if (!camera || markerData.length === 0) return;
  const t = clock.getElapsedTime();

  for (const md of markerData) {
    // Billboard label — face camera
    md.label.up.copy(md.localUp);
    md.label.lookAt(camera.position);

    // Pulse glow sphere scale between 1.0 and 1.5
    const pulse = 1.0 + 0.25 * (1 + Math.sin(t * 2));
    md.sphere.scale.setScalar(pulse);

    // Rotate rings slowly (0.1 rad/sec around local up axis)
    const angle = t * 0.1;
    const spinQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1), angle
    );
    md.outerRing.quaternion.copy(md.ringOrientQ).multiply(spinQ);
    md.innerRing.quaternion.copy(md.ringOrientQ).multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -angle)
    );
  }
}
