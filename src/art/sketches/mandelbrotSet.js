import * as THREE from 'three';
import { mulberry32 } from '../random.js';

const VIEW_PRESETS = [
  { center: [-0.5, 0], scale: 1.55 },
  { center: [-0.7435, 0.1314], scale: 0.052 },
  { center: [-0.7453, 0.1127], scale: 0.16 },
  { center: [-1.2507, 0.0201], scale: 0.24 },
  { center: [-0.1607, 1.0376], scale: 0.11 },
  { center: [0.274, 0.482], scale: 0.12 },
  { center: [-0.1011, 0.9563], scale: 0.19 },
  { center: [-1.768, 0.001], scale: 0.09 }
];

function makeColorUniforms(colors) {
  return colors.map((value) => new THREE.Color(value));
}

function normalizedDensity(density) {
  return THREE.MathUtils.clamp((density - 900) / (5200 - 900), 0, 1);
}

function seededView(seed) {
  const random = mulberry32(seed + 4217);
  const view = VIEW_PRESETS[Math.floor(random() * VIEW_PRESETS.length)];
  const jitterRadius = view.scale * (0.012 + random() * 0.02);
  const jitterAngle = random() * Math.PI * 2;

  return {
    center: new THREE.Vector2(
      view.center[0] + Math.cos(jitterAngle) * jitterRadius,
      view.center[1] + Math.sin(jitterAngle) * jitterRadius
    ),
    scale: view.scale * (0.9 + random() * 0.24),
    rotation: (random() - 0.5) * Math.PI * 0.04,
    phase: random() * Math.PI * 2
  };
}

