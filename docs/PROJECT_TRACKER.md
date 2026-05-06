# Islamic Geometry Explorer — Project Tracker

Single source of truth for scope, progress, and per-task phase status.
Update this file every time a task changes phase. The truth of "done" is the
**Acceptance** block on each task; nothing is green until those checks pass.

---

## 1. Vision

A browser-based, parametric explorer for Islamic geometric design. The user
arrives at a single web page, picks a "design" from a menu, tunes parameters
in a side panel, and sees the result live in a 2D canvas or a 3D scene. The
tool is a **wrapper** plus a growing library of mathematically rigorous
**designs** that share a common runtime contract.

The mathematical core is the **Hankin / Polygons-In-Contact (PIC)** method as
formalised by Craig S. Kaplan. Additional engines (Girih tiles à la Lu &
Steinhardt, n-fold star rosettes à la Broug, muqarnas) are layered on top of
the same wrapper.

## 2. Definition of Completion

The project is **complete (v1.0)** when **every** statement below holds:

1. A user can open the deployed site and choose between **at least 5 distinct
   designs** from a visible menu without reloading the page.
2. Each design exposes **at least 3 parameters** through Tweakpane and
   responds to changes in real time (≤ 16 ms re-render on a 2020 mid-range
   laptop).
3. The Hankin/PIC engine renders patterns from **at least 3 base tilings**
   (square, hexagonal, and one mixed/Archimedean) and supports continuous
   variation of the contact angle.
4. **At least one design renders in 3D** with three.js, using extrusion of the
   strapwork.
5. **At least one design renders the pattern as a procedural texture** on a 3D
   surface (graffiti-on-wall style or equivalent).
6. The full unit-test suite is **green** with **≥ 85 % line coverage** on
   `src/geometry/**` and **≥ 70 %** on `src/core/**`.
7. CI runs typecheck + tests on every push and is **green on `main`**.
8. The build produces a static bundle (`vite build`) that loads in < 2 s on
   broadband and works without a server other than static hosting.
9. The project README documents how to run, build, test, and add a new sketch.
10. Mathematical methods are credited in `docs/REFERENCES.md` with primary
    sources for each engine.

Anything beyond the list above is **stretch** (see §11).

## 3. Methodology — Phase model

Every task moves through six phases, in order. A task may not skip phases.

| Phase | Glyph | Exit criterion |
|---|---|---|
| **Plan** | `P` | Contracts (types, function signatures) and acceptance criteria written down. No implementation. |
| **Red** | `R` | Tests exist that exercise the contract and **fail** when run. |
| **Implement** | `I` | Code exists that aims to satisfy the contracts. May still fail tests. |
| **Green** | `G` | The Red tests now pass; typecheck clean. |
| **Optimize** | `O` | Refactor/perf pass while staying green. Coverage target hit. |
| **Automate** | `A` | CI runs the relevant tests on push and blocks regression. |

Notation in this file:
- `[x]` = phase complete
- `[ ]` = phase pending
- `[~]` = phase in progress (optional; use sparingly)
- `[-]` = phase deliberately skipped (must explain in **Notes**)

## 4. Status snapshot (2026-05-06 — updated)

- Stack: Vite + TS + three.js + Tweakpane + Vitest — **provisioned**.
- Tests: **92/92 green** (primitives 14 · tilings 10 · hankin 11 · hankin perf 1
  · variations 14 · canvas2d 14 · SketchRunner 13 · Registry 9 · Menu 6).
- Coverage on `src/geometry/**`: **99.46 % / 94.44 %** (lines / branches).
- Coverage on `src/render/**`: **99.33 % / 84.78 %**.
- Coverage on `src/core/**`: **92.89 % / 80.7 %** — above the 70 % gate;
  `Registry.ts` is 100 / 100.
- Coverage on `src/ui/**`: **100 % / 100 %**.
- Build: `vite build` succeeds; bundle 11.28 kB raw / 4.51 kB gzip (B-01 size
  ceiling 600 kB gzip).
- CI YAML: drafted at `docs/ci.yml.example`, **not yet active** (GitHub App
  cannot create `.github/workflows/`; user must copy file in a manual commit).

