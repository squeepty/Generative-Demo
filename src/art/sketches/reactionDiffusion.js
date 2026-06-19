import * as THREE from 'three';
import { mulberry32 } from '../random.js';

function makeColorUniforms(colors) {
  return colors.map((value) => new THREE.Color(value));
}

function normalizedDensity(density) {
  return THREE.MathUtils.clamp((density - 900) / (5200 - 900), 0, 1);
}

function simulationSizeForDensity(density) {
  const detail = normalizedDensity(density);
  return Math.round(THREE.MathUtils.lerp(224, 448, detail) / 16) * 16;
}

function createInitialTexture(size, seed) {
  const random = mulberry32(seed + 1709);
  const data = new Uint8Array(size * size * 4);
  const spotCount = 48 + Math.floor(random() * 28);
  const spots = Array.from({ length: spotCount }, () => ({
    x: random(),
    y: random(),
    radius: 0.008 + random() * 0.026,
    stretch: 0.7 + random() * 0.8
  }));

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      let a = 1;
      let b = 0;

      for (const spot of spots) {
        const dx = Math.min(Math.abs(u - spot.x), 1 - Math.abs(u - spot.x));
        const dy = Math.min(Math.abs(v - spot.y), 1 - Math.abs(v - spot.y)) * spot.stretch;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < spot.radius) {
          const core = 1 - distance / spot.radius;
          a = Math.min(a, 0.28 + random() * 0.18);
          b = Math.max(b, 0.58 + core * 0.34 + random() * 0.08);
        }
      }

      const noise = (random() - 0.5) * 0.035;
      const index = (y * size + x) * 4;
      data[index] = THREE.MathUtils.clamp(Math.round((a + noise) * 255), 0, 255);
      data[index + 1] = THREE.MathUtils.clamp(Math.round((b - noise) * 255), 0, 255);
      data[index + 2] = 0;
      data[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return texture;
}

function createRenderTarget(size, type) {
  const target = new THREE.WebGLRenderTarget(size, size, {
    format: THREE.RGBAFormat,
    type,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false
  });

  target.texture.generateMipmaps = false;
  return target;
}

