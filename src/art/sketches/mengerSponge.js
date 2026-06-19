import * as THREE from 'three';

const CELLS = [];

for (const x of [-1, 0, 1]) {
  for (const y of [-1, 0, 1]) {
    for (const z of [-1, 0, 1]) {
      const centeredAxes = Number(x === 0) + Number(y === 0) + Number(z === 0);

      if (centeredAxes < 2) {
        CELLS.push([x, y, z]);
      }
    }
  }
}

function levelForDensity(density) {
  return density < 1500 ? 2 : 3;
}

function buildCubes(level) {
  let cubes = [{ center: [0, 0, 0], size: 2 }];

  for (let depth = 0; depth < level; depth += 1) {
    const next = [];

    for (const cube of cubes) {
      const childSize = cube.size / 3;

      for (const [x, y, z] of CELLS) {
        next.push({
          center: [
            cube.center[0] + x * childSize,
            cube.center[1] + y * childSize,
            cube.center[2] + z * childSize
          ],
          size: childSize
        });
      }
    }

    cubes = next;
  }

  return cubes;
}

function colorAt(palette, cube, index) {
  const t =
    (Math.abs(cube.center[0]) * 0.33 +
      Math.abs(cube.center[1]) * 0.27 +
      Math.abs(cube.center[2]) * 0.4 +
      index * 0.013) %
    1;
  const scaled = t * palette.colors.length;
  const colorA = new THREE.Color(palette.colors[Math.floor(scaled) % palette.colors.length]);
  const colorB = new THREE.Color(palette.colors[(Math.floor(scaled) + 1) % palette.colors.length]);

  return colorA.lerp(colorB, scaled % 1).multiplyScalar(0.78 + t * 0.34);
}

export const mengerSponge = {
  id: 'menger-sponge',
  label: 'Menger Sponge',
  math: {
    summary:
      'The Menger sponge is the 3D analogue of the Sierpinski carpet. Each cube is split into 27 smaller cubes, then the center cube and six face centers are removed.',
    rows: [
      {
        label: 'Subdivision',
        body: 'Start with one cube. At each level, replace every cube with a 3 x 3 x 3 grid of smaller cubes.'
      },
      {
        label: 'Removal Rule',
        body: 'Keep cells whose offset (x,y,z) in {-1,0,1}^3 has fewer than two zero coordinates.'
      },
      {
        label: 'Dimension',
        body: 'Each step keeps 20 copies scaled by 1/3, giving Hausdorff dimension log(20)/log(3).'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const level = levelForDensity(state.density);
    const cubes = buildCubes(level);
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.ShaderMaterial({
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
          vec3 light = normalize(vec3(-0.42, 0.72, 0.54));
          float diffuse = max(dot(normal, light), 0.0);
          float side = 0.5 + 0.5 * dot(normal, normalize(vec3(0.2, 0.5, 0.84)));
          float rim = pow(1.0 - clamp(abs(normal.z), 0.0, 1.0), 1.7);
          float depthTint = smoothstep(-2.4, 2.4, vPosition.z);
          vec3 color = vColor * (0.34 + diffuse * 0.86 + side * 0.22);
          color += vColor * rim * (0.24 + uBloom * 0.55);
          color += mix(vec3(0.03, 0.05, 0.06), vec3(0.18, 0.09, 0.04), depthTint) * 0.28;
          gl_FragColor = vec4(pow(color, vec3(0.82)), 1.0);
        }
      `
    });
    const object = new THREE.InstancedMesh(geometry, material, cubes.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const scale = 1.28;

    object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    cubes.forEach((cube, index) => {
      dummy.position.set(
        cube.center[0] * scale,
        cube.center[1] * scale,
        cube.center[2] * scale
      );
      dummy.scale.setScalar(cube.size * scale * 0.94);
      dummy.updateMatrix();
      object.setMatrixAt(index, dummy.matrix);
      object.setColorAt(index, color.copy(colorAt(palette, cube, index)));
    });

    object.instanceMatrix.needsUpdate = true;
    object.instanceColor.needsUpdate = true;
    const applyResponsiveTransform = (zoom) => {
      const isPortrait = renderer.domElement.height > renderer.domElement.width;
      object.scale.setScalar((zoom ?? 1) * (isPortrait ? 0.56 : 1));
      object.position.y = isPortrait ? 0.62 : 0;
    };

    applyResponsiveTransform(state.zoom);

    return {
      object,
      resize() {},
      update(elapsed, nextState) {
        applyResponsiveTransform(nextState.zoom);
        material.uniforms.uBloom.value = nextState.bloom;
        object.rotation.x = -0.48 + Math.sin(elapsed * 0.13) * 0.08;
        object.rotation.y = 0.62 + elapsed * (0.028 + nextState.flow * 0.06);
        object.rotation.z = 0.12 + Math.cos(elapsed * 0.1) * 0.04;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      }
    };
  }
};
