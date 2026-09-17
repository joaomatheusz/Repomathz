// Wheels, lights, aero and trim for the GT3 RS, placed on the body surface.
import * as THREE from 'three';
import { DIM, lerp, topPoint, sidePoint, endPoint, halfW } from './body.js';

// ---------- mesh helpers ----------
function gridMesh(nu, nv, fn, material) {
  const pos = [], idx = [];
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      const v = fn(i / nu, j / nv);
      pos.push(v.x, v.y, v.z);
    }
  }
  const row = nv + 1;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

const onTop = (x, z, lift) => { const s = topPoint(x, z); return s.p.addScaledVector(s.n, lift); };
const onSide = (x, y, sign, lift) => { const s = sidePoint(x, y, sign); return s.p.addScaledVector(s.n, lift); };

function topPatch(x0, x1, z0, z1, lift, material, nu = 12, nv = 8) {
  return gridMesh(nu, nv, (u, v) => onTop(lerp(x0, x1, u), lerp(z0, z1, v), lift), material);
}

// thin fin standing on the top surface along a polyline of [x, z]
function topFin(points, height, material) {
  const base = points.map(([x, z]) => topPoint(x, z));
  return gridMesh(base.length - 1, 1, (u, v) => {
    const s = base[Math.round(u * (base.length - 1))];
    return s.p.clone().addScaledVector(s.n, 0.002 + v * height);
  }, material);
}

function line(points, material, radius = 0.0022) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 4, radius, 5), material);
}

// ---------- wheels ----------
export function buildWheel(spec, m) {
  const { r, width } = spec;
  const hw = width / 2;
  const rimR = r * 0.745;
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  wheel.add(spin);

  // tyre with a bulged sidewall and rounded shoulders
  const prof = [new THREE.Vector2(rimR + 0.004, -hw + 0.03)];
  prof.push(new THREE.Vector2(lerp(rimR, r, 0.45), -hw - 0.004));
  for (let k = 0; k <= 6; k++) {
    const a = -Math.PI / 2 + (k / 6) * (Math.PI / 2);
    prof.push(new THREE.Vector2(r - 0.028 + Math.cos(a) * 0.028, -hw + 0.03 + Math.sin(a) * 0.03));
  }
  for (let k = 0; k <= 6; k++) {
    const a = (k / 6) * (Math.PI / 2);
    prof.push(new THREE.Vector2(r - 0.028 + Math.cos(a) * 0.028, hw - 0.03 + Math.sin(a) * 0.03));
  }
  prof.push(new THREE.Vector2(lerp(rimR, r, 0.45), hw + 0.004));
  prof.push(new THREE.Vector2(rimR + 0.004, hw - 0.03));
  const tyre = new THREE.LatheGeometry(prof, 96);
  tyre.rotateX(Math.PI / 2);
  spin.add(new THREE.Mesh(tyre, m.tyre));

  const barrel = new THREE.CylinderGeometry(rimR, rimR, width - 0.04, 64, 1, true);
  barrel.rotateX(Math.PI / 2);
  spin.add(new THREE.Mesh(barrel, m.rimInner));

  // forged 10-spoke face, dished towards the hub
  const lipR = rimR - 0.02, inR = 0.1, spokes = 10;
  const face = new THREE.Shape();
  face.absarc(0, 0, rimR, 0, Math.PI * 2, false);
  for (let s = 0; s < spokes; s++) {
    const a0 = (s / spokes) * Math.PI * 2, a1 = ((s + 1) / spokes) * Math.PI * 2;
    const dOut = 0.017 / lipR, dIn = 0.021 / inR;
    const hole = new THREE.Path();
    hole.absarc(0, 0, lipR, a0 + dOut, a1 - dOut, false);
    hole.absarc(0, 0, inR, a1 - dIn, a0 + dIn, true);
    hole.closePath();
    face.holes.push(hole);
  }
  const faceGeo = new THREE.ExtrudeGeometry(face, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2, curveSegments: 64 });
  const fp = faceGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const rr = Math.hypot(fp.getX(i), fp.getY(i));
    fp.setZ(i, fp.getZ(i) - 0.06 * Math.pow(1 - Math.min(rr / rimR, 1), 1.4));
  }
  faceGeo.computeVertexNormals();
  faceGeo.translate(0, 0, hw - 0.034);
  spin.add(new THREE.Mesh(faceGeo, m.rim));

  const lip = new THREE.Mesh(new THREE.TorusGeometry(rimR - 0.004, 0.007, 8, 96), m.rimLip);
  lip.position.z = hw - 0.012;
  spin.add(lip);

  const nut = new THREE.CylinderGeometry(0.036, 0.042, 0.04, 6);
  nut.rotateX(Math.PI / 2);
  nut.translate(0, 0, hw - 0.055);
  spin.add(new THREE.Mesh(nut, m.nut));

  const disc = new THREE.CylinderGeometry(rimR - 0.04, rimR - 0.04, 0.034, 64);
  disc.rotateX(Math.PI / 2);
  disc.translate(0, 0, hw - 0.17);
  wheel.add(new THREE.Mesh(disc, m.disc));

  const cal = new THREE.Shape();
  cal.absarc(0, 0, rimR - 0.03, 0.2, 1.25, false);
  cal.absarc(0, 0, rimR - 0.125, 1.25, 0.2, true);
  const calGeo = new THREE.ExtrudeGeometry(cal, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 24 });
  calGeo.translate(0, 0, hw - 0.2);
  const caliper = new THREE.Mesh(calGeo, m.caliper);
  caliper.rotation.z = Math.PI * 0.42;
  wheel.add(caliper);

  return wheel;
}

