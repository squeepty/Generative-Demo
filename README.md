# Generative Three Art

A Vite + Three.js generative-art playground built around a deliberately modular sketch engine.

The project is intentionally structured so new mathematical models can be added as self-contained
sketch modules. The app shell owns the canvas, renderer, UI, shared state, lifecycle, resize handling,
palette selection, and export controls. Each sketch owns only its own geometry, shaders, simulation
state, animation behavior, mathematical description, and cleanup.

## Quick Start

```bash
npm install
npm run dev
```

Vite serves the app at `http://127.0.0.1:5173/` by default.

Build the production bundle:

```bash
npm run build
```

Run the browser render verification:

```bash
npm run verify:render
```

The verifier expects Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
Override with `CHROME_PATH` if needed.

## Project Structure

```text
.
├── index.html
├── package.json
├── README.md
├── scripts/
│   └── verify-render.mjs
└── src/
    ├── main.js
    ├── styles.css
    └── art/
        ├── palettes.js
        ├── pointCloudSketch.js
        ├── random.js
        └── sketches/
            ├── index.js
            ├── apollonianGasket.js
            ├── cliffordAttractor.js
            ├── hopfFibration.js
            ├── lorenzAttractor.js
            ├── mandelbulbFractal.js
            ├── mengerSponge.js
            ├── mesmerLoop.js
            ├── penroseTiling.js
            ├── reactionDiffusion.js
            ├── sierpinskiCarpet.js
            ├── spiralStrands.js
            └── waveLattice.js
```

## Engine Overview

The engine is centered in `src/main.js`. It creates one Three.js scene, one perspective camera, one
WebGL renderer, and one scene group that holds the active sketch object.

The engine responsibilities are:

- Populate the algorithm selector from `src/art/sketches/index.js`.
- Maintain global UI state: seed, selected algorithm, zoom, density, flow, bloom, palette, and paused.
- Create, dispose, and replace the active sketch when structure-changing state changes.
- Forward live state changes to the active sketch without forcing a rebuild where possible.
- Render the math panel from each sketch's `math` metadata.
- Keep the canvas sized to the viewport through `ResizeObserver`.
- Render the animation loop and PNG export.

The sketch responsibilities are:

- Generate geometry, buffers, materials, shaders, simulations, or render targets.
- Expose a Three.js `object` that can be added to the shared scene.
- Implement `resize`, `update`, and `dispose`.
- Provide its own mathematical explanation through `math.summary` and `math.rows`.

This split is the main design choice in the project. The core app never needs to know whether a sketch
is a point cloud, raymarched shader, instanced mesh, line/tube construction, or GPU simulation.

## Runtime State

`src/main.js` holds this state object:

```js
const state = {
  seed,
  algorithmId,
  zoom,
  density,
  flow,
  bloom,
  paletteName,
  colorCycling,
  paused
};
```

Control behavior:

- `algorithmId`: rebuilds the active sketch with a new module.
- `seed`: rebuilds the current sketch with new deterministic randomness.
- `density`: rebuilds because most sketches use it to choose point counts, recursion depth, tile count, or simulation resolution.
- `paletteName`: rebuilds because colors are usually baked into buffers or uniforms at creation time.
- `zoom`: updates live.
- `flow`: updates live and usually controls animation speed, perturbation strength, or simulation stirring.
- `bloom`: updates live and usually controls glow, opacity, or highlight strength.
- `colorCycling`: toggles a continuous hue rotation over the rendered canvas. It is a display-only effect, leaves the selected palette and geometry intact, and does not rebuild the sketch.
- `paused`: stops sketch updates while the renderer keeps drawing the current frame.

The palette swatches select the sketch palette. The adjacent Color Cycling switch animates the visible
canvas through a full hue rotation; it can be enabled or disabled at any time without changing the seed
or regenerating the artwork.

## Sketch Contract

Every sketch exports a named object with this shape:

```js
export const mySketch = {
  id: 'my-sketch',
  label: 'My Sketch',
  math: {
    summary: 'Short explanation shown in the right-side math panel.',
    rows: [
      { label: 'Rule', body: 'A concise mathematical formula or implementation note.' }
    ]
  },
  create({ renderer, state, palette }) {
    return {
      object,
      resize(pixelRatio) {},
      update(elapsed, nextState) {},
      dispose() {}
    };
  }
};
```

