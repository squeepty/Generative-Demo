import * as THREE from 'three';
import { mulberry32 } from '../random.js';

const TAU = Math.PI * 2;

function normalizedDensity(density) {
  return THREE.MathUtils.clamp((density - 900) / (5200 - 900), 0, 1);
}

function samplePalette(colors, t) {
  const wrapped = ((t % 1) + 1) % 1;
  const scaled = wrapped * colors.length;
  const index = Math.floor(scaled) % colors.length;
  const nextIndex = (index + 1) % colors.length;

  return new THREE.Color(colors[index]).lerp(new THREE.Color(colors[nextIndex]), scaled - index);
}

function isInsideMainCardioidOrBulb(x, y) {
  const q = (x - 0.25) * (x - 0.25) + y * y;
  const inCardioid = q * (q + x - 0.25) <= 0.25 * y * y;
  const inBulb = (x + 1) * (x + 1) + y * y <= 0.0625;

  return inCardioid || inBulb;
}

function pointTargetForDensity(density) {
  const detail = normalizedDensity(density);
  return Math.round(THREE.MathUtils.lerp(26000, 170000, detail));
}

function buildOrbitCloud(state, palette) {
  const random = mulberry32(state.seed + 1447);
  const detail = normalizedDensity(state.density);
  const target = pointTargetForDensity(state.density);
  const maxIterations = Math.round(THREE.MathUtils.lerp(62, 138, detail));
  const positions = new Float32Array(target * 3);
  const colors = new Float32Array(target * 3);
  const sizes = new Float32Array(target);
  const phases = new Float32Array(target);
  const orbitX = new Float32Array(maxIterations);
  const orbitY = new Float32Array(maxIterations);
  let written = 0;
  let attempts = 0;

  while (written < target && attempts < target * 4) {
    attempts += 1;

    const focusSample = random() < 0.58;
    const angle = random() * TAU;
    const radius = focusSample ? Math.pow(random(), 0.55) * 1.58 : random() * 1.9;
    const cX = focusSample ? -0.62 + Math.cos(angle) * radius : -2.18 + random() * 3.45;
    const cY = focusSample ? Math.sin(angle) * radius * 0.82 : (random() - 0.5) * 2.9;

    if (isInsideMainCardioidOrBulb(cX, cY)) {
      continue;
    }

    let x = 0;
    let y = 0;
    let escapedAt = 0;

    for (let i = 0; i < maxIterations; i += 1) {
      const nextX = x * x - y * y + cX;
      const nextY = 2 * x * y + cY;
      x = nextX;
      y = nextY;
      orbitX[i] = x;
      orbitY[i] = y;

      if (x * x + y * y > 16) {
        escapedAt = i + 1;
        break;
      }
    }

    if (!escapedAt || escapedAt < 8) {
      continue;
    }

    const skip = Math.max(2, Math.floor(escapedAt * 0.08));
    const escapeBand = escapedAt / maxIterations;

    for (let i = skip; i < escapedAt && written < target; i += 1) {
      const zx = orbitX[i];
      const zy = orbitY[i];

      if (zx < -2.28 || zx > 1.24 || Math.abs(zy) > 1.58) {
        continue;
      }

      const progress = i / Math.max(escapedAt - 1, 1);
      const mappedX = (zx + 0.52) * 1.88;
      const mappedY = zy * 1.88;
      const radiusFromCenter = Math.hypot(mappedX, mappedY);
      const color = samplePalette(
        palette.colors,
        escapeBand * 0.72 + progress * 0.2 + Math.atan2(zy, zx + 0.48) / TAU
      ).multiplyScalar(0.36 + escapeBand * 0.65 + random() * 0.25);

      positions[written * 3] = mappedX + (random() - 0.5) * 0.018;
      positions[written * 3 + 1] = mappedY + (random() - 0.5) * 0.018;
      positions[written * 3 + 2] = (escapeBand - 0.5) * 0.42 + Math.sin(progress * TAU) * 0.035;
      colors[written * 3] = color.r;
      colors[written * 3 + 1] = color.g;
      colors[written * 3 + 2] = color.b;
      sizes[written] = THREE.MathUtils.lerp(1.3, 5.2, 1 - Math.min(radiusFromCenter / 4.0, 1)) + random() * 2.4;
      phases[written] = progress * TAU + escapeBand * 6.0 + random() * 0.6;
      written += 1;
    }
  }

  return {
    positions: positions.slice(0, written * 3),
    colors: colors.slice(0, written * 3),
    sizes: sizes.slice(0, written),
    phases: phases.slice(0, written)
  };
}