export const mandelbrotSet = {
  id: 'mandelbrot-set',
  label: 'Mandelbrot Set',
  math: {
    summary:
      'The Mandelbrot set colors each complex coordinate c by iterating z -> z^2 + c from z = 0. The seed chooses a viewport across bulbs, antennae, and seahorse valleys.',
    rows: [
      {
        label: 'Iteration',
        body: 'z[0] = 0; z[n+1] = z[n]^2 + c, where each pixel supplies c.'
      },
      {
        label: 'Membership',
        body: 'If |z[n]| remains bounded for the iteration limit, c is treated as part of the filled Mandelbrot set.'
      },
      {
        label: 'Boundary',
        body: 'Smooth escape time plus the derivative dz/dc estimate edge distance, giving continuous bands near the fractal boundary.'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const paletteColors = makeColorUniforms(palette.colors);
    const view = seededView(state.seed);
    const geometry = new THREE.PlaneGeometry(16, 10, 1, 1);
    const material = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uFlow: { value: state.flow },
        uBloom: { value: state.bloom },
        uDetail: { value: normalizedDensity(state.density) },
        uZoom: { value: state.zoom },
        uCenter: { value: view.center },
        uScale: { value: view.scale },
        uRotation: { value: view.rotation },
        uSeedPhase: { value: view.phase },
        uResolution: {
          value: new THREE.Vector2(renderer.domElement.width, renderer.domElement.height)
        },
        uColor0: { value: paletteColors[0] },
        uColor1: { value: paletteColors[1] },
        uColor2: { value: paletteColors[2] },
        uColor3: { value: paletteColors[3] }
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;

        varying vec2 vUv;
        uniform float uTime;
        uniform float uFlow;
        uniform float uBloom;
        uniform float uDetail;
        uniform float uZoom;
        uniform float uScale;
        uniform float uRotation;
        uniform float uSeedPhase;
        uniform vec2 uCenter;
        uniform vec2 uResolution;
        uniform vec3 uColor0;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;

        const int MAX_ITERATIONS = 240;
        const float TAU = 6.28318530718;

        mat2 rotate2d(float angle) {
          float s = sin(angle);
          float c = cos(angle);
          return mat2(c, -s, s, c);
        }

        vec2 complexSquare(vec2 z) {
          return vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
        }

        vec2 complexMultiply(vec2 a, vec2 b) {
          return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
        }

        vec3 paletteRamp(float t) {
          t = fract(t);

          if (t < 0.33) {
            return mix(uColor0, uColor1, smoothstep(0.0, 0.33, t));
          }

          if (t < 0.66) {
            return mix(uColor1, uColor2, smoothstep(0.33, 0.66, t));
          }

          return mix(uColor2, uColor3, smoothstep(0.66, 1.0, t));
        }

        float analyticInterior(vec2 c) {
          float x = c.x;
          float y = c.y;
          float q = (x - 0.25) * (x - 0.25) + y * y;
          float cardioid = 1.0 - step(0.25 * y * y, q * (q + x - 0.25));
          float bulb = 1.0 - step(0.0625, (x + 1.0) * (x + 1.0) + y * y);

          return max(cardioid, bulb);
        }

        void main() {
          vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
          float portrait = step(uResolution.x, uResolution.y);
          uv.y -= portrait * 0.15;

          float phase = uSeedPhase + uTime * (0.035 + uFlow * 0.12);
          float breathing = 1.0 + sin(phase * 0.72) * 0.035 * uFlow;
          vec2 drift = vec2(cos(phase), sin(phase * 1.31)) * uScale * 0.022 * uFlow;
          vec2 p = rotate2d(uRotation) * uv;
          vec2 c = uCenter + p * uScale * breathing / max(uZoom, 0.001) + drift;
          vec2 z = vec2(0.0);
          vec2 dz = vec2(0.0);
          vec2 trapFocus = vec2(cos(phase * 0.68), sin(phase * 0.91)) * 0.38;
          float iterationLimit = mix(96.0, 224.0, uDetail);
          float escaped = 0.0;
          float escapeTime = iterationLimit;
          float distanceEstimate = 0.0;
          float orbitTrap = 10.0;
          float axisTrap = 10.0;

          for (int i = 0; i < MAX_ITERATIONS; i++) {
            if (float(i) >= iterationLimit) {
              break;
            }

            dz = 2.0 * complexMultiply(z, dz) + vec2(1.0, 0.0);
            z = complexSquare(z) + c;

            orbitTrap = min(orbitTrap, length(z - trapFocus));
            axisTrap = min(axisTrap, min(abs(z.x), abs(z.y)));

            float radius2 = dot(z, z);

            if (radius2 > 256.0) {
              float radius = sqrt(radius2);
              float smoothEscape = float(i) + 1.0 - log(log(max(radius, 1.0001))) / log(2.0);
              escapeTime = smoothEscape;
              distanceEstimate = 0.5 * log(radius) * radius / max(length(dz), 0.0001);
              escaped = 1.0;
              break;
            }
          }

          float inside = max(1.0 - escaped, analyticInterior(c));
          float normalizedEscape = clamp(escapeTime / iterationLimit, 0.0, 1.0);
          float distanceGlow = escaped * exp(-distanceEstimate * mix(36.0, 84.0, uDetail));
          float orbitGlow = exp(-orbitTrap * mix(2.4, 5.8, uDetail));
          float axisGlow = exp(-axisTrap * mix(12.0, 28.0, uDetail));
          float band = 0.5 + 0.5 * cos(escapeTime * 0.26 - log(max(distanceEstimate, 0.00001)) * 0.2);
          float exteriorStrength = escaped * (0.2 + normalizedEscape * 0.92);
          vec3 background = mix(vec3(0.006, 0.007, 0.011), vec3(0.032, 0.024, 0.028), smoothstep(-1.0, 0.9, uv.y));
          vec3 exterior = paletteRamp(normalizedEscape * 1.18 + band * 0.12 + uTime * 0.005);
          vec3 core = paletteRamp(axisTrap * 0.74 + orbitTrap * 0.12 + uSeedPhase * 0.04);
          vec3 color = background;

          color += exterior * exteriorStrength * (0.38 + band * 0.46);
          color = mix(color, core * (0.14 + orbitGlow * 0.35), clamp(inside, 0.0, 1.0));
          color += paletteRamp(normalizedEscape + 0.24) * distanceGlow * (0.72 + uBloom * 1.25);
          color += paletteRamp(orbitTrap * 0.2 + 0.56) * orbitGlow * escaped * (0.08 + uBloom * 0.26);
          color += vec3(1.0, 0.9, 0.72) * pow(axisGlow, 3.0) * inside * (0.05 + uBloom * 0.16);
          color *= smoothstep(2.15, 0.22, length(uv)) + 0.1;
          color = pow(color, vec3(0.82));

          gl_FragColor = vec4(color, 1.0);
        }
      `
    });

    const object = new THREE.Mesh(geometry, material);
    object.frustumCulled = false;

    return {
      object,
      resize() {
        material.uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height);
      },
      update(elapsed, nextState) {
        material.uniforms.uTime.value = elapsed;
        material.uniforms.uFlow.value = nextState.flow;
        material.uniforms.uBloom.value = nextState.bloom;
        material.uniforms.uDetail.value = normalizedDensity(nextState.density);
        material.uniforms.uZoom.value = nextState.zoom;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      }
    };
  }
};
