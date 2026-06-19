import * as THREE from 'three';

const LOOP_SECONDS = 14;

function makeColorUniforms(colors) {
  return colors.map((value) => new THREE.Color(value));
}

function normalizedDensity(density) {
  return THREE.MathUtils.clamp((density - 900) / (5200 - 900), 0, 1);
}

export const mesmerLoop = {
  id: 'mesmer-loop',
  label: 'Mesmer Loop',
  math: {
    summary:
      'A procedural loop field combines rotating ellipses, a lemniscate contour, and polar interference rings into a seamless cyclic animation.',
    rows: [
      {
        label: 'Loop Phase',
        body: 't = fract(time / 14 * speed + seed); phase = 2*pi*t'
      },
      {
        label: 'Ellipse Bands',
        body: 'band = smoothstep(thickness, 0, abs(length(R(angle)*(p - c)/radius) - 1) * min(radius))'
      },
      {
        label: 'Lemniscate',
        body: 'f(p) = |(x^2 + y^2)^2 - a*(x^2 - y^2)|; small f values draw the infinity-loop contour.'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const paletteColors = makeColorUniforms(palette.colors);
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
        uSeed: { value: (state.seed % 10000) / 10000 },
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
        uniform float uSeed;
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

        float ellipseBand(vec2 point, vec2 center, vec2 radius, float angle, float thickness) {
          vec2 q = rotate2d(angle) * (point - center);
          float distanceToLoop = abs(length(q / radius) - 1.0) * min(radius.x, radius.y);
          return smoothstep(thickness, 0.0, distanceToLoop);
        }

        float ellipseGlow(vec2 point, vec2 center, vec2 radius, float angle, float falloff) {
          vec2 q = rotate2d(angle) * (point - center);
          float distanceToLoop = abs(length(q / radius) - 1.0) * min(radius.x, radius.y);
          return exp(-distanceToLoop * falloff);
        }

        float lemniscateBand(vec2 point, float angle, float scale, float thickness) {
          vec2 p = rotate2d(angle) * point / scale;
          float r2 = dot(p, p);
          float f = abs(r2 * r2 - 0.74 * (p.x * p.x - p.y * p.y));
          return smoothstep(thickness, 0.0, f);
        }

        void main() {
          vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
          uv /= max(uZoom, 0.001);
          float portrait = step(uResolution.x, uResolution.y);
          uv.y -= portrait * 0.32;
          float t = fract(uTime / ${LOOP_SECONDS}.0 * (0.45 + uFlow * 0.95) + uSeed);
          float phase = t * TAU;
          float detail = uDetail;
          float radius = length(uv);
          float angle = atan(uv.y, uv.x);

          vec2 warp = vec2(
            sin(angle * 3.0 + phase) * 0.055,
            cos(radius * 5.0 - phase) * 0.055
          ) * (0.35 + uFlow);
          vec2 p = uv + warp;

          vec3 color = mix(vec3(0.007, 0.008, 0.011), vec3(0.033, 0.024, 0.03), smoothstep(-0.9, 0.9, uv.y));
          float total = 0.0;
          float halo = 0.0;
          float thickness = mix(0.033, 0.014, detail);

          for (int i = 0; i < 7; i++) {
            float fi = float(i);
            float orbit = fi * TAU / 7.0 + phase * (0.24 + fi * 0.012);
            vec2 center = vec2(cos(orbit), sin(orbit * 1.17 + uSeed * TAU)) * (0.24 + 0.12 * sin(phase + fi));
            vec2 loopRadius = vec2(
              0.48 + 0.09 * sin(phase * 0.7 + fi * 1.4),
              0.22 + 0.05 * cos(phase * 0.9 + fi)
            );
            float loopAngle = orbit + phase * 0.18;
            float band = ellipseBand(p, center, loopRadius, loopAngle, thickness);
            float glow = ellipseGlow(p, center, loopRadius, loopAngle, mix(14.0, 27.0, detail));
            vec3 loopColor = paletteRamp(fi / 7.0 + t * 0.32 + radius * 0.04);

            total += band;
            halo += glow * (0.04 + band * 0.18);
            color += loopColor * band * (0.45 + uBloom * 0.5);
            color += loopColor * glow * 0.055 * (1.0 + uBloom);
          }

          float infinity = lemniscateBand(p, phase * 0.32, 1.0 + sin(phase) * 0.05, mix(0.018, 0.007, detail));
          float rings = pow(0.5 + 0.5 * cos(radius * mix(34.0, 74.0, detail) + sin(angle * 6.0 + phase) * 2.2 - phase * 3.0), mix(8.0, 18.0, detail));
          float spokes = pow(0.5 + 0.5 * cos(angle * 10.0 + radius * 15.0 - phase * 2.0), 8.0);
          float vignette = smoothstep(1.65, 0.18, radius);
          vec3 accent = paletteRamp(radius * 0.24 + t * 0.42 + infinity * 0.08);

          color += accent * infinity * (0.88 + uBloom * 0.75);
          color += paletteRamp(angle / TAU + t) * rings * spokes * vignette * (0.12 + uBloom * 0.2);
          color += accent * halo * (1.1 + uBloom * 1.8);
          color += vec3(1.0, 0.92, 0.74) * pow(clamp(total, 0.0, 1.0), 3.0) * (0.42 + uBloom);

          color *= smoothstep(1.78, 0.12, radius) + 0.12;
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
