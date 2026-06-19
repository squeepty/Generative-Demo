import * as THREE from 'three';

function makeColorUniforms(colors) {
  return colors.map((value) => new THREE.Color(value));
}

function normalizedDensity(density) {
  return THREE.MathUtils.clamp((density - 900) / (5200 - 900), 0, 1);
}

export const mandelbulbFractal = {
  id: 'mandelbulb-fractal',
  label: 'Mandelbulb Fractal',
  math: {
    summary:
      'A distance-estimated Mandelbulb is raymarched in the fragment shader. The bulb is the 3D analogue of z -> z^n + c using spherical coordinates.',
    rows: [
      {
        label: 'Power Map',
        body: 'r, theta, phi = spherical(z); z = r^8 * (sin(8theta)cos(8phi), sin(8theta)sin(8phi), cos(8theta)) + c'
      },
      {
        label: 'Distance Estimate',
        body: 'd ~= 0.5 * log(r) * r / dr; ray steps advance by this estimate until d is near zero.'
      },
      {
        label: 'Shading',
        body: 'Normals are estimated from local distance gradients, then diffuse, rim, cavity, and glow terms color the surface.'
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

        const int MAX_STEPS = 58;
        const int FRACTAL_STEPS = 7;
        const float MAX_DISTANCE = 7.5;

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

        float mandelbulbDistance(vec3 point) {
          vec3 z = point;
          float dr = 1.0;
          float radius = 0.0;
          float power = 8.0;

          for (int i = 0; i < FRACTAL_STEPS; i++) {
            radius = length(z);

            if (radius > 2.0) {
              break;
            }

            float safeRadius = max(radius, 0.0001);
            float theta = acos(clamp(z.z / safeRadius, -1.0, 1.0));
            float phi = atan(z.y, z.x);
            float zr = pow(safeRadius, power);

            dr = pow(safeRadius, power - 1.0) * power * dr + 1.0;
            theta *= power;
            phi *= power;

            z = zr * vec3(
              sin(theta) * cos(phi),
              sin(phi) * sin(theta),
              cos(theta)
            );
            z += point;
          }

          return 0.5 * log(max(radius, 0.0001)) * radius / dr;
        }

        vec3 estimateNormal(vec3 point) {
          vec2 e = vec2(0.002, -0.002);
          return normalize(
            e.xyy * mandelbulbDistance(point + e.xyy) +
            e.yyx * mandelbulbDistance(point + e.yyx) +
            e.yxy * mandelbulbDistance(point + e.yxy) +
            e.xxx * mandelbulbDistance(point + e.xxx)
          );
        }

        void main() {
          vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
          uv /= max(uZoom, 0.001);
          float portrait = step(uResolution.x, uResolution.y);
          uv.y -= portrait * 0.36;
          float flow = 0.35 + uFlow * 1.35;
          float orbit = uTime * 0.13 * flow + 0.58;
          vec3 rayOrigin = vec3(
            sin(orbit) * 3.15,
            0.72 + sin(orbit * 0.8) * 0.32,
            cos(orbit) * 3.15
          );
          vec3 target = vec3(0.0, -0.05, 0.0);
          mat3 camera = lookAt(rayOrigin, target);
          vec3 rayDirection = camera * normalize(vec3(uv, 1.65));

          float travel = 0.0;
          float glow = 0.0;
          float stepRatio = 1.0;
          bool hit = false;
          vec3 point = rayOrigin;

          for (int i = 0; i < MAX_STEPS; i++) {
            point = rayOrigin + rayDirection * travel;
            float distanceToSurface = mandelbulbDistance(point);
            float field = abs(distanceToSurface);
            float surfaceDistance = mix(0.0075, 0.0035, uDetail);

            glow += exp(-field * mix(30.0, 44.0, uDetail)) * 0.012;

            if (field < surfaceDistance) {
              stepRatio = float(i) / float(MAX_STEPS);
              hit = true;
              break;
            }

            travel += max(distanceToSurface * 0.82, 0.008);

            if (travel > MAX_DISTANCE) {
              stepRatio = float(i) / float(MAX_STEPS);
              break;
            }
          }

          vec3 bgTop = vec3(0.035, 0.025, 0.028);
          vec3 bgBottom = vec3(0.006, 0.008, 0.012);
          vec3 color = mix(bgBottom, bgTop, smoothstep(-0.8, 0.8, uv.y));

          if (hit) {
            vec3 normal = estimateNormal(point);
            vec3 lightDirection = normalize(vec3(-0.35, 0.78, 0.42));
            float diffuse = max(dot(normal, lightDirection), 0.0);
            float rim = pow(1.0 - max(dot(normal, -rayDirection), 0.0), 2.15);
            float cavity = smoothstep(0.95, 0.15, stepRatio);
            float band = length(point) * 0.34 + point.y * 0.24 + sin(point.x * 2.0 + point.z) * 0.08;
            vec3 base = paletteRamp(band + uTime * 0.015);

            color = base * (0.18 + diffuse * 0.92) * cavity;
            color += paletteRamp(band + 0.42) * rim * (0.42 + uBloom * 0.4);
            color += vec3(1.0, 0.92, 0.78) * pow(diffuse, 18.0) * (0.55 + uBloom);
          }

          vec3 glowColor = paletteRamp(0.18 + length(uv) * 0.08 + uTime * 0.012);
          color += glowColor * glow * (1.2 + uBloom * 1.8);
          color = pow(color, vec3(0.86));

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
