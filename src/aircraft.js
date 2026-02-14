import * as THREE from 'three';
import { ac, game } from './state.js';

function flatGeo(pts, th) {
  const n = pts.length, v = [], idx = [];
  for (const [x, y, z] of pts) v.push(x, y + th / 2, z);
  for (const [x, y, z] of pts) v.push(x, y - th / 2, z);
  for (let i = 1; i < n - 1; i++) { idx.push(0, i, i + 1); idx.push(n, n + i + 1, n + i); }
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i, n + i, j); idx.push(j, n + i, n + j); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

function flatGeoX(pts, th) {
  const n = pts.length, v = [], idx = [];
  for (const [x, y, z] of pts) v.push(x + th / 2, y, z);
  for (const [x, y, z] of pts) v.push(x - th / 2, y, z);
  for (let i = 1; i < n - 1; i++) { idx.push(0, i, i + 1); idx.push(n, n + i + 1, n + i); }
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i, n + i, j); idx.push(j, n + i, n + j); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

export function buildF16() {
  const g = new THREE.Group();
  let m;

  // ===== MATERIALS =====
  const matBody = new THREE.MeshStandardMaterial({ color: 0x8090a0, roughness: 0.6, metalness: 0.3 });
  const matUnder = new THREE.MeshStandardMaterial({ color: 0x607080, roughness: 0.65, metalness: 0.25 });
  const matRadome = new THREE.MeshStandardMaterial({ color: 0x505850, roughness: 0.7, metalness: 0.2 });
  const matExh = new THREE.MeshStandardMaterial({ color: 0x303030, roughness: 0.4, metalness: 0.7 });
  const matCanopy = new THREE.MeshPhongMaterial({ color: 0x4488aa, transparent: true, opacity: 0.4, specular: 0xffffff, shininess: 200 });
  const matDark = new THREE.MeshBasicMaterial({ color: 0x080808 });
  const matFrame = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.8, metalness: 0.4 });
  const matAB = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
  const matAIM = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.5, metalness: 0.2 });
  const matMk82 = new THREE.MeshStandardMaterial({ color: 0x5a5a3a, roughness: 0.7, metalness: 0.1 });
  const matPylon = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7, metalness: 0.3 });

  // ===== FUSELAGE — LatheGeometry for smooth profile =====
  const profile = [
    [0, -7.5], [0.04, -7.4], [0.12, -7.1], [0.22, -6.6], [0.32, -6],
    [0.4, -5.3], [0.45, -4.5], [0.48, -3.8], [0.5, -3], [0.53, -2],
    [0.57, -0.5], [0.6, 0.5], [0.6, 1.5], [0.58, 2.5], [0.56, 3.5],
    [0.53, 4.5], [0.5, 5.5], [0.47, 6.5], [0.44, 7], [0.42, 7.5]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const fuseGeo = new THREE.LatheGeometry(profile, 16);
  fuseGeo.rotateX(Math.PI / 2);
  const fa = fuseGeo.attributes.position.array;
  for (let i = 0; i < fa.length; i += 3) fa[i + 1] *= 0.88;
  fuseGeo.attributes.position.needsUpdate = true;
  fuseGeo.computeVertexNormals();
  g.add(new THREE.Mesh(fuseGeo, matBody));

  // ===== RADOME =====
  m = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.8, 12), matRadome);
  m.rotation.x = -Math.PI / 2; m.position.set(0, 0, -8.1); g.add(m);

  // ===== CANOPY =====
  m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), matCanopy);
  m.scale.set(0.6, 0.88, 2.3); m.position.set(0, 0.3, -3.8); g.add(m);
  m = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06, 4), matFrame);
  m.position.set(0, 0.68, -3.8); g.add(m);
  m = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.05), matFrame);
  m.position.set(0, 0.52, -1.9); g.add(m);
  m = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.05), matFrame);
  m.position.set(0, 0.58, -5.0); g.add(m);

  // ===== DORSAL SPINE =====
  m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 8), matBody);
  m.position.set(0, 0.48, 1.5); g.add(m);
  m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 1.5), matBody);
  m.position.set(0, 0.44, -1.8); g.add(m);

  // ===== CHIN INTAKE =====
  m = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.52, 3.5), matUnder);
  m.position.set(0, -0.56, -3); g.add(m);
  m = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.04, 2.2), matBody);
  m.position.set(0, -0.31, -3.3); g.add(m);
  m = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.44, 0.08), matDark);
  m.position.set(0, -0.56, -4.8); g.add(m);
  m = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.05, 1.8), matFrame);
  m.position.set(0, -0.31, -3.9); g.add(m);
  [-1, 1].forEach(s => {
    m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 2.5), matUnder);
    m.position.set(s * 0.42, -0.56, -3.2); g.add(m);
  });

  // ===== WINGS =====
  const rwPts = [
    [0.6, -0.04, -1.5], [3.0, 0.06, -0.3], [4.8, 0.14, 0.4],
    [4.8, 0.14, 1.7], [3.0, 0.04, 2.5], [0.65, -0.04, 3.0]
  ];
  g.add(new THREE.Mesh(flatGeo(rwPts, 0.1), matBody));
  g.add(new THREE.Mesh(flatGeo(rwPts.map(([x, y, z]) => [-x, y, z]), 0.1), matBody));
  const rwUnder = [
    [0.8, -0.1, -1.0], [4.5, 0.08, 0.5], [4.5, 0.08, 1.5], [0.8, -0.1, 2.8]
  ];
  g.add(new THREE.Mesh(flatGeo(rwUnder, 0.02), matUnder));
  g.add(new THREE.Mesh(flatGeo(rwUnder.map(([x, y, z]) => [-x, y, z]), 0.02), matUnder));

  // ===== LEX =====
  const lexPts = [
    [0.48, 0.04, -4.5], [1.2, 0, -1.5], [0.6, -0.04, -1.5]
  ];
  g.add(new THREE.Mesh(flatGeo(lexPts, 0.05), matBody));
  g.add(new THREE.Mesh(flatGeo(lexPts.map(([x, y, z]) => [-x, y, z]), 0.05), matBody));

  // ===== AILERONS =====
  const raGrp = new THREE.Group();
  raGrp.position.set(2.8, 0.02, 2.0);
  raGrp.add(new THREE.Mesh(flatGeo([[0, 0, 0], [2.0, 0.12, 0], [2.0, 0.12, 0.6], [0, 0, 1.0]], 0.04), matBody));
  g.add(raGrp);
  const laGrp = new THREE.Group();
  laGrp.position.set(-2.8, 0.02, 2.0);
  laGrp.add(new THREE.Mesh(flatGeo([[0, 0, 0], [-2.0, 0.12, 0], [-2.0, 0.12, 0.6], [0, 0, 1.0]], 0.04), matBody));
  g.add(laGrp);

  // ===== HORIZONTAL STABILIZERS =====
  const rsGrp = new THREE.Group();
  rsGrp.position.set(0.45, -0.08, 5.8);
  rsGrp.add(new THREE.Mesh(flatGeo([[0, 0, 0], [2.8, 0, 0.8], [2.8, 0, 1.8], [0, 0, 2.0]], 0.07), matBody));
  g.add(rsGrp);
  const lsGrp = new THREE.Group();
  lsGrp.position.set(-0.45, -0.08, 5.8);
  lsGrp.add(new THREE.Mesh(flatGeo([[0, 0, 0], [-2.8, 0, 0.8], [-2.8, 0, 1.8], [0, 0, 2.0]], 0.07), matBody));
  g.add(lsGrp);

  // ===== VERTICAL STABILIZER =====
  g.add(new THREE.Mesh(flatGeoX([[0, 0.42, 3.8], [0, 3.3, 5.4], [0, 3.0, 7.5], [0, 0.42, 7.5]], 0.08), matBody));
  g.add(new THREE.Mesh(flatGeoX([[0, 0.42, 2.5], [0, 0.8, 3.8], [0, 0.42, 3.8]], 0.06), matBody));
  m = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.4, 0.025), matFrame);
  m.position.set(0, 3.5, 5.4); g.add(m);

  // ===== RUDDER =====
  const rudGrp = new THREE.Group();
  rudGrp.position.set(0, 0.42, 6.5);
  rudGrp.add(new THREE.Mesh(flatGeoX([[0, 0, 0], [0, 2.5, -0.5], [0, 2.2, 1.0], [0, 0, 1.0]], 0.05), matBody));
  g.add(rudGrp);

  // ===== VENTRAL FINS =====
  [-0.28, 0.28].forEach(xp => {
    g.add(new THREE.Mesh(flatGeo([
      [xp, -0.48, 5.5], [xp * 3, -1.15, 6.5], [xp * 2.5, -0.95, 7.5], [xp, -0.48, 7.5]
    ], 0.035), matBody));
  });

  // ===== EXHAUST NOZZLE =====
  m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 1.4, 16), matExh);
  m.rotation.x = Math.PI / 2; m.position.set(0, 0, 7.8); g.add(m);
  m = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.37, 0.5, 16), matDark);
  m.rotation.x = Math.PI / 2; m.position.set(0, 0, 8.3); g.add(m);
  m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.3, 16), matExh);
  m.rotation.x = Math.PI / 2; m.position.set(0, 0, 8.5); g.add(m);

  // ===== AFTERBURNER =====
  const ab = new THREE.Mesh(new THREE.ConeGeometry(0.34, 4, 8), matAB);
  ab.rotation.x = Math.PI / 2; ab.position.set(0, 0, 10); g.add(ab);
  ac.abMesh = ab;

  ac.cs = { ra: raGrp, la: laGrp, rs: rsGrp, ls: lsGrp, rud: rudGrp };

  // ===== WINGTIP AIM-9 MISSILES =====
  ac.wm.mis = [];
  [-1, 1].forEach(s => {
    m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.6), matPylon);
    m.position.set(s * 4.85, 0.08, 0.9); g.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.35), matPylon);
    m.position.set(s * 4.85, 0, 1.0); g.add(m);
    const mg = new THREE.Group();
    const mb = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.5, 8), matAIM);
    mb.rotation.x = Math.PI / 2; mg.add(mb);
    const mh = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 6), matFrame);
    mh.position.z = -0.8; mg.add(mh);
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(i % 2 ? 0.01 : 0.14, i % 2 ? 0.14 : 0.01, 0.18), matAIM);
      fin.position.z = 0.6; mg.add(fin);
    }
    for (let i = 0; i < 4; i++) {
      const can = new THREE.Mesh(new THREE.BoxGeometry(i % 2 ? 0.01 : 0.07, i % 2 ? 0.07 : 0.01, 0.1), matAIM);
      can.position.z = -0.5; mg.add(can);
    }
    mg.position.set(s * 4.85, -0.1, 0.9); g.add(mg);
    ac.wm.mis.push(mg);
  });

  // ===== UNDER-WING MK-82 BOMBS =====
  ac.wm.bom = [];
  [-1, 1].forEach(s => {
    [0, 1].forEach(p => {
      const xp = s * (1.8 + p * 1.4);
      m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.45), matPylon);
      m.position.set(xp, -0.14, 1.0); g.add(m);
      m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.3), matPylon);
      m.position.set(xp, -0.24, 1.0); g.add(m);
      const bg = new THREE.Group();
      const bb = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 1.3, 8), matMk82);
      bb.rotation.x = Math.PI / 2; bg.add(bb);
      const bn = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.5), matMk82);
      bn.rotation.x = Math.PI / 2; bn.position.z = -0.7; bg.add(bn);
      const bt = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 6), matMk82);
      bt.rotation.x = Math.PI / 2; bt.position.z = 0.75; bg.add(bt);
      for (let i = 0; i < 4; i++) {
        const tf = new THREE.Mesh(new THREE.BoxGeometry(i % 2 ? 0.01 : 0.2, i % 2 ? 0.2 : 0.01, 0.12), matMk82);
        tf.position.z = 0.7; bg.add(tf);
      }
      bg.position.set(xp, -0.34, 1.0); g.add(bg);
      ac.wm.bom.push(bg);
    });
  });

  // ===== FUSELAGE UNDERSIDE =====
  m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 6), matUnder);
  m.position.set(0, -0.5, 1.5); g.add(m);

  game.scene.add(g); ac.mdl = g;
}
