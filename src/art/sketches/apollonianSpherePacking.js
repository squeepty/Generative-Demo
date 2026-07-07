import * as THREE from 'three';
import { mulberry32 } from '../random.js';

const TETRA_RADIUS = Math.sqrt(6) / 2;
const OUTER_RADIUS = TETRA_RADIUS + 1;

function normalizedDensity(density) {
  return THREE.MathUtils.clamp((density - 900) / (5200 - 900), 0, 1);
}

function createSphere(bend, center, depth) {
  return {
    bend,
    center: center.clone(),
    depth,
    radius: 1 / Math.abs(bend)
  };
}

function sphereKey(sphere) {
  const scale = 10000;

  return `${Math.round(sphere.center.x * scale)}:${Math.round(sphere.center.y * scale)}:${Math.round(
    sphere.center.z * scale
  )}:${Math.round(sphere.bend * scale)}`;
}

function replaceSphere(tuple, index, depth) {
  let bendSum = 0;
  const weightedCenter = new THREE.Vector3();

  for (let i = 0; i < tuple.length; i += 1) {
    if (i === index) {
      continue;
    }

    const sphere = tuple[i];
    bendSum += sphere.bend;
    weightedCenter.addScaledVector(sphere.center, sphere.bend);
  }

  const old = tuple[index];
  const nextBend = bendSum - old.bend;

  if (Math.abs(nextBend) < 0.00001) {
    return null;
  }

  const nextCenter = weightedCenter
    .sub(old.center.clone().multiplyScalar(old.bend))
    .divideScalar(nextBend);

  return createSphere(nextBend, nextCenter, depth);
}

function isVisibleSphere(sphere, minRadius) {
  return (
    Number.isFinite(sphere.center.x) &&
    Number.isFinite(sphere.center.y) &&
    Number.isFinite(sphere.center.z) &&
    Number.isFinite(sphere.radius) &&
    sphere.bend > 0 &&
    sphere.radius >= minRadius &&
    sphere.center.length() + sphere.radius <= OUTER_RADIUS * 1.002
  );
}

function buildPacking(density, seed) {
  const random = mulberry32(seed + 8111);
  const detail = normalizedDensity(density);
  const targetCount = Math.round(THREE.MathUtils.lerp(180, 1650, detail));
  const minRadius = THREE.MathUtils.lerp(0.11, 0.032, detail);
  const maxDepth = Math.round(THREE.MathUtils.lerp(5, 10, detail));
  const rotation = new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI);
  const innerBend = 1;
  const outer = createSphere(-1 / OUTER_RADIUS, new THREE.Vector3(0, 0, 0), 0);
  const a = 1 / Math.sqrt(2);
  const tetraCenters = [
    new THREE.Vector3(a, a, a),
    new THREE.Vector3(-a, -a, a),
    new THREE.Vector3(-a, a, -a),
    new THREE.Vector3(a, -a, -a)
  ].map((center) => center.applyEuler(rotation));
  const initial = [outer, ...tetraCenters.map((center) => createSphere(innerBend, center, 0))];
  const spheres = initial.slice(1);
  const seen = new Set(spheres.map(sphereKey));
  const queue = [{ tuple: initial, depth: 0 }];

  for (let cursor = 0; cursor < queue.length && spheres.length < targetCount; cursor += 1) {
    const { tuple, depth } = queue[cursor];

    if (depth >= maxDepth) {
      continue;
    }

    for (let index = 0; index < tuple.length && spheres.length < targetCount; index += 1) {
      const next = replaceSphere(tuple, index, depth + 1);

      if (!next || !isVisibleSphere(next, minRadius)) {
        continue;
      }

      const key = sphereKey(next);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      spheres.push(next);

      const nextTuple = [...tuple];
      nextTuple[index] = next;
      queue.push({ tuple: nextTuple, depth: depth + 1 });
    }
  }

  return spheres.sort((a, b) => b.radius - a.radius);
}

function paletteColor(palette, sphere, index) {
  const normal = sphere.center.clone().normalize();
  const angle = Math.atan2(normal.z, normal.x) / (Math.PI * 2) + 0.5;
  const elevation = normal.y * 0.5 + 0.5;
  const bendBand = Math.log(sphere.bend + 1) * 0.15;
  const t = (angle * 0.42 + elevation * 0.22 + bendBand + sphere.depth * 0.055 + index * 0.002) % 1;
  const scaled = t * palette.colors.length;
  const colorA = new THREE.Color(palette.colors[Math.floor(scaled) % palette.colors.length]);
  const colorB = new THREE.Color(palette.colors[(Math.floor(scaled) + 1) % palette.colors.length]);

  return colorA.lerp(colorB, scaled % 1).multiplyScalar(0.72 + Math.min(sphere.bend * 0.02, 0.42));
}

