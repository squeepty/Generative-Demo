import * as THREE from 'three';
import { createPointCloudSketch } from '../pointCloudSketch.js';
import { mulberry32 } from '../random.js';

const TAU = Math.PI * 2;

function normalizedDensity(density) {
  return THREE.MathUtils.clamp((density - 900) / (5200 - 900), 0, 1);
}

function pointCountForDensity(density) {
  return Math.round(THREE.MathUtils.lerp(7800, 52000, normalizedDensity(density)));
}

function samplePalette(colors, t) {
  const wrapped = ((t % 1) + 1) % 1;
  const scaled = wrapped * colors.length;
  const index = Math.floor(scaled) % colors.length;
  const nextIndex = (index + 1) % colors.length;

  return new THREE.Color(colors[index]).lerp(new THREE.Color(colors[nextIndex]), scaled - index);
}

function rotateAroundAxis(vector, axis, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dot = vector.dot(axis);
  const cross = new THREE.Vector3().crossVectors(axis, vector);

  return vector
    .clone()
    .multiplyScalar(cos)
    .add(cross.multiplyScalar(sin))
    .add(axis.clone().multiplyScalar(dot * (1 - cos)));
}

function buildGenerators(random) {
  const centerRadius = 1.22 + random() * 0.16;
  const rotation = new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI);
  const directions = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(1, 1, 1).normalize(),
    new THREE.Vector3(-1, -1, 1).normalize()
  ];

  return directions.map((direction, index) => {
    const axis = direction.clone().applyEuler(rotation).normalize();

    return {
      axis,
      center: axis.clone().multiplyScalar(centerRadius),
      radius: 0.82 + random() * 0.12 + (index > 5 ? 0.05 : 0),
      twist: (random() - 0.5) * 0.62
    };
  });
}

function buildLimitSet(state, palette) {
  const random = mulberry32(state.seed + 9737);
  const count = pointCountForDensity(state.density);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const generators = buildGenerators(random);
  const phaseOffset = random() * TAU;
  const warmup = 420;
  let p = new THREE.Vector3((random() - 0.5) * 0.6, (random() - 0.5) * 0.6, (random() - 0.5) * 0.6);
  let lastGenerator = -1;
  let written = 0;
  let attempts = 0;

  while (written < count && attempts < count * 10 + warmup) {
    attempts += 1;

    let generatorIndex = Math.floor(random() * generators.length);

    if (generatorIndex === lastGenerator) {
      generatorIndex = (generatorIndex + 1 + Math.floor(random() * (generators.length - 1))) % generators.length;
    }

    const generator = generators[generatorIndex];
    const diff = p.clone().sub(generator.center);
    const denominator = Math.max(diff.lengthSq(), 0.0012);
    const inversionScale = (generator.radius * generator.radius) / denominator;
    const twist = generator.twist + Math.sin(attempts * 0.0027 + phaseOffset) * 0.045;
    const rotated = rotateAroundAxis(diff, generator.axis, twist);
    const inverted = generator.center.clone().add(rotated.multiplyScalar(inversionScale));

    p = inverted.multiplyScalar(0.7).add(generator.center.clone().multiplyScalar(0.1));
    lastGenerator = generatorIndex;

    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z) || p.length() > 6.0) {
      p.set((random() - 0.5) * 0.75, (random() - 0.5) * 0.75, (random() - 0.5) * 0.75);
      lastGenerator = -1;
      continue;
    }

    if (attempts < warmup || p.length() > 3.8) {
      continue;
    }

    const radius = p.length();
    const azimuth = Math.atan2(p.z, p.x);
    const elevation = Math.atan2(p.y, Math.hypot(p.x, p.z));
    const shell = Math.abs(radius - 1.32);
    const band =
      generatorIndex / generators.length +
      azimuth / TAU * 0.2 +
      elevation * 0.08 +
      Math.log(radius + 0.25) * 0.1 +
      attempts * 0.00034;
    const color = samplePalette(palette.colors, band).multiplyScalar(
      0.32 + Math.min(inversionScale * 0.09, 0.36) + random() * 0.16
    );
    const scale = 1.38;

    positions[written * 3] = p.x * scale;
    positions[written * 3 + 1] = p.y * scale;
    positions[written * 3 + 2] = p.z * scale;
    colors[written * 3] = color.r;
    colors[written * 3 + 1] = color.g;
    colors[written * 3 + 2] = color.b;
    sizes[written] = 1.25 + random() * 4.6 + Math.min(inversionScale, 4.5) * 0.18 + Math.max(0, 0.16 - shell) * 3.2;
    phases[written] = azimuth + elevation * 1.7 + radius * 0.36 + generatorIndex * TAU / generators.length;
    written += 1;
  }

  return {
    positions: positions.slice(0, written * 3),
    colors: colors.slice(0, written * 3),
    sizes: sizes.slice(0, written),
    phases: phases.slice(0, written)
  };
}

export const kleinianSphereInversion = {
  id: 'kleinian-sphere-inversion',
  label: 'Kleinian Sphere Inversion',
  math: {
    summary:
      'A three-dimensional limit set sampled by repeatedly applying sphere inversions with small rotational twists. The points accumulate into nested pearl shells and tunnel-like chains.',
    rows: [
      {
        label: 'Sphere Inversion',
        body: 'pNew = center + r^2 * R(axis,theta) * (p - center) / |p - center|^2.'
      },
      {
        label: 'Generators',
        body: 'Inversion spheres are arranged around the coordinate axes and seeded diagonal directions.'
      },
      {
        label: 'Limit Set',
        body: 'A random walk through the generators keeps points that remain bounded after warmup.'
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
        baseX: -0.16,
        baseZ: 0.02,
        spinY: 0.016,
        flowSpinY: 0.055,
        tilt: 0.1,
        tiltSpeed: 0.13,
        roll: 0.045,
        rollSpeed: 0.1
      }
    });

    const applyResponsiveTransform = (zoom) => {
      const isPortrait = renderer.domElement.height > renderer.domElement.width;
      cloud.object.scale.setScalar((zoom ?? 1) * (isPortrait ? 0.82 : 1.24));
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
