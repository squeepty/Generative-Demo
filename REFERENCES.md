# Mathematical and Algorithm References

This catalog documents the mathematics shown in each sketch's info panel. It distinguishes the origin of a named mathematical model from a practical, implementation-oriented resource that explains the corresponding equation or algorithm.

The info panel intentionally stays compact. Use this document when a reader needs a citation, derivation, or code-oriented explanation.

## How to read the entries

- **Foundational reference** identifies the original paper or historical source when one exists.
- **Implementation reference** is a modern, equation- or code-oriented resource that corresponds to the formula displayed in the panel.
- **Project-authored** means the displayed expression is a composition or parameterization created for this project. It should be credited to the project rather than represented as a published mathematical model.

## Apollonian Gasket

Panel formulas: signed curvature `k = 1/r`, Descartes' circle theorem, and the replacement rule for the other tangent circle.

- **Foundational reference:** René Descartes stated the tangent-circle result in 1643. The [Descartes circle theorem reference](https://mathworld.wolfram.com/DescartesCircleTheorem.html) gives the signed-curvature form used by the sketch and notes its historical provenance.
- **Implementation reference:** [The Coding Train: Apollonian Gasket](https://thecodingtrain.com/challenges/182-apollonian-gasket/) demonstrates recursive generation using Descartes' theorem and complex-number circle centers.

## Clifford Attractor

Panel formula: `x[n+1] = sin(a*y[n]) + c*cos(a*x[n])`, `y[n+1] = sin(b*x[n]) + d*cos(b*y[n])`.

- **Foundational reference:** The map is conventionally attributed to Clifford A. Pickover. A citable primary publication for this exact named map has not been identified with enough confidence to claim one here.
- **Implementation reference:** [Paul Bourke: Clifford Attractors](https://www.paulbourke.net/fractals/clifford/) states the exact iteration, supplies parameter sets, and discusses density-based rendering.

## Hopf Fibration

Panel formulas: the unit 3-sphere condition `|z1|^2 + |z2|^2 = 1`, circular fibers, and stereographic projection `p = (x1, x2, x3) / (1 - x4)`.

- **Foundational reference:** H. Hopf, [“Über die Abbildungen der dreidimensionalen Sphäre auf die Kugelfläche” (1931)](https://doi.org/10.1007/BF01457962).
- **Implementation reference:** David W. Lyons, [“An Elementary Introduction to the Hopf Fibration”](https://arxiv.org/abs/2212.01642), a modern, accessible derivation of the fibers and their stereographic projection.

## Lorenz Attractor

Panel formulas: the three Lorenz differential equations, the classic `sigma = 10`, `rho = 28`, `beta = 8/3` regime, and fourth-order Runge–Kutta integration.

- **Foundational reference:** Edward N. Lorenz, [“Deterministic Nonperiodic Flow” (1963)](https://journals.ametsoc.org/view/journals/atsc/20/2/1520-0469_1963_020_0130_dnf_2_0_co_2.xml).
- **Implementation reference:** Christopher Tripp, [“Chaos and Dynamical Systems, Part I”](https://cs.marlboro.college/cours/spring2018/jims_tutorials/computational_science/apr9.attachments/lorenz_attractor.html), which implements these equations with an RK4 step.

## Mandelbulb Fractal

Panel formulas: the power-eight spherical-coordinate map and the distance estimate `d ~= 0.5 * log(r) * r / dr` used for ray marching.

- **Foundational reference:** Daniel White and Paul Nylander's [Mandelbulb project](https://www.skytopia.com/project/fractal/mandelbulb.html), which introduced the widely used spherical-coordinate construction in 2009.
- **Implementation reference:** [The Mandelbulb — Ice Fractal](https://icefractal.com/articles/mandelbulb/) provides the spherical iteration, accumulated derivative, distance-estimator expression, and GLSL-style implementation.

## Menger Sponge

Panel formulas: the `3 x 3 x 3` subdivision, removal of seven cells, and Hausdorff dimension `log(20)/log(3)`.

- **Foundational reference:** Karl Menger's 1926 work on dimension theory is catalogued in the [Illinois Institute of Technology Menger bibliography](https://www.math.iit.edu/Menger/menger_bib.html-BAK).
- **Implementation reference:** [MathWorld: Menger Sponge](https://mathworld.wolfram.com/MengerSponge.html) gives the 20-of-27 recurrence and derives the displayed dimension.

## Mesmer Loop

Panel formulas: a cyclic phase, rotated ellipse bands, and an implicit lemniscate contour.

- **Foundational reference:** The infinity-loop component is the Bernoulli lemniscate; [MathWorld: Lemniscate](https://mathworld.wolfram.com/Lemniscate.html) gives the equivalent Cartesian form `(x^2 + y^2)^2 = 2*a^2*(x^2 - y^2)`.
- **Implementation reference:** The combined ellipse, lemniscate, interference, and seamless-loop formulation is **project-authored**. See [the sketch source](src/art/sketches/mesmerLoop.js).

## Penrose Tiling

Panel formulas: the golden ratio, Robinson-triangle deflation, and aperiodicity.

- **Foundational reference:** Roger Penrose, [“Pentaplexity: A Class of Non-Periodic Tilings of the Plane” (1979)](https://doi.org/10.1007/BF03024384).
- **Implementation reference:** [SciPython: Penrose Tiling I](https://scipython.com/blog/penrose-tiling-1/) explains and implements the Robinson-triangle inflation/deflation rules used by this sketch.

## Reaction Diffusion

Panel formulas: the Gray–Scott reaction `A*B^2`, diffusion via a Laplacian, and feed/kill-rate update equations.

- **Foundational reference:** Peter Gray and Stephen K. Scott, [“Autocatalytic reactions in the isothermal, continuous stirred tank reactor” (1984)](https://doi.org/10.1016/0009-2509(84)87017-7). For the familiar visual-pattern parameterization, see John E. Pearson, [“Complex Patterns in a Simple System” (1993)](https://doi.org/10.1126/science.261.5118.189).
- **Implementation reference:** [Karl Sims' Reaction-Diffusion Tutorial](https://karlsims.com/rd.html) gives the discrete grid update, the `3 x 3` Laplacian stencil, and typical Gray–Scott parameters.

## Sierpiński Carpet

Panel formulas: eight affine maps `p[n+1] = p[n]/3 + o[k]`, omission of the center offset, and dimension `log(8)/log(3)`.

- **Foundational reference:** Wacław Sierpiński's 1916 paper is cited in [MathWorld: Sierpiński Carpet](https://mathworld.wolfram.com/SierpinskiCarpet.html), which also derives the panel's dimension formula.
- **Implementation reference:** Michael Barnsley and Andrew Vince, [“The Chaos Game on a General Iterated Function System”](https://arxiv.org/abs/1005.0322), supplies the modern algorithmic basis for randomly iterating the eight contraction maps.

## Spiral Strands

Panel formulas: a polar angle, a radius with sinusoidal modulation, and a three-dimensional helical embedding.

- **Foundational reference:** The underlying curve family is the standard parametric helix; [MathWords: Helix](https://www.mathwords.com/h/helix.htm) introduces its Cartesian parameterization.
- **Implementation reference:** The selected turn count, strand offsets, radial modulation, vertical wave, and animation are **project-authored**. See [the sketch source](src/art/sketches/spiralStrands.js).

## Wave Lattice

Panel formulas: a square grid and a height field formed by the sum of three sinusoidal waves.

- **Foundational reference:** No external named model is being claimed. This is a standard trigonometric superposition, with project-specific coefficients, phase offsets, and animation choices.
- **Implementation reference:** The exact formula is **project-authored** and documented in [the sketch source](src/art/sketches/waveLattice.js).

## Citation guidance

When references are surfaced in the UI, link the named model to its implementation reference and keep the foundational reference in documentation or an expanded “Learn more” view. For project-authored formulas, use the label **Custom procedural formulation** and link to the corresponding sketch source instead of attributing the entire expression to a standard model.
