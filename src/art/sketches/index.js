import { apollonianGasket } from './apollonianGasket.js';
import { apollonianSpherePacking } from './apollonianSpherePacking.js';
import { cliffordAttractor } from './cliffordAttractor.js';
import { hopfFibration } from './hopfFibration.js';
import { juliaSet } from './juliaSet.js';
import { kaleidoscopicIfsCrystal } from './kaleidoscopicIfsCrystal.js';
import { kleinianLimitSet } from './kleinianLimitSet.js';
import { kleinianSphereInversion } from './kleinianSphereInversion.js';
import { lorenzAttractor } from './lorenzAttractor.js';
import { mandelbrotSet } from './mandelbrotSet.js';
import { mandelboxFractal } from './mandelboxFractal.js';
import { mandelbulbFractal } from './mandelbulbFractal.js';
import { mandelbulbHybrid } from './mandelbulbHybrid.js';
import { mengerFractalOrb } from './mengerFractalOrb.js';
import { mengerSponge } from './mengerSponge.js';
import { mesmerLoop } from './mesmerLoop.js';
import { nebulabrot } from './nebulabrot.js';
import { newtonBasins } from './newtonBasins.js';
import { penroseTiling } from './penroseTiling.js';
import { polarTunnel } from './polarTunnel.js';
import { quaternionJuliaSet } from './quaternionJuliaSet.js';
import { reactionDiffusion } from './reactionDiffusion.js';
import { sierpinskiCarpet } from './sierpinskiCarpet.js';
import { sierpinskiTetrahedron } from './sierpinskiTetrahedron.js';
import { spiralStrands } from './spiralStrands.js';
import { waveLattice } from './waveLattice.js';

export const sketches = [
  spiralStrands,
  waveLattice,
  reactionDiffusion,
  juliaSet,
  mandelbrotSet,
  newtonBasins,
  nebulabrot,
  mandelboxFractal,
  mengerFractalOrb,
  quaternionJuliaSet,
  kaleidoscopicIfsCrystal,
  kleinianLimitSet,
  kleinianSphereInversion,
  polarTunnel,
  penroseTiling,
  apollonianGasket,
  apollonianSpherePacking,
  sierpinskiCarpet,
  sierpinskiTetrahedron,
  mengerSponge,
  hopfFibration,
  lorenzAttractor,
  cliffordAttractor,
  mandelbulbFractal,
  mandelbulbHybrid,
  mesmerLoop
];

export function getSketchById(id) {
  return sketches.find((sketch) => sketch.id === id) ?? sketches[0];
}