Contract details:

- `id` is the stable machine-readable selector value and export filename theme.
- `label` is the human-readable selector and math-panel title.
- `math.summary` and `math.rows` are rendered automatically by `updateMathPanel`.
- `create()` receives the shared `renderer`, current `state`, and resolved `palette`.
- `object` can be any Three.js `Object3D`: `Points`, `Mesh`, `Group`, `InstancedMesh`, `LineSegments`, etc.
- `resize(pixelRatio)` is called after canvas resize. Sketches that depend on resolution or pixel ratio update uniforms here.
- `update(elapsed, nextState)` is called every animation frame while unpaused, and also after live controls change.
- `dispose()` must release geometries, materials, textures, and render targets created by the sketch.

## Registry

`src/art/sketches/index.js` is the only place sketches are registered.

The exported `sketches` array controls selector order:

```js
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
```

The app uses `getSketchById(id)` to resolve the selected sketch. There is no central switch statement
and no special-case algorithm logic in `main.js`; adding, removing, or reordering sketches happens in
the registry.

## Shared Modules

### `src/art/pointCloudSketch.js`

Reusable shader-based point cloud renderer. It accepts position, color, size, and phase buffers, then
creates a `THREE.Points` object with:

- additive blending,
- per-point colors,
- shader-controlled point size,
- soft circular point sprites,
- animated flow displacement,
- bloom-sensitive brightness,
- common rotation/tilt motion controls.

Used by:

- Spiral Strands
- Wave Lattice
- Sierpinski Carpet
- Clifford Attractor

Other sketches use their own renderer when their structure needs lines, instancing, raymarching, tubes,
or render targets.

### `src/art/random.js`

Contains the seeded pseudo-random generator `mulberry32`. Sketches use offsets from `state.seed` so a
single global seed can produce deterministic but independent randomness per algorithm.

### `src/art/palettes.js`

Defines named palettes. Each palette has:

- `background`: two colors used by the scene and CSS canvas background.
- `colors`: four foreground colors used by sketches.

Current palettes:

- `ember`
- `reef`
- `orchid`
- `mono`

## Renderer Families

The codebase intentionally supports several rendering strategies under the same sketch contract.

Point-cloud sketches:

- Build typed arrays for positions, colors, sizes, and phases.
- Delegate the common shader and animation behavior to `createPointCloudSketch`.
- Good for attractors, sampled fractals, particle fields, and discrete mathematical point sets.

Instanced geometry sketches:

- Use `THREE.InstancedMesh` to draw many repeated primitives with one geometry and one material.
- Good for recursive solids or repeated rings.

Full-screen shader sketches:

- Render a plane in front of the camera.
- Use fragment shaders for raymarching, procedural fields, or screen-space animation.
- Good for Mandelbulb and Mesmer Loop.

GPU simulation sketches:

- Use offscreen `WebGLRenderTarget`s and ping-pong updates.
- Good for evolving fields such as reaction-diffusion.

Curve and tube sketches:

- Generate paths with `LineSegments`, `CatmullRomCurve3`, or `TubeGeometry`.
- Good for trajectories, fibers, and linked 3D structures.

## Current Algorithm Models

### Spiral Strands

File: `src/art/sketches/spiralStrands.js`

A seeded polar construction splits points into strands. Each strand maps local progress into radius,
angle, and height, then the shared point-cloud shader adds subtle temporal flow.

Model:

```text
theta = 2*pi*turns*t + strand*0.42
r = 0.45 + 2.6*t + 0.2*sin(9*t + strand)
p = (r*cos(theta), 5.2*(t - 0.5) + 0.36*sin(0.7*theta), r*sin(theta))
```

Renderer family: point cloud.

### Wave Lattice

File: `src/art/sketches/waveLattice.js`

A square lattice lifted into 3D by layered sinusoidal height fields.

Model:

```text
x = 5.8*(u - 0.5)
y = 5.8*(v - 0.5)
z = 0.36*sin(1.7*x + s) + 0.32*cos(2.1*y + 0.7*s) + 0.18*sin(1.2*(x + y))
```

Renderer family: point cloud.

### Reaction-Diffusion

File: `src/art/sketches/reactionDiffusion.js`

A Gray-Scott reaction-diffusion system using ping-pong render targets. The sketch evolves two virtual
chemicals, then colorizes the result as glowing organic cells.

