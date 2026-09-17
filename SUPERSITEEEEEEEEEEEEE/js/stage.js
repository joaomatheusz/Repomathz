// Renderer, studio lighting, floor and the car.
import * as THREE from 'three';
import { createCar } from './car.js';

function studioEnvironment(renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x000000);
  const panel = (w, h, intensity, pos, look, tint = 0xffffff) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(intensity), side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(...pos);
    m.lookAt(...look);
    env.add(m);
  };
  // long overhead softbox strips -> the crisp stripes on black paint
  panel(14, 1.2, 5, [0, 7, -1.6], [0, 0, -1.6]);
  panel(14, 1.2, 5, [0, 7, 1.6], [0, 0, 1.6]);
  panel(3, 10, 2.2, [9, 3, 0], [0, 1, 0]);
  panel(3, 10, 1.4, [-9, 3, 0], [0, 1, 0]);
  panel(16, 2.5, 1.2, [0, 2.5, 9], [0, 1, 0]);
  panel(16, 2.5, 0.8, [0, 2.5, -9], [0, 1, 0]);
  panel(30, 30, 0.06, [0, -1, 0], [0, 1, 0]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return tex;
}

function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(7, 1.6, 7);

  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(3, 8, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(-6, 3, -5);
  scene.add(rim);

  const rig = new THREE.Group();
  scene.add(rig);
  const { car, materials, wheels, lights } = createCar();
  rig.add(car);

  // faint mirror reflection underneath
  const mirror = car.clone(true);
  mirror.scale.y = -1;
  // the tall wing and glow sprites reflect too far out on the floor
  mirror.getObjectByName('wing').visible = false;
  mirror.traverse((o) => { if (o.isSprite || o.name === 'wordmark' || o.name === 'tailbar') o.visible = false; });
  rig.add(mirror);

  // floor: fades out to transparent so the page background shows through
  const floorMat = new THREE.MeshBasicMaterial({
    map: radialTexture([[0, 'rgba(12,12,13,0.88)'], [0.3, 'rgba(12,12,13,0.94)'], [0.62, 'rgba(12,12,13,0.9)'], [1, 'rgba(12,12,13,0)']]),
    transparent: true, depthWrite: false, toneMapped: false,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.001;
  floor.renderOrder = 1;
  rig.add(floor);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 2.9),
    new THREE.MeshBasicMaterial({ map: radialTexture([[0, 'rgba(0,0,0,0.95)'], [0.55, 'rgba(0,0,0,0.7)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false, toneMapped: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  shadow.renderOrder = 2;
  rig.add(shadow);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, rig, car, mirror, materials, wheels, lights, floor, resize };
}