// ---------- lights ----------
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function wordmarkTexture(text) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d8d8d8';
  ctx.font = '400 70px Michroma, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.split('').join(String.fromCharCode(8202, 8202)), 512, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function headlight(m, glow) {
  const g = new THREE.Group();
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.012, 12, 64), m.bezel);
  g.add(bezel);
  const back = new THREE.Mesh(new THREE.CircleGeometry(0.098, 48), m.reflector);
  back.position.z = -0.012;
  g.add(back);
  const projector = new THREE.Mesh(new THREE.SphereGeometry(0.032, 24, 12), m.chrome);
  projector.scale.z = 0.6;
  g.add(projector);
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const drl = new THREE.Mesh(new THREE.PlaneGeometry(0.024, 0.008), m.drl);
    drl.position.set(sx * 0.05, sy * 0.045, 0.004);
    g.add(drl);
  }
  const lens = new THREE.SphereGeometry(0.104, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  lens.rotateX(Math.PI / 2);
  lens.scale(1, 1, 0.32);
  g.add(new THREE.Mesh(lens, m.lens));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xdfe8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.12 }));
  halo.name = 'headGlow';
  halo.position.z = 0.06;
  halo.scale.set(0.26, 0.26, 1);
  g.add(halo);
  g.scale.set(1, 1.08, 1);
  return g;
}

export function buildLights(m) {
  const g = new THREE.Group();
  const glow = glowTexture();
  const zAxis = new THREE.Vector3(0, 0, 1);

  for (const s of [-1, 1]) {
    const p = endPoint(0.645, s * 0.68, 1);
    const dir = new THREE.Vector3(0.86, 0.42, s * 0.28).normalize();
    const lamp = headlight(m, glow);
    lamp.quaternion.setFromUnitVectors(zAxis, dir);
    lamp.position.copy(p).addScaledVector(dir, 0.004);
    g.add(lamp);
  }

  // rear: smoked band + continuous LED bar following the tail
  const yBar = 0.795;
  const band = gridMesh(48, 1, (u, v) => {
    const z = lerp(-0.84, 0.84, u);
    const e = endPoint(lerp(yBar - 0.026, yBar + 0.022, v), z, -1);
    return e.setX(e.x - 0.003);
  }, m.smoked);
  g.add(band);

  const barPts = [];
  for (let k = 0; k <= 48; k++) {
    const z = lerp(-0.83, 0.83, k / 48);
    const e = endPoint(yBar, z, -1);
    barPts.push(e.setX(e.x - 0.007));
  }
  const bar = line(barPts, m.tail, 0.0075);
  bar.name = 'tailbar';
  g.add(bar);

  const barGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff1a1a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
  barGlow.name = 'barGlow';
  barGlow.scale.set(2, 0.2, 1);
  barGlow.position.set(endPoint(yBar, 0, -1).x - 0.06, yBar, 0);
  g.add(barGlow);

  const word = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.07), new THREE.MeshBasicMaterial({ map: wordmarkTexture('PORSCHE'), transparent: true, depthWrite: false }));
  word.name = 'wordmark';
  word.rotation.y = -Math.PI / 2;
  word.position.copy(endPoint(0.742, 0, -1)).add(new THREE.Vector3(-0.006, 0, 0));
  g.add(word);
  return g;
}

// ---------- rear wing ----------
function airfoil(chord, thick, camber) {
  const s = new THREE.Shape();
  const N = 28, top = [], bot = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const yt = 5 * thick * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1036 * t ** 4);
    const yc = camber * 4 * t * (1 - t);
    top.push([-t * chord, yc + yt]);
    bot.push([-t * chord, yc - yt]);
  }
  s.moveTo(top[0][0], top[0][1]);
  for (const p of top.slice(1)) s.lineTo(p[0], p[1]);
  for (const p of bot.reverse()) s.lineTo(p[0], p[1]);
  return s;
}