Model:

```text
dA/dt = Da*laplace(A) - A*B^2 + feed*(1 - A)
dB/dt = Db*laplace(B) + A*B^2 - (kill + feed)*B
```

Renderer family: GPU simulation plus full-screen display shader.

### Penrose Tiling

File: `src/art/sketches/penroseTiling.js`

An aperiodic tiling generated from Robinson triangle deflation. Triangles are recursively subdivided
using the golden ratio.

Model:

```text
phi = (1 + sqrt(5)) / 2
```

Thin and thick triangles are replaced by smaller triangles whose edges remain in golden-ratio
proportion.

Renderer family: mesh triangles plus edge line segments.

### Apollonian Gasket

File: `src/art/sketches/apollonianGasket.js`

A recursive circle-packing gasket. Starting from three mutually tangent inner circles and one enclosing
circle, the sketch repeatedly replaces one tangent circle with the other Descartes solution.

Model:

```text
(k1 + k2 + k3 + k4)^2 = 2*(k1^2 + k2^2 + k3^2 + k4^2)
kNew = 2*(ka + kb + kc) - k
```

Renderer family: instanced rings and fills.

### Sierpinski Carpet

File: `src/art/sketches/sierpinskiCarpet.js`

A chaos-game sampler for the Sierpinski carpet. It repeatedly applies one of eight affine maps, all
corresponding to non-center cells in a 3 by 3 grid.

Model:

```text
p[n+1] = p[n] / 3 + o[k]
o[k] in {-2/3, 0, 2/3} x {-2/3, 0, 2/3}, excluding (0, 0)
dimension = log(8) / log(3)
```

Renderer family: point cloud.

### Menger Sponge

File: `src/art/sketches/mengerSponge.js`

The 3D analogue of the Sierpinski carpet. Each cube is subdivided into a 3 by 3 by 3 grid, then the
center cube and six face-center cubes are removed.

Model:

```text
Keep cells whose offset (x,y,z) in {-1,0,1}^3 has fewer than two zero coordinates.
dimension = log(20) / log(3)
```

Renderer family: instanced cubes.

### Hopf Fibration

File: `src/art/sketches/hopfFibration.js`

A 3D visualization of linked fibers from the Hopf fibration. Fibers are circles on the 3-sphere,
projected into ordinary 3D space by stereographic projection.

Model:

```text
(z1, z2) in S^3 with |z1|^2 + |z2|^2 = 1
p = (x1, x2, x3) / (1 - x4)
```

Renderer family: `TubeGeometry` curves in a `THREE.Group`.

### Lorenz Attractor

File: `src/art/sketches/lorenzAttractor.js`

A chaotic flow integrated with fourth-order Runge-Kutta. The orbit is rendered with glowing points and
a faint line trace.

Model:

```text
dx/dt = sigma(y - x)
dy/dt = x(rho - z) - y
dz/dt = xy - beta*z
sigma = 10, rho = 28, beta = 8/3
```

Renderer family: custom point and line geometry.

### Clifford Attractor

File: `src/art/sketches/cliffordAttractor.js`

A seeded strange attractor generated by repeatedly applying a nonlinear 2D map. The orbit is
normalized, colored by angle/order, and lifted into a shallow 3D ripple.

Model:

```text
x[n+1] = sin(a*y[n]) + c*cos(a*x[n])
y[n+1] = sin(b*x[n]) + d*cos(b*y[n])
```

Renderer family: point cloud.

### Mandelbulb Fractal

File: `src/art/sketches/mandelbulbFractal.js`

A distance-estimated Mandelbulb raymarched in a fragment shader. It is a 3D analogue of complex
iteration, using spherical coordinates and a power map.

Model:

```text
r, theta, phi = spherical(z)
z = r^8 * (sin(8theta)cos(8phi), sin(8theta)sin(8phi), cos(8theta)) + c
d ~= 0.5 * log(r) * r / dr
```

Renderer family: full-screen raymarch shader.

### Mesmer Loop

File: `src/art/sketches/mesmerLoop.js`

A procedural loop field made from rotating ellipses, an infinity-loop contour, and polar interference
rings. It is designed to animate seamlessly.

Model:

```text
t = fract(time / 14 * speed + seed)
phase = 2*pi*t
f(p) = |(x^2 + y^2)^2 - a*(x^2 - y^2)|
```