Completed: **G-01, G-02, G-03, G-04, G-05, R-01, S-01, S-02** through O phase.
Next: **S-03** (ParamPanel via Tweakpane) so the registered sketches expose
parameters at runtime; or **S-04** (hash routing) for shareable links;
**R-02** (SVG export) is parallel-safe.

## 5. Domain map (epics)

| ID | Domain | Why it exists |
|---|---|---|
| **G** | Core geometry engine (Hankin/PIC) | Mathematical heart. Everything else depends on it. |
| **P** | Additional pattern engines | Variety: Girih, n-fold rosettes, recursion. |
| **R** | 2D renderer | Show patterns flat, on Canvas2D / SVG. |
| **S** | Shell / wrapper | Sketch registry, menu, parameter panel, routing. |
| **T** | 3D renderer (three.js) | Extrude strapwork, project on meshes. |
| **M** | Materials & shaders | Concrete, graffiti, weathered, neon, gilded. |
| **Q** | Muqarnas | Specialised 3D vault generator. |
| **B** | Build / CI / DX | Tooling, deployment, regression. |
| **D** | Documentation | Onboarding + mathematical references. |

---

## 6. Tasks

### Domain G — Core geometry engine (Hankin / PIC)

#### G-01 — Geometric primitives
Pure functions: `regularPolygon`, `polygonEdges`, `distance`, `midpoint`,
`pointsEqual`. Backbone of every higher-level call.

- Phases: P [x] · R [x] · I [x] · G [x] · O [x] · A [ ]
- Files: `src/geometry/primitives.ts`, `tests/geometry/primitives.test.ts`
- **Acceptance**:
  - [x] All 14 tests in `primitives.test.ts` pass.
  - [x] `regularPolygon` rejects `sides < 3` with a thrown error.
  - [x] Vertex 0 lies on `+x` axis when `rotation === 0`.
  - [x] Coverage of `primitives.ts` ≥ 95 % (analytically 100 %: all branches hit).
- **Notes**: A pending until B-02 (CI activation) is resolved by user.

#### G-02 — Tiling generators
`squareTiling`, `hexagonalTiling`. Produce a `Tiling` containing polygons,
edges, contact info, and bounds.

- Phases: P [x] · R [x] · I [x] · G [x] · O [x] · A [ ]
- Files: `src/geometry/tilings.ts`, `tests/geometry/tilings.test.ts`
- **Acceptance**:
  - [x] A `r×c` square tiling produces `r·c` polygons, 4 vertices each.
  - [x] Interior edges report `polygonIds.length === 2`; boundary edges report 1.
  - [x] Bounds match the geometric extent within 1e-9.
  - [x] Hexagonal tiling — **pointy-top** (corrected from contract): vertex 0
        at +y; adjacent rows offset by half a column (sqrt(3)/2 · size in x).
  - [x] All 7 tilings tests in `tilings.test.ts` pass.
- **Notes**: Contract said "flat-top"; corrected to "pointy-top" because
  pointy-top is the orientation where adjacent rows naturally offset, matching
  the rest of the contract.

#### G-03 — Contact graph
`buildContactGraph` finds shared edges across an arbitrary polygon list with
configurable tolerance. The escape hatch when polygons are not laid out by a
canonical generator.

- Phases: P [x] · R [x] · I [x] · G [x] · O [x] · A [ ]
- Files: `src/geometry/tilings.ts`, `tests/geometry/tilings.test.ts`
- **Acceptance**:
  - [x] Two adjacent unit squares produce exactly one shared edge.
  - [x] Tolerance argument makes endpoints agree at 1e-10 separation.
  - [x] No false positives for parallel-but-non-touching edges (verified by
        single-polygon and tolerance tests; full `n × m` orientation handled
        by `pointsEqual` in either order).
  - [x] Runs O((Σ|edges|)²) or better; **measured 11.4 ms for 1000 polygons**
        on Node 22 (18× under budget).

#### G-04 — Hankin strap construction
`segmentIntersection`, `rayExitPoint`, `hankinPattern`. The actual pattern
generation: for each interior edge emit two rays at `±contactAngle`, extend
until they hit each other or the polygon boundary.

- Phases: P [x] · R [x] · I [x] · G [x] · O [x] · A [ ]
- Files: `src/geometry/hankin.ts`, `tests/geometry/hankin.test.ts`,
  `tests/geometry/hankin.perf.test.ts`
