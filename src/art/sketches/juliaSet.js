import * as THREE from 'three';
import { mulberry32 } from '../random.js';

const JULIA_PRESETS = [
  [-0.8, 0.156],
  [-0.70176, -0.3842],
  [-0.7269, 0.1889],
  [-0.4, 0.6],
  [0.285, 0.01],
  [0.355, 0.355],
  [-0.835, -0.2321],
  [0.37, -0.1]
];

function makeColorUniforms(colors) {
  return colors.map((value) => new THREE.Color(value));
}

function normalizedDensity(density) {
  return THREE.MathUtils.clamp((density - 900) / (5200 - 900), 0, 1);
}

function seededJuliaParameter(seed) {
  const random = mulberry32(seed + 3019);
  const preset = JULIA_PRESETS[Math.floor(random() * JULIA_PRESETS.length)];
  const jitterRadius = 0.018 + random() * 0.026;
  const jitterAngle = random() * Math.PI * 2;

  return new THREE.Vector2(
    preset[0] + Math.cos(jitterAngle) * jitterRadius,
    preset[1] + Math.sin(jitterAngle) * jitterRadius
  );
}

export const juliaSet = {
  id: 'julia-set',
  label: 'Julia Set',
  math: {
    summary:
      'A complex plane is colored by escape time under the quadratic Julia iteration z -> z^2 + c. The seed chooses c, while flow gently moves it through nearby connected and filamented forms.',
    rows: [
      {
        label: 'Iteration',
        body: 'z[n+1] = z[n]^2 + c, where z and c are complex numbers.'
      },
      {
        label: 'Escape',
        body: 'If |z[n]| > 4, the point is outside the filled Julia set; later escape means closer to the boundary.'
      },
      {
        label: 'Coloring',
        body: 'Smooth escape time and orbit traps turn iteration count, distance to axes, and distance to a moving focus into continuous bands.'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const paletteColors = makeColorUniforms(palette.colors);
    const random = mulberry32(state.seed + 6173);
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
        uRotation: { value: (random() - 0.5) * Math.PI * 0.18 },
        uSeedPhase: { value: random() * Math.PI * 2 },
        uJuliaC: { value: seededJuliaParameter(state.seed) },
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
        uniform float uRotation;
        uniform float uSeedPhase;
        uniform vec2 uJuliaC;
        uniform vec2 uResolution;
        uniform vec3 uColor0;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;

        const int MAX_ITERATIONS = 168;
        const float TAU = 6.28318530718;

        mat2 rotate2d(float angle) {
          float s = sin(angle);
          float c = cos(angle);
          return mat2(c, -s, s, c);
        }

        vec2 complexSquare(vec2 z) {
          return vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
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

          float spin = uRotation + uTime * uFlow * 0.025;
          vec2 p = rotate2d(spin) * uv * 1.64;
          float radius = length(p);
          float angle = atan(p.y, p.x);
          float phase = uSeedPhase + uTime * (0.07 + uFlow * 0.24);
          vec2 c = uJuliaC + vec2(cos(phase), sin(phase * 1.17)) * 0.045 * uFlow;
          vec2 trapFocus = vec2(cos(phase * 0.6), sin(phase * 0.73)) * 0.26;
          vec2 z = p;
          float iterationLimit = mix(72.0, 156.0, uDetail);
          float escaped = 0.0;
          float escapeTime = iterationLimit;
          float orbitTrap = 10.0;
          float axisTrap = 10.0;

          for (int i = 0; i < MAX_ITERATIONS; i++) {
            if (float(i) >= iterationLimit) {
              break;
            }

            orbitTrap = min(orbitTrap, length(z - trapFocus));
            axisTrap = min(axisTrap, min(abs(z.x), abs(z.y)));
            z = complexSquare(z) + c;

            float radius2 = dot(z, z);

            if (radius2 > 16.0) {
              float smoothEscape = float(i) + 1.0 - log(log(max(sqrt(radius2), 1.0001))) / log(2.0);
              escapeTime = smoothEscape;
              escaped = 1.0;
              break;
            }
          }

          float normalizedEscape = clamp(escapeTime / iterationLimit, 0.0, 1.0);
          float orbitGlow = exp(-orbitTrap * mix(4.8, 9.0, uDetail));
          float axisGlow = exp(-axisTrap * mix(18.0, 42.0, uDetail));
          float boundary = pow(normalizedEscape, mix(2.1, 3.6, uDetail));
          float bands = 0.5 + 0.5 * cos(escapeTime * 0.22 + orbitTrap * 8.0 + angle * 0.35);
          vec3 background = mix(vec3(0.006, 0.007, 0.011), vec3(0.032, 0.023, 0.03), smoothstep(-1.0, 0.9, uv.y));
          vec3 exterior = paletteRamp(normalizedEscape * 1.28 + orbitTrap * 0.16 + uTime * 0.008);
          vec3 interior = paletteRamp(axisTrap * 1.6 + radius * 0.09 + uSeedPhase * 0.03);
          vec3 color = mix(background, exterior * (0.34 + bands * 0.72), escaped);

          color = mix(color, interior * (0.18 + axisGlow * 0.58), 1.0 - escaped);
          color += paletteRamp(normalizedEscape + 0.18) * boundary * escaped * (0.26 + uBloom * 0.46);
          color += paletteRamp(orbitTrap * 0.22 + 0.42) * orbitGlow * (0.1 + uBloom * 0.42);
          color += vec3(1.0, 0.92, 0.74) * pow(axisGlow, 3.0) * (0.06 + uBloom * 0.16);
          color *= smoothstep(2.35, 0.18, radius) + 0.08;
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
