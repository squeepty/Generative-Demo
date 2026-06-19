import * as THREE from 'three';
import { mulberry32 } from '../random.js';

const PHI = (1 + Math.sqrt(5)) / 2;
const TAU = Math.PI * 2;

function normalizedDensity(density) {
  return THREE.MathUtils.clamp((density - 900) / (5200 - 900), 0, 1);
}

function mixPoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  };
}

function initialTriangles(seed) {
  const random = mulberry32(seed + 2501);
  const rotation = random() * TAU;
  const radius = 3.18;
  const triangles = [];

  for (let i = 0; i < 10; i += 1) {
    let b = {
      x: Math.cos(rotation + (2 * i - 1) * Math.PI / 10) * radius,
      y: Math.sin(rotation + (2 * i - 1) * Math.PI / 10) * radius
    };
    let c = {
      x: Math.cos(rotation + (2 * i + 1) * Math.PI / 10) * radius,
      y: Math.sin(rotation + (2 * i + 1) * Math.PI / 10) * radius
    };

    if (i % 2 === 0) {
      [b, c] = [c, b];
    }

    triangles.push({
      type: 0,
      a: { x: 0, y: 0 },
      b,
      c,
      depth: 0
    });
  }

  return triangles;
}

function deflate(triangles) {
  const next = [];

  for (const triangle of triangles) {
    const { a, b, c, depth } = triangle;

    if (triangle.type === 0) {
      const p = mixPoint(a, b, 1 / PHI);
      next.push({ type: 0, a: c, b: p, c: b, depth: depth + 1 });
      next.push({ type: 1, a: p, b: c, c: a, depth: depth + 1 });
    } else {
      const q = mixPoint(b, a, 1 / PHI);
      const r = mixPoint(b, c, 1 / PHI);
      next.push({ type: 1, a: r, b: c, c: a, depth: depth + 1 });
      next.push({ type: 1, a: q, b: r, c: b, depth: depth + 1 });
      next.push({ type: 0, a: r, b: q, c: a, depth: depth + 1 });
    }
  }

  return next;
}

function buildTriangles(density, seed) {
  const iterations = Math.round(THREE.MathUtils.lerp(5, 7, normalizedDensity(density)));
  let triangles = initialTriangles(seed);

  for (let i = 0; i < iterations; i += 1) {
    triangles = deflate(triangles);
  }

  return triangles;
}

function paletteColor(palette, triangle, index) {
  const centerX = (triangle.a.x + triangle.b.x + triangle.c.x) / 3;
  const centerY = (triangle.a.y + triangle.b.y + triangle.c.y) / 3;
  const angle = Math.atan2(centerY, centerX) / TAU + 0.5;
  const radius = Math.hypot(centerX, centerY) * 0.12;
  const t = (angle * 0.48 + radius + triangle.type * 0.23 + index * 0.0015) % 1;
  const scaled = t * palette.colors.length;
  const colorA = new THREE.Color(palette.colors[Math.floor(scaled) % palette.colors.length]);
  const colorB = new THREE.Color(palette.colors[(Math.floor(scaled) + 1) % palette.colors.length]);

  return colorA.lerp(colorB, scaled % 1).multiplyScalar(triangle.type === 0 ? 0.68 : 0.88);
}

function createTrianglePrismGeometry() {
  const positions = new Float32Array([
    // Top face.
    0, 0, 0.5, 1, 0, 0.5, 0, 1, 0.5,
    // Bottom face.
    0, 1, -0.5, 1, 0, -0.5, 0, 0, -0.5,
    // Three side faces.
    0, 0, -0.5, 1, 0, -0.5, 1, 0, 0.5,
    0, 0, -0.5, 1, 0, 0.5, 0, 0, 0.5,
    1, 0, -0.5, 0, 1, -0.5, 0, 1, 0.5,
    1, 0, -0.5, 0, 1, 0.5, 1, 0, 0.5,
    0, 1, -0.5, 0, 0, -0.5, 0, 0, 0.5,
    0, 1, -0.5, 0, 0, 0.5, 0, 1, 0.5
  ]);
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  return geometry;
}

