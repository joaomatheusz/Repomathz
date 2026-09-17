import * as THREE from 'three';
import { createStage } from './stage.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const nextFrame = () => new Promise((r) => { requestAnimationFrame(r); setTimeout(r, 60); });

// ---------- stage ----------
const loader = $('#loader');
const canvas = $('#stage');
const stage = createStage(canvas);
const { renderer, scene, camera, rig, car, mirror, materials, floor } = stage;

const findAll = (name) => [car, mirror].flatMap((root) => root.getObjectsByProperty('name', name));
const spins = findAll('spin');
const flaps = findAll('flap');
const barGlows = findAll('barGlow');
const headGlows = findAll('headGlow');
const keyLights = scene.children.filter((o) => o.isDirectionalLight);
const keyBase = keyLights.map((l) => l.intensity);

// Camera shots. Car nose points to +X. ox/oy shift the car on screen as a
// fraction of the viewport (+ox = right, +oy = down).
const SHOTS = {
  hero: { pos: [6.5, 1.1, -5.8], look: [0.1, 0.62, 0], ox: 0, oy: 0.0, fov: 30 },
  design: { pos: [0.2, 0.85, -11.8], look: [0, 0.62, 0], ox: 0.17, oy: 0.04, fov: 27 },
  aero: { pos: [-7.4, 3.3, 6.2], look: [-0.4, 0.62, 0], ox: -0.16, oy: 0.04, fov: 30 },
  light: { pos: [-9.8, 0.95, 0.0], look: [0, 0.72, 0], ox: 0.17, oy: 0.03, fov: 25, night: 1 },
  config: { pos: [7.4, 1.9, 6.6], look: [0, 0.6, 0], ox: 0.04, oy: -0.02, fov: 30, config: 1 },
};

const chapters = $$('[data-shot]');
let centers = [];
function measure() {
  centers = chapters.map((el) => {
    const r = el.getBoundingClientRect();
    return r.top + scrollY + Math.min(r.height, innerHeight) / 2;
  });
}

const toCyl = (p) => ({ r: Math.hypot(p[0], p[2]), a: Math.atan2(p[2], p[0]), y: p[1] });
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function blendShots(A, B, t) {
  const ca = toCyl(A.pos), cb = toCyl(B.pos);
  const pick = (k) => lerp(A[k] || 0, B[k] || 0, t);
  return {
    r: lerp(ca.r, cb.r, t), a: angleLerp(ca.a, cb.a, t), y: lerp(ca.y, cb.y, t),
    look: A.look.map((v, i) => lerp(v, B.look[i], t)),
    ox: pick('ox'), oy: pick('oy'), fov: pick('fov'), night: pick('night'), config: pick('config'),
  };
}

function currentShot() {
  const c = scrollY + innerHeight / 2;
  const names = chapters.map((el) => el.dataset.shot);
  if (c <= centers[0]) return blendShots(SHOTS[names[0]], SHOTS[names[0]], 0);
  for (let i = 0; i < centers.length - 1; i++) {
    if (c < centers[i + 1]) {
      const t = smooth(0.12, 0.88, (c - centers[i]) / (centers[i + 1] - centers[i]));
      return blendShots(SHOTS[names[i]], SHOTS[names[i + 1]], t);
    }
  }
  const last = SHOTS[names[names.length - 1]];
  return blendShots(last, last, 0);
}

// ---------- camera + effects ----------
const cam = { r: 12, a: 0, y: 2, look: new THREE.Vector3(0, 0.6, 0), ox: 0, oy: 0, fov: 30 };
const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
const fx = { drs: 0, drsOpen: false, night: 0, config: 0 };
let intro = 0;
let snapFrames = 0; // frames that skip easing (deep links)
let userRot = 0, rigRot = 0;
const lookTarget = new THREE.Vector3();

addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = (e.clientY / innerHeight) * 2 - 1;
}, { passive: true });

function updateCamera(dt) {
  const shot = currentShot();
  const narrow = innerWidth < 900;
  const aspect = innerWidth / innerHeight;
  const k = reduceMotion || snapFrames > 0 ? 1 : 1 - Math.exp(-dt * 3.2);
  if (snapFrames > 0) snapFrames--;

  const fit = aspect < 1.2 ? clamp(1.2 / aspect, 1, 2.6) : 1;
  const e = 1 - Math.pow(1 - intro, 3);
  cam.r = lerp(cam.r, shot.r * fit * lerp(1.5, 1, e), k);
  cam.a = angleLerp(cam.a, shot.a + lerp(-0.8, 0, e) + pointer.sx * 0.04, k);
  cam.y = lerp(cam.y, shot.y + lerp(1.1, 0, e) - pointer.sy * 0.1, k);
  cam.look.lerp(lookTarget.set(...shot.look), k);
  cam.ox = lerp(cam.ox, narrow ? 0 : shot.ox, k);
  cam.oy = lerp(cam.oy, narrow ? lerp(-0.14, 0.02, 1 - smooth(0, 0.6, scrollY / innerHeight)) : shot.oy, k);
  cam.fov = lerp(cam.fov, shot.fov, k);

  camera.position.set(Math.cos(cam.a) * cam.r, cam.y, Math.sin(cam.a) * cam.r);
  camera.lookAt(cam.look);
  camera.fov = cam.fov;
  camera.setViewOffset(innerWidth, innerHeight, -cam.ox * innerWidth, -cam.oy * innerHeight, innerWidth, innerHeight);

  fx.drs = lerp(fx.drs, fx.drsOpen ? 1 : 0, k);
  fx.night = lerp(fx.night, shot.night, k);
  fx.config = lerp(fx.config, shot.config, k);
}

