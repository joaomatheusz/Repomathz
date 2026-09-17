// Body shell of the 911 GT3 RS (992) plus helpers that sample its surface,
// so every detail part can sit exactly on the skin.
// Units are metres. +X points to the nose, +Y up, Z across the car.
import * as THREE from 'three';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));

// Piecewise cubic through [x, y] pairs (Catmull-Rom tangents).
function table(pairs) {
  const p = [...pairs].sort((a, b) => a[0] - b[0]);
  const n = p.length;
  const m = p.map((_, i) => {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)];
    return (b[1] - a[1]) / (b[0] - a[0] || 1);
  });
  return (x) => {
    if (x <= p[0][0]) return p[0][1];
    if (x >= p[n - 1][0]) return p[n - 1][1];
    let i = 0;
    while (x > p[i + 1][0]) i++;
    const [x0, y0] = p[i], [x1, y1] = p[i + 1];
    const h = x1 - x0, t = (x - x0) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m[i + 1];
  };
}

const catmull = (p0, p1, p2, p3, t) => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

// ---------- proportions (992 GT3 RS: 4572 long, 1900 wide, 1322 tall, 2457 wheelbase) ----------
export const DIM = {
  nose: 2.29, tail: -2.29,
  front: { x: 1.33, y: 0.35, r: 0.35, width: 0.275, track: 0.8, arch: 0.385 },
  rear: { x: -1.127, y: 0.368, r: 0.368, width: 0.335, track: 0.79, arch: 0.405 },
};

// centreline: bumper, hood, windshield, roof, rear window, ducktail
export const yTop = table([
  [2.29, 0.4], [2.25, 0.47], [2.18, 0.535], [2.1, 0.565], [1.9, 0.605], [1.6, 0.655],
  [1.3, 0.705], [1.0, 0.755], [0.8, 0.79], [0.66, 0.815], [0.45, 0.955], [0.2, 1.12],
  [-0.05, 1.235], [-0.3, 1.29], [-0.5, 1.305], [-0.75, 1.285], [-1.0, 1.215], [-1.3, 1.1],
  [-1.6, 0.99], [-1.85, 0.93], [-2.05, 0.9], [-2.18, 0.885], [-2.24, 0.84], [-2.27, 0.76], [-2.29, 0.66],
]);
// front fender crest -> beltline -> rear haunch crest
export const yCrest = table([
  [2.29, 0.42], [2.25, 0.54], [2.19, 0.645], [2.12, 0.71], [2.02, 0.75], [1.85, 0.78], [1.6, 0.81], [1.33, 0.83],
  [1.05, 0.815], [0.8, 0.8], [0.55, 0.815], [0.0, 0.835], [-0.5, 0.86], [-0.9, 0.905],
  [-1.127, 0.945], [-1.45, 0.955], [-1.75, 0.93], [-2.0, 0.89], [-2.18, 0.86], [-2.26, 0.78], [-2.29, 0.64],
]);
export const halfW = table([
  [2.29, 0.62], [2.26, 0.74], [2.2, 0.83], [2.1, 0.875], [1.9, 0.905], [1.6, 0.925], [1.33, 0.935],
  [1.05, 0.915], [0.7, 0.895], [0.2, 0.895], [-0.4, 0.905], [-0.8, 0.935], [-1.127, 0.965],
  [-1.5, 0.962], [-1.9, 0.94], [-2.1, 0.91], [-2.22, 0.87], [-2.29, 0.8],
]);
const yBase = table([
  [2.29, 0.22], [2.2, 0.14], [1.9, 0.12], [-1.8, 0.12], [-2.1, 0.17], [-2.29, 0.3],
]);

export function yBottom(x) {
  let y = yBase(x);
  for (const w of [DIM.front, DIM.rear]) {
    const d = x - w.x;
    if (Math.abs(d) < w.arch) y = Math.max(y, w.y + Math.sqrt(w.arch * w.arch - d * d));
  }
  return y;
}

// 0 = hood / engine lid, 1 = greenhouse
export const cabin = (x) => smooth(0.8, 0.52, x) * smooth(-1.78, -1.2, x);

