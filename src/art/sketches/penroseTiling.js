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

export const penroseTiling = {
  id: 'penrose-tiling',
  label: 'Penrose Tiling',
  math: {
    summary:
      'A Penrose tiling covers the plane without repeating periodically. This renderer uses Robinson triangle deflation driven by the golden ratio.',
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
      }
    ]
  },
  create({ renderer, state, palette }) {
    const triangles = buildTriangles(state.density, state.seed);
    const positions = new Float32Array(triangles.length * 9);
    const colors = new Float32Array(triangles.length * 9);
    const linePositions = new Float32Array(triangles.length * 18);
    const lineColors = new Float32Array(triangles.length * 18);
    const color = new THREE.Color();

    triangles.forEach((triangle, index) => {
      const vertices = [triangle.a, triangle.b, triangle.c];
      const tileColor = paletteColor(palette, triangle, index);
      const centerX = (triangle.a.x + triangle.b.x + triangle.c.x) / 3;
      const centerY = (triangle.a.y + triangle.b.y + triangle.c.y) / 3;
      const z = Math.sin(centerX * 1.8 + centerY * 1.3 + triangle.depth) * 0.045;

      vertices.forEach((vertex, vertexIndex) => {
        const positionIndex = index * 9 + vertexIndex * 3;
        const shade = 0.82 + vertexIndex * 0.06 + triangle.type * 0.08;
        positions[positionIndex] = vertex.x;
        positions[positionIndex + 1] = vertex.y;
        positions[positionIndex + 2] = z;
        color.copy(tileColor).multiplyScalar(shade);
        colors[positionIndex] = color.r;
        colors[positionIndex + 1] = color.g;
        colors[positionIndex + 2] = color.b;
      });

      const edges = [
        [triangle.a, triangle.b],
        [triangle.b, triangle.c],
        [triangle.c, triangle.a]
      ];

      edges.forEach(([start, end], edgeIndex) => {
        const lineIndex = index * 18 + edgeIndex * 6;
        const edgeColor = color.copy(tileColor).multiplyScalar(1.34);
        linePositions[lineIndex] = start.x;
        linePositions[lineIndex + 1] = start.y;
        linePositions[lineIndex + 2] = z + 0.012;
        linePositions[lineIndex + 3] = end.x;
        linePositions[lineIndex + 4] = end.y;
        linePositions[lineIndex + 5] = z + 0.012;

        for (let i = 0; i < 2; i += 1) {
          const colorIndex = lineIndex + i * 3;
          lineColors[colorIndex] = edgeColor.r;
          lineColors[colorIndex + 1] = edgeColor.g;
          lineColors[colorIndex + 2] = edgeColor.b;
        }
      });
    });

    const tileGeometry = new THREE.BufferGeometry();
    tileGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    tileGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    tileGeometry.computeVertexNormals();

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

    const tileMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.46 + state.bloom * 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const object = new THREE.Group();
    const mesh = new THREE.Mesh(tileGeometry, tileMaterial);
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    mesh.renderOrder = 1;
    lines.renderOrder = 2;
    object.add(mesh, lines);

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
        tileMaterial.opacity = 0.46 + nextState.bloom * 0.16;
        lineMaterial.opacity = 0.36 + nextState.bloom * 0.36;
        object.rotation.x = -0.18 + Math.sin(elapsed * 0.12) * 0.045;
        object.rotation.y = Math.cos(elapsed * 0.1) * 0.045;
        object.rotation.z = elapsed * (0.01 + nextState.flow * 0.024);
      },
      dispose() {
        tileGeometry.dispose();
        lineGeometry.dispose();
        tileMaterial.dispose();
        lineMaterial.dispose();
      }
    };
  }
};
