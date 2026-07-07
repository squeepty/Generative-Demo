import * as THREE from 'three';

const VERTICES = [
  new THREE.Vector3(1, 1, 1).normalize(),
  new THREE.Vector3(-1, -1, 1).normalize(),
  new THREE.Vector3(-1, 1, -1).normalize(),
  new THREE.Vector3(1, -1, -1).normalize()
];

function levelForDensity(density) {
  if (density < 1700) {
    return 4;
  }

  if (density < 3600) {
    return 5;
  }

  return 6;
}

function buildTetrahedra(level) {
  let tetrahedra = [{ center: new THREE.Vector3(0, 0, 0), size: 1.58, depth: 0, branch: 0 }];

  for (let depth = 0; depth < level; depth += 1) {
    const next = [];

    for (const tetrahedron of tetrahedra) {
      const childSize = tetrahedron.size * 0.5;

      VERTICES.forEach((vertex, branch) => {
        next.push({
          center: tetrahedron.center.clone().addScaledVector(vertex, tetrahedron.size * 0.5),
          size: childSize,
          depth: depth + 1,
          branch
        });
      });
    }

    tetrahedra = next;
  }

  return tetrahedra;
}

function paletteColor(palette, tetrahedron, index) {
  const direction = tetrahedron.center.clone().normalize();
  const angle = Math.atan2(direction.z, direction.x) / (Math.PI * 2) + 0.5;
  const elevation = direction.y * 0.5 + 0.5;
  const t =
    (angle * 0.42 +
      elevation * 0.24 +
      tetrahedron.branch * 0.13 +
      tetrahedron.depth * 0.047 +
      index * 0.003) %
    1;
  const scaled = t * palette.colors.length;
  const colorA = new THREE.Color(palette.colors[Math.floor(scaled) % palette.colors.length]);
  const colorB = new THREE.Color(palette.colors[(Math.floor(scaled) + 1) % palette.colors.length]);

  return colorA.lerp(colorB, scaled % 1).multiplyScalar(0.76 + t * 0.38);
}

export const sierpinskiTetrahedron = {
  id: 'sierpinski-tetrahedron',
  label: 'Sierpinski Tetrahedron',
  math: {
    summary:
      'The tetrahedral analogue of the Sierpinski triangle. Each tetrahedron is replaced by four half-scale tetrahedra at its vertices, leaving the central void open.',
    rows: [
      {
        label: 'Affine Maps',
        body: 'p[n+1] = (p[n] + v[k]) / 2, where v[k] is one of the four tetrahedron vertices.'
      },
      {
        label: 'Subdivision',
        body: 'Each step keeps 4 copies scaled by 1/2 and removes the middle octahedral gap.'
      },
      {
        label: 'Dimension',
        body: 'The Hausdorff dimension is log(4)/log(2), so the ideal set has dimension 2.'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const level = levelForDensity(state.density);
    const tetrahedra = buildTetrahedra(level);
    const geometry = new THREE.TetrahedronGeometry(1, 0);
    const material = new THREE.ShaderMaterial({
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
          vec3 light = normalize(vec3(-0.4, 0.78, 0.48));
          float diffuse = max(dot(normal, light), 0.0);
          float rim = pow(1.0 - clamp(abs(normal.z), 0.0, 1.0), 1.55);
          float height = smoothstep(-1.5, 1.5, vWorldPosition.y);
          vec3 color = vColor * (0.28 + diffuse * 0.92 + rim * (0.28 + uBloom * 0.42));
          color += mix(vec3(0.02, 0.04, 0.06), vec3(0.12, 0.07, 0.03), height) * 0.2;
          color += vec3(1.0, 0.9, 0.72) * pow(diffuse, 18.0) * (0.2 + uBloom * 0.38);
          gl_FragColor = vec4(pow(color, vec3(0.84)), 1.0);
        }
      `
    });
    const object = new THREE.InstancedMesh(geometry, material, tetrahedra.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    object.frustumCulled = false;

    tetrahedra.forEach((tetrahedron, index) => {
      dummy.position.copy(tetrahedron.center);
      dummy.scale.setScalar(tetrahedron.size * 0.58);
      dummy.updateMatrix();
      object.setMatrixAt(index, dummy.matrix);
      object.setColorAt(index, color.copy(paletteColor(palette, tetrahedron, index)));
    });

    object.instanceMatrix.needsUpdate = true;
    object.instanceColor.needsUpdate = true;

    const applyResponsiveTransform = (zoom) => {
      const isPortrait = renderer.domElement.height > renderer.domElement.width;
      object.scale.setScalar((zoom ?? 1) * (isPortrait ? 0.92 : 1.62));
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
        material.uniforms.uBloom.value = nextState.bloom;
        object.rotation.x = -0.36 + Math.sin(elapsed * 0.13) * 0.08;
        object.rotation.y = 0.52 + elapsed * (0.025 + nextState.flow * 0.065);
        object.rotation.z = 0.08 + Math.cos(elapsed * 0.11) * 0.04;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      }
    };
  }
};
