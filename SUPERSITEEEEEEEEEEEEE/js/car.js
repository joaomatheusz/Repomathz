// Porsche 911 GT3 RS (992): materials and assembly.
import * as THREE from 'three';
import { DIM, buildBody } from './body.js';
import { buildWheel, buildLights, buildWing, buildDetails } from './parts.js';

// Paint shader that also draws windows and their rubber frames from the
// body's aGlass mask, so the glass edges stay crisp at any mesh density.
function withGlassMask(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aGlass;
        varying float vGlass;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vGlass = aGlass - 1.0;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vGlass;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        float gW = max(fwidth(vGlass), 1e-4);
        float gMask = clamp(vGlass / gW + 0.5, 0.0, 1.0);
        float gFrame = clamp((vGlass + 0.02) / gW + 0.5, 0.0, 1.0) * (1.0 - gMask);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.004), max(gMask, gFrame));
        roughnessFactor = mix(roughnessFactor, 0.03, gMask);
        roughnessFactor = mix(roughnessFactor, 0.5, gFrame);
        metalnessFactor = mix(metalnessFactor, 0.6, gMask);
        metalnessFactor = mix(metalnessFactor, 0.0, gFrame);`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        #ifdef USE_CLEARCOAT
          material.clearcoat *= 1.0 - gFrame;
        #endif`);
  };
  mat.customProgramCacheKey = () => 'paint-glass';
  return mat;
}

export function createMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  return {
    paint: withGlassMask(phys({ color: 0x060607, roughness: 0.4, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 })),
    under: std({ color: 0x050505, roughness: 0.95, side: THREE.DoubleSide }),
    intake: std({ color: 0x060606, roughness: 0.85, side: THREE.DoubleSide }),
    seam: new THREE.MeshBasicMaterial({ color: 0x020202 }),
    carbon: phys({ color: 0x0d0d0e, roughness: 0.32, metalness: 0.2, clearcoat: 0.9, clearcoatRoughness: 0.06, side: THREE.DoubleSide }),
    tyre: std({ color: 0x111111, roughness: 0.9 }),
    rim: phys({ color: 0x151516, roughness: 0.35, metalness: 0.85, clearcoat: 0.5 }),
    rimLip: std({ color: 0x2a2a2c, roughness: 0.25, metalness: 1 }),
    rimInner: std({ color: 0x0a0a0a, roughness: 0.6, metalness: 0.6, side: THREE.DoubleSide }),
    nut: std({ color: 0x8a8a8a, roughness: 0.25, metalness: 1 }),
    chrome: std({ color: 0x9a9a9a, roughness: 0.15, metalness: 1 }),
    exhaust: std({ color: 0x3a3632, roughness: 0.35, metalness: 1, side: THREE.DoubleSide }),
    disc: std({ color: 0x4a4a4a, roughness: 0.45, metalness: 0.9 }),
    caliper: phys({ color: 0xf2c200, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
    bezel: std({ color: 0x1a1a1c, roughness: 0.2, metalness: 1 }),
    reflector: std({ color: 0x0c0c0e, roughness: 0.3, metalness: 0.8 }),
    lens: phys({ color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.12, clearcoat: 1, depthWrite: false }),
    mirrorGlass: std({ color: 0x222428, roughness: 0.02, metalness: 1 }),
    smoked: phys({ color: 0x120404, roughness: 0.08, metalness: 0.3, clearcoat: 1 }),
    drl: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 1.2, 1.3) }),
    tail: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.12, 0.08) }),
  };
}

export function createCar() {
  const materials = createMaterials();
  const car = new THREE.Group();
  car.name = 'gt3rs';

  car.add(buildBody(materials));
  const wing = buildWing(materials);
  wing.name = 'wing';
  car.add(wing);
  car.add(buildDetails(materials));
  const lights = buildLights(materials);
  car.add(lights);

  const wheels = [];
  for (const spec of [DIM.front, DIM.rear]) {
    for (const s of [-1, 1]) {
      const w = buildWheel(spec, materials);
      w.position.set(spec.x, spec.y, s * spec.track);
      if (s < 0) w.rotation.y = Math.PI;
      car.add(w);
      wheels.push(w);
    }
  }

  return { car, materials, wheels, lights };
}
