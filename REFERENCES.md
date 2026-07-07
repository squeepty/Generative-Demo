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

## Apollonian Sphere Packing

Panel formulas: sphere bend `b = 1/r`, the 3D Soddy-Gossett relation for five mutually tangent spheres, and bend-center replacement for the alternate tangent sphere.

- **Foundational reference:** Generalized Apollonian sphere packings extend Descartes/Soddy configurations into three dimensions; Dias' [The local-global principle for integral generalized Apollonian sphere packings](https://www.aimsciences.org/article/doi/10.3934/jmd.2019019) discusses the sphere-packing analogue and its arithmetic structure.
- **Implementation reference:** The exact breadth-first replacement order, translucent sphere material, color bands, and responsive framing are **project-authored**. See [the sketch source](src/art/sketches/apollonianSpherePacking.js).

## Clifford Attractor

Panel formula: `x[n+1] = sin(a*y[n]) + c*cos(a*x[n])`, `y[n+1] = sin(b*x[n]) + d*cos(b*y[n])`.

- **Foundational reference:** The map is conventionally attributed to Clifford A. Pickover. A citable primary publication for this exact named map has not been identified with enough confidence to claim one here.
- **Implementation reference:** [Paul Bourke: Clifford Attractors](https://www.paulbourke.net/fractals/clifford/) states the exact iteration, supplies parameter sets, and discusses density-based rendering.

## Hopf Fibration

Panel formulas: the unit 3-sphere condition `|z1|^2 + |z2|^2 = 1`, circular fibers, and stereographic projection `p = (x1, x2, x3) / (1 - x4)`.

- **Foundational reference:** H. Hopf, [“Über die Abbildungen der dreidimensionalen Sphäre auf die Kugelfläche” (1931)](https://doi.org/10.1007/BF01457962).
- **Implementation reference:** David W. Lyons, [“An Elementary Introduction to the Hopf Fibration”](https://arxiv.org/abs/2212.01642), a modern, accessible derivation of the fibers and their stereographic projection.

## Julia Set

Panel formulas: the quadratic complex iteration `z[n+1] = z[n]^2 + c`, escape threshold `|z[n]| > 4`, smooth escape-time coloring, and orbit-trap accents.

- **Foundational reference:** Gaston Julia's 1918 work on iteration of rational functions introduced the family now known as Julia sets.
- **Implementation reference:** [MathWorld: Julia Set](https://mathworld.wolfram.com/JuliaSet.html) gives the complex iteration context and the filled-set/outside-set distinction used by the sketch.

## Kaleidoscopic IFS Crystal

Panel formulas: mirror folds, coordinate sorting into a symmetric wedge, repeated scale-offset IFS steps, and distance-field ray marching.

- **Foundational reference:** Iterated function systems were developed as a global construction for fractals by Barnsley and collaborators; kaleidoscopic IFS variants combine IFS iteration with symmetry folds.
- **Implementation reference:** Tim McGraw's [Interactive Procedural Building Generation Using Kaleidoscopic Iterated Function Systems](https://link.springer.com/chapter/10.1007/978-3-319-27857-5_10) describes KIFS distance fields running in real-time fragment shaders. The exact crystal field, fold ordering, shading, and palette treatment are **project-authored**. See [the sketch source](src/art/sketches/kaleidoscopicIfsCrystal.js).

## Kleinian Limit Set

Panel formulas: circle inversion as a Mobius-style transformation, repeated generators, and a sampled limit set.

- **Foundational reference:** Kleinian groups are discrete groups of Mobius transformations; the visual pearl style is popularized by David Mumford, Caroline Series, and David Wright's book [Indra's Pearls](https://en.wikipedia.org/wiki/Indra%27s_Pearls_%28book%29).
- **Implementation reference:** The specific inversion-circle sampler, generator placement, point sizing, and coloring are **project-authored**. See [the sketch source](src/art/sketches/kleinianLimitSet.js).

## Kleinian Sphere Inversion

Panel formulas: 3D sphere inversion, rotational twists around generator axes, and bounded random iteration of inversion generators.

- **Foundational reference:** Kleinian groups act on the sphere at infinity by Mobius transformations and are studied through their fractal limit sets; see [Kleinian Groups from the Sphere at Infinity and Their Self-Joinings](https://link.springer.com/rwe/10.1007/978-3-030-93954-0_39-1) for the modern geometric context.
- **Implementation reference:** The axis/diagonal generator placement, bounded random-walk sampler, twist schedule, point sizing, and coloring are **project-authored**. See [the sketch source](src/art/sketches/kleinianSphereInversion.js).

## Mandelbrot Set

Panel formulas: the quadratic iteration from `z[0] = 0`, bounded-orbit membership, smooth escape-time coloring, and the derivative estimate for boundary glow.

- **Foundational reference:** Benoit Mandelbrot's work on complex quadratic iteration established the set's modern visual and mathematical identity.
- **Implementation reference:** [MathWorld: Mandelbrot Set](https://mathworld.wolfram.com/MandelbrotSet.html) gives the canonical recurrence `z -> z^2 + c`, escape behavior, and coordinate-plane definition used by the sketch.

## Mandelbox Fractal

Panel formulas: box folds, sphere folds, scale-add iteration, and the accumulated derivative distance estimate.

- **Foundational reference:** Tom Lowe introduced the Mandelbox fractal, a folding-based Mandelbrot analogue in three dimensions.
- **Implementation reference:** [Mandelbox](https://en.wikipedia.org/wiki/Mandelbox) summarizes the box-fold and sphere-fold construction used by the sketch.

## Menger Fractal Orb

Panel formulas: sphere signed distance, repeated `3^n` scale carving, and Menger-style central-third removal where two coordinates occupy the middle third of a cell.

- **Foundational reference:** The removal rule follows the same Menger sponge construction described in [MathWorld: Menger Sponge](https://mathworld.wolfram.com/MengerSponge.html).
- **Implementation reference:** The spherical base field, cross-tunnel SDF, raymarch shading, and palette treatment are **project-authored**. See [the sketch source](src/art/sketches/mengerFractalOrb.js).

## Newton Basins

Panel formulas: Newton's update `z[n+1] = z[n] - f(z[n]) / fPrime(z[n])`, the polynomial `f(z) = z^k - 1`, roots of unity, and basin coloring.

- **Foundational reference:** Isaac Newton's root-finding method is the classical iteration underlying the sketch.
- **Implementation reference:** [MathWorld: Newton's Method](https://mathworld.wolfram.com/NewtonsMethod.html) gives the update formula and convergence context used by the sketch.

## Lorenz Attractor

Panel formulas: the three Lorenz differential equations, the classic `sigma = 10`, `rho = 28`, `beta = 8/3` regime, and fourth-order Runge–Kutta integration.

- **Foundational reference:** Edward N. Lorenz, [“Deterministic Nonperiodic Flow” (1963)](https://journals.ametsoc.org/view/journals/atsc/20/2/1520-0469_1963_020_0130_dnf_2_0_co_2.xml).
- **Implementation reference:** Christopher Tripp, [“Chaos and Dynamical Systems, Part I”](https://cs.marlboro.college/cours/spring2018/jims_tutorials/computational_science/apr9.attachments/lorenz_attractor.html), which implements these equations with an RK4 step.

## Mandelbulb Fractal

Panel formulas: the power-eight spherical-coordinate map and the distance estimate `d ~= 0.5 * log(r) * r / dr` used for ray marching.

- **Foundational reference:** Daniel White and Paul Nylander's [Mandelbulb project](https://www.skytopia.com/project/fractal/mandelbulb.html), which introduced the widely used spherical-coordinate construction in 2009.
- **Implementation reference:** [The Mandelbulb — Ice Fractal](https://icefractal.com/articles/mandelbulb/) provides the spherical iteration, accumulated derivative, distance-estimator expression, and GLSL-style implementation.

## Mandelbulb Hybrid

Panel formulas: Mandelbulb-style spherical power iteration, absolute-value folds, box folds, orbit-trap ridges, and a Mandelbulb-inspired distance estimate.

- **Foundational reference:** This sketch inherits the Mandelbulb spherical power-map lineage from Daniel White and Paul Nylander's [Mandelbulb project](https://www.skytopia.com/project/fractal/mandelbulb.html).
- **Implementation reference:** The fold sequence, seed-dependent power, orbit trap, coral-like shading, and palette treatment are **project-authored**. See [the sketch source](src/art/sketches/mandelbulbHybrid.js).

## Menger Sponge

Panel formulas: the `3 x 3 x 3` subdivision, removal of seven cells, and Hausdorff dimension `log(20)/log(3)`.

- **Foundational reference:** Karl Menger's 1926 work on dimension theory is catalogued in the [Illinois Institute of Technology Menger bibliography](https://www.math.iit.edu/Menger/menger_bib.html-BAK).
- **Implementation reference:** [MathWorld: Menger Sponge](https://mathworld.wolfram.com/MengerSponge.html) gives the 20-of-27 recurrence and derives the displayed dimension.

## Mesmer Loop

Panel formulas: a cyclic phase, rotated ellipse bands, and an implicit lemniscate contour.

- **Foundational reference:** The infinity-loop component is the Bernoulli lemniscate; [MathWorld: Lemniscate](https://mathworld.wolfram.com/Lemniscate.html) gives the equivalent Cartesian form `(x^2 + y^2)^2 = 2*a^2*(x^2 - y^2)`.
- **Implementation reference:** The combined ellipse, lemniscate, interference, and seamless-loop formulation is **project-authored**. See [the sketch source](src/art/sketches/mesmerLoop.js).

## Nebulabrot

Panel formulas: Mandelbrot iteration, escaping-orbit filtering, and point-density accumulation of intermediate `z` values.

- **Foundational reference:** The Buddhabrot rendering technique was introduced by Melinda Green as an orbit-density view of the Mandelbrot set.
- **Implementation reference:** [Buddhabrot](https://en.wikipedia.org/wiki/Buddhabrot) describes the escaped-orbit accumulation strategy used by the sketch.

## Penrose Tiling

Panel formulas: the golden ratio, Robinson-triangle deflation, and aperiodicity.

- **Foundational reference:** Roger Penrose, [“Pentaplexity: A Class of Non-Periodic Tilings of the Plane” (1979)](https://doi.org/10.1007/BF03024384).
- **Implementation reference:** [SciPython: Penrose Tiling I](https://scipython.com/blog/penrose-tiling-1/) explains and implements the Robinson-triangle inflation/deflation rules used by this sketch.

## Polar Tunnel

Panel formulas: polar conversion `r = length(p)`, `theta = atan(y, x)`, reciprocal depth `1/r`, and repeated spoke/ring bands.

- **Foundational reference:** No external named model is being claimed. This is a standard polar-coordinate transform with project-specific repetition, twist, and coloring choices.
- **Implementation reference:** The exact tunnel mapping, band frequencies, seed offsets, and animation behavior are **project-authored**. See [the sketch source](src/art/sketches/polarTunnel.js).

## Quaternion Julia Set

Panel formulas: quaternion quadratic iteration, a 3D slice through the 4D quaternion state, and the accumulated derivative distance estimate used for ray marching.

- **Foundational reference:** John C. Hart, Daniel J. Sandin, and Louis H. Kauffman's [Ray Tracing Deterministic 3-D Fractals](https://www-new.evl.uic.edu/news/1989/1989-07-01-1511/) describes ray tracing quaternion Julia sets and other deterministic 3D fractals.
- **Implementation reference:** Keenan Crane's [Ray Tracing Quaternion Julia Sets on the GPU](https://www.cs.cmu.edu/~kmcrane/Projects/QuaternionJulia/paper.pdf) provides a GPU-oriented quaternion Julia rendering reference. The seed-driven constants, slice animation, orbit trap coloring, and shading are **project-authored**. See [the sketch source](src/art/sketches/quaternionJuliaSet.js).

## Reaction Diffusion

Panel formulas: the Gray–Scott reaction `A*B^2`, diffusion via a Laplacian, and feed/kill-rate update equations.

- **Foundational reference:** Peter Gray and Stephen K. Scott, [“Autocatalytic reactions in the isothermal, continuous stirred tank reactor” (1984)](https://doi.org/10.1016/0009-2509(84)87017-7). For the familiar visual-pattern parameterization, see John E. Pearson, [“Complex Patterns in a Simple System” (1993)](https://doi.org/10.1126/science.261.5118.189).
- **Implementation reference:** [Karl Sims' Reaction-Diffusion Tutorial](https://karlsims.com/rd.html) gives the discrete grid update, the `3 x 3` Laplacian stencil, and typical Gray–Scott parameters.

## Sierpiński Carpet

Panel formulas: eight affine maps `p[n+1] = p[n]/3 + o[k]`, omission of the center offset, and dimension `log(8)/log(3)`.

- **Foundational reference:** Wacław Sierpiński's 1916 paper is cited in [MathWorld: Sierpiński Carpet](https://mathworld.wolfram.com/SierpinskiCarpet.html), which also derives the panel's dimension formula.
- **Implementation reference:** Michael Barnsley and Andrew Vince, [“The Chaos Game on a General Iterated Function System”](https://arxiv.org/abs/1005.0322), supplies the modern algorithmic basis for randomly iterating the eight contraction maps.

## Sierpinski Tetrahedron

Panel formulas: four affine contractions toward tetrahedron vertices, removal of the central octahedral gap, and dimension `log(4)/log(2)`.

- **Foundational reference:** The tetrahedron is the 3D analogue of the Sierpiński construction; [MathWorld: Sierpinski Gasket](https://mathworld.wolfram.com/SierpinskiGasket.html) gives the contraction and dimension context for the simplex family.
- **Implementation reference:** The instanced tetrahedron construction, density-to-depth mapping, color bands, and responsive framing are **project-authored**. See [the sketch source](src/art/sketches/sierpinskiTetrahedron.js).

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
