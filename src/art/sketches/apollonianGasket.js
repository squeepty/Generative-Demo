import * as THREE from 'three';
import { mulberry32 } from '../random.js';

const TAU = Math.PI * 2;
const OUTER_BEND = -1;
const INNER_BEND = 1 + 2 / Math.sqrt(3);

function normalizedDensity(density) {
  return THREE.MathUtils.clamp((density - 900) / (5200 - 900), 0, 1);
}

function circleKey(circle) {
  return `${Math.round(circle.x * 100000)}:${Math.round(circle.y * 100000)}:${Math.round(
    circle.k * 100000
  )}`;
}

function createCircle(k, x, y, depth) {
  return {
    k,
    x,
    y,
    depth,
    r: 1 / Math.abs(k)
  };
}

function replaceCircle(tuple, index, depth) {
  let bendSum = 0;
  let weightedX = 0;
  let weightedY = 0;

  for (let i = 0; i < tuple.length; i += 1) {
    if (i === index) {
      continue;
    }

    const circle = tuple[i];
    bendSum += circle.k;
    weightedX += circle.k * circle.x;
    weightedY += circle.k * circle.y;
  }

  const old = tuple[index];
  const nextBend = 2 * bendSum - old.k;

  if (Math.abs(nextBend) < 0.00001) {
    return null;
  }

  return createCircle(
    nextBend,
    (2 * weightedX - old.k * old.x) / nextBend,
    (2 * weightedY - old.k * old.y) / nextBend,
    depth
  );
}

function isVisibleCircle(circle, minRadius) {
  return (
    Number.isFinite(circle.x) &&
    Number.isFinite(circle.y) &&
    Number.isFinite(circle.r) &&
    circle.k > 0 &&
    circle.r >= minRadius &&
    Math.hypot(circle.x, circle.y) + circle.r <= 1.002
  );
}

function buildGasket(density, seed) {
  const random = mulberry32(seed + 2309);
  const detail = normalizedDensity(density);
  const targetCount = Math.round(THREE.MathUtils.lerp(240, 2600, detail));
  const minRadius = THREE.MathUtils.lerp(0.026, 0.0048, detail);
  const maxDepth = Math.round(THREE.MathUtils.lerp(7, 12, detail));
  const innerRadius = 1 / INNER_BEND;
  const centerRadius = 1 - innerRadius;
  const rotation = random() * TAU;
  const outer = createCircle(OUTER_BEND, 0, 0, 0);
  const initial = [outer];
  const circles = [];
  const seen = new Set();

  for (let i = 0; i < 3; i += 1) {
    const angle = rotation + i * TAU / 3;
    const circle = createCircle(
      INNER_BEND,
      Math.cos(angle) * centerRadius,
      Math.sin(angle) * centerRadius,
      0
    );

    initial.push(circle);
    circles.push(circle);
    seen.add(circleKey(circle));
  }

  const queue = [{ tuple: initial, depth: 0 }];

  for (let cursor = 0; cursor < queue.length && circles.length < targetCount; cursor += 1) {
    const { tuple, depth } = queue[cursor];

    if (depth >= maxDepth) {
      continue;
    }

    for (let index = 0; index < tuple.length && circles.length < targetCount; index += 1) {
      const next = replaceCircle(tuple, index, depth + 1);

      if (!next || !isVisibleCircle(next, minRadius)) {
        continue;
      }

      const key = circleKey(next);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      circles.push(next);

      const nextTuple = [...tuple];
      nextTuple[index] = next;
      queue.push({ tuple: nextTuple, depth: depth + 1 });
    }
  }

  return circles.sort((a, b) => b.r - a.r);
}

function paletteColor(palette, circle, index) {
  const angle = Math.atan2(circle.y, circle.x) / TAU + 0.5;
  const bendBand = Math.log(circle.k) * 0.16;
  const depthBand = circle.depth * 0.075;
  const t = (angle * 0.44 + bendBand + depthBand + index * 0.003) % 1;
  const scaled = t * palette.colors.length;
  const colorA = new THREE.Color(palette.colors[Math.floor(scaled) % palette.colors.length]);
  const colorB = new THREE.Color(palette.colors[(Math.floor(scaled) + 1) % palette.colors.length]);

  return colorA.lerp(colorB, scaled % 1).multiplyScalar(0.78 + Math.min(circle.k * 0.01, 0.32));
}