export const penroseTiling = {
  id: 'penrose-tiling',
  label: 'Penrose Tiling',
  math: {
    summary:
      'A Penrose tiling covers the plane without repeating periodically. Robinson triangle deflation drives a field of individually extruded tiles, turning its planar rule into a sculptural relief.',
    rows: [
      {
        label: 'Golden Ratio',
        body: 'phi = (1 + sqrt(5))/2. Each deflation cuts triangle edges in the ratio 1:phi.'
      },
      {
        label: 'Deflation',
        body: 'Thin and thick Robinson triangles are replaced by smaller triangles whose edges remain in golden-ratio proportion.'
      },
      {
        label: 'Aperiodicity',
        body: 'Local matching rules force long-range order, but no finite translation can reproduce the entire tiling.'
      },
      {
        label: 'Relief',
        body: 'Each final triangle is an extruded prism. Its height follows a smooth spatial field, exposing tile sides as the form turns.'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const triangles = buildTriangles(state.density, state.seed);
    const linePositions = new Float32Array(triangles.length * 18);
    const lineColors = new Float32Array(triangles.length * 18);
    const prismGeometry = createTrianglePrismGeometry();
    const prismMaterial = new THREE.ShaderMaterial({
      vertexColors: true,
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
          vec3 light = normalize(vec3(-0.48, 0.66, 0.76));
          float diffuse = max(dot(normal, light), 0.0);
          float side = pow(1.0 - abs(normal.z), 1.35);
          float elevation = smoothstep(-0.42, 0.58, vPosition.z);
          vec3 color = vColor * (0.34 + diffuse * 0.8 + side * 0.24);
          color += vColor * (0.1 + uBloom * 0.3) * elevation;
          color += vec3(1.0, 0.78, 0.52) * side * uBloom * 0.14;
          gl_FragColor = vec4(pow(color, vec3(0.84)), 1.0);
        }
      `
    });
    const prisms = new THREE.InstancedMesh(prismGeometry, prismMaterial, triangles.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    prisms.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    prisms.frustumCulled = false;

    triangles.forEach((triangle, index) => {
      const tileColor = paletteColor(palette, triangle, index);
      const centerX = (triangle.a.x + triangle.b.x + triangle.c.x) / 3;
      const centerY = (triangle.a.y + triangle.b.y + triangle.c.y) / 3;
      const radial = Math.hypot(centerX, centerY);
      const lift =
        Math.sin(centerX * 1.65 + centerY * 1.3 + triangle.type * 1.7) * 0.115 +
        Math.cos(radial * 4.1 - triangle.depth * 0.55) * 0.055;
      const thickness = 0.07 + (triangle.type === 0 ? 0.055 : 0.035) + radial * 0.012;
      let first = triangle.b;
      let second = triangle.c;
      const signedArea =
        (first.x - triangle.a.x) * (second.y - triangle.a.y) -
        (first.y - triangle.a.y) * (second.x - triangle.a.x);

      if (signedArea < 0) {
        [first, second] = [second, first];
      }

      const edgeA = new THREE.Vector3(first.x - triangle.a.x, first.y - triangle.a.y, 0);
      const edgeB = new THREE.Vector3(second.x - triangle.a.x, second.y - triangle.a.y, 0);
      const depthAxis = new THREE.Vector3(0, 0, thickness);

      dummy.matrix.makeBasis(edgeA, edgeB, depthAxis);
      dummy.matrix.setPosition(triangle.a.x, triangle.a.y, lift);
      prisms.setMatrixAt(index, dummy.matrix);
      prisms.setColorAt(index, color.copy(tileColor).multiplyScalar(0.94 + triangle.type * 0.12));

      const edges = [
        [triangle.a, first],
        [first, second],
        [second, triangle.a]
      ];

      edges.forEach(([start, end], edgeIndex) => {
        const lineIndex = index * 18 + edgeIndex * 6;
        const edgeColor = color.copy(tileColor).multiplyScalar(1.48);
        linePositions[lineIndex] = start.x;
        linePositions[lineIndex + 1] = start.y;
        linePositions[lineIndex + 2] = lift + thickness * 0.515;
        linePositions[lineIndex + 3] = end.x;
        linePositions[lineIndex + 4] = end.y;
        linePositions[lineIndex + 5] = lift + thickness * 0.515;

        for (let i = 0; i < 2; i += 1) {
          const colorIndex = lineIndex + i * 3;
          lineColors[colorIndex] = edgeColor.r;
          lineColors[colorIndex + 1] = edgeColor.g;
          lineColors[colorIndex + 2] = edgeColor.b;
        }
      });
    });

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.3 + state.bloom * 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const object = new THREE.Group();
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    prisms.renderOrder = 1;
    lines.renderOrder = 2;
    object.add(prisms, lines);

    const applyResponsiveTransform = (zoom) => {
      const isPortrait = renderer.domElement.height > renderer.domElement.width;
      object.scale.setScalar((zoom ?? 1) * (isPortrait ? 0.74 : 1));
      object.position.y = isPortrait ? 0.42 : 0;
    };

    applyResponsiveTransform(state.zoom);

    return {
      object,
      resize() {
        applyResponsiveTransform(state.zoom);
      },
      update(elapsed, nextState) {
        applyResponsiveTransform(nextState.zoom);
        prismMaterial.uniforms.uBloom.value = nextState.bloom;
        lineMaterial.opacity = 0.22 + nextState.bloom * 0.35;
        object.rotation.x = -0.52 + Math.sin(elapsed * 0.12) * 0.075;
        object.rotation.y = 0.24 + Math.cos(elapsed * 0.1) * 0.11;
        object.rotation.z = elapsed * (0.012 + nextState.flow * 0.03);
      },
      dispose() {
        prismGeometry.dispose();
        lineGeometry.dispose();
        prismMaterial.dispose();
        lineMaterial.dispose();
      }
    };
  }
};
