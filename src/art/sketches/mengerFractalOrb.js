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

export const mengerFractalOrb = {
  id: 'menger-fractal-orb',
  label: 'Menger Fractal Orb',
  math: {
    summary:
      'A spherical signed-distance field is carved with recursive Menger-style cross tunnels. The result keeps the sponge removal logic while wrapping it into a glowing orb.',
    rows: [
      {
        label: 'Base Field',
        body: 'd = |p| - r starts from a sphere instead of the usual Menger cube.'
      },
      {
        label: 'Recursive Carving',
        body: 'At scales 1, 3, 9, ... subtract cells where two coordinates fall inside the central third.'
      },
      {
        label: 'Raymarching',
        body: 'Rays advance by the signed-distance estimate; normals come from local distance gradients.'
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

        const int MAX_STEPS = 76;
        const int CARVE_STEPS = 5;
        const float MAX_DISTANCE = 8.2;

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

        float sdSphere(vec3 point, float radius) {
          return length(point) - radius;
        }

        float crossTunnel(vec3 point, float width) {
          vec3 p = abs(point);
          float tunnelX = max(p.y - width, p.z - width);
          float tunnelY = max(p.z - width, p.x - width);
          float tunnelZ = max(p.x - width, p.y - width);

          return min(tunnelX, min(tunnelY, tunnelZ));
        }

        float mengerOrbDistance(vec3 point) {
          vec3 p = point;
          p.xy = rotate2d(sin(uSeedPhase) * 0.1) * p.xy;
          p.yz = rotate2d(cos(uSeedPhase) * 0.08) * p.yz;

          float radius = 1.34 + sin(uSeedPhase * 1.7) * 0.035;
          float d = sdSphere(p, radius);
          float scale = 1.0;
          float width = mix(0.37, 0.285, uDetail);

          for (int i = 0; i < CARVE_STEPS; i++) {
            vec3 cell = mod(p * scale + 1.0, 2.0) - 1.0;
            float hole = crossTunnel(cell, width);
            d = max(d, -hole / scale);
            scale *= 3.0;
            width *= 0.96;
          }

          return d;
        }

        vec3 estimateNormal(vec3 point) {
          vec2 e = vec2(0.0022, -0.0022);
          return normalize(
            e.xyy * mengerOrbDistance(point + e.xyy) +
            e.yyx * mengerOrbDistance(point + e.yyx) +
            e.yxy * mengerOrbDistance(point + e.yxy) +
            e.xxx * mengerOrbDistance(point + e.xxx)
          );
        }

        void main() {
          vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
          uv /= max(uZoom, 0.001);
          float portrait = step(uResolution.x, uResolution.y);
          uv.y -= portrait * 0.32;

          float orbit = uSeedPhase * 0.18 + uTime * (0.075 + uFlow * 0.18);
          vec3 rayOrigin = vec3(
            sin(orbit) * 3.38,
            0.74 + sin(orbit * 0.72 + uSeedPhase) * 0.26,
            cos(orbit) * 3.38
          );
          vec3 target = vec3(0.0, -0.03, 0.0);
          mat3 camera = lookAt(rayOrigin, target);
          vec3 rayDirection = camera * normalize(vec3(uv, 1.58));

          float travel = 0.0;
          float glow = 0.0;
          float stepRatio = 1.0;
          bool hit = false;
          vec3 point = rayOrigin;

          for (int i = 0; i < MAX_STEPS; i++) {
            point = rayOrigin + rayDirection * travel;
            point.xz = rotate2d(uTime * 0.035 * uFlow) * point.xz;
            float distanceToSurface = mengerOrbDistance(point);
            float surfaceDistance = mix(0.0085, 0.0038, uDetail);

            glow += exp(-abs(distanceToSurface) * mix(18.0, 38.0, uDetail)) * 0.009;

            if (distanceToSurface < surfaceDistance) {
              stepRatio = float(i) / float(MAX_STEPS);
              hit = true;
              break;
            }

            travel += max(distanceToSurface * 0.74, 0.006);

            if (travel > MAX_DISTANCE) {
              stepRatio = float(i) / float(MAX_STEPS);
              break;
            }
          }

          vec3 color = mix(
            vec3(0.006, 0.009, 0.012),
            vec3(0.032, 0.028, 0.025),
            smoothstep(-0.85, 0.9, uv.y)
          );

          if (hit) {
            vec3 normal = estimateNormal(point);
            vec3 lightDirection = normalize(vec3(-0.42, 0.78, 0.47));
            float diffuse = max(dot(normal, lightDirection), 0.0);
            float rim = pow(1.0 - max(dot(normal, -rayDirection), 0.0), 2.05);
            float cavity = smoothstep(0.98, 0.12, stepRatio);
            float cells = sin(point.x * 7.0) * sin(point.y * 7.0) * sin(point.z * 7.0);
            float band = length(point) * 0.28 + normal.y * 0.22 + cells * 0.045 + uTime * 0.012;
            vec3 base = paletteRamp(band + uSeedPhase * 0.03);

            color = base * (0.18 + diffuse * 0.9) * cavity;
            color += paletteRamp(band + 0.36) * rim * (0.38 + uBloom * 0.58);
            color += vec3(1.0, 0.93, 0.78) * pow(diffuse, 22.0) * (0.34 + uBloom * 0.62);
          }

          color += paletteRamp(length(uv) * 0.08 + uSeedPhase * 0.04 + uTime * 0.01) * glow * (1.35 + uBloom * 2.15);
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