function updateEffects(dt) {
  const kp = 1 - Math.exp(-dt * 2);
  pointer.sx = lerp(pointer.sx, pointer.x, kp);
  pointer.sy = lerp(pointer.sy, pointer.y, kp);

  for (const f of flaps) f.rotation.z = lerp(0.32, -0.08, fx.drs);

  const n = fx.night;
  scene.environmentIntensity = lerp(1, 0.16, n);
  keyLights.forEach((l, i) => (l.intensity = keyBase[i] * lerp(1, 0.12, n)));
  materials.tail.color.setRGB(lerp(3.2, 7, n), lerp(0.12, 0.18, n), 0.08);
  for (const g of barGlows) { g.material.opacity = lerp(0.45, 0.95, n); g.scale.set(lerp(2, 2.6, n), lerp(0.2, 0.32, n), 1); }
  for (const g of headGlows) g.material.opacity = lerp(0.1, 0.5, n);
  document.documentElement.style.setProperty('--night', (n * 0.85).toFixed(3));

  rigRot = lerp(rigRot, userRot * fx.config, 1 - Math.exp(-dt * 6));
  rig.rotation.y = rigRot;
}

let lastScroll = scrollY;
function spinWheels() {
  const d = scrollY - lastScroll;
  lastScroll = scrollY;
  for (const s of spins) s.rotation.z -= d * 0.004;
}

const heroWord = $('.hero__word span');
function heroParallax() {
  if (scrollY > innerHeight * 1.5) return;
  heroWord.style.setProperty('--lift', `${(-scrollY * 0.3).toFixed(1)}px`);
  heroWord.style.setProperty('--fade', clamp(1 - scrollY / (innerHeight * 0.6), 0, 1).toFixed(3));
}

let storyVisible = true;
new IntersectionObserver(([e]) => { storyVisible = e.isIntersecting; }).observe($('#story'));

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (loader.classList.contains('is-done') || snapFrames) intro = Math.min(1, intro + dt / (reduceMotion ? 0.01 : 2.4));
  updateEffects(dt);
  updateCamera(dt);
  spinWheels();
  heroParallax();
  if (storyVisible) renderer.render(scene, camera);
}

// ---------- still renders (used for images without a photo in /assets) ----------
const STILLS = {
  side: { size: [1800, 820], pos: [0.1, 0.72, -12], look: [0, 0.64, 0], fov: 15 },
  front34: { size: [1800, 770], pos: [6.2, 1.1, -5.6], look: [0.1, 0.6, 0], fov: 19 },
  rear: { size: [1200, 900], pos: [-9, 1.0, 0.001], look: [0, 0.68, 0], fov: 18, night: true },
  wheel: { size: [1200, 900], pos: [2.4, 0.5, -2.5], look: [1.33, 0.38, -0.8], fov: 18 },
};
const stills = {};

function renderStills() {
  const ratio = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  floor.visible = false;
  mirror.visible = false;
  const carGlows = car.getObjectsByProperty('name', 'barGlow');
  carGlows.forEach((g) => (g.visible = false));
  const shotCam = new THREE.PerspectiveCamera();
  for (const [name, s] of Object.entries(STILLS)) {
    renderer.setSize(s.size[0], s.size[1], false);
    Object.assign(shotCam, { fov: s.fov, aspect: s.size[0] / s.size[1], near: 0.1, far: 100 });
    shotCam.position.set(...s.pos);
    shotCam.updateProjectionMatrix();
    shotCam.lookAt(...s.look);
    scene.environmentIntensity = s.night ? 0.18 : 1;
    materials.tail.color.setRGB(s.night ? 7 : 3.2, 0.14, 0.08);
    renderer.render(scene, shotCam);
    stills[name] = canvas.toDataURL('image/webp', 0.92);
  }
  scene.environmentIntensity = 1;
  floor.visible = true;
  mirror.visible = true;
  carGlows.forEach((g) => (g.visible = true));
  renderer.setPixelRatio(ratio);
  stage.resize();
}

function wireImages() {
  for (const img of $$('img[data-render]')) {
    const fallback = () => { img.src = stills[img.dataset.render]; };
    if (!img.getAttribute('src')) fallback();
    else if (img.complete && img.naturalWidth === 0) fallback();
    else img.addEventListener('error', fallback, { once: true });
  }
}

