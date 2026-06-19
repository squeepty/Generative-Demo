import { createPointCloudSketch, pickGradientColor } from '../pointCloudSketch.js';
import { mulberry32 } from '../random.js';

const TAU = Math.PI * 2;

export const waveLattice = {
  id: 'wave-lattice',
  label: 'Wave Lattice',
  math: {
    summary:
      'A square lattice is lifted into 3D by a sum of sinusoidal height fields, then rotated as a gently moving surface.',
    rows: [
      {
        label: 'Grid',
        body: 'x = 5.8*(u - 0.5); y = 5.8*(v - 0.5)'
      },
      {
        label: 'Height',
        body: 'z = 0.36*sin(1.7*x + s) + 0.32*cos(2.1*y + 0.7*s) + 0.18*sin(1.2*(x + y))'
      },
      {
        label: 'Phase',
        body: 'phase = tau*(u + v) + seedOffset; shader waves add small temporal displacement.'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const random = mulberry32(state.seed + 211);
    const positions = new Float32Array(state.density * 3);
    const colors = new Float32Array(state.density * 3);
    const sizes = new Float32Array(state.density);
    const phases = new Float32Array(state.density);
    const grid = Math.ceil(Math.sqrt(state.density));
    const phaseOffset = random() * TAU;

    for (let i = 0; i < state.density; i += 1) {
      const row = Math.floor(i / grid);
      const column = i % grid;
      const u = column / Math.max(grid - 1, 1);
      const v = row / Math.max(grid - 1, 1);
      const x = (u - 0.5) * 5.8;
      const y = (v - 0.5) * 5.8;
      const ridge =
        Math.sin(x * 1.7 + phaseOffset) * 0.36 +
        Math.cos(y * 2.1 + phaseOffset * 0.7) * 0.32 +
        Math.sin((x + y) * 1.2) * 0.18;

      positions[i * 3] = x + (random() - 0.5) * 0.05;
      positions[i * 3 + 1] = y + (random() - 0.5) * 0.05;
      positions[i * 3 + 2] = ridge + (random() - 0.5) * 0.18;

      const color = pickGradientColor(palette.colors, column + row, grid * 2).multiplyScalar(
        0.78 + random() * 0.44
      );
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      sizes[i] = 4 + random() * 12;
      phases[i] = (u + v) * TAU + phaseOffset;
    }

    return createPointCloudSketch({
      renderer,
      positions,
      colors,
      sizes,
      phases,
      state,
      motion: {
        baseX: -0.34,
        baseZ: 0.08,
        spinY: 0.014,
        flowSpinY: 0.035,
        tilt: 0.08,
        tiltSpeed: 0.22,
        roll: 0.035,
        rollSpeed: 0.16
      }
    });
  }
};