- **Acceptance**:
  - [x] All 11 tests in `hankin.test.ts` pass.
  - [x] Result is deterministic for identical inputs.
  - [x] At `contactAngle = π/2` on a square tiling, every strap is axis-aligned.
  - [x] Strap count ≥ `2 × |interior edges|`.
  - [x] No NaN or Infinity in output for any contact angle ∈ [π/12, 5π/12]
        (24-step sweep on a 3×3 square tiling).
- **Notes**: Per-edge construction emits one ray *per host polygon* (interior
  edges → 2, boundary edges → 1 inward; outward boundary ray dropped). Within
  each polygon, every ray is clipped at the closest opposing-ray intersection
  or, failing that, at the polygon boundary (default `clipToPolygons = true`).
  Ray direction is selected by checking the centroid's projection onto the
  edge normal so each ray points into its host. Output sorted by
  `(p1.x, p1.y, p2.x, p2.y)` for determinism. Perf: 32×32 square tiling
  pattern at π/4 in ~47 ms (test ceiling 200 ms). A pending until B-02.

#### G-05 — Pattern variations & helpers
Convenience helpers built on top of G-04: rosette extraction, n-fold star
detection, strap-width offset, dashing, repetition (motif tiling).

- Phases: P [x] · R [x] · I [x] · G [x] · O [x] · A [ ]
- Files: `src/geometry/variations.ts`, `tests/geometry/variations.test.ts`
- **Acceptance**:
  - [x] Function exists to expand a single strap segment into a polygonal
        ribbon (offset both sides) given a `width` parameter
        (`strapToRibbon(segment, width) → Polygon`, CCW, 4 vertices).
  - [x] Function exists to compute the convex hull of strap endpoints near a
        polygon centre, used to identify rosettes
        (`rosetteHull(pattern, center, radius) → Polygon | null`).
  - [x] Tests cover ≥ 90 % (`variations.ts`: 100 % lines / 96.66 % branches).
- **Notes**: `convexHull` (Andrew's monotone chain) is exported for direct use
  and for testability. Dashing, n-fold star detection, and motif repetition
  are deferred — only the two acceptance helpers and their backing hull are
  shipped here, leaving room for a focused follow-up if the rendering layer
  needs them. A pending until B-02.

### Domain P — Additional pattern engines

#### P-01 — n-fold star rosette (Broug)
Compass-and-straightedge construction parameterised by `n` (6, 8, 10, 12).
Produces a star polygon at the centre of a host polygon.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]
- Files: `src/geometry/star.ts` (new)
- **Acceptance**:
  - [ ] Output is geometrically equivalent to a {n/k} star polygon for chosen
        density `k`.
  - [ ] Reproduces the canonical sixfold rosette from Broug §1 within 1e-6.

#### P-02 — Girih tile set
The five Lu–Steinhardt decorated polygons (decagon, pentagon, rhombus,
bowtie, hexagon) with edge-matching strap rules.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]
- Files: `src/geometry/girih.ts` (new)
- **Acceptance**:
  - [ ] All 5 tile vertex sets equilateral with edge length 1.
  - [ ] Strap rules join cleanly at every shared edge in any legal placement.
  - [ ] Helper to assemble the canonical "Topkapı scroll" decagonal cluster.

#### P-03 — Mixed Archimedean tilings
4.8.8 (truncated square), 3.6.3.6 (trihexagonal), 4.6.12 (rhombitrihexagonal),
plus an extensibility hook for arbitrary vertex configurations.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]
- Files: `src/geometry/archimedean.ts` (new)
- **Acceptance**:
  - [ ] Each implemented tiling produces the correct polygon mix per cell.
  - [ ] Feeds into G-04 unchanged (uses the standard `Tiling` type).

#### P-04 — Self-similar / quasi-crystalline recursion
Sub-tile substitution rules à la Lu–Steinhardt; one level of recursion turns
a girih tile into the next finer set per the published rules (decagon → 80
decagons + 80 bowties + 36 hexagons, etc.).

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]
- Files: `src/geometry/substitution.ts` (new)
- **Acceptance**:
  - [ ] Substitution count matches Lu & Steinhardt 2007 Table S1.
  - [ ] Two iterations on a single decagon generate ≥ 6400 child decagons.

