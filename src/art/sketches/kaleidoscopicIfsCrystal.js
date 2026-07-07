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

export const kaleidoscopicIfsCrystal = {
  id: 'kaleidoscopic-ifs-crystal',
  label: 'Kaleidoscopic IFS Crystal',
  math: {
    summary:
      'A kaleidoscopic iterated function system folds space through mirror symmetries, sorts coordinates into a wedge, then scales and offsets the result into crystalline towers.',
    rows: [
      {
        label: 'Mirror Folds',
        body: 'p = abs(p); sort p.x, p.y, p.z so every sample reflects into one symmetric wedge.'
      },
      {
        label: 'IFS Step',
        body: 'p[n+1] = s*p[n] - offset*(s - 1); repeated folds create nested crystal chambers.'
      },
      {
        label: 'Distance Field',
        body: 'A sphere/box hybrid distance is divided by the accumulated scale and raymarched.'
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

        const int MAX_STEPS = 82;
        const int IFS_STEPS = 8;
        const float MAX_DISTANCE = 9.0;

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

        vec3 sortWedge(vec3 p) {
          p = abs(p);

          if (p.x < p.y) {
            p.xy = p.yx;
          }

          if (p.x < p.z) {
            p.xz = p.zx;
          }

          if (p.y < p.z) {
            p.yz = p.zy;
          }

          return p;
        }

        float sdBox(vec3 point, vec3 bounds) {
          vec3 q = abs(point) - bounds;
          return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
        }

        float crystalCore(vec3 point) {
          vec3 p = point;
          float scale = mix(1.72, 2.05, uDetail);
          float accumulatedScale = 1.0;
          vec3 offset = vec3(
            0.86 + 0.05 * sin(uSeedPhase),
            0.54 + 0.04 * cos(uSeedPhase * 1.7),
            0.7 + 0.05 * sin(uSeedPhase * 1.3)
          );

          p.xy = rotate2d(0.1 * sin(uSeedPhase)) * p.xy;

          for (int i = 0; i < IFS_STEPS; i++) {
            p = sortWedge(p);
            p.xy = rotate2d(0.12 + 0.035 * float(i)) * p.xy;
            p = p * scale - offset * (scale - 1.0);
            accumulatedScale *= scale;
          }

          float bulb = (length(p) - 0.72) / accumulatedScale;
          float tower = sdBox(p, vec3(0.3, 0.92, 0.3)) / accumulatedScale;
          float plate = sdBox(p, vec3(0.78, 0.16, 0.42)) / accumulatedScale;

          return min(bulb, min(tower, plate));
        }

        float crystalDistance(vec3 point) {
          vec3 p = point;
          p.xz = rotate2d(uTime * 0.025 * uFlow + uSeedPhase * 0.08) * p.xz;
          p.yz = rotate2d(0.08 * sin(uSeedPhase * 0.9)) * p.yz;

          return crystalCore(p);
        }

        float foldTrap(vec3 point) {
          vec3 p = point;
          float trap = 9.0;
          float scale = mix(1.72, 2.05, uDetail);
          vec3 offset = vec3(0.86, 0.54, 0.7);

          for (int i = 0; i < IFS_STEPS; i++) {
            p = sortWedge(p);
            trap = min(trap, abs(p.x - p.y));
            trap = min(trap, length(p.yz) * 0.35);
            p = p * scale - offset * (scale - 1.0);
          }

          return trap;
        }

        vec3 estimateNormal(vec3 point) {
          vec2 e = vec2(0.002, -0.002);
          return normalize(
            e.xyy * crystalDistance(point + e.xyy) +
            e.yyx * crystalDistance(point + e.yyx) +
            e.yxy * crystalDistance(point + e.yxy) +
            e.xxx * crystalDistance(point + e.xxx)
          );
        }

        void main() {
          vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
          uv /= max(uZoom, 0.001);
          float portrait = step(uResolution.x, uResolution.y);
          uv.y -= portrait * 0.34;

          float orbit = uSeedPhase * 0.16 + uTime * (0.065 + uFlow * 0.18);
          vec3 rayOrigin = vec3(
            sin(orbit) * 3.7,
            0.86 + sin(orbit * 0.67 + uSeedPhase) * 0.26,
            cos(orbit) * 3.7
          );
          vec3 target = vec3(0.0, -0.06, 0.0);
          mat3 camera = lookAt(rayOrigin, target);
          vec3 rayDirection = camera * normalize(vec3(uv, 1.55));

          float travel = 0.0;
          float glow = 0.0;
          float stepRatio = 1.0;
          bool hit = false;
          vec3 point = rayOrigin;

          for (int i = 0; i < MAX_STEPS; i++) {
            point = rayOrigin + rayDirection * travel;
            float distanceToSurface = crystalDistance(point);
            float surfaceDistance = mix(0.009, 0.0035, uDetail);

            glow += exp(-abs(distanceToSurface) * mix(16.0, 38.0, uDetail)) * 0.009;

            if (distanceToSurface < surfaceDistance) {
              stepRatio = float(i) / float(MAX_STEPS);
              hit = true;
              break;
            }

            travel += max(distanceToSurface * 0.72, 0.0055);

            if (travel > MAX_DISTANCE) {
              stepRatio = float(i) / float(MAX_STEPS);
              break;
            }
          }

          vec3 color = mix(
            vec3(0.006, 0.008, 0.012),
            vec3(0.026, 0.03, 0.028),
            smoothstep(-0.9, 0.88, uv.y)
          );

          if (hit) {
            vec3 normal = estimateNormal(point);
            vec3 lightDirection = normalize(vec3(-0.38, 0.78, 0.5));
            float diffuse = max(dot(normal, lightDirection), 0.0);
            float rim = pow(1.0 - max(dot(normal, -rayDirection), 0.0), 1.85);
            float facet = pow(abs(dot(normal, normalize(vec3(0.55, 0.2, -0.8)))), 6.0);
            float cavity = smoothstep(1.0, 0.15, stepRatio);
            float trap = foldTrap(point);
            float band = point.y * 0.2 + length(point.xz) * 0.18 + trap * 0.56 + uTime * 0.01;
            vec3 base = paletteRamp(band + uSeedPhase * 0.03);

            color = base * (0.14 + diffuse * 0.96) * cavity;
            color += paletteRamp(band + 0.31) * rim * (0.42 + uBloom * 0.66);
            color += paletteRamp(band + 0.58) * facet * (0.16 + uBloom * 0.36);
            color += vec3(1.0, 0.94, 0.82) * pow(diffuse, 24.0) * (0.28 + uBloom * 0.52);
          }

          color += paletteRamp(length(uv) * 0.09 + uSeedPhase * 0.04 + uTime * 0.012) * glow * (1.35 + uBloom * 2.1);
          color = pow(color, vec3(0.84));

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
