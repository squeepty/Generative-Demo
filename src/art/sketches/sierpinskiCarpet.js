import { createPointCloudSketch, pickGradientColor } from '../pointCloudSketch.js';
import { mulberry32 } from '../random.js';

const TAU = Math.PI * 2;
const OFFSETS = [
  [-2 / 3, -2 / 3],
  [0, -2 / 3],
  [2 / 3, -2 / 3],
  [-2 / 3, 0],
  [2 / 3, 0],
  [-2 / 3, 2 / 3],
  [0, 2 / 3],
  [2 / 3, 2 / 3]
];

export const sierpinskiCarpet = {
  id: 'sierpinski-carpet',
  label: 'Sierpinski Carpet',
  math: {
    summary:
      'The carpet repeatedly divides a square into a 3 by 3 grid and removes the center cell. This sketch samples the same attractor with eight affine maps.',
    rows: [
      {
        label: 'IFS Maps',
        body: 'p[n+1] = p[n] / 3 + o[k], where o[k] is one of the eight non-center cell offsets.'
      },
      {
        label: 'Removed Cell',
        body: 'Offsets include {-2/3, 0, 2/3} x {-2/3, 0, 2/3}, excluding (0, 0).'
      },
      {
        label: 'Dimension',
        body: 'Each step keeps 8 copies scaled by 1/3, giving Hausdorff dimension log(8)/log(3).'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const random = mulberry32(state.seed + 419);
    const count = Math.round(state.density * 2.05);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);

    let x = random() * 2 - 1;
    let y = random() * 2 - 1;

    for (let i = 0; i < count + 24; i += 1) {
      const offsetIndex = Math.floor(random() * OFFSETS.length);
      const [offsetX, offsetY] = OFFSETS[offsetIndex];
      x = x / 3 + offsetX;
      y = y / 3 + offsetY;

      if (i < 24) {
        continue;
      }

      const pointIndex = i - 24;
      const depth = pointIndex / Math.max(count - 1, 1);
      const scale = 3.0;
      const gridPulse =
        Math.sin((x + y) * 9.0 + depth * TAU * 4) *
        Math.cos((x - y) * 7.0 - depth * TAU * 2);
      const z = gridPulse * 0.12 + (random() - 0.5) * 0.05;

      positions[pointIndex * 3] = x * scale + (random() - 0.5) * 0.012;
      positions[pointIndex * 3 + 1] = y * scale + (random() - 0.5) * 0.012;
      positions[pointIndex * 3 + 2] = z;

      const colorIndex = offsetIndex + Math.floor(depth * palette.colors.length * 4);
      const color = pickGradientColor(palette.colors, colorIndex, 18).multiplyScalar(
        0.78 + random() * 0.48
      );
      colors[pointIndex * 3] = color.r;
      colors[pointIndex * 3 + 1] = color.g;
      colors[pointIndex * 3 + 2] = color.b;
      sizes[pointIndex] = 3.4 + random() * 10.5;
      phases[pointIndex] = depth * TAU + offsetIndex * 0.7 + random() * 0.5;
    }

    return createPointCloudSketch({
      renderer,
      positions,
      colors,
      sizes,
      phases,
      state,
      motion: {
        baseX: -0.22,
        baseZ: 0.06,
        spinY: 0.014,
        flowSpinY: 0.035,
        tilt: 0.06,
        tiltSpeed: 0.18,
        roll: 0.02,
        rollSpeed: 0.12
      }
    });
  }
};