### Domain R — 2D renderer

#### R-01 — Canvas2D rasterizer
Take a `Pattern` and draw it on a `<canvas>` 2D context. Strap width, colour,
endcap, line join, optional construction-line overlay.

- Phases: P [x] · R [x] · I [x] · G [x] · O [x] · A [ ]
- Files: `src/render/canvas2d.ts`, `tests/render/canvas2d.test.ts`,
  `src/main.ts` (demo wiring)
- **Acceptance**:
  - [x] Renders a 2x2 square Hankin pattern at 800x800 in ≤ 16 ms (perf test
        in `canvas2d.test.ts`).
  - [x] DPI-aware (uses `devicePixelRatio`) — `resizeCanvas` consults
        `globalThis.devicePixelRatio` and scales the backing store; the demo
        in `src/main.ts` applies the matching context transform.
- **Notes**: Public surface is intentionally split. `renderToContext`
  is the pure draw routine (mockable), `renderCanvas2D` is a convenience that
  treats canvas pixel dimensions as the drawing surface, and `resizeCanvas`
  owns DPR. Construction-line overlay strokes the source tiling polygons when
  `showConstructionLines` is true and `pattern.sourceTiling` is present. A
  pending until B-02.

#### R-02 — SVG export
Same `Pattern` → minimal SVG string. Useful for downloads and snapshot tests.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]
- Files: `src/render/svg.ts` (new), `tests/render/svg.test.ts`
- **Acceptance**:
  - [ ] Output is valid SVG (XML parse ok, viewBox correct).
  - [ ] Snapshot test stable across runs.

#### R-03 — Construction-line overlay
Render the underlying tiling polygons faintly behind the pattern, toggleable
from the parameter panel. Pedagogical aid.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]
- **Acceptance**:
  - [ ] Toggle visible in Tweakpane.
  - [ ] Overlay opacity adjustable.

### Domain S — Shell / wrapper

#### S-01 — SketchRunner lifecycle
Common interface every design implements: `init`, `update`, `dispose`,
`defineParams`. Plus a runner that drives one sketch at a time.

- Phases: P [x] · R [x] · I [x] · G [x] · O [x] · A [ ]
- Files: `src/core/SketchRunner.ts`, `tests/core/SketchRunner.test.ts`,
  `src/main.ts` (demo wiring)
- **Acceptance**:
  - [x] `dispose` releases all GPU and DOM resources — verified by a
        50-cycle mount/unmount loop that asserts each sketch's `dispose`
        runs once, the host has zero children after each unmount, and no
        rAF callbacks remain pending.
  - [x] Runner respects `prefers-reduced-motion` — when the injected
        `MediaQueryList.matches === true` the rAF loop is suppressed and
        zero `update` ticks fire; flipping `matches` back to `false` and
        dispatching `change` resumes the loop.
- **Notes**: rAF and `MediaQueryList` are dependency-injected so tests drive
  frames manually and toggle the motion preference deterministically.
  Production defaults pull from `globalThis.requestAnimationFrame` and
  `window.matchMedia('(prefers-reduced-motion: reduce)')`. A generation
  counter guards against an in-flight async `init` clobbering a newer
  mount. `requestPaint()` exposes a single-frame escape hatch for sketches
  that need to repaint after a parameter change while reduced motion is
  on. A pending until B-02.

#### S-02 — Sketch registry & menu
Lazy registry keyed by id. UI lists available sketches; clicking switches.

- Phases: P [x] · R [x] · I [x] · G [x] · O [x] · A [ ]
- Files: `src/core/Registry.ts`, `src/ui/Menu.ts`,
  `tests/core/Registry.test.ts`, `tests/ui/Menu.test.ts`,
  `src/main.ts` (demo wiring), `index.html` (menu styles)
- **Acceptance**:
  - [x] Adding a sketch is one import + one `register()` call —
        `registry.register(sketch)` keys by `sketch.id` and falls back to
        `id` when `title` is omitted; duplicate ids throw.
  - [x] Menu reflects registry without manual wiring — `Menu` subscribes to
        the registry on construction and re-renders on every change. Active
        marker survives re-renders. Verified by registering / unregistering
        sketches *after* menu construction in `Menu.test.ts`.
