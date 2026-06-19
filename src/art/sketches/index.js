import { apollonianGasket } from './apollonianGasket.js';
import { cliffordAttractor } from './cliffordAttractor.js';
import { hopfFibration } from './hopfFibration.js';
import { lorenzAttractor } from './lorenzAttractor.js';
import { mandelbulbFractal } from './mandelbulbFractal.js';
import { mengerSponge } from './mengerSponge.js';
import { mesmerLoop } from './mesmerLoop.js';
import { penroseTiling } from './penroseTiling.js';
import { reactionDiffusion } from './reactionDiffusion.js';
import { sierpinskiCarpet } from './sierpinskiCarpet.js';
import { spiralStrands } from './spiralStrands.js';
import { waveLattice } from './waveLattice.js';

export const sketches = [
  spiralStrands,
  waveLattice,
  reactionDiffusion,
  penroseTiling,
  apollonianGasket,
  sierpinskiCarpet,
  mengerSponge,
  hopfFibration,
  lorenzAttractor,
  cliffordAttractor,
  mandelbulbFractal,
  mesmerLoop
];

export function getSketchById(id) {
  return sketches.find((sketch) => sketch.id === id) ?? sketches[0];
}