function createNebulaCloud({ renderer, state, buffers }) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(buffers.colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(buffers.sizes, 1));
  geometry.setAttribute('phase', new THREE.BufferAttribute(buffers.phases, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms: {
      uTime: { value: 0 },
      uFlow: { value: state.flow },
      uBloom: { value: state.bloom },
      uPixelRatio: { value: renderer.getPixelRatio() }
    },
    vertexShader: `
      attribute float size;
      attribute float phase;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uTime;
      uniform float uFlow;
      uniform float uPixelRatio;

      void main() {
        vColor = color;
        vec3 p = position;
        float pulse = sin(phase * 2.0 + uTime * (0.22 + uFlow * 0.72));
        p.xy += vec2(cos(phase + uTime * 0.1), sin(phase * 1.3 - uTime * 0.12)) * 0.035 * uFlow;
        p.z += pulse * 0.08 * uFlow;

        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = size * uPixelRatio * (6.0 / -mvPosition.z);
        vAlpha = 0.22 + abs(pulse) * 0.42;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uBloom;

      void main() {
        vec2 center = gl_PointCoord - vec2(0.5);
        float distanceFromCenter = length(center);
        float core = smoothstep(0.5, 0.03, distanceFromCenter);
        float halo = smoothstep(0.5, 0.0, distanceFromCenter);
        float alpha = (core * 0.52 + halo * (0.16 + uBloom * 0.22)) * vAlpha;
        gl_FragColor = vec4(vColor * (1.0 + uBloom * 1.15), alpha);
      }
    `
  });

  const object = new THREE.Points(geometry, material);
  object.frustumCulled = false;

  return {
    object,
    resize(pixelRatio) {
      material.uniforms.uPixelRatio.value = pixelRatio;
    },
    update(elapsed, nextState) {
      material.uniforms.uTime.value = elapsed;
      material.uniforms.uFlow.value = nextState.flow;
      material.uniforms.uBloom.value = nextState.bloom;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

export const nebulabrot = {
  id: 'nebulabrot',
  label: 'Nebulabrot',
  math: {
    summary:
      'Escaping Mandelbrot orbits are accumulated as luminous points. Instead of coloring c itself, the sketch plots the trail of every escaping z value, producing a nebula-like Buddhabrot view.',
    rows: [
      {
        label: 'Orbit',
        body: 'z[0] = 0; z[n+1] = z[n]^2 + c; keep the orbit only when it eventually escapes.'
      },
      {
        label: 'Accumulation',
        body: 'Each escaped orbit contributes its intermediate z positions to a glowing point-density cloud.'
      },
      {
        label: 'Color',
        body: 'Escape time, orbit progress, and angle choose the palette band; density controls sample count and maximum iterations.'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const buffers = buildOrbitCloud(state, palette);
    const cloud = createNebulaCloud({ renderer, state, buffers });

    const applyResponsiveTransform = (zoom) => {
      const isPortrait = renderer.domElement.height > renderer.domElement.width;
      cloud.object.scale.setScalar((zoom ?? 1) * (isPortrait ? 0.72 : 1));
      cloud.object.position.y = isPortrait ? 0.36 : 0;
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
        cloud.object.rotation.z = Math.sin(elapsed * 0.08) * nextState.flow * 0.035;
      },
      dispose() {
        cloud.dispose();
      }
    };
  }
};
