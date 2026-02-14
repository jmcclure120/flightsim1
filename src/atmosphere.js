import * as THREE from 'three';
import { game } from './state.js';

export function buildAtmo() {
  const skyG = new THREE.SphereGeometry(100000, 32, 16);
  const skyM = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { sunDir: { value: game.sunLight.position.clone().normalize() } },
    vertexShader: `varying vec3 vP;void main(){vP=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      uniform vec3 sunDir;varying vec3 vP;
      void main(){
        vec3 d=normalize(vP);float y=d.y;
        vec3 zen=vec3(0.08,0.12,0.38),hor=vec3(0.55,0.7,0.9),gnd=vec3(0.25,0.3,0.35);
        vec3 c=y>0.0?mix(hor,zen,pow(y,0.5)):mix(hor,gnd,pow(-y,0.3));
        float sd=max(dot(d,sunDir),0.0);
        c+=vec3(1,.9,.7)*pow(sd,64.0)*2.0+vec3(1,.8,.5)*pow(sd,8.0)*0.3;
        gl_FragColor=vec4(c,1);
      }`
  });
  game.skyMesh = new THREE.Mesh(skyG, skyM);
  game.scene.add(game.skyMesh);

  // Cloud texture
  function mkCloudTex(sz) {
    const cc = document.createElement('canvas'); cc.width = cc.height = sz;
    const cx = cc.getContext('2d');
    const h = sz / 2;
    for (let i = 0; i < 12; i++) {
      const ox = (Math.random() - 0.5) * sz * 0.35, oy = (Math.random() - 0.5) * sz * 0.25;
      const r = sz * 0.2 + Math.random() * sz * 0.2;
      const gr = cx.createRadialGradient(h + ox, h + oy, 0, h + ox, h + oy, r);
      const a = 0.15 + Math.random() * 0.1;
      gr.addColorStop(0, `rgba(255,255,255,${a})`);
      gr.addColorStop(0.5, `rgba(250,250,252,${a * 0.6})`);
      gr.addColorStop(1, 'rgba(245,245,250,0)');
      cx.fillStyle = gr; cx.fillRect(0, 0, sz, sz);
    }
    return new THREE.CanvasTexture(cc);
  }
  const cloudTexes = [mkCloudTex(256), mkCloudTex(256), mkCloudTex(256)];

  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2, d = 8000 + Math.random() * 55000;
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    const baseY = 4000 + Math.random() * 2500;
    const clW = 600 + Math.random() * 1200, clH = 200 + Math.random() * 400;
    const nPuffs = 8 + Math.floor(Math.random() * 10);
    for (let j = 0; j < nPuffs; j++) {
      const tex = cloudTexes[Math.floor(Math.random() * 3)];
      const cm = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.35 + Math.random() * 0.2, depthWrite: false, fog: true });
      const sp = new THREE.Sprite(cm);
      const px = cx + (Math.random() - 0.5) * clW;
      const py = baseY + (Math.random() - 0.3) * clH;
      const pz = cz + (Math.random() - 0.5) * clW;
      sp.position.set(px, py, pz);
      const s = 300 + Math.random() * 500;
      sp.scale.set(s, s * 0.5, 1);
      game.scene.add(sp);
    }
  }
}
