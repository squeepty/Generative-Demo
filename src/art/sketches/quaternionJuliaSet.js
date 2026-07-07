import * as THREE from 'three';

function makeColorUniforms(colors) {
  return colors.map((value) => new THREE.Color(value));
}

function normalizedDensity(density) {
  return THREE.MathUtils.clamp((density - 900) / (5200 - 900), 0, 1);
}

function seedPhase(seed) {
  return ((seed % 10000) / 10000) * Math.PI * 2;
}

export const quaternionJuliaSet = {
  id: 'quaternion-julia-set',
  label: 'Quaternion Julia Set',
  math: {
    summary:
      'A three-dimensional slice through a quaternion Julia set. Each ray samples quaternion iteration, revealing bulbous lobes, pinched tunnels, and self-similar boundary folds.',
    rows: [
      {
        label: 'Quaternion Map',
        body: 'q[n+1] = q[n]^2 + c, where q and c are quaternions.'
      },
      {
        label: '3D Slice',
        body: 'Each ray point supplies (x,y,z); the fourth quaternion component is a seeded slice offset.'
      },
      {
        label: 'Distance Estimate',
        body: 'd ~= 0.5 * |q| * log(|q|) / dr, with dr accumulated during iteration.'
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
        uSeedPhase: { value: seedPhase(state.seed) },
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
        uniform vec2 uResolution;
        uniform vec3 uColor0;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;

        const int MAX_STEPS = 74;
        const int JULIA_STEPS = 12;
        const float MAX_DISTANCE = 8.0;

        mat2 rotate2d(float angle) {
          float s = sin(angle);
          float c = cos(angle);
          return mat2(c, -s, s, c);
        }

        mat3 lookAt(vec3 origin, vec3 target) {
          vec3 forward = normalize(target - origin);
          vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
          vec3 up = cross(right, forward);
          return mat3(right, up, forward);
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

        vec4 quatSquare(vec4 q) {
          return vec4(
            q.x * q.x - dot(q.yzw, q.yzw),
            2.0 * q.x * q.yzw
          );
        }

        vec4 juliaConstant() {
          return vec4(
            -0.18 + 0.055 * sin(uSeedPhase * 1.13),
            0.68 + 0.04 * cos(uSeedPhase * 0.71),
            0.22 * sin(uSeedPhase * 1.9),
            -0.26 + 0.06 * cos(uSeedPhase * 1.47)
          );
        }

        float quaternionJuliaDistance(vec3 point) {
          float slice = 0.18 * sin(uSeedPhase * 0.83) + 0.06 * sin(uTime * 0.12 * uFlow);
          vec4 z = vec4(point, slice);
          vec4 c = juliaConstant();
          float derivative = 1.0;
          float radius = length(z);

          for (int i = 0; i < JULIA_STEPS; i++) {
            radius = length(z);

            if (radius > 4.0) {
              break;
            }

            derivative = 2.0 * max(radius, 0.0001) * derivative + 1.0;
            z = quatSquare(z) + c;
          }

          return 0.5 * log(max(radius, 1.0001)) * radius / max(derivative, 0.0001);
        }

        float orbitTrap(vec3 point) {
          float slice = 0.18 * sin(uSeedPhase * 0.83);
          vec4 z = vec4(point, slice);
          vec4 c = juliaConstant();
          float trap = 12.0;

          for (int i = 0; i < JULIA_STEPS; i++) {
            trap = min(trap, abs(length(z.xyz) - 0.72));
            trap = min(trap, abs(z.x) + abs(z.w) * 0.35);
            z = quatSquare(z) + c;

            if (length(z) > 4.0) {
              break;
            }
          }

          return trap;
        }

        vec3 estimateNormal(vec3 point) {
          vec2 e = vec2(0.002, -0.002);
          return normalize(
            e.xyy * quaternionJuliaDistance(point + e.xyy) +
            e.yyx * quaternionJuliaDistance(point + e.yyx) +
            e.yxy * quaternionJuliaDistance(point + e.yxy) +
            e.xxx * quaternionJuliaDistance(point + e.xxx)
          );
        }

        void main() {
          vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
          uv /= max(uZoom, 0.001);
          float portrait = step(uResolution.x, uResolution.y);
          uv.y -= portrait * 0.34;

          float orbit = uSeedPhase * 0.12 + uTime * (0.08 + uFlow * 0.2);
          vec3 rayOrigin = vec3(
            sin(orbit) * 3.15,
            0.48 + sin(orbit * 0.74 + uSeedPhase) * 0.24,
            cos(orbit) * 3.15
          );
          vec3 target = vec3(0.0, -0.03, 0.0);
          mat3 camera = lookAt(rayOrigin, target);
          vec3 rayDirection = camera * normalize(vec3(uv, 1.6));

          float travel = 0.0;
          float glow = 0.0;
          float stepRatio = 1.0;
          bool hit = false;
          vec3 point = rayOrigin;

          for (int i = 0; i < MAX_STEPS; i++) {
            point = rayOrigin + rayDirection * travel;
            point.xz = rotate2d(uTime * 0.025 * uFlow) * point.xz;
            float distanceToSurface = quaternionJuliaDistance(point);
            float surfaceDistance = mix(0.0085, 0.0038, uDetail);

            glow += exp(-abs(distanceToSurface) * mix(18.0, 42.0, uDetail)) * 0.01;

            if (distanceToSurface < surfaceDistance) {
              stepRatio = float(i) / float(MAX_STEPS);
              hit = true;
              break;
            }

            travel += max(distanceToSurface * 0.78, 0.006);

            if (travel > MAX_DISTANCE) {
              stepRatio = float(i) / float(MAX_STEPS);
              break;
            }
          }

          vec3 color = mix(
            vec3(0.006, 0.008, 0.012),
            vec3(0.028, 0.024, 0.034),
            smoothstep(-0.9, 0.9, uv.y)
          );

          if (hit) {
            vec3 normal = estimateNormal(point);
            vec3 lightDirection = normalize(vec3(-0.35, 0.82, 0.44));
            float diffuse = max(dot(normal, lightDirection), 0.0);
            float rim = pow(1.0 - max(dot(normal, -rayDirection), 0.0), 2.1);
            float cavity = smoothstep(0.96, 0.16, stepRatio);
            float trap = orbitTrap(point);
            float band = length(point) * 0.24 + normal.z * 0.2 + trap * 0.8 + uTime * 0.012;
            vec3 base = paletteRamp(band + uSeedPhase * 0.025);

            color = base * (0.16 + diffuse * 0.94) * cavity;
            color += paletteRamp(band + 0.44) * rim * (0.46 + uBloom * 0.62);
            color += vec3(1.0, 0.93, 0.82) * pow(diffuse, 20.0) * (0.32 + uBloom * 0.64);
            color += paletteRamp(trap * 0.6 + 0.12) * exp(-trap * 9.0) * (0.08 + uBloom * 0.16);
          }

          color += paletteRamp(length(uv) * 0.08 + uSeedPhase * 0.03 + uTime * 0.01) * glow * (1.3 + uBloom * 2.0);
          color = pow(color, vec3(0.85));

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
        material.uniforms.uSeedPhase.value = seedPhase(nextState.seed);
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      }
    };
  }
};
