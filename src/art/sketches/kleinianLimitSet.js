import * as THREE from 'three';
import { createPointCloudSketch } from '../pointCloudSketch.js';
import { mulberry32 } from '../random.js';

const TAU = Math.PI * 2;

function normalizedDensity(density) {
  return THREE.MathUtils.clamp((density - 900) / (5200 - 900), 0, 1);
}

function pointCountForDensity(density) {
  return Math.round(THREE.MathUtils.lerp(6200, 42000, normalizedDensity(density)));
}

function samplePalette(colors, t) {
  const wrapped = ((t % 1) + 1) % 1;
  const scaled = wrapped * colors.length;
  const index = Math.floor(scaled) % colors.length;
  const nextIndex = (index + 1) % colors.length;

  return new THREE.Color(colors[index]).lerp(new THREE.Color(colors[nextIndex]), scaled - index);
}

function buildLimitSet(state, palette) {
  const random = mulberry32(state.seed + 5387);
  const count = pointCountForDensity(state.density);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const generatorCount = 5 + Math.floor(random() * 2);
  const centerRadius = 1.26 + random() * 0.18;
  const inversionRadius = 0.9 + random() * 0.14;
  const phaseOffset = random() * TAU;
  const generators = Array.from({ length: generatorCount }, (_, index) => {
    const angle = phaseOffset + (index / generatorCount) * TAU;

    return {
      x: Math.cos(angle) * centerRadius,
      y: Math.sin(angle) * centerRadius,
      angle,
      twist: (random() - 0.5) * 0.42
    };
  });
  let x = (random() - 0.5) * 0.7;
  let y = (random() - 0.5) * 0.7;
  let lastGenerator = -1;
  let written = 0;
  let attempts = 0;
  const warmup = 360;

  while (written < count && attempts < count * 9 + warmup) {
    attempts += 1;

    let generatorIndex = Math.floor(random() * generatorCount);

    if (generatorIndex === lastGenerator) {
      generatorIndex = (generatorIndex + 1 + Math.floor(random() * (generatorCount - 1))) % generatorCount;
    }

    const generator = generators[generatorIndex];
    const dx = x - generator.x;
    const dy = y - generator.y;
    const denominator = Math.max(dx * dx + dy * dy, 0.0008);
    const inversionScale = (inversionRadius * inversionRadius) / denominator;
    const twist = generator.twist + Math.sin(attempts * 0.003 + phaseOffset) * 0.045;
    const c = Math.cos(twist);
    const s = Math.sin(twist);
    const invertedX = generator.x + inversionScale * (c * dx - s * dy);
    const invertedY = generator.y + inversionScale * (s * dx + c * dy);

    x = invertedX * 0.74 + generator.x * 0.1;
    y = invertedY * 0.74 + generator.y * 0.1;
    lastGenerator = generatorIndex;

    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) > 5.6) {
      x = (random() - 0.5) * 0.9;
      y = (random() - 0.5) * 0.9;
      lastGenerator = -1;
      continue;
    }

    if (attempts < warmup || Math.hypot(x, y) > 3.7) {
      continue;
    }

    const radius = Math.hypot(x, y);
    const angle = Math.atan2(y, x);
    const band = generatorIndex / generatorCount + Math.log(radius + 0.2) * 0.08;
    const color = samplePalette(palette.colors, band + attempts * 0.0004).multiplyScalar(
      0.34 + Math.min(inversionScale * 0.08, 0.34) + random() * 0.18
    );
    const z = Math.sin(angle * generatorCount + radius * 2.4) * 0.22 + (inversionScale - 1) * 0.035;

    positions[written * 3] = x * 1.64;
    positions[written * 3 + 1] = y * 1.64;
    positions[written * 3 + 2] = z;
    colors[written * 3] = color.r;
    colors[written * 3 + 1] = color.g;
    colors[written * 3 + 2] = color.b;
    sizes[written] = 1.35 + random() * 4.8 + Math.min(inversionScale, 4) * 0.18;
    phases[written] = angle + radius * 0.42 + generatorIndex * TAU / generatorCount;
    written += 1;
  }

  return {
    positions: positions.slice(0, written * 3),
    colors: colors.slice(0, written * 3),
    sizes: sizes.slice(0, written),
    phases: phases.slice(0, written)
  };
}

export const kleinianLimitSet = {
  id: 'kleinian-limit-set',
  label: 'Kleinian Limit Set',
  math: {
    summary:
      'Circle inversions act as Mobius-style generators. Random iteration of these generators accumulates the limit set: nested pearl chains where repeated inversions never settle into a single region.',
    rows: [
      {
        label: 'Inversion',
        body: 'pNew = center + r^2 * R(theta) * (p - center) / |p - center|^2'
      },
      {
        label: 'Generators',
        body: 'Several inversion circles form a discrete group; repeated generator choices trace the limit set.'
      },
      {
        label: 'Pearls',
        body: 'Point size and color respond to inversion scale, generator index, and orbit depth to reveal nested circular chains.'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const buffers = buildLimitSet(state, palette);
    const cloud = createPointCloudSketch({
      renderer,
      positions: buffers.positions,
      colors: buffers.colors,
      sizes: buffers.sizes,
      phases: buffers.phases,
      state,
      motion: {
        baseX: -0.18,
        baseZ: 0.04,
        spinY: 0.012,
        flowSpinY: 0.04,
        tilt: 0.08,
        tiltSpeed: 0.16,
        roll: 0.035,
        rollSpeed: 0.11
      }
    });

    const applyResponsiveTransform = (zoom) => {
      const isPortrait = renderer.domElement.height > renderer.domElement.width;
      cloud.object.scale.setScalar((zoom ?? 1) * (isPortrait ? 0.7 : 0.95));
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