export const apollonianGasket = {
  id: 'apollonian-gasket',
  label: 'Apollonian Gasket',
  math: {
    summary:
      'An Apollonian gasket recursively packs mutually tangent circles. Each circle is lifted into a solid, producing a stepped three-dimensional packing governed by the same curvature rule.',
    rows: [
      {
        label: 'Curvature',
        body: 'For a circle of radius r, curvature is k = 1/r. The enclosing circle is represented with negative curvature.'
      },
      {
        label: 'Descartes',
        body: '(k1 + k2 + k3 + k4)^2 = 2*(k1^2 + k2^2 + k3^2 + k4^2) for four mutually tangent circles.'
      },
      {
        label: 'Replacement',
        body: 'Given one solution k, the other tangent circle has kNew = 2*(ka + kb + kc) - k.'
      },
      {
        label: 'Relief',
        body: 'The circle radius controls its footprint while recursion depth and position set its height, making the packing readable from an oblique view.'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const circles = buildGasket(state.density, state.seed);
    const diskGeometry = new THREE.CylinderGeometry(0.96, 0.96, 1, 40, 1, false);
    diskGeometry.rotateX(Math.PI / 2);
    const diskMaterial = new THREE.ShaderMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      uniforms: {
        uBloom: { value: state.bloom }
      },
      vertexShader: `
        varying vec3 vColor;
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
          vColor = instanceColor;
          mat4 instanceModel = modelMatrix * instanceMatrix;
          vec4 worldPosition = instanceModel * vec4(position, 1.0);
          vPosition = worldPosition.xyz;
          vNormal = normalize(mat3(instanceModel) * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        precision highp float;

        varying vec3 vColor;
        varying vec3 vNormal;
        varying vec3 vPosition;
        uniform float uBloom;

        void main() {
          vec3 normal = normalize(vNormal);
          vec3 light = normalize(vec3(-0.5, 0.72, 0.68));
          float diffuse = max(dot(normal, light), 0.0);
          float side = pow(1.0 - abs(normal.z), 1.2);
          float elevation = smoothstep(-0.18, 0.48, vPosition.z);
          vec3 color = vColor * (0.32 + diffuse * 0.84 + side * 0.28);
          color += vColor * elevation * (0.09 + uBloom * 0.24);
          color += vec3(1.0, 0.83, 0.55) * side * uBloom * 0.16;
          gl_FragColor = vec4(pow(color, vec3(0.84)), 1.0);
        }
      `
    });
    const disks = new THREE.InstancedMesh(diskGeometry, diskMaterial, circles.length);
    const boundaryGeometry = new THREE.TorusGeometry(1.012, 0.025, 8, 96);
    boundaryGeometry.rotateX(Math.PI / 2);
    const boundaryMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette.colors[1] ?? palette.colors[0]).multiplyScalar(1.35),
      transparent: true,
      opacity: 0.82
    });
    const boundary = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const object = new THREE.Group();

    disks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    disks.frustumCulled = false;
    boundary.position.z = 0.01;
    boundary.renderOrder = 2;

    circles.forEach((circle, index) => {
      const angle = Math.atan2(circle.y, circle.x);
      const z =
        0.025 +
        circle.depth * 0.023 +
        Math.sin(angle * 3.0 + Math.log(circle.r) * 2.5) * (0.035 + circle.r * 0.075);
      const thickness = 0.032 + Math.min(circle.r, 0.46) * 0.27 + (circle.depth < 3 ? 0.025 : 0);
      const circleColor = paletteColor(palette, circle, index);

      dummy.position.set(circle.x, circle.y, z);
      dummy.scale.set(circle.r, circle.r, thickness);
      dummy.updateMatrix();
      disks.setMatrixAt(index, dummy.matrix);
      disks.setColorAt(index, color.copy(circleColor).multiplyScalar(0.98));
    });

    disks.instanceMatrix.needsUpdate = true;
    disks.instanceColor.needsUpdate = true;
    object.add(disks, boundary);

    const applyResponsiveTransform = (zoom) => {
      const isPortrait = renderer.domElement.height > renderer.domElement.width;
      object.scale.setScalar((zoom ?? 1) * (isPortrait ? 1.46 : 2.72));
      object.position.y = isPortrait ? 0.48 : 0;
    };

    applyResponsiveTransform(state.zoom);

    return {
      object,
      resize() {
        applyResponsiveTransform(state.zoom);
      },
      update(elapsed, nextState) {
        applyResponsiveTransform(nextState.zoom);
        diskMaterial.uniforms.uBloom.value = nextState.bloom;
        boundaryMaterial.opacity = 0.58 + nextState.bloom * 0.34;
        object.rotation.x = -0.48 + Math.sin(elapsed * 0.15) * 0.07;
        object.rotation.y = 0.26 + Math.sin(elapsed * 0.11) * 0.11;
        object.rotation.z = elapsed * (0.012 + nextState.flow * 0.03);
      },
      dispose() {
        diskGeometry.dispose();
        boundaryGeometry.dispose();
        diskMaterial.dispose();
        boundaryMaterial.dispose();
      }
    };
  }
};