export const reactionDiffusion = {
  id: 'reaction-diffusion',
  label: 'Reaction-Diffusion',
  math: {
    summary:
      'A Gray-Scott reaction-diffusion simulation models two virtual chemicals that diffuse, react, and feed back into each other to form organic spots and labyrinths.',
    rows: [
      {
        label: 'Chemicals',
        body: 'A diffuses quickly, B diffuses slowly, and the reaction term A*B*B converts A into B.'
      },
      {
        label: 'Update',
        body: 'dA/dt = Da*laplace(A) - A*B^2 + feed*(1 - A); dB/dt = Db*laplace(B) + A*B^2 - (kill + feed)*B'
      },
      {
        label: 'Feedback',
        body: 'Feed and kill rates decide whether the field becomes dots, stripes, rings, or branching cell-like forms.'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const paletteColors = makeColorUniforms(palette.colors);
    const size = simulationSizeForDensity(state.density);
    const initialTexture = createInitialTexture(size, state.seed);
    const targetType = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const targetA = createRenderTarget(size, targetType);
    const targetB = createRenderTarget(size, targetType);
    let currentTarget = targetA;
    let nextTarget = targetB;

    const passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const passScene = new THREE.Scene();
    const passGeometry = new THREE.PlaneGeometry(2, 2);
    const passMesh = new THREE.Mesh(passGeometry);
    passScene.add(passMesh);

    const copyMaterial = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTexture: { value: initialTexture }
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;

        varying vec2 vUv;
        uniform sampler2D uTexture;

        void main() {
          gl_FragColor = texture2D(uTexture, vUv);
        }
      `
    });

    const simulationMaterial = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTexture: { value: initialTexture },
        uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
        uFeed: { value: 0.037 },
        uKill: { value: 0.06 },
        uTime: { value: 0 },
        uStir: { value: state.flow }
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;

        varying vec2 vUv;
        uniform sampler2D uTexture;
        uniform vec2 uTexel;
        uniform float uFeed;
        uniform float uKill;
        uniform float uTime;
        uniform float uStir;

        vec4 sampleField(vec2 uv) {
          return texture2D(uTexture, fract(uv));
        }

        void main() {
          vec2 uv = vUv;
          vec4 center = sampleField(uv);
          vec4 laplace =
            sampleField(uv + vec2(-uTexel.x, 0.0)) * 0.2 +
            sampleField(uv + vec2(uTexel.x, 0.0)) * 0.2 +
            sampleField(uv + vec2(0.0, -uTexel.y)) * 0.2 +
            sampleField(uv + vec2(0.0, uTexel.y)) * 0.2 +
            sampleField(uv + vec2(-uTexel.x, -uTexel.y)) * 0.05 +
            sampleField(uv + vec2(uTexel.x, -uTexel.y)) * 0.05 +
            sampleField(uv + vec2(-uTexel.x, uTexel.y)) * 0.05 +
            sampleField(uv + vec2(uTexel.x, uTexel.y)) * 0.05 -
            center;

          float a = center.r;
          float b = center.g;
          float reaction = a * b * b;
          float feed = uFeed + sin(uv.y * 5.0 + uTime * 0.08) * 0.0018;
          float kill = uKill + cos(uv.x * 6.0 - uTime * 0.06) * 0.0015;

          a += (1.0 * laplace.r - reaction + feed * (1.0 - a));
          b += (0.48 * laplace.g + reaction - (kill + feed) * b);

          vec2 wander = vec2(cos(uTime * 0.17), sin(uTime * 0.13)) * 0.22 + 0.5;
          vec2 offset = uv - wander;
          float pulse = exp(-dot(offset, offset) * 210.0) * 0.0035 * uStir;

          a = clamp(a - pulse * 0.55, 0.0, 1.0);
          b = clamp(b + pulse, 0.0, 1.0);

          gl_FragColor = vec4(a, b, 0.0, 1.0);
        }
      `
    });

    const displayGeometry = new THREE.PlaneGeometry(16, 10, 1, 1);
    const displayMaterial = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTexture: { value: currentTarget.texture },
        uTime: { value: 0 },
        uBloom: { value: state.bloom },
        uZoom: { value: state.zoom },
        uDisplayTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
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
        uniform sampler2D uTexture;
        uniform float uTime;
        uniform float uBloom;
        uniform float uZoom;
        uniform vec2 uDisplayTexel;
        uniform vec2 uResolution;
        uniform vec3 uColor0;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;

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

        vec2 mirrorRepeat(vec2 uv) {
          vec2 wrapped = mod(uv, 2.0);
          return 1.0 - abs(wrapped - 1.0);
        }

        void main() {
          vec2 screen = gl_FragCoord.xy / uResolution.xy;
          vec2 p = (screen - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
          p /= max(uZoom, 0.001);
          float portrait = step(uResolution.x, uResolution.y);
          p.y -= portrait * 0.12;

          vec2 uv = mirrorRepeat(((screen - 0.5) / max(uZoom, 0.001) + 0.5) * 0.92 + 0.04);
          vec4 chemical = texture2D(uTexture, uv);
          float b = chemical.g;
          float a = chemical.r;
          float edge = abs(b - texture2D(uTexture, mirrorRepeat(uv + vec2(uDisplayTexel.x, 0.0))).g) +
            abs(b - texture2D(uTexture, mirrorRepeat(uv + vec2(0.0, uDisplayTexel.y))).g);

          float cell = smoothstep(0.12, 0.68, b);
          float membrane = smoothstep(0.018, 0.105, edge);
          float interior = smoothstep(0.92, 0.25, a);
          vec3 background = mix(vec3(0.006, 0.008, 0.011), vec3(0.025, 0.018, 0.023), smoothstep(-0.7, 0.85, p.y));
          vec3 color = background;
          vec3 stain = paletteRamp(b * 1.15 + edge * 1.2 + a * 0.18 + uTime * 0.006);
          vec3 rim = paletteRamp(0.42 + edge * 3.1 + b * 0.18 + uTime * 0.01);

          color += stain * cell * (0.32 + uBloom * 0.22);
          color += paletteRamp(0.16 + b * 0.48) * interior * 0.18;
          color += rim * membrane * (0.58 + uBloom * 0.7);
          color += vec3(1.0, 0.94, 0.76) * pow(membrane, 4.0) * (0.08 + uBloom * 0.18);
          color *= smoothstep(1.08, 0.22, length(p)) + 0.18;
          color = pow(color, vec3(0.82));

          gl_FragColor = vec4(color, 1.0);
        }
      `
    });

    const object = new THREE.Mesh(displayGeometry, displayMaterial);
    object.frustumCulled = false;

    const renderPass = (material, target) => {
      const previousTarget = renderer.getRenderTarget();
      passMesh.material = material;
      renderer.setRenderTarget(target);
      renderer.render(passScene, passCamera);
      renderer.setRenderTarget(previousTarget);
    };

    const runSimulation = (steps, elapsed, nextState) => {
      const detail = normalizedDensity(nextState.density);
      simulationMaterial.uniforms.uFeed.value = THREE.MathUtils.lerp(0.043, 0.055, detail);
      simulationMaterial.uniforms.uKill.value = THREE.MathUtils.lerp(
        0.0605,
        0.0645,
        nextState.flow * 0.65 + detail * 0.35
      );
      simulationMaterial.uniforms.uStir.value = nextState.flow;

      for (let i = 0; i < steps; i += 1) {
        simulationMaterial.uniforms.uTime.value = elapsed + i * 0.016;
        simulationMaterial.uniforms.uTexture.value = currentTarget.texture;
        renderPass(simulationMaterial, nextTarget);
        [currentTarget, nextTarget] = [nextTarget, currentTarget];
      }

      displayMaterial.uniforms.uTexture.value = currentTarget.texture;
    };

    renderPass(copyMaterial, targetA);
    renderPass(copyMaterial, targetB);
    runSimulation(90 + Math.round(normalizedDensity(state.density) * 50), 0, state);

    return {
      object,
      resize() {
        displayMaterial.uniforms.uResolution.value.set(
          renderer.domElement.width,
          renderer.domElement.height
        );
      },
      update(elapsed, nextState) {
        const steps = 1 + Math.round(nextState.flow * 4);
        runSimulation(steps, elapsed, nextState);
        displayMaterial.uniforms.uTime.value = elapsed;
        displayMaterial.uniforms.uBloom.value = nextState.bloom;
        displayMaterial.uniforms.uZoom.value = nextState.zoom;
      },
      dispose() {
        initialTexture.dispose();
        targetA.dispose();
        targetB.dispose();
        passGeometry.dispose();
        copyMaterial.dispose();
        simulationMaterial.dispose();
        displayGeometry.dispose();
        displayMaterial.dispose();
      }
    };
  }
};
