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

export const mandelbulbHybrid = {
  id: 'mandelbulb-hybrid',
  label: 'Mandelbulb Hybrid',
  math: {
    summary:
      'A project-authored Mandelbulb variant that mixes the spherical power map with absolute-value folds and box-fold perturbations. The hybrid creates coral-like ridges and nested lobes.',
    rows: [
      {
        label: 'Folded Space',
        body: 'z = abs(z); z = clamp(z, -fold, fold)*2 - z before the bulb power map.'
      },
      {
        label: 'Power Map',
        body: 'r, theta, phi = spherical(z); z = r^p * spherical(p*theta, p*phi) + c*p0.'
      },
      {
        label: 'Distance Estimate',
        body: 'd ~= 0.5 * log(r) * r / dr, with dr updated through the hybrid iteration.'
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

        const int MAX_STEPS = 66;
        const int FRACTAL_STEPS = 8;
        const int BOX_STEPS = 8;
        const float MAX_DISTANCE = 8.4;

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

        vec3 boxFold(vec3 z, float fold) {
          return clamp(z, -fold, fold) * 2.0 - z;
        }

        float mandelbulbCore(vec3 point) {
          vec3 z = point;
          float derivative = 1.0;
          float radius = 0.0;
          float power = mix(6.0, 9.0, 0.5 + 0.5 * sin(uSeedPhase * 1.7));

          for (int i = 0; i < FRACTAL_STEPS; i++) {
            radius = length(z);

            if (radius > 2.3) {
              break;
            }

            float safeRadius = max(radius, 0.0001);
            float theta = acos(clamp(z.z / safeRadius, -1.0, 1.0));
            float phi = atan(z.y, z.x);
            float zr = pow(safeRadius, power);

            derivative = pow(safeRadius, power - 1.0) * power * derivative + 1.0;
            theta = theta * power + sin(float(i) + uSeedPhase) * 0.08;
            phi = phi * power + cos(float(i) * 0.7 + uSeedPhase) * 0.06;

            z = zr * vec3(
              sin(theta) * cos(phi),
              sin(theta) * sin(phi),
              cos(theta)
            );
            z += point * mix(0.82, 0.98, uDetail);
          }

          return 0.5 * log(max(radius, 1.0001)) * radius / max(derivative, 0.0001);
        }

        float mandelboxCore(vec3 point) {
          vec3 z = point;
          float derivative = 1.0;
          float scale = mix(-1.38, -1.68, uDetail);
          float minRadius2 = 0.24;
          float fixedRadius2 = 1.0;

          for (int i = 0; i < BOX_STEPS; i++) {
            z = boxFold(z, 1.0);

            float radius2 = dot(z, z);

            if (radius2 < minRadius2) {
              float foldScale = fixedRadius2 / minRadius2;
              z *= foldScale;
              derivative *= foldScale;
            } else if (radius2 < fixedRadius2) {
              float foldScale = fixedRadius2 / max(radius2, 0.0001);
              z *= foldScale;
              derivative *= foldScale;
            }

            z.xy = rotate2d(0.08 + uSeedPhase * 0.02) * z.xy;
            z = z * scale + point;
            derivative = derivative * abs(scale) + 1.0;
          }

          return length(z) / abs(derivative);
        }

        float hybridDistance(vec3 point) {
          vec3 foldedPoint = point;
          foldedPoint.xy = rotate2d(0.28 + uSeedPhase * 0.08) * foldedPoint.xy;
          foldedPoint = mix(foldedPoint, boxFold(foldedPoint, 1.05), 0.08 + uDetail * 0.04);
          foldedPoint = mix(foldedPoint, abs(foldedPoint) - vec3(0.12, 0.04, 0.09), 0.18 + uDetail * 0.1);

          return max(mandelbulbCore(foldedPoint) * 0.92, 0.00045);
        }

        float hybridTrap(vec3 point) {
          vec3 z = point;
          float trap = 12.0;
          float fold = mix(0.72, 0.54, uDetail);

          for (int i = 0; i < FRACTAL_STEPS; i++) {
            z = abs(z);
            z = boxFold(z, fold);
            trap = min(trap, abs(length(z.xy) - 0.38));
            trap = min(trap, abs(z.z) + abs(z.x - z.y) * 0.35);
            z = normalize(z + 0.0001) * pow(max(length(z), 0.0001), 1.18) + point * 0.72;

            if (length(z) > 3.2) {
              break;
            }
          }

          return trap;
        }

        vec3 estimateNormal(vec3 point) {
          vec2 e = vec2(0.002, -0.002);
          return normalize(
            e.xyy * hybridDistance(point + e.xyy) +
            e.yyx * hybridDistance(point + e.yyx) +
            e.yxy * hybridDistance(point + e.yxy) +
            e.xxx * hybridDistance(point + e.xxx)
          );
        }

        void main() {
          vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
          uv /= max(uZoom, 0.001);
          float portrait = step(uResolution.x, uResolution.y);
          uv.y -= portrait * 0.34;

          float orbit = uSeedPhase * 0.14 + uTime * (0.08 + uFlow * 0.22);
          vec3 rayOrigin = vec3(
            sin(orbit) * 3.75,
            0.7 + sin(orbit * 0.83 + uSeedPhase) * 0.3,
            cos(orbit) * 3.75
          );
          vec3 target = vec3(0.0, -0.04, 0.0);
          mat3 camera = lookAt(rayOrigin, target);
          vec3 rayDirection = camera * normalize(vec3(uv, 1.34));

          float travel = 0.0;
          float glow = 0.0;
          float stepRatio = 1.0;
          bool hit = false;
          vec3 point = rayOrigin;

          for (int i = 0; i < MAX_STEPS; i++) {
            point = rayOrigin + rayDirection * travel;
            point.xz = rotate2d(uTime * 0.028 * uFlow) * point.xz;
            float distanceToSurface = hybridDistance(point);
            float surfaceDistance = mix(0.008, 0.0035, uDetail);

            glow += exp(-distanceToSurface * mix(22.0, 48.0, uDetail)) * 0.0045;

            if (distanceToSurface < surfaceDistance) {
              stepRatio = float(i) / float(MAX_STEPS);
              hit = true;
              break;
            }

            travel += max(distanceToSurface * 0.76, 0.006);

            if (travel > MAX_DISTANCE) {
              stepRatio = float(i) / float(MAX_STEPS);
              break;
            }
          }

          vec3 color = mix(
            vec3(0.006, 0.008, 0.012),
            vec3(0.032, 0.026, 0.03),
            smoothstep(-0.85, 0.88, uv.y)
          );

          if (hit) {
            vec3 normal = estimateNormal(point);
            vec3 lightDirection = normalize(vec3(-0.38, 0.78, 0.48));
            float diffuse = max(dot(normal, lightDirection), 0.0);
            float rim = pow(1.0 - max(dot(normal, -rayDirection), 0.0), 2.0);
            float cavity = smoothstep(0.98, 0.14, stepRatio);
            float trap = hybridTrap(point);
            float ridge = exp(-trap * 7.5);
            float band = length(point) * 0.3 + normal.y * 0.18 + trap * 0.72 + uTime * 0.012;
            vec3 base = paletteRamp(band + uSeedPhase * 0.03);

            color = base * (0.16 + diffuse * 0.92) * cavity;
            color += paletteRamp(band + 0.37) * rim * (0.42 + uBloom * 0.58);
            color += paletteRamp(trap * 0.7 + 0.2) * ridge * (0.12 + uBloom * 0.34);
            color += vec3(1.0, 0.9, 0.72) * pow(diffuse, 18.0) * (0.34 + uBloom * 0.55);
          }

          color += paletteRamp(length(uv) * 0.08 + uSeedPhase * 0.04 + uTime * 0.01) * glow * (0.8 + uBloom * 1.2);
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
