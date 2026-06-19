import * as THREE from 'three';
import { mulberry32 } from '../random.js';

const SIGMA = 10;
const RHO = 28;
const BETA = 8 / 3;
const DT = 0.006;
const TRAILS = 3;

function derivative(point) {
  return {
    x: SIGMA * (point.y - point.x),
    y: point.x * (RHO - point.z) - point.y,
    z: point.x * point.y - BETA * point.z
  };
}

function rk4Step(point, dt) {
  const k1 = derivative(point);
  const k2 = derivative({
    x: point.x + k1.x * dt * 0.5,
    y: point.y + k1.y * dt * 0.5,
    z: point.z + k1.z * dt * 0.5
  });
  const k3 = derivative({
    x: point.x + k2.x * dt * 0.5,
    y: point.y + k2.y * dt * 0.5,
    z: point.z + k2.z * dt * 0.5
  });
  const k4 = derivative({
    x: point.x + k3.x * dt,
    y: point.y + k3.y * dt,
    z: point.z + k3.z * dt
  });

  return {
    x: point.x + (dt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
    y: point.y + (dt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
    z: point.z + (dt / 6) * (k1.z + 2 * k2.z + 2 * k3.z + k4.z)
  };
}

function samplePalette(colors, t) {
  const wrapped = ((t % 1) + 1) % 1;
  const scaled = wrapped * colors.length;
  const index = Math.floor(scaled) % colors.length;
  const nextIndex = (index + 1) % colors.length;

  return new THREE.Color(colors[index]).lerp(new THREE.Color(colors[nextIndex]), scaled - index);
}

function pointCountForDensity(density) {
  return Math.round(THREE.MathUtils.clamp(density * 2.7, 2400, 15000));
}

export const lorenzAttractor = {
  id: 'lorenz-attractor',
  label: 'Lorenz Attractor',
  math: {
    summary:
      'The Lorenz attractor integrates three coupled differential equations. Nearby starting points separate quickly, yet the orbit stays folded into a stable butterfly-shaped strange attractor.',
    rows: [
      {
        label: 'System',
        body: 'dx/dt = sigma(y - x); dy/dt = x(rho - z) - y; dz/dt = xy - beta*z'
      },
      {
        label: 'Parameters',
        body: 'sigma = 10, rho = 28, beta = 8/3. This classic chaotic regime produces the two-lobed attractor.'
      },
      {
        label: 'Integration',
        body: 'A fourth-order Runge-Kutta step advances the orbit; density controls how many phase-space samples are drawn.'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const random = mulberry32(state.seed + 1103);
    const count = pointCountForDensity(state.density);
    const pointsPerTrail = Math.floor(count / TRAILS);
    const actualCount = pointsPerTrail * TRAILS;
    const segmentCount = TRAILS * Math.max(pointsPerTrail - 1, 0);
    const positions = new Float32Array(actualCount * 3);
    const colors = new Float32Array(actualCount * 3);
    const sizes = new Float32Array(actualCount);
    const phases = new Float32Array(actualCount);
    const linePositions = new Float32Array(segmentCount * 2 * 3);
    const lineColors = new Float32Array(segmentCount * 2 * 3);

    for (let trail = 0; trail < TRAILS; trail += 1) {
      let point = {
        x: 0.1 + random() * 0.45 + trail * 0.018,
        y: 0.1 + random() * 0.45 - trail * 0.014,
        z: 0.1 + random() * 0.45
      };
      const warmup = 650 + trail * 110;

      for (let i = 0; i < warmup; i += 1) {
        point = rk4Step(point, DT);
      }

      for (let i = 0; i < pointsPerTrail; i += 1) {
        point = rk4Step(point, DT);

        const index = trail * pointsPerTrail + i;
        const progress = i / Math.max(pointsPerTrail - 1, 1);
        const x = point.x * 0.112;
        const y = (point.z - 25) * 0.106;
        const z = point.y * 0.096;
        const color = samplePalette(
          palette.colors,
          progress * 0.82 + trail * 0.19 + Math.sin(point.z * 0.05) * 0.035
        ).multiplyScalar(0.78 + random() * 0.44);

        positions[index * 3] = x;
        positions[index * 3 + 1] = y;
        positions[index * 3 + 2] = z;
        colors[index * 3] = color.r;
        colors[index * 3 + 1] = color.g;
        colors[index * 3 + 2] = color.b;
        sizes[index] = 4.5 + random() * 13.5 + Math.sin(progress * Math.PI) * 2.5;
        phases[index] = progress * Math.PI * 8 + trail * 1.7;
      }
    }

    for (let trail = 0; trail < TRAILS; trail += 1) {
      for (let i = 0; i < pointsPerTrail - 1; i += 1) {
        const pointIndex = trail * pointsPerTrail + i;
        const segmentIndex = (trail * (pointsPerTrail - 1) + i) * 6;

        linePositions.set(positions.subarray(pointIndex * 3, pointIndex * 3 + 3), segmentIndex);
        linePositions.set(
          positions.subarray(pointIndex * 3 + 3, pointIndex * 3 + 6),
          segmentIndex + 3
        );
        lineColors.set(colors.subarray(pointIndex * 3, pointIndex * 3 + 3), segmentIndex);
        lineColors.set(colors.subarray(pointIndex * 3 + 3, pointIndex * 3 + 6), segmentIndex + 3);
      }
    }

    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pointGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    pointGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    pointGeometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

    const pointMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: {
        uTime: { value: 0 },
        uFlow: { value: state.flow },
        uBloom: { value: state.bloom },
        uPixelRatio: { value: renderer.getPixelRatio() }
      },
      vertexShader: `
        attribute float size;
        attribute float phase;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uTime;
        uniform float uFlow;
        uniform float uPixelRatio;

        void main() {
          vColor = color;
          vec3 p = position;
          float shimmer = sin(phase + uTime * (0.42 + uFlow * 1.8));
          p.x += shimmer * 0.055 * uFlow;
          p.y += cos(phase * 0.7 + uTime * 0.38) * 0.045 * uFlow;
          p.z += sin(phase * 1.2 - uTime * 0.5) * 0.05 * uFlow;

          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = size * uPixelRatio * (6.5 / -mvPosition.z);
          vAlpha = 0.32 + abs(shimmer) * 0.5;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uBloom;

        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float distanceFromCenter = length(center);
          float core = smoothstep(0.48, 0.04, distanceFromCenter);
          float halo = smoothstep(0.5, 0.0, distanceFromCenter) * uBloom;
          float alpha = (core * 0.74 + halo * 0.3) * vAlpha;
          gl_FragColor = vec4(vColor * (1.0 + uBloom), alpha);
        }
      `
    });

    const lineMaterial = new THREE.LineBasicMaterial({
      transparent: true,
      opacity: 0.2 + state.bloom * 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });

    const object = new THREE.Group();
    const line = new THREE.LineSegments(lineGeometry, lineMaterial);
    const points = new THREE.Points(pointGeometry, pointMaterial);
    object.add(line, points);

    const applyResponsiveTransform = (zoom) => {
      const isPortrait = renderer.domElement.height > renderer.domElement.width;
      object.scale.setScalar((zoom ?? 1) * (isPortrait ? 0.72 : 1));
      object.position.y = isPortrait ? 0.42 : 0;
    };

    applyResponsiveTransform(state.zoom);

    return {
      object,
      resize(pixelRatio) {
        pointMaterial.uniforms.uPixelRatio.value = pixelRatio;
        applyResponsiveTransform(state.zoom);
      },
      update(elapsed, nextState) {
        pointMaterial.uniforms.uTime.value = elapsed;
        pointMaterial.uniforms.uFlow.value = nextState.flow;
        pointMaterial.uniforms.uBloom.value = nextState.bloom;
        lineMaterial.opacity = 0.18 + nextState.bloom * 0.28;
        applyResponsiveTransform(nextState.zoom);

        object.rotation.x = -0.08 + Math.sin(elapsed * 0.13) * 0.08;
        object.rotation.y = 0.48 + elapsed * (0.018 + nextState.flow * 0.05);
        object.rotation.z = -0.03 + Math.cos(elapsed * 0.1) * 0.025;
      },
      dispose() {
        pointGeometry.dispose();
        lineGeometry.dispose();
        pointMaterial.dispose();
        lineMaterial.dispose();
      }
    };
  }
};