export function buildWing(m) {
  const g = new THREE.Group();
  const span = 1.7;
  const mainGeo = new THREE.ExtrudeGeometry(airfoil(0.46, 0.12, 0.035), { depth: span, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2 });
  mainGeo.translate(0, 0, -span / 2);
  const main = new THREE.Mesh(mainGeo, m.carbon);
  main.position.set(-1.82, 1.17, 0);
  main.rotation.z = 0.08;
  g.add(main);

  const flapGeo = new THREE.ExtrudeGeometry(airfoil(0.24, 0.11, 0.02), { depth: span - 0.04, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2 });
  flapGeo.translate(0, 0, -(span - 0.04) / 2);
  const flap = new THREE.Mesh(flapGeo, m.carbon);
  flap.name = 'flap';
  flap.position.set(-2.1, 1.245, 0);
  flap.rotation.z = 0.32;
  g.add(flap);

  const ep = new THREE.Shape();
  ep.moveTo(-1.76, 1.1);
  ep.lineTo(-1.8, 1.3);
  ep.quadraticCurveTo(-2.05, 1.37, -2.37, 1.33);
  ep.lineTo(-2.36, 1.12);
  ep.quadraticCurveTo(-2.05, 1.06, -1.76, 1.1);
  for (const z of [-span / 2 - 0.012, span / 2]) {
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(ep, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 }), m.carbon);
    mesh.position.z = z;
    g.add(mesh);
  }

  // swan-neck uprights rising from the engine lid
  for (const z of [-0.3, 0.3]) {
    const deck = topPoint(-1.86, z).p.y;
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.84, deck - 0.02, 0), new THREE.Vector3(-1.82, deck + 0.12, 0),
      new THREE.Vector3(-1.88, 1.19, 0), new THREE.Vector3(-2.02, 1.27, 0), new THREE.Vector3(-2.12, 1.275, 0),
    ]);
    const neck = new THREE.Shape();
    const pts = path.getPoints(24);
    const w = 0.028;
    neck.moveTo(pts[0].x - w, pts[0].y);
    for (const p of pts) neck.lineTo(p.x - w, p.y + (p.y > 1.2 ? w * 0.6 : 0));
    for (const p of [...pts].reverse()) neck.lineTo(p.x + w, p.y - (p.y > 1.2 ? w * 0.6 : 0));
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(neck, { depth: 0.02, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 }), m.carbon);
    mesh.position.z = z - 0.01;
    g.add(mesh);
  }
  return g;
}