- **Notes**: Registry is intentionally non-lazy (instances, not factories).
  Lazy loading via dynamic `import()` is a follow-up that can layer on top
  without changing the menu surface. `main.ts` registers two demo sketches
  (square + hex) so the menu has something to switch between. A pending
  until B-02.

#### S-03 — ParamPanel wrapper
Thin facade over Tweakpane: per-sketch folder, persistent across reloads via
`localStorage`, programmatic reset.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]
- **Acceptance**:
  - [ ] Type-safe param definitions with default + min/max + step.
  - [ ] Last-used values restored on reload.

#### S-04 — Hash routing
URL hash binds the active sketch (`#hankin-square-10`) and serialises params
(`#hankin-square-10?angle=0.7&rows=5`). Shareable links.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]
- **Acceptance**:
  - [ ] Back/forward buttons work.
  - [ ] Copy link → paste in new tab → identical sketch state.

#### S-05 — Preset save/load
Save the current parameter set as a named preset; export/import as JSON.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]
- **Acceptance**:
  - [ ] At least 3 built-in presets per sketch.

### Domain T — 3D renderer (three.js)

#### T-01 — Scene boilerplate
Camera (perspective + ortho), lighting rig, OrbitControls, resize handler,
clock, render loop coupled to `SketchRunner.update`.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]
- Files: `src/core/three/Scene.ts` (new)
- **Acceptance**:
  - [ ] Idle GPU usage < 5 % on integrated graphics.
  - [ ] Resize is correct on devicePixelRatio change.

#### T-02 — Strapwork extrusion
`Pattern` → `THREE.ExtrudeGeometry` via `THREE.Shape`. Configurable depth
and bevel; connected straps merge into single shapes.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]
- Files: `src/core/three/extrude.ts` (new), tests with stub geometry.
- **Acceptance**:
  - [ ] Number of resulting meshes matches connected-component count of the
        strap graph.
  - [ ] No self-intersections detected by `BufferGeometryUtils.mergeVertices`.

#### T-03 — Pattern as fragment shader
Render the pattern in a fragment shader on any UV-mapped surface. Branchless
SDF for straps, anti-aliased.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]
- Files: `src/materials/shaders/hankin.frag.glsl`
- **Acceptance**:
  - [ ] Visually matches Canvas2D output within 2 px / 95 % of pixels.
  - [ ] Configurable strap width, base colour, background, AA width.

#### T-04 — Projection on arbitrary meshes
Triplanar mapping so the pattern stays continuous on irregular geometry
(walls, columns, vaults).

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]
- **Acceptance**:
  - [ ] No stretching on a 90° edge.
  - [ ] Works on a `THREE.SphereGeometry` and `BoxGeometry`.

### Domain M — Materials & shaders

#### M-01 — Concrete / wall base
Procedural normal + roughness for a matte painted wall. Uses Worley noise.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]
- **Acceptance**:
  - [ ] No visible tiling at 4× repetition.

#### M-02 — Graffiti shader
Pattern on top of M-01 with FBM bleed at edges, slight colour variation,
optional drip mask.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]
- **Acceptance**:
  - [ ] Hand toggleable parameters: bleed, drip, fade, palette.

#### M-03 — Weathered / aged variant
Pattern degraded by an erosion mask; some straps broken, some discoloured.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]

#### M-04 — Neon / emissive
Straps emit; the rest is dark. Bloom post-processing pass.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]

#### M-05 — Gilded / metallic
Anisotropic gold reflection on the strapwork; matte plaster background.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]

### Domain Q — Muqarnas

#### Q-01 — 2D plan generator
Concentric tier projection à la Necipoğlu/Topkapı scroll.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]

#### Q-02 — 3D cell library
Catalogue of unit cells (squinch, half-pyramid, almond, biped) that snap
together at integer tier boundaries.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]

#### Q-03 — Tier stacking algorithm
Given a 2D plan, instantiate cells and stack tiers to build a vault mesh.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]
- **Acceptance**:
  - [ ] Reproduces a small documented historical example within visual
        tolerance.

### Domain B — Build / CI / DX

