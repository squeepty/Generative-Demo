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
      'An Apollonian gasket recursively packs mutually tangent circles. Each new circle is forced by the curvatures and centers of three existing tangent neighbors.',
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
      }
    ]
  },
  create({ renderer, state, palette }) {
    const circles = buildGasket(state.density, state.seed);
    const ringGeometry = new THREE.RingGeometry(0.92, 1, 72, 1);
    const fillGeometry = new THREE.CircleGeometry(0.92, 72);
    const ringMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uBloom: { value: state.bloom },
        uAlpha: { value: 0.72 }
      },
      vertexShader: `
        varying vec3 vColor;

        void main() {
          vColor = instanceColor;
          mat4 instanceModel = modelMatrix * instanceMatrix;
          vec4 worldPosition = instanceModel * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        precision highp float;

        varying vec3 vColor;
        uniform float uBloom;
        uniform float uAlpha;

        void main() {
          vec3 color = vColor * (0.9 + uBloom * 0.85);
          color += vec3(1.0, 0.92, 0.72) * uBloom * 0.18;
          gl_FragColor = vec4(pow(color, vec3(0.82)), uAlpha);
        }
      `
    });
    const fillMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uBloom: { value: state.bloom },
        uAlpha: { value: 0.13 }
      },
      vertexShader: `
        varying vec3 vColor;

        void main() {
          vColor = instanceColor;
          mat4 instanceModel = modelMatrix * instanceMatrix;
          vec4 worldPosition = instanceModel * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        precision highp float;

        varying vec3 vColor;
        uniform float uBloom;
        uniform float uAlpha;

        void main() {
          vec3 color = vColor * (0.22 + uBloom * 0.18);
          gl_FragColor = vec4(color, uAlpha);
        }
      `
    });
    const rings = new THREE.InstancedMesh(ringGeometry, ringMaterial, circles.length + 1);
    const fills = new THREE.InstancedMesh(fillGeometry, fillMaterial, circles.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const boundaryColor = new THREE.Color(palette.colors[1] ?? palette.colors[0]).multiplyScalar(0.9);
    const object = new THREE.Group();

    rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    fills.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    fills.renderOrder = 1;
    rings.renderOrder = 2;

    dummy.position.set(0, 0, -0.01);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    rings.setMatrixAt(0, dummy.matrix);
    rings.setColorAt(0, boundaryColor);

    circles.forEach((circle, index) => {
      const z = 0.04 * Math.sin(circle.depth * 0.7 + circle.k * 0.02);
      const circleColor = paletteColor(palette, circle, index);

      dummy.position.set(circle.x, circle.y, z);
      dummy.scale.setScalar(circle.r);
      dummy.updateMatrix();
      rings.setMatrixAt(index + 1, dummy.matrix);
      rings.setColorAt(index + 1, color.copy(circleColor).multiplyScalar(1.12));

      dummy.position.z = z - 0.012;
      dummy.updateMatrix();
      fills.setMatrixAt(index, dummy.matrix);
      fills.setColorAt(index, color.copy(circleColor));
    });

    rings.instanceMatrix.needsUpdate = true;
    rings.instanceColor.needsUpdate = true;
    fills.instanceMatrix.needsUpdate = true;
    fills.instanceColor.needsUpdate = true;
    object.add(fills, rings);

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
        ringMaterial.uniforms.uBloom.value = nextState.bloom;
        fillMaterial.uniforms.uBloom.value = nextState.bloom;
        object.rotation.x = -0.05 + Math.sin(elapsed * 0.15) * 0.035;
        object.rotation.y = Math.sin(elapsed * 0.11) * 0.06;
        object.rotation.z = elapsed * (0.012 + nextState.flow * 0.03);
      },
      dispose() {
        ringGeometry.dispose();
        fillGeometry.dispose();
        ringMaterial.dispose();
        fillMaterial.dispose();
      }
    };
  }
};