// ---------- trim & details ----------
export function buildDetails(m) {
  const g = new THREE.Group();

  // hood exits of the central radiator, with fins
  for (const s of [-1, 1]) {
    g.add(topPatch(1.72, 2.02, s * 0.1, s * 0.42, 0.0015, m.intake));
    for (let k = 0; k < 6; k++) {
      const z = s * (0.13 + k * 0.052);
      g.add(topFin([[1.73, z], [1.8, z], [1.87, z], [1.94, z], [2.01, z]], 0.012, m.carbon));
    }
  }

  // louvres on top of the front arches
  for (const s of [-1, 1]) {
    for (let k = 0; k < 9; k++) {
      const x = 1.14 + k * 0.042;
      g.add(topFin([[x, s * 0.7], [x + 0.004, s * 0.76], [x + 0.008, s * 0.82], [x + 0.012, s * 0.86]], 0.01, m.intake));
    }
  }

  // engine-lid gills between rear window and wing
  for (let k = 0; k < 8; k++) {
    const x = -1.64 - k * 0.032;
    g.add(topFin([[x, -0.36], [x, -0.12], [x, 0.12], [x, 0.36]], 0.008, m.intake));
  }

  // front intakes on the bumper face
  const frontPatch = (z0, z1, y0, y1) => gridMesh(14, 6, (u, v) => {
    const e = endPoint(lerp(y0, y1, v), lerp(z0, z1, u), 1);
    return e.setX(e.x + 0.003);
  }, m.intake);
  g.add(frontPatch(-0.4, 0.4, 0.2, 0.34));
  for (const s of [-1, 1]) g.add(frontPatch(s * 0.5, s * 0.74, 0.2, 0.34));
  for (const y of [0.25, 0.29]) {
    const pts = [];
    for (let k = 0; k <= 12; k++) { const e = endPoint(y, lerp(-0.38, 0.38, k / 12), 1); pts.push(e.setX(e.x + 0.008)); }
    g.add(line(pts, m.carbon, 0.004));
  }

  // splitter following the nose outline
  const lip = new THREE.Shape();
  const outline = [];
  for (let k = 0; k <= 24; k++) {
    const z = lerp(-0.84, 0.84, k / 24);
    outline.push([endPoint(0.17, z, 1).x + 0.035, z]);
  }
  lip.moveTo(1.98, -0.84);
  for (const [x, z] of outline) lip.lineTo(x, z);
  lip.lineTo(1.98, 0.84);
  const lipGeo = new THREE.ExtrudeGeometry(lip, { depth: 0.018, bevelEnabled: false });
  lipGeo.rotateX(Math.PI / 2);
  lipGeo.translate(0, 0.125, 0);
  g.add(new THREE.Mesh(lipGeo, m.intake));

  // carbon side skirts
  for (const s of [-1, 1]) {
    g.add(gridMesh(20, 3, (u, v) => onSide(lerp(-0.7, 0.9, u), lerp(0.13, 0.225, v), s, 0.004), m.carbon));
  }

  // rear diffuser + twin centre exhaust
  g.add(gridMesh(16, 5, (u, v) => {
    const e = endPoint(lerp(0.15, 0.4, v), lerp(-0.72, 0.72, u), -1);
    return e.setX(e.x - 0.003);
  }, m.intake));
  for (const s of [-1, 1]) {
    const tip = endPoint(0.3, s * 0.085, -1);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 32, 1, true), m.exhaust);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(tip.x - 0.02, 0.3, s * 0.085);
    g.add(pipe);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.04, 32), m.intake);
    hole.rotation.y = -Math.PI / 2;
    hole.position.set(tip.x - 0.065, 0.3, s * 0.085);
    g.add(hole);
  }

  // shut lines
  const lidPath = [];
  for (let k = 0; k <= 10; k++) { const x = lerp(0.84, 1.98, k / 10); lidPath.push(onTop(x, -(halfW(x) - 0.3), 0.0012)); }
  for (let k = 1; k < 10; k++) { const z = lerp(-0.5, 0.5, k / 10); lidPath.push(onTop(2.08 - 0.06 * (z / 0.5) ** 2, z, 0.0012)); }
  for (let k = 10; k >= 0; k--) { const x = lerp(0.84, 1.98, k / 10); lidPath.push(onTop(x, halfW(x) - 0.3, 0.0012)); }
  g.add(line(lidPath, m.seam));

  const lid = [];
  const rect = [[-1.62, -0.5], [-1.62, 0.5], [-2.12, 0.54], [-2.12, -0.54], [-1.62, -0.5]];
  for (let k = 0; k < rect.length - 1; k++) {
    for (let t = 0; t < 8; t++) {
      const [x0, z0] = rect[k], [x1, z1] = rect[k + 1];
      lid.push(onTop(lerp(x0, x1, t / 8), lerp(z0, z1, t / 8), 0.0012));
    }
  }
  g.add(line(lid, m.seam));

  for (const s of [-1, 1]) {
    const door = [
      [0.78, 0.8], [0.8, 0.6], [0.79, 0.38], [0.74, 0.27], [0.5, 0.25], [0.0, 0.25],
      [-0.4, 0.26], [-0.47, 0.34], [-0.5, 0.6], [-0.56, 0.84],
    ].map(([x, y]) => onSide(x, y, s, 0.0012));
    g.add(line(door, m.seam));

    // flush door handle
    const handle = [[-0.2, 0.735], [-0.02, 0.735], [-0.02, 0.755], [-0.2, 0.755], [-0.2, 0.735]]
      .map(([x, y]) => onSide(x, y, s, 0.0015));
    g.add(line(handle, m.seam, 0.0018));

    // door mirror on a short stalk
    const root = sidePoint(0.52, 0.87, s);
    const mirror = new THREE.Group();
    const shellGeo = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    shellGeo.rotateZ(-Math.PI / 2);
    const shell = new THREE.Mesh(shellGeo, m.paint);
    shell.scale.set(0.1, 0.058, 0.118);
    mirror.add(shell);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(1, 32), m.mirrorGlass);
    glass.scale.set(0.11, 0.053, 1);
    glass.rotation.y = -Math.PI / 2;
    glass.position.x = 0.002;
    mirror.add(glass);
    mirror.position.set(root.p.x - 0.03, 0.935, root.p.z + s * 0.14);
    g.add(mirror);
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.018, 0.13), m.carbon);
    stalk.position.set(root.p.x - 0.01, 0.905, root.p.z + s * 0.06);
    stalk.rotation.x = s * 0.35;
    g.add(stalk);
  }
  return g;
}

export { DIM };
