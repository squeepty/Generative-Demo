import * as THREE from 'three';
import { mulberry32 } from '../random.js';

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function normalizedDensity(density) {
  return THREE.MathUtils.clamp((density - 900) / (5200 - 900), 0, 1);
}

function fiberCountForDensity(density) {
  return Math.round(THREE.MathUtils.lerp(24, 58, normalizedDensity(density)));
}

function samplePalette(colors, t) {
  const wrapped = ((t % 1) + 1) % 1;
  const scaled = wrapped * colors.length;
  const index = Math.floor(scaled) % colors.length;
  const nextIndex = (index + 1) % colors.length;

  return new THREE.Color(colors[index]).lerp(new THREE.Color(colors[nextIndex]), scaled - index);
}

function fiberPoints(theta, phi, phase, segments) {
  const points = [];
  const cosHalf = Math.cos(theta * 0.5);
  const sinHalf = Math.sin(theta * 0.5);

  for (let i = 0; i <= segments; i += 1) {
    const eta = i / segments * TAU + phase;
    const a = (phi + eta) * 0.5;
    const b = (phi - eta) * 0.5;
    const x1 = cosHalf * Math.cos(a);
    const x2 = cosHalf * Math.sin(a);
    const x3 = sinHalf * Math.cos(b);
    const x4 = sinHalf * Math.sin(b);
    const denominator = 1.18 - x4 * 0.92;

    points.push(
      new THREE.Vector3(x1 / denominator, x2 / denominator, x3 / denominator).multiplyScalar(2.15)
    );
  }

  return points;
}

export const hopfFibration = {
  id: 'hopf-fibration',
  label: 'Hopf Fibration',
  math: {
    summary:
      'The Hopf fibration decomposes the 3-sphere into linked circles. Stereographic projection brings those fibers into ordinary 3D space as interlocked loops.',
    rows: [
      {
        label: 'Domain',
        body: 'Points on S^3 are represented as two complex numbers (z1, z2) with |z1|^2 + |z2|^2 = 1.'
      },
      {
        label: 'Fiber',
        body: 'Changing a shared phase eta traces a circle while the base point on S^2 stays fixed.'
      },
      {
        label: 'Projection',
        body: '(x1,x2,x3,x4) in S^3 maps to R^3 by stereographic projection: p = (x1,x2,x3)/(1 - x4).'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const random = mulberry32(state.seed + 2803);
    const detail = normalizedDensity(state.density);
    const fiberCount = fiberCountForDensity(state.density);
    const segments = Math.round(THREE.MathUtils.lerp(72, 112, detail));
    const tubeRadius = THREE.MathUtils.lerp(0.012, 0.019, detail);
    const object = new THREE.Group();
    const geometries = [];
    const materials = [];
    const phaseOffset = random() * TAU;

    for (let i = 0; i < fiberCount; i += 1) {
      const y = 1 - (i + 0.5) * 2 / fiberCount;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = i * GOLDEN_ANGLE + phaseOffset;
      const baseX = Math.cos(phi) * radius;
      const baseY = Math.sin(phi) * radius;
      const baseZ = y * 0.94;
      const theta = Math.acos(THREE.MathUtils.clamp(baseZ, -0.98, 0.98));
      const points = fiberPoints(theta, Math.atan2(baseY, baseX), random() * TAU, segments);
      const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
      const geometry = new THREE.TubeGeometry(curve, segments, tubeRadius, 7, true);
      const color = samplePalette(
        palette.colors,
        i / fiberCount * 0.78 + Math.atan2(baseY, baseX) / TAU * 0.22
      ).multiplyScalar(0.92 + random() * 0.24);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.44 + state.bloom * 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geometry, material);

      geometries.push(geometry);
      materials.push(material);
      object.add(mesh);
    }

    const applyResponsiveTransform = (zoom) => {
      const isPortrait = renderer.domElement.height > renderer.domElement.width;
      object.scale.setScalar((zoom ?? 1) * (isPortrait ? 0.58 : 0.82));
      object.position.y = isPortrait ? 0.56 : 0;
    };

    applyResponsiveTransform(state.zoom);

    return {
      object,
      resize() {
        applyResponsiveTransform(state.zoom);
      },
      update(elapsed, nextState) {
        applyResponsiveTransform(nextState.zoom);

        for (let i = 0; i < materials.length; i += 1) {
          materials[i].opacity = 0.34 + nextState.bloom * 0.34 + Math.sin(elapsed * 0.7 + i) * 0.035;
        }

        object.rotation.x = -0.42 + Math.sin(elapsed * 0.12) * 0.16;
        object.rotation.y = elapsed * (0.03 + nextState.flow * 0.085);
        object.rotation.z = 0.22 + Math.cos(elapsed * 0.09) * 0.12;
      },
      dispose() {
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
      }
    };
  }
};