// plan-view rounding: nose corners pulled back, tail corners pulled forward
export function bend(x, z) {
  const f = smooth(2.0, 2.29, x) * 0.11 - smooth(-2.05, -2.29, x) * 0.07;
  return f * Math.min(1, (z / 0.9) ** 2);
}

function halfSection(x) {
  const hw = halfW(x), yf = yCrest(x), yt = yTop(x), c = cabin(x);
  const yb = Math.min(yBottom(x), yf - 0.1);
  const yS = yf - 0.075;
  const flare = 0.02 * gauss(x, DIM.front.x, 0.32) + 0.03 * gauss(x, DIM.rear.x, 0.42);
  const fast = smooth(-0.7, -1.55, x);
  return [
    [hw - 0.07, yb],
    [hw - 0.012, lerp(yb, yS, 0.3)],
    [hw + flare, lerp(yb, yS, 0.78)],
    [hw - 0.018 + flare * 0.5, yS + 0.03],
    [hw - 0.075, yf - 0.012],
    [lerp(hw - 0.17, hw - 0.16, c), lerp(yf, yf + 0.03, c)],
    [lerp(hw - 0.32, 0.66 - 0.08 * fast, c), lerp(lerp(yf, yt, 0.8), lerp(yf, yt, 0.6), c)],
    [lerp(hw - 0.46, 0.44 - 0.09 * fast, c), lerp(yt + 0.006, yt - 0.012, c)],
    [0, yt],
  ];
}

const SEG = 8;
const HALF = 9;

// full section [z, y] from left rocker over the roof to right rocker (unbent)
export function section(x) {
  const h = halfSection(x);
  const ctrl = [];
  for (let k = 0; k < HALF; k++) ctrl.push([-h[k][0], h[k][1]]);
  for (let k = HALF - 2; k >= 0; k--) ctrl.push([h[k][0], h[k][1]]);
  const out = [];
  const last = ctrl.length - 1;
  for (let s = 0; s < last; s++) {
    const a = ctrl[Math.max(0, s - 1)], b = ctrl[s], c = ctrl[s + 1], d = ctrl[Math.min(last, s + 2)];
    for (let k = 0; k < SEG; k++) {
      const t = k / SEG;
      out.push([catmull(a[0], b[0], c[0], d[0], t), catmull(a[1], b[1], c[1], d[1], t)]);
    }
  }
  out.push(ctrl[last]);
  return out;
}

// ---------- rings: main stations plus rounded closures at nose and tail ----------
let RINGS = null;
function rings() {
  if (RINGS) return RINGS;
  const list = [];
  const closure = (x0, dir, depth) => {
    const base = section(x0);
    const cy = base.reduce((s, p) => s + p[1], 0) / base.length;
    const out = [];
    for (let k = 1; k <= 5; k++) {
      const a = (k / 5) * (Math.PI / 2);
      const sc = 1 - 0.9 * (1 - Math.cos(a));
      out.push({ x: x0 + dir * depth * Math.sin(a), bendX: x0, pts: base.map(([z, y]) => [z * sc, cy + (y - cy) * sc]) });
    }
    return out;
  };
  list.push(...closure(DIM.tail, -1, 0.03).reverse());
  for (let x = DIM.tail; x <= DIM.nose + 1e-6; x += 0.01) {
    const xx = Math.min(x, DIM.nose);
    list.push({ x: xx, bendX: xx, pts: section(xx) });
  }
  list.push(...closure(DIM.nose, 1, 0.028));
  RINGS = list;
  return list;
}

// ---------- surface sampling ----------
// y on the upper surface at (x, z), searching from the roof centre outwards
function topY(x, z) {
  const pts = section(x);
  const mid = (pts.length - 1) / 2;
  const az = Math.abs(z);
  for (let j = mid; j < pts.length - 1; j++) {
    const a = pts[j], b = pts[j + 1];
    if (b[0] < a[0]) return a[1];
    if (az >= a[0] && az <= b[0]) return lerp(a[1], b[1], (az - a[0]) / (b[0] - a[0] || 1));
  }
  return pts[pts.length - 1][1];
}

