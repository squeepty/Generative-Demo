import * as THREE from 'three';

function makeColorUniforms(colors) {
  return colors.map((value) => new THREE.Color(value));
}

function normalizedDensity(density) {
  return THREE.MathUtils.clamp((density - 900) / (5200 - 900), 0, 1);
}

export const mandelboxFractal = {
  id: 'mandelbox-fractal',
  label: 'Mandelbox Fractal',
  math: {
    summary:
      'A Mandelbox is raymarched with repeated box folds, sphere folds, and scaling. The folds turn space inside out until architectural chambers and crystal-like struts emerge.',
    rows: [
      {
        label: 'Box Fold',
        body: 'z = clamp(z, -1, 1)*2 - z; coordinates outside the box reflect back inward.'
      },
      {
        label: 'Sphere Fold',
        body: 'If |z| is small, scale outward; if it is inside the fixed radius, invert by fixedRadius^2 / |z|^2.'
      },
      {
        label: 'Distance',
        body: 'The accumulated derivative dr gives a distance estimate, letting the fragment shader raymarch the folded solid.'
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
        uniform vec2 uResolution;
        uniform vec3 uColor0;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;

        const int MAX_STEPS = 72;
        const int FRACTAL_STEPS = 11;
        const float MAX_DISTANCE = 11.5;

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

        float mandelboxDistance(vec3 point) {
          vec3 z = point;
          float derivative = 1.0;
          float scale = mix(-1.42, -1.82, uDetail);
          float minRadius2 = 0.22;
          float fixedRadius2 = 1.0;

          for (int i = 0; i < FRACTAL_STEPS; i++) {
            z = clamp(z, -1.0, 1.0) * 2.0 - z;

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

            z = z * scale + point;
            derivative = derivative * abs(scale) + 1.0;
          }

          return length(z) / abs(derivative);
        }

        vec3 estimateNormal(vec3 point) {
          vec2 e = vec2(0.0025, -0.0025);
          return normalize(
            e.xyy * mandelboxDistance(point + e.xyy) +
            e.yyx * mandelboxDistance(point + e.yyx) +
            e.yxy * mandelboxDistance(point + e.yxy) +
            e.xxx * mandelboxDistance(point + e.xxx)
          );
        }

        void main() {
          vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
          uv /= max(uZoom, 0.001);
          float portrait = step(uResolution.x, uResolution.y);
          uv.y -= portrait * 0.3;

          float orbit = uTime * (0.07 + uFlow * 0.22) + 0.7;
          vec3 rayOrigin = vec3(
            sin(orbit) * 3.4,
            1.15 + sin(orbit * 0.67) * 0.34,
            cos(orbit) * 3.4
          );
          vec3 target = vec3(0.0, 0.03, 0.0);
          mat3 camera = lookAt(rayOrigin, target);
          vec3 rayDirection = camera * normalize(vec3(uv, 1.55));

          float travel = 0.0;
          float glow = 0.0;
          float stepRatio = 1.0;
          bool hit = false;
          vec3 point = rayOrigin;

          for (int i = 0; i < MAX_STEPS; i++) {
            point = rayOrigin + rayDirection * travel;
            vec3 foldedPoint = point;
            foldedPoint.xz = rotate2d(uTime * 0.035 * uFlow) * foldedPoint.xz;
            float distanceToSurface = mandelboxDistance(foldedPoint);
            float surfaceDistance = mix(0.009, 0.0038, uDetail);

            glow += exp(-abs(distanceToSurface) * mix(20.0, 42.0, uDetail)) * 0.01;

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

          vec3 color = mix(vec3(0.006, 0.008, 0.012), vec3(0.032, 0.024, 0.03), smoothstep(-0.8, 0.9, uv.y));

          if (hit) {
            vec3 foldedPoint = point;
            foldedPoint.xz = rotate2d(uTime * 0.035 * uFlow) * foldedPoint.xz;
            vec3 normal = estimateNormal(foldedPoint);
            vec3 lightDirection = normalize(vec3(-0.48, 0.72, 0.52));
            float diffuse = max(dot(normal, lightDirection), 0.0);
            float rim = pow(1.0 - max(dot(normal, -rayDirection), 0.0), 2.0);
            float cavity = smoothstep(1.0, 0.12, stepRatio);
            float band = length(foldedPoint) * 0.3 + foldedPoint.y * 0.2 + normal.x * 0.12;
            vec3 base = paletteRamp(band + uTime * 0.012);

            color = base * (0.16 + diffuse * 0.95) * cavity;
            color += paletteRamp(band + 0.37) * rim * (0.36 + uBloom * 0.58);
            color += vec3(1.0, 0.92, 0.74) * pow(diffuse, 20.0) * (0.3 + uBloom * 0.5);
          }

          color += paletteRamp(length(uv) * 0.06 + uTime * 0.01) * glow * (1.4 + uBloom * 2.2);
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
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      }
    };
  }
};