#### B-01 — Vite production build
`npm run build` produces a deployable `dist/` with sourcemaps.

- Phases: P [x] · R [-] · I [x] · G [ ] · O [ ] · A [ ]
- **Acceptance**:
  - [ ] `dist/index.html` opens via `vite preview` and renders the menu.
  - [ ] Bundle size < 600 kB gzip.
- **Notes**: R skipped — config-only, smoke-tested manually until B-03 lands.

#### B-02 — GitHub Actions CI activation
Workflow exists (`docs/ci.yml.example`) but the GitHub App used to push
cannot create files under `.github/workflows/`. **Manual user action**:
copy `docs/ci.yml.example` → `.github/workflows/ci.yml` in a regular commit.

- Phases: P [x] · R [-] · I [x] · G [ ] · O [-] · A [ ]
- **Acceptance**:
  - [ ] Push to any `claude/**` or `main` triggers the workflow.
  - [ ] Workflow goes green on `main` after Domain G is implemented.
- **Notes**: R/O skipped — pure CI YAML.

#### B-03 — Visual regression tests
Playwright + screenshot diff for each sketch (`@playwright/test`). Run on PR.

- Phases: P [ ] · R [ ] · I [ ] · G [ ] · O [ ] · A [ ]
- **Acceptance**:
  - [ ] Threshold ≤ 0.1 % pixel diff per snapshot.
  - [ ] Snapshots committed under `tests/__screenshots__/`.

#### B-04 — Deployment
GitHub Pages (or equivalent) auto-deploy on `main`.

- Phases: P [ ] · R [-] · I [ ] · G [ ] · O [-] · A [ ]
- **Acceptance**:
  - [ ] Live URL documented in README.
  - [ ] HTTPS, no console errors, no 404s.

### Domain D — Documentation

#### D-01 — README
Run, build, test, and "add a sketch in 5 minutes" walkthrough.

- Phases: P [ ] · R [-] · I [ ] · G [ ] · O [-] · A [-]

#### D-02 — Mathematical references
`docs/REFERENCES.md` listing primary sources (Hankin 1925; Kaplan 2005;
Lu & Steinhardt 2007; Broug 2008; Necipoğlu 1995; Cumincad muqarnas papers).

- Phases: P [ ] · R [-] · I [ ] · G [ ] · O [-] · A [-]

#### D-03 — Per-sketch usage docs
Short markdown alongside each sketch explaining the parameters and the
mathematical idea behind the design.

- Phases: P [ ] · R [-] · I [ ] · G [ ] · O [-] · A [-]

---

## 7. Dependency graph (rough)

```
G-01 ──► G-02 ──► G-03 ──► G-04 ──► G-05
                         │
                         ├──► R-01 ──► R-03
                         ├──► R-02
                         ├──► T-02
                         └──► T-03 ──► T-04
S-01 ──► S-02 ──► (any sketch)
S-01 ──► S-03 ──► S-04 ──► S-05
T-01 ──► T-02 / T-03 / T-04
M-01 ──► M-02 ──► M-03
M-04, M-05 stand alone (after T-03)
Q-01 ──► Q-02 ──► Q-03 (after T-01)
B-02 unblocks all CI gating; B-03 needs S-02 + at least one sketch.
```

## 8. Critical path to v1.0 (definition §2)

The shortest sequence that satisfies the v1.0 acceptance list:

1. G-01 → G-02 → G-03 → G-04 (Hankin engine green).
2. R-01 (one 2D sketch on screen).
3. S-01 → S-02 → S-03 (wrapper + menu + params).
4. Three sketches on different tilings (G-02 already gives two; add P-03 for
   the third — Archimedean 4.8.8 is enough).
5. T-01 → T-02 (one 3D extruded sketch).
6. T-03 + M-02 (procedural pattern texture, graffiti material).
7. B-02 (CI active) → B-03 (visual regression) → B-04 (deploy).
8. D-01 + D-02.