// outermost z on the right flank at height y
function sideZ(x, y) {
  const pts = section(x);
  const mid = (pts.length - 1) / 2;
  let best = 0;
  for (let j = mid; j < pts.length - 1; j++) {
    const a = pts[j], b = pts[j + 1];
    if ((y - a[1]) * (y - b[1]) <= 0 && a[1] !== b[1]) {
      best = Math.max(best, lerp(a[0], b[0], (y - a[1]) / (b[1] - a[1])));
    }
  }
  return best;
}

const E = 0.004;
export function topPoint(x, z) {
  const y = topY(x, z);
  const dx = (topY(x + E, z) - topY(x - E, z)) / (2 * E);
  const dz = (topY(x, z + E) - topY(x, z - E)) / (2 * E);
  return { p: new THREE.Vector3(x - bend(x, z), y, z), n: new THREE.Vector3(-dx, 1, -dz).normalize() };
}

export function sidePoint(x, y, sign = 1) {
  const z = sideZ(x, y);
  const dx = (sideZ(x + E, y) - sideZ(x - E, y)) / (2 * E);
  const dy = (sideZ(x, y + E) - sideZ(x, y - E)) / (2 * E);
  return { p: new THREE.Vector3(x - bend(x, z), y, z * sign), n: new THREE.Vector3(-dx, -dy, sign).normalize() };
}

// Point on the nose (end = 1) or tail (end = -1) surface at (y, z): walk the
// rings inwards and interpolate between the last one outside and the first inside.
export function endPoint(y, z, end = 1) {
  const list = rings();
  let prev = null;
  for (let k = 0; k < list.length; k++) {
    const r = list[end > 0 ? list.length - 1 - k : k];
    const d = sdPoly(z, y, r.pts);
    if (d <= 0) {
      if (!prev) return new THREE.Vector3(r.x - bend(r.bendX, z), y, z);
      const t = prev.d / (prev.d - d);
      return new THREE.Vector3(lerp(prev.x, r.x, t) - bend(lerp(prev.bendX, r.bendX, t), z), y, z);
    }
    prev = { d, x: r.x, bendX: r.bendX };
  }
  return new THREE.Vector3(end * 2.2, y, z);
}

// ---------- window outlines (signed distance, negative inside) ----------
function loop(ctrl, n) {
  const out = [];
  const N = ctrl.length;
  for (let s = 0; s < N; s++) {
    const a = ctrl[(s - 1 + N) % N], b = ctrl[s], c = ctrl[(s + 1) % N], d = ctrl[(s + 2) % N];
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push([catmull(a[0], b[0], c[0], d[0], t), catmull(a[1], b[1], c[1], d[1], t)]);
    }
  }
  return out;
}
const mirrorZ = (half) => [...half, ...half.slice(1, -1).reverse().map(([x, z]) => [x, -z])];

function sdPoly(px, py, poly) {
  let d = Infinity, s = 1;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[j];
    const ex = bx - ax, ey = by - ay, wx = px - ax, wy = py - ay;
    const h = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey || 1), 0, 1);
    const dx = wx - ex * h, dy = wy - ey * h;
    d = Math.min(d, dx * dx + dy * dy);
    const c1 = py >= ay, c2 = py < by, c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}
