import { createPointCloudSketch, pickGradientColor } from '../pointCloudSketch.js';
import { mulberry32 } from '../random.js';

export const spiralStrands = {
  id: 'spiral-strands',
  label: 'Spiral Strands',
  math: {
    summary:
      'A seeded polar construction splits points into strands, then maps each strand through radius, angle, and height functions before shader waves perturb the field.',
    rows: [
      {
        label: 'Position',
        body: 'theta = 2*pi*turns*t + strand*0.42; r = 0.45 + 2.6*t + 0.2*sin(9*t + strand)'
      },
      {
        label: 'Embedding',
        body: 'p = (r*cos(theta), 5.2*(t - 0.5) + 0.36*sin(0.7*theta), r*sin(theta))'
      },
      {
        label: 'Motion',
        body: 'p += wave(phase, time, flow); the whole cloud rotates slowly around y.'
      }
    ]
  },
  create({ renderer, state, palette }) {
    const random = mulberry32(state.seed);
    const positions = new Float32Array(state.density * 3);
    const colors = new Float32Array(state.density * 3);
    const sizes = new Float32Array(state.density);
    const phases = new Float32Array(state.density);
    const strands = 18 + Math.floor(random() * 20);
    const turns = 2.4 + random() * 3.2;

    for (let i = 0; i < state.density; i += 1) {
      const strand = i % strands;
      const t = i / state.density;
      const local = (i / strands) / (state.density / strands);
      const angle = local * Math.PI * 2 * turns + strand * 0.42;
      const drift = (random() - 0.5) * 0.24;
      const radius = 0.45 + local * 2.6 + Math.sin(local * 9 + strand) * 0.2;
      const height = (local - 0.5) * 5.2 + Math.sin(angle * 0.7) * 0.36;

      positions[i * 3] = Math.cos(angle) * radius + drift;
      positions[i * 3 + 1] = height + (random() - 0.5) * 0.22;
      positions[i * 3 + 2] = Math.sin(angle) * radius + (random() - 0.5) * 0.28;

      const color = pickGradientColor(palette.colors, strand, strands).multiplyScalar(
        0.8 + random() * 0.55
      );
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      sizes[i] = 2.4 + random() * 8.5;
      phases[i] = t * Math.PI * 2 + random() * Math.PI;
    }

    return createPointCloudSketch({
      renderer,
      positions,
      colors,
      sizes,
      phases,
      state,
      motion: {
        spinY: 0.035,
        flowSpinY: 0.08,
        tilt: 0.12,
        tiltSpeed: 0.14
      }
    });
  }
};
