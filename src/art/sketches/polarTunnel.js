import * as THREE from 'three';
import { mulberry32 } from '../random.js';

function makeColorUniforms(colors) {
  return colors.map((value) => new THREE.Color(value));
}

function normalizedDensity(density) {
  return THREE.MathUtils.clamp((density - 900) / (5200 - 900), 0, 1);
}

export const polarTunnel = {
  id: 'polar-tunnel',
  label: 'Polar Tunnel',
  math: {
    summary:
      'A flat screen coordinate is transformed into polar angle and reciprocal radius, making rings and angular spokes appear as a forward-moving tunnel.',
    rows: [
      {
        label: 'Polar Map',
        body: 'r = length(p); theta = atan(y, x); depth = 1 / max(r, epsilon)'
      },
      {
        label: 'Tunnel Texture',
        body: 'u = theta + twist*depth; v = depth + time*speed; bands combine cos(u*k) with repeated depth rings.'
      },
      {
        label: 'Motion',
        body: 'Flow advances depth and twist phase, while density increases spoke count, ring frequency, and edge sharpness.'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const paletteColors = makeColorUniforms(palette.colors);
    const random = mulberry32(state.seed + 9281);
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
        uSeedPhase: { value: random() * Math.PI * 2 },
        uTwist: { value: 0.18 + random() * 0.46 },
        uRotation: { value: (random() - 0.5) * Math.PI * 0.28 },
        uOffset: {
          value: new THREE.Vector2((random() - 0.5) * 0.12, (random() - 0.5) * 0.12)
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
        uniform float uSeedPhase;
        uniform float uTwist;
        uniform float uRotation;
        uniform vec2 uOffset;
        uniform vec2 uResolution;
        uniform vec3 uColor0;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;

        const float TAU = 6.28318530718;

        mat2 rotate2d(float angle) {
          float s = sin(angle);
          float c = cos(angle);
          return mat2(c, -s, s, c);
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

        float ridge(float value, float sharpness) {
          return pow(0.5 + 0.5 * cos(value), sharpness);
        }

        void main() {
          vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
          uv /= max(uZoom, 0.001);
          float portrait = step(uResolution.x, uResolution.y);
          uv.y -= portrait * 0.18;

          float phase = uSeedPhase + uTime * (0.12 + uFlow * 0.46);
          vec2 center = uOffset + vec2(cos(phase * 0.37), sin(phase * 0.29)) * 0.055 * uFlow;
          vec2 p = rotate2d(uRotation + sin(phase * 0.25) * 0.12 * uFlow) * (uv - center);
          float radius = max(length(p), 0.038);
          float angle = atan(p.y, p.x);
          float depth = 1.0 / radius;
          float speed = 0.35 + uFlow * 1.55;
          float travel = depth + uTime * speed;
          float twist = angle + travel * (uTwist + sin(phase + depth * 0.17) * 0.08);
          float detail = uDetail;
          float spokeCount = floor(mix(7.0, 18.0, detail) + 0.5);
          float ringFrequency = mix(2.1, 5.8, detail);
          float sharpness = mix(4.5, 14.0, detail);
          float spokes = ridge(twist * spokeCount + sin(travel * 0.7 + phase) * 1.4, sharpness);
          float rings = ridge(travel * TAU * ringFrequency + sin(angle * 3.0 - phase) * 0.9, sharpness * 0.72);
          float diagonals = ridge(twist * 4.0 - travel * 2.4 + sin(phase) * 0.8, mix(3.0, 8.0, detail));
          float cells = max(spokes * 0.78, rings * 0.72);
          cells = max(cells, spokes * rings * 1.15);

          float fog = smoothstep(26.0, 2.2, travel);
          float aperture = smoothstep(0.04, 0.28, radius) * smoothstep(1.75, 0.28, radius);
          float core = smoothstep(0.16, 0.038, radius);
          float edgeGlow = pow(clamp(cells + diagonals * 0.38, 0.0, 1.0), mix(1.4, 2.6, detail));
          float depthPulse = 0.5 + 0.5 * sin(travel * 0.85 + phase);
          vec3 background = mix(vec3(0.006, 0.007, 0.011), vec3(0.032, 0.023, 0.028), smoothstep(-0.9, 0.9, uv.y));
          vec3 wallColor = paletteRamp(travel * 0.045 + sin(angle + phase) * 0.08 + depthPulse * 0.08);
          vec3 secondary = paletteRamp(travel * 0.073 + cos(angle * 2.0 - phase) * 0.07 + 0.38);
          vec3 color = background;

          color += wallColor * cells * aperture * fog * (0.34 + uBloom * 0.48);
          color += secondary * diagonals * aperture * fog * (0.08 + uBloom * 0.18);
          color += paletteRamp(0.18 + travel * 0.035) * edgeGlow * aperture * (0.15 + uBloom * 0.45);
          color += vec3(1.0, 0.92, 0.72) * pow(spokes * rings, 2.4) * aperture * (0.08 + uBloom * 0.2);
          color = mix(color, background * 0.5 + wallColor * 0.16, core);
          color *= smoothstep(1.85, 0.12, length(uv)) + 0.08;
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