function sdSegment(px, py, ax, ay, bx, by) {
  const ex = bx - ax, ey = by - ay;
  const h = clamp(((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey), 0, 1);
  return Math.hypot(px - ax - ex * h, py - ay - ey * h);
}

// side daylight opening in (x, y)
const SIDE_DLO = loop([
  [0.46, 0.9], [0.2, 1.07], [-0.04, 1.2], [-0.36, 1.245], [-0.7, 1.225],
  [-0.98, 1.12], [-1.2, 0.96], [-0.95, 0.925], [-0.3, 0.905], [0.3, 0.892],
], 10);
// windshield and rear window in plan (x, z)
const WINDSHIELD = loop(mirrorZ([[0.66, 0], [0.63, 0.38], [0.55, 0.56], [0.3, 0.55], [0.04, 0.5], [-0.05, 0.3], [-0.06, 0]]), 8);
const REAR_WINDOW = loop(mirrorZ([[-0.88, 0], [-0.9, 0.34], [-1.02, 0.44], [-1.3, 0.43], [-1.5, 0.34], [-1.58, 0.17], [-1.6, 0]]), 8);

function glassValue(x, y, z, nz, ny) {
  let g = -1;
  if (Math.abs(nz) > 0.42) {
    const side = -sdPoly(x, y, SIDE_DLO);
    // thin divider between door glass and quarter glass
    const divider = sdSegment(x, y, -0.62, 0.9, -0.74, 1.24) - 0.011;
    g = Math.max(g, Math.min(side, divider));
  }
  if (ny > 0.6) {
    g = Math.max(g, -sdPoly(x, z, WINDSHIELD), -sdPoly(x, z, REAR_WINDOW));
  }
  return g;
}

// ---------- meshes ----------
export function buildBody(materials) {
  const list = rings();
  const NI = list.length, NJ = list[0].pts.length;
  const pos = new Float32Array(NI * NJ * 3);
  const glass = new Float32Array(NI * NJ);

  for (let i = 0; i < NI; i++) {
    const { x, bendX, pts } = list[i];
    for (let j = 0; j < NJ; j++) {
      const [z, y] = pts[j];
      const o = (i * NJ + j) * 3;
      pos[o] = x - bend(bendX, z); pos[o + 1] = y; pos[o + 2] = z;
      const a = pts[Math.max(0, j - 1)], b = pts[Math.min(NJ - 1, j + 1)];
      const tz = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tz, ty) || 1;
      glass[i * NJ + j] = glassValue(x, y, z, -ty / tl, tz / tl) + 1;
    }
  }

  const index = [];
  for (let i = 0; i < NI - 1; i++) {
    for (let j = 0; j < NJ - 1; j++) {
      const a = i * NJ + j, b = a + 1, c = a + NJ, d = c + 1;
      index.push(a, b, c, b, d, c);
    }
  }
  // end caps (fan to ring centre)
  const capVerts = [];
  const addCap = (i, flip) => {
    const base = pos.length / 3 + capVerts.length / 3;
    let cx = 0, cy = 0;
    for (let j = 0; j < NJ; j++) { cx += pos[(i * NJ + j) * 3]; cy += pos[(i * NJ + j) * 3 + 1]; }
    capVerts.push(cx / NJ, cy / NJ, 0);
    for (let j = 0; j < NJ; j++) {
      const a = i * NJ + j, b = i * NJ + ((j + 1) % NJ);
      if (flip) index.push(base, b, a); else index.push(base, a, b);
    }
  };
  addCap(NI - 1, false);
  addCap(0, true);

  const allPos = new Float32Array(pos.length + capVerts.length);
  allPos.set(pos);
  allPos.set(capVerts, pos.length);
  const allGlass = new Float32Array(glass.length + capVerts.length / 3);
  allGlass.set(glass);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(allPos, 3));
  geo.setAttribute('aGlass', new THREE.BufferAttribute(allGlass, 1));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, materials.paint);
  body.name = 'body';

  // underbody + wheel wells: flat strip rocker to rocker
  const upos = new Float32Array(NI * 6);
  const uidx = [];
  for (let i = 0; i < NI; i++) {
    const L = i * NJ, R = i * NJ + NJ - 1;
    upos.set([pos[L * 3], pos[L * 3 + 1], pos[L * 3 + 2], pos[R * 3], pos[R * 3 + 1], pos[R * 3 + 2]], i * 6);
    if (i < NI - 1) { const a = i * 2; uidx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const ugeo = new THREE.BufferGeometry();
  ugeo.setAttribute('position', new THREE.BufferAttribute(upos, 3));
  ugeo.setIndex(uidx);
  ugeo.computeVertexNormals();
  const under = new THREE.Mesh(ugeo, materials.under);

  const group = new THREE.Group();
  group.add(body, under);
  return group;
}
