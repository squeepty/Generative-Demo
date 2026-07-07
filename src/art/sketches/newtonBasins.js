import * as THREE from 'three';
import { mulberry32 } from '../random.js';

function makeColorUniforms(colors) {
  return colors.map((value) => new THREE.Color(value));
}

function normalizedDensity(density) {
  return THREE.MathUtils.clamp((density - 900) / (5200 - 900), 0, 1);
}

export const newtonBasins = {
  id: 'newton-basins',
  label: 'Newton Basins',
  math: {
    summary:
      'Newton iteration is applied to z^n - 1 in the complex plane. Each pixel is colored by which root it reaches, revealing the fractal basin boundaries between roots.',
    rows: [
      {
        label: 'Newton Step',
        body: 'z[n+1] = z[n] - f(z[n]) / fPrime(z[n])'
      },
      {
        label: 'Polynomial',
        body: 'f(z) = z^k - 1; the k roots of unity are equally spaced around the unit circle.'
      },
      {
        label: 'Basins',
        body: 'Points that converge to the same root share a color; slow convergence marks the intricate boundary between basins.'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const paletteColors = makeColorUniforms(palette.colors);
    const random = mulberry32(state.seed + 8123);
    const rootCount = 3 + Math.floor(random() * 5);
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
        uRootCount: { value: rootCount },
        uRotation: { value: (random() - 0.5) * Math.PI * 0.32 },
        uSeedPhase: { value: random() * Math.PI * 2 },
        uScale: { value: 1.42 + random() * 0.36 },
        uOffset: {
          value: new THREE.Vector2((random() - 0.5) * 0.16, (random() - 0.5) * 0.16)
        },
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
        uniform float uRootCount;
        uniform float uRotation;
        uniform float uSeedPhase;
        uniform float uScale;
        uniform vec2 uOffset;
        uniform vec2 uResolution;
        uniform vec3 uColor0;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;

        const int MAX_ITERATIONS = 56;
        const int MAX_POWER = 8;
        const float TAU = 6.28318530718;

        mat2 rotate2d(float angle) {
          float s = sin(angle);
          float c = cos(angle);
          return mat2(c, -s, s, c);
        }

        vec2 complexMultiply(vec2 a, vec2 b) {
          return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
        }

        vec2 complexDivide(vec2 a, vec2 b) {
          float denominator = max(dot(b, b), 0.000001);
          return vec2(
            (a.x * b.x + a.y * b.y) / denominator,
            (a.y * b.x - a.x * b.y) / denominator
          );
        }

        vec2 complexPower(vec2 z, float power) {
          vec2 result = vec2(1.0, 0.0);

          for (int i = 0; i < MAX_POWER; i++) {
            if (float(i) >= power) {
              break;
            }

            result = complexMultiply(result, z);
          }

          return result;
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

        void main() {
          vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
          uv /= max(uZoom, 0.001);
          float portrait = step(uResolution.x, uResolution.y);
          uv.y -= portrait * 0.18;

          float phase = uSeedPhase + uTime * (0.05 + uFlow * 0.22);
          vec2 offset = uOffset + vec2(cos(phase * 0.53), sin(phase * 0.41)) * 0.055 * uFlow;
          vec2 start = rotate2d(uRotation + sin(phase) * 0.11 * uFlow) * uv * uScale + offset;
          vec2 z = start;
          float iterationLimit = mix(22.0, 52.0, uDetail);
          float convergence = iterationLimit;
          float converged = 0.0;
          float minStep = 10.0;
          float orbitTrap = 10.0;

          for (int i = 0; i < MAX_ITERATIONS; i++) {
            if (float(i) >= iterationLimit) {
              break;
            }

            vec2 f = complexPower(z, uRootCount) - vec2(1.0, 0.0);
            vec2 derivative = uRootCount * complexPower(z, uRootCount - 1.0);
            vec2 stepValue = complexDivide(f, derivative);

            z -= stepValue;
            minStep = min(minStep, length(stepValue));
            orbitTrap = min(orbitTrap, abs(length(z) - 1.0));

            if (length(stepValue) < mix(0.0008, 0.00018, uDetail)) {
              convergence = float(i);
              converged = 1.0;
              break;
            }
          }

          float angle = atan(z.y, z.x);
          float rootSector = floor(fract(angle / TAU + 1.0 + 0.5 / uRootCount) * uRootCount);
          float rootT = rootSector / max(uRootCount, 1.0);
          float slow = clamp(convergence / iterationLimit, 0.0, 1.0);
          float boundary = pow(slow, mix(1.7, 3.2, uDetail)) * converged;
          float unresolved = 1.0 - converged;
          float radial = length(start);
          float rings = 0.5 + 0.5 * cos(convergence * 0.72 + log(radial + 0.08) * 5.2);
          float rootGlow = exp(-orbitTrap * mix(8.0, 20.0, uDetail));
          float filaments = exp(-minStep * mix(38.0, 88.0, uDetail));
          vec3 background = mix(vec3(0.006, 0.007, 0.011), vec3(0.032, 0.023, 0.03), smoothstep(-0.9, 0.9, uv.y));
          vec3 basin = paletteRamp(rootT + slow * 0.18 + uTime * 0.004);
          vec3 neighbor = paletteRamp(rootT + 1.0 / max(uRootCount, 1.0) + 0.08);
          vec3 color = mix(background, basin * (0.2 + (1.0 - slow) * 0.72 + rings * 0.18), converged);

          color = mix(color, background + neighbor * 0.18, unresolved);
          color += neighbor * boundary * (0.44 + uBloom * 0.72);
          color += paletteRamp(rootT + 0.42) * rootGlow * converged * (0.1 + uBloom * 0.28);
          color += vec3(1.0, 0.92, 0.72) * pow(filaments, 2.3) * (0.06 + uBloom * 0.16);
          color *= smoothstep(1.95, 0.18, length(uv)) + 0.1;
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