Renderer family: full-screen procedural fragment shader.

## UI Structure

`index.html` contains:

- `canvas#art-canvas`: the WebGL canvas.
- `aside.math-panel`: current sketch title, summary, and math rows.
- `section.control-panel`: brand, seed label, quick actions, algorithm selector, sliders, and palette swatches.

`src/styles.css` owns:

- Full-viewport canvas layout.
- Compact bottom-left control panel.
- Top-right math panel.
- Mobile layout where the math panel moves to the top and the controls stay near the bottom.
- Shared panel surfaces, range/select styling, icon button styling, swatches, and accessible screen-reader text.

## Lifecycle

Startup:

1. Import sketches and palettes.
2. Populate the algorithm selector from `sketches`.
3. Initialize `state`.
4. Create `THREE.Scene`, `WebGLRenderer`, camera, and sketch group.
5. Call `rebuildSketch()`.
6. Start `ResizeObserver`.
7. Start `animate()`.

Sketch rebuild:

1. Remove active sketch object from the scene.
2. Call `activeSketch.dispose()`.
3. Resolve the selected sketch with `getSketchById`.
4. Render the sketch's math metadata.
5. Call `sketch.create({ renderer, state, palette })`.
6. Add returned `object` to the shared group.
7. Sync colors, seed label, and first update.

Frame update:

1. If not paused, call `activeSketch.update(clock.getElapsedTime(), state)`.
2. Render the scene with the shared camera.

Resize:

1. Set renderer drawing size to the canvas client size.
2. Update camera aspect.
3. Forward pixel ratio to `activeSketch.resize(pixelRatio)`.

## Adding A New Sketch

1. Create `src/art/sketches/mySketch.js`.
2. Export a sketch object with `id`, `label`, `math`, and `create()`.
3. Return `{ object, resize, update, dispose }` from `create()`.
4. Register it in `src/art/sketches/index.js`.
5. Decide how each control should map:
   - Use `state.seed` for deterministic randomness.
   - Use `state.density` for point counts, recursion levels, tile count, or simulation resolution.
   - Use `state.zoom` in `update` or a responsive transform.
   - Use `state.flow` for animation speed, physical stirring, or perturbation amount.
   - Use `state.bloom` for glow, opacity, rim light, or highlight intensity.
   - Use `palette.colors` for generated buffers or shader uniforms.
6. Run:

```bash
npm run build
npm run verify:render
```

Design notes for new sketches:

- Keep all algorithm-specific math inside the sketch file.
- Keep `main.js` free of algorithm-specific branches.
- Prefer shared helpers when they fit, especially `createPointCloudSketch`.
- Use `dispose()` thoroughly; sketches are rebuilt often.
- If the sketch uses screen-space shaders, update resolution uniforms in `resize()`.
- If the sketch has portrait-specific framing, use `renderer.domElement.width` and `height` inside the sketch.
- Add a compact but useful `math` explanation so the right-side panel stays meaningful.

## Verification

`scripts/verify-render.mjs` launches headless Chrome through Playwright, opens the local app, and tests
each algorithm in desktop and mobile viewports.

For every algorithm it:

- Selects the algorithm through `#algorithm-control`.
- Waits for the sketch to render.
- Reads WebGL pixels from several sample regions.
- Fails if the canvas does not fill the viewport.
- Fails if sampled pixels look blank or too low-color.
- Saves screenshots to `/tmp/generative-three-art-{viewport}-{algorithm}.png`.

This verifier is intentionally broad rather than pixel-perfect. It catches blank canvases, broken shader
compilation, resize failures, invisible mobile framing, and selector registration mistakes while still
allowing generative output to vary.

## Dependencies

Runtime:

- `three`: rendering, geometries, shaders, render targets, and math helpers.
- `lucide`: UI icons for shuffle, pause/play, and download.

Development:

- `vite`: dev server and production build.
- `playwright-core`: headless Chrome render verification.

## Design Philosophy

This project is built to grow sideways.

The important architectural choice is that sketches are plugins with a tiny shared contract. The engine
does not care whether a sketch is a raymarcher, point cloud, tiling, recursive mesh, linked-curve
sculpture, or reaction-diffusion simulation. That intentional modularity makes the project easy to
extend: add one file, register it once, describe the math, and let the existing UI, palette system,
resize handling, animation loop, export tool, and verifier do the rest.
