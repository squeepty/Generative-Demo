import * as THREE from 'three';
import { createPointCloudSketch } from '../pointCloudSketch.js';
import { mulberry32 } from '../random.js';

const TAU = Math.PI * 2;
const PARAMETER_PRESETS = [
  { a: -1.4, b: 1.6, c: 1.0, d: 0.7 },
  { a: -1.7, b: 1.8, c: -1.9, d: -0.4 },
  { a: 1.7, b: 1.7, c: 0.6, d: 1.2 },
  { a: -1.9, b: -1.9, c: -1.2, d: -0.7 },
  { a: 1.5, b: -1.8, c: 1.6, d: 0.9 }
];

function pointCountForDensity(density) {
  return Math.round(THREE.MathUtils.clamp(density * 3.2, 3200, 19000));
}

function parametersForSeed(seed) {
  const random = mulberry32(seed + 3109);
  const preset = PARAMETER_PRESETS[Math.floor(random() * PARAMETER_PRESETS.length)];
  const jitter = () => (random() - 0.5) * 0.08;

  return {
    a: preset.a + jitter(),
    b: preset.b + jitter(),
    c: preset.c + jitter(),
    d: preset.d + jitter()
  };
}

function samplePalette(colors, t) {
  const wrapped = ((t % 1) + 1) % 1;
  const scaled = wrapped * colors.length;
  const index = Math.floor(scaled) % colors.length;
  const nextIndex = (index + 1) % colors.length;

  return new THREE.Color(colors[index]).lerp(new THREE.Color(colors[nextIndex]), scaled - index);
}

export const cliffordAttractor = {
  id: 'clifford-attractor',
  label: 'Clifford Attractor',
  math: {
    summary:
      'The Clifford attractor repeatedly applies a nonlinear 2D map. The orbit never repeats, but it settles into a bounded strange attractor with dense folded structure.',
    rows: [
      {
        label: 'Iteration',
        body: 'x[n+1] = sin(a*y[n]) + c*cos(a*x[n]); y[n+1] = sin(b*x[n]) + d*cos(b*y[n])'
      },
      {
        label: 'Parameters',
        body: 'Seeded values near classic chaotic sets choose a, b, c, and d; tiny changes can reshape the attractor.'
      },
      {
        label: 'Embedding',
        body: 'The 2D orbit is normalized, colored by angle and visit order, then lifted with a shallow sinusoidal z ripple.'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const random = mulberry32(state.seed + 3119);
    const params = parametersForSeed(state.seed);
    const count = pointCountForDensity(state.density);
    const rawX = new Float32Array(count);
    const rawY = new Float32Array(count);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    let x = random() * 0.8 - 0.4;
    let y = random() * 0.8 - 0.4;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const warmup = 480;

    for (let i = 0; i < count + warmup; i += 1) {
      const nextX = Math.sin(params.a * y) + params.c * Math.cos(params.a * x);
      const nextY = Math.sin(params.b * x) + params.d * Math.cos(params.b * y);
      x = nextX;
      y = nextY;

      if (i < warmup) {
        continue;
      }

      const pointIndex = i - warmup;
      rawX[pointIndex] = x;
      rawY[pointIndex] = y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    const centerX = (minX + maxX) * 0.5;
    const centerY = (minY + maxY) * 0.5;
    const scale = 5.25 / Math.max(maxX - minX, maxY - minY, 0.001);

    for (let i = 0; i < count; i += 1) {
      const nx = (rawX[i] - centerX) * scale;
      const ny = (rawY[i] - centerY) * scale;
      const progress = i / Math.max(count - 1, 1);
      const radius = Math.hypot(nx, ny);
      const angle = Math.atan2(ny, nx);
      const z = Math.sin(nx * 1.7 + ny * 1.25 + progress * TAU * 7) * 0.12;
      const color = samplePalette(
        palette.colors,
        angle / TAU + radius * 0.09 + progress * 0.38
      ).multiplyScalar(0.76 + random() * 0.5);

      positions[i * 3] = nx + (random() - 0.5) * 0.01;
      positions[i * 3 + 1] = ny + (random() - 0.5) * 0.01;
      positions[i * 3 + 2] = z;
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      sizes[i] = 2.2 + random() * 7.6;
      phases[i] = progress * TAU + radius * 0.35 + random() * 0.45;
    }

    const cloud = createPointCloudSketch({
      renderer,
      positions,
      colors,
      sizes,
      phases,
      state,
      motion: {
        baseX: -0.12,
        baseZ: 0.04,
        spinY: 0.018,
        flowSpinY: 0.052,
        tilt: 0.07,
        tiltSpeed: 0.17,
        roll: 0.035,
        rollSpeed: 0.12
      }
    });

    const applyResponsiveTransform = (zoom) => {
      const isPortrait = renderer.domElement.height > renderer.domElement.width;
      cloud.object.scale.setScalar((zoom ?? 1) * (isPortrait ? 0.72 : 1));
      cloud.object.position.y = isPortrait ? 0.42 : 0;
    };

    applyResponsiveTransform(state.zoom);

    return {
      object: cloud.object,
      resize(pixelRatio) {
        cloud.resize(pixelRatio);
        applyResponsiveTransform(state.zoom);
      },
      update(elapsed, nextState) {
        cloud.update(elapsed, nextState);
        applyResponsiveTransform(nextState.zoom);
      },
      dispose() {
        cloud.dispose();
      }
    };
  }
};