// ---------- reveal + counters ----------
function countUp(el) {
  const end = parseFloat(el.dataset.count);
  const dec = +(el.dataset.decimals || 0);
  const fmt = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (reduceMotion) { el.textContent = fmt(end); return; }
  const t0 = performance.now();
  const step = (now) => {
    const t = clamp((now - t0) / 1400, 0, 1);
    el.textContent = fmt(end * (1 - Math.pow(1 - t, 4)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('is-in');
    $$('[data-count]', e.target).forEach(countUp);
    io.unobserve(e.target);
  }
}, { threshold: 0.2 });

// ---------- configurator ----------
const OPTIONS = {
  paint: {
    label: '#paintName',
    items: [
      ['Preto', '#0b0b0c', { color: 0x060607, roughness: 0.4, metalness: 0.1 }],
      ['Branco Carrara', '#e6e6e1', { color: 0xd8d8d2, roughness: 0.35, metalness: 0.25 }],
      ['Prata GT', '#a3a6aa', { color: 0x80838a, roughness: 0.3, metalness: 0.75 }],
      ['Vermelho Guards', '#b3121b', { color: 0x9e0710, roughness: 0.38, metalness: 0.1 }],
      ['Azul Shark', '#1f5fb4', { color: 0x0f4aa0, roughness: 0.33, metalness: 0.35 }],
      ['Verde Python', '#5bb535', { color: 0x3f9e21, roughness: 0.35, metalness: 0.2 }],
    ],
    apply: (m) => { materials.paint.color.set(m.color); materials.paint.roughness = m.roughness; materials.paint.metalness = m.metalness; },
  },
  rim: {
    label: '#rimName',
    items: [
      ['Preto acetinado', '#1a1a1b', { color: 0x151516, roughness: 0.35 }],
      ['Bronze', '#6b5234', { color: 0x5a4125, roughness: 0.3 }],
      ['Prata', '#b9bcc0', { color: 0xa9adb2, roughness: 0.25 }],
    ],
    apply: (m) => { materials.rim.color.set(m.color); materials.rim.roughness = m.roughness; },
  },
  caliper: {
    label: '#caliperName',
    items: [
      ['Amarelo', '#f2c200', { color: 0xf2c200 }],
      ['Vermelho', '#c4121a', { color: 0xc4121a }],
      ['Preto', '#1b1b1b', { color: 0x151515 }],
    ],
    apply: (m) => materials.caliper.color.set(m.color),
  },
};

function buildSwatches() {
  for (const group of $$('.swatches')) {
    const opt = OPTIONS[group.dataset.target];
    group.setAttribute('role', 'radiogroup');
    opt.items.forEach(([name, css, mat], i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.style.setProperty('--c', css);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', name);
      b.setAttribute('aria-checked', String(i === 0));
      b.title = name;
      b.addEventListener('click', () => {
        $$('.swatch', group).forEach((s) => s.setAttribute('aria-checked', 'false'));
        b.setAttribute('aria-checked', 'true');
        $(opt.label).textContent = name;
        opt.apply(mat);
      });
      group.append(b);
    });
  }
}

function wireDrag() {
  const zone = $('#dragZone');
  let startX = 0, startRot = 0, id = null;
  zone.addEventListener('pointerdown', (e) => {
    id = e.pointerId; startX = e.clientX; startRot = userRot;
    zone.setPointerCapture(id);
    zone.classList.add('is-dragging');
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId === id) userRot = startRot + (e.clientX - startX) * 0.009;
  });
  const end = () => { id = null; zone.classList.remove('is-dragging'); };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
}

// ---------- nav ----------
const navLinks = $$('.nav__links a');
function onScroll() {
  const mid = innerHeight * 0.45;
  for (const a of navLinks) {
    const r = $(a.getAttribute('href')).getBoundingClientRect();
    a.classList.toggle('is-active', r.top < mid && r.bottom > mid);
  }
}

// ---------- boot ----------
async function boot() {
  const bar = $('#loaderBar');
  const progress = (p) => { bar.style.width = `${p * 100}%`; };
  progress(0.15);
  buildSwatches();
  wireDrag();

  $('#drsBtn').addEventListener('click', (e) => {
    fx.drsOpen = !fx.drsOpen;
    e.currentTarget.setAttribute('aria-pressed', String(fx.drsOpen));
    e.currentTarget.textContent = fx.drsOpen ? 'Fechar DRS' : 'Abrir DRS';
  });

  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  progress(0.4);
  await nextFrame();
  renderer.compile(scene, camera);
  progress(0.7);
  await nextFrame();
  renderStills();
  wireImages();
  progress(1);
  await nextFrame();

  measure();
  $$('.reveal').forEach((el) => io.observe(el));
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', measure);
  addEventListener('load', measure);
  onScroll();

  // ?at=<section id> opens the page on that section
  const target = document.getElementById(new URLSearchParams(location.search).get('at') || '');
  if (target) {
    document.documentElement.style.scrollBehavior = 'auto';
    const r = target.getBoundingClientRect();
    scrollTo(0, r.top + scrollY + Math.min(r.height, innerHeight) / 2 - innerHeight / 2);
    intro = 1;
    snapFrames = 5;
    $$('.reveal', target).forEach((el) => el.classList.add('is-in'));
  }

  renderer.setAnimationLoop(tick);
  setTimeout(() => loader.classList.add('is-done'), 300);
}

boot();
