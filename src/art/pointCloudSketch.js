import * as THREE from 'three';

export function pickGradientColor(colors, index, count) {
  const colorA = new THREE.Color(colors[index % colors.length]);
  const colorB = new THREE.Color(colors[(index + 1) % colors.length]);
  return colorA.lerp(colorB, (index / Math.max(count - 1, 1)) % 1);
}

export function createPointCloudSketch({
  renderer,
  positions,
  colors,
  sizes,
  phases,
  state,
  motion = {}
}) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
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
        float wave = sin(phase * 4.0 + uTime * (0.35 + uFlow * 2.0));
        p.x += wave * 0.16 * uFlow;
        p.y += cos(phase * 2.7 + uTime * 0.5) * 0.12 * uFlow;
        p.z += sin(phase * 3.2 + uTime * 0.7) * 0.18 * uFlow;

        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = size * uPixelRatio * (6.0 / -mvPosition.z);
        vAlpha = 0.34 + abs(wave) * 0.46;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uBloom;

      void main() {
        vec2 center = gl_PointCoord - vec2(0.5);
        float distanceFromCenter = length(center);
        float core = smoothstep(0.5, 0.04, distanceFromCenter);
        float halo = smoothstep(0.5, 0.0, distanceFromCenter) * uBloom;
        float alpha = (core * 0.72 + halo * 0.28) * vAlpha;
        gl_FragColor = vec4(vColor * (1.0 + uBloom * 0.9), alpha);
      }
    `
  });

  const object = new THREE.Points(geometry, material);
  object.scale.setScalar(state.zoom ?? 1);

  return {
    object,
    resize(pixelRatio) {
      material.uniforms.uPixelRatio.value = pixelRatio;
    },
    update(elapsed, nextState) {
      material.uniforms.uTime.value = elapsed;
      material.uniforms.uFlow.value = nextState.flow;
      material.uniforms.uBloom.value = nextState.bloom;
      object.scale.setScalar(nextState.zoom ?? 1);

      object.rotation.x =
        (motion.baseX ?? 0) +
        Math.sin(elapsed * (motion.tiltSpeed ?? 0.14)) * (motion.tilt ?? 0.12);
      object.rotation.y =
        (motion.baseY ?? 0) +
        elapsed * ((motion.spinY ?? 0.035) + nextState.flow * (motion.flowSpinY ?? 0.08));
      object.rotation.z =
        (motion.baseZ ?? 0) +
        Math.cos(elapsed * (motion.rollSpeed ?? 0.11)) * (motion.roll ?? 0);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}
