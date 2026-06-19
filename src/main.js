import './styles.css';
import * as THREE from 'three';
import { createIcons, Download, Pause, Play, Shuffle } from 'lucide';
import { palettes } from './art/palettes.js';
import { getSketchById, sketches } from './art/sketches/index.js';

createIcons({ icons: { Download, Pause, Play, Shuffle } });

const canvas = document.querySelector('#art-canvas');
const seedLabel = document.querySelector('#seed-label');
const mathTitle = document.querySelector('#math-title');
const mathSummary = document.querySelector('#math-summary');
const mathStack = document.querySelector('#math-stack');
const algorithmControl = document.querySelector('#algorithm-control');
const zoomControl = document.querySelector('#zoom-control');
const densityControl = document.querySelector('#density-control');
const flowControl = document.querySelector('#flow-control');
const bloomControl = document.querySelector('#bloom-control');
const shuffleButton = document.querySelector('#shuffle-button');
const pauseButton = document.querySelector('#pause-button');
const downloadButton = document.querySelector('#download-button');
const swatches = [...document.querySelectorAll('.swatch')];
const colorCycleToggle = document.querySelector('#color-cycle-toggle');

for (const sketch of sketches) {
  const option = document.createElement('option');
  option.value = sketch.id;
  option.textContent = sketch.label;
  algorithmControl.append(option);
}

const state = {
  seed: Math.floor(Math.random() * 1_000_000),
  algorithmId: sketches[0].id,
  zoom: Number(zoomControl.value) / 100,
  density: Number(densityControl.value),
  flow: Number(flowControl.value) / 100,
  bloom: Number(bloomControl.value) / 100,
  paletteName: 'ember',
  colorCycling: false,
  paused: false
};

algorithmControl.value = state.algorithmId;

const clock = new THREE.Clock();
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
camera.position.set(0, 0, 8);

const group = new THREE.Group();
scene.add(group);

let activeSketch;
let resizeObserver;

function currentPalette() {
  return palettes[state.paletteName];
}

function updateSceneColors() {
  const palette = currentPalette();
  const [top, bottom] = palette.background.map((value) => new THREE.Color(value));
  scene.background = top.clone().lerp(bottom, 0.35);
  document.documentElement.style.setProperty('--canvas-top', palette.background[0]);
  document.documentElement.style.setProperty('--canvas-bottom', palette.background[1]);
}

function updateMathPanel(sketch) {
  mathTitle.textContent = sketch.label;
  mathSummary.textContent = sketch.math?.summary ?? '';
  mathStack.replaceChildren();

  for (const item of sketch.math?.rows ?? []) {
    const row = document.createElement('section');
    row.className = 'math-row';

    const label = document.createElement('h3');
    label.textContent = item.label;

    const body = document.createElement('p');
    body.textContent = item.body;

    row.append(label, body);
    mathStack.append(row);
  }
}

function syncActiveSketch() {
  activeSketch?.update(clock.getElapsedTime(), state);
}

function rebuildSketch() {
  if (activeSketch) {
    group.remove(activeSketch.object);
    activeSketch.dispose();
  }

  const sketch = getSketchById(state.algorithmId);
  updateMathPanel(sketch);
  activeSketch = sketch.create({
    renderer,
    state,
    palette: currentPalette()
  });

  group.add(activeSketch.object);
  updateSceneColors();
  seedLabel.textContent = `Seed ${state.seed}`;
  syncActiveSketch();
}

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  activeSketch?.resize(renderer.getPixelRatio());
}

function setPaused(isPaused) {
  state.paused = isPaused;
  pauseButton.dataset.tooltip = isPaused ? 'Play' : 'Pause';
  pauseButton.innerHTML = `<i data-lucide="${isPaused ? 'play' : 'pause'}" aria-hidden="true"></i><span class="sr-only">${isPaused ? 'Play' : 'Pause'} animation</span>`;
  createIcons({ icons: { Download, Pause, Play, Shuffle } });
}

function setColorCycling(isEnabled) {
  state.colorCycling = isEnabled;
  colorCycleToggle.setAttribute('aria-checked', String(isEnabled));
  colorCycleToggle.dataset.tooltip = `Color cycling: ${isEnabled ? 'on' : 'off'}`;
  canvas.classList.toggle('color-cycling', isEnabled);
}

function animate() {
  requestAnimationFrame(animate);

  if (!state.paused) {
    activeSketch?.update(clock.getElapsedTime(), state);
  }

  renderer.render(scene, camera);
}

algorithmControl.addEventListener('change', () => {
  state.algorithmId = algorithmControl.value;
  rebuildSketch();
});

shuffleButton.addEventListener('click', () => {
  state.seed = Math.floor(Math.random() * 1_000_000);
  rebuildSketch();
});

pauseButton.addEventListener('click', () => {
  setPaused(!state.paused);
});

downloadButton.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `generative-three-art-${state.algorithmId}-${state.seed}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

densityControl.addEventListener('input', () => {
  state.density = Number(densityControl.value);
  rebuildSketch();
});

zoomControl.addEventListener('input', () => {
  state.zoom = Number(zoomControl.value) / 100;
  syncActiveSketch();
});

flowControl.addEventListener('input', () => {
  state.flow = Number(flowControl.value) / 100;
  syncActiveSketch();
});

bloomControl.addEventListener('input', () => {
  state.bloom = Number(bloomControl.value) / 100;
  syncActiveSketch();
});

colorCycleToggle.addEventListener('click', () => {
  setColorCycling(!state.colorCycling);
});

swatches.forEach((swatch) => {
  swatch.addEventListener('click', () => {
    swatches.forEach((button) => button.classList.remove('active'));
    swatch.classList.add('active');
    state.paletteName = swatch.dataset.palette;
    rebuildSketch();
  });
});

resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(canvas);

rebuildSketch();
resize();
animate();

window.addEventListener('beforeunload', () => {
  resizeObserver.disconnect();
  activeSketch?.dispose();
  renderer.dispose();
});