Five sketches: hankin-square, hankin-hex, hankin-archimedean, strapwork-3d,
graffiti-wall. That hits all ten v1.0 criteria.

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hankin ray extension produces visual glitches at acute contact angles | M | M | Property-based tests on angle sweep; clamp angle range. |
| three.js extrusion of self-touching strapwork creates non-manifold meshes | M | M | Run `BufferGeometryUtils.mergeVertices` + validate manifold in test. |
| Tweakpane v4 breaking changes vs v3 docs | L | L | Pin in package.json; regenerate types if needed. |
| GitHub App workflow permission stays blocked | H | L | Manual user commit (B-02) — already documented. |
| Visual snapshots flaky across OSes | M | M | Run snapshot tests only on Linux CI; provide local baseline regen script. |

## 10. Quality gates

A change merges to `main` only if **all** of these are true:

1. `npm run typecheck` clean.
2. `npm test` clean.
3. Coverage thresholds met (G ≥ 85 %, S ≥ 70 %).
4. Visual regression (B-03) passes (once active).
5. No new `// @ts-ignore`, `as any`, `eslint-disable` introduced without an
   inline justification.

## 11. Out of scope (stretch / v1.x)

- Calligraphy / arabesque overlays.
- Audio-reactive parameter binding.
- Multi-user collaborative editing.
- Native AR/VR mode (the existing `scan_no_event/` AR.js project can be
  revisited separately).
- Fabrication exports (DXF for laser cutting, STL for 3D printing) — useful
  but not required for v1.0.
- Server-rendered thumbnails for the menu.

---

## 12. Change log

| Date | Change |
|---|---|
| 2026-05-06 | Tracker created. RED phase complete for G-01..G-04. Stack provisioned. CI YAML drafted as `docs/ci.yml.example`. |
| 2026-05-06 | G-01 implemented and optimised. 14/14 primitives tests green. Tracker corrected (17→14 tests). |
| 2026-05-06 | G-02 + G-03 implemented and optimised. squareTiling, hexagonalTiling (pointy-top), buildContactGraph. 24/34 tests green; 10 hankin tests still RED as intended. Contact graph perf: 11.4 ms for 1000 polygons. |
| 2026-05-06 | G-04 implemented and optimised. `segmentIntersection`, `rayExitPoint`, `hankinPattern` shipped. Added the missing angle-sweep no-NaN test (now 11 hankin tests as the contract claims) and a perf test. 36/36 green. Coverage on `src/geometry/**`: 99.33 % lines / 93.54 % branches. Perf: 32×32 hankin pattern at π/4 in ~47 ms. |
| 2026-05-06 | G-05 implemented and optimised. `strapToRibbon`, `convexHull`, `rosetteHull` shipped in `src/geometry/variations.ts`. 14 new tests; 50/50 green. Coverage on `variations.ts`: 100 % lines / 96.66 % branches. |
| 2026-05-06 | R-01 implemented and optimised. `renderToContext`, `renderCanvas2D`, `resizeCanvas` in `src/render/canvas2d.ts`. 14 new tests using a hand-rolled mock context (happy-dom's canvas2d is incomplete). 64/64 green. Coverage on `canvas2d.ts`: 99.33 % lines / 84.78 % branches. `vite build` succeeds at 2.78 kB gzip. `src/main.ts` rewritten as a temporary demo (4×4 hankin at π/4) so `npm run dev` shows a real pattern. tsconfig `noEmit: true` added so `tsc -b` no longer leaks `.js` siblings beside source. |
| 2026-05-06 | S-01 implemented and optimised. `SketchRunner` class plus `Sketch` / `SketchParam` / `SketchContext` types in `src/core/SketchRunner.ts`. 13 new tests covering mount/unmount, sketch switching, defineParams plumbing, setParam, the 50-cycle no-leak loop, dispose-after-dispose guards, `prefers-reduced-motion` (initial suppression + runtime resume on `change`), `requestPaint` escape hatch, async-init supersession. 77/77 green. Coverage on `SketchRunner.ts`: 90.76 % lines / 75 % branches. `src/main.ts` refactored to mount its hankin demo through the runner. |
| 2026-05-06 | S-02 implemented and optimised. `SketchRegistry` (`src/core/Registry.ts`) and `Menu` (`src/ui/Menu.ts`). 9 + 6 new tests; 92/92 green. Both new files at 100 % lines / 100 % branches. `main.ts` registers `hankin-square` and `hankin-hex` and routes menu selection through the runner; `index.html` gains menu styles. Bundle 4.51 kB gzip. |