export const apollonianSpherePacking = {
  id: 'apollonian-sphere-packing',
  label: 'Apollonian Sphere Packing',
  math: {
    summary:
      'A three-dimensional Apollonian packing generated from five mutually tangent spheres. Replacing one sphere with the alternate tangent solution recursively fills the remaining curved gaps.',
    rows: [
      {
        label: 'Curvature',
        body: 'For a sphere of radius r, bend is b = 1/r. The enclosing sphere has negative bend.'
      },
      {
        label: 'Soddy-Gossett',
        body: '(b1 + b2 + b3 + b4 + b5)^2 = 3*(b1^2 + b2^2 + b3^2 + b4^2 + b5^2).'
      },
      {
        label: 'Replacement',
        body: 'In 3D, the alternate tangent sphere has bNew = sum(other bends) - b.'
      },
      {
        label: 'Bend-Center',
        body: 'The center follows the same replacement rule applied to b*center, preserving tangency.'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const spheres = buildPacking(state.density, state.seed);
    const geometry = new THREE.SphereGeometry(1, 24, 16);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: {
        uBloom: { value: state.bloom }
      },
      vertexShader: `
        varying vec3 vColor;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;

        void main() {
          vColor = instanceColor;
          mat4 instanceModel = modelMatrix * instanceMatrix;
          vec4 worldPosition = instanceModel * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vNormal = normalize(mat3(instanceModel) * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        precision highp float;

        varying vec3 vColor;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        uniform float uBloom;

        void main() {
          vec3 normal = normalize(vNormal);
          vec3 light = normalize(vec3(-0.46, 0.74, 0.5));
          float diffuse = max(dot(normal, light), 0.0);
          float rim = pow(1.0 - abs(normal.z), 1.7);
          float pearl = pow(max(dot(normal, normalize(vec3(0.25, 0.55, 0.8))), 0.0), 18.0);
          float depthTint = smoothstep(-2.6, 2.6, vWorldPosition.z);
          vec3 color = vColor * (0.2 + diffuse * 0.84 + rim * (0.38 + uBloom * 0.36));
          color += vec3(1.0, 0.88, 0.66) * pearl * (0.26 + uBloom * 0.48);
          color += mix(vec3(0.02, 0.05, 0.08), vec3(0.12, 0.06, 0.03), depthTint) * 0.18;
          float alpha = 0.18 + diffuse * 0.2 + rim * (0.2 + uBloom * 0.18);
          gl_FragColor = vec4(pow(color, vec3(0.86)), alpha);
        }
      `
    });
    const packing = new THREE.InstancedMesh(geometry, material, spheres.length);
    const boundaryGeometry = new THREE.SphereGeometry(1, 32, 18);
    const boundaryMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette.colors[1] ?? palette.colors[0]).multiplyScalar(1.25),
      transparent: true,
      opacity: 0.18,
      wireframe: true
    });
    const boundary = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const object = new THREE.Group();

    packing.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    packing.frustumCulled = false;

    spheres.forEach((sphere, index) => {
      const normalizedCenter = sphere.center.clone().divideScalar(OUTER_RADIUS);
      const normalizedRadius = sphere.radius / OUTER_RADIUS;

      dummy.position.copy(normalizedCenter);
      dummy.scale.setScalar(normalizedRadius * 0.96);
      dummy.updateMatrix();
      packing.setMatrixAt(index, dummy.matrix);
      packing.setColorAt(index, color.copy(paletteColor(palette, sphere, index)));
    });

    packing.instanceMatrix.needsUpdate = true;
    packing.instanceColor.needsUpdate = true;
    object.add(packing, boundary);

    const applyResponsiveTransform = (zoom) => {
      const isPortrait = renderer.domElement.height > renderer.domElement.width;
      object.scale.setScalar((zoom ?? 1) * (isPortrait ? 1.12 : 2.26));
      object.position.y = isPortrait ? 0.46 : 0;
    };

    applyResponsiveTransform(state.zoom);

    return {
      object,
      resize() {
        applyResponsiveTransform(state.zoom);
      },
      update(elapsed, nextState) {
        applyResponsiveTransform(nextState.zoom);
        material.uniforms.uBloom.value = nextState.bloom;
        boundaryMaterial.opacity = 0.12 + nextState.bloom * 0.12;
        object.rotation.x = -0.34 + Math.sin(elapsed * 0.12) * 0.08;
        object.rotation.y = 0.52 + elapsed * (0.018 + nextState.flow * 0.055);
        object.rotation.z = 0.12 + Math.cos(elapsed * 0.1) * 0.04;
      },
      dispose() {
        geometry.dispose();
        boundaryGeometry.dispose();
        material.dispose();
        boundaryMaterial.dispose();
      }
    };
  }
};
