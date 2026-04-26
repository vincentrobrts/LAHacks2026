# Intuify — Codebase Summary

**Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · Groq API (llama-3.1-8b-instant)  
**Entry:** `app/page.tsx` (home), `app/sim/page.tsx` (atomic sim), `app/compound/page.tsx` (compound lab)

---

## Architecture Overview

```
User types prompt
    ↓
app/page.tsx  ──isCompoundPrompt()──→  /compound?prompt=...
    │
    └──else──→  /api/parse  (Groq → SimulationConfig JSON)
                    ↓
              /sim?state=<base64 encoded SimulationConfig + prompt>
                    ↓
              SimulationClient.tsx  →  MatterScene.tsx  x(dispatches to scene component)
```

---

## Key Types (`types/simulation.ts`, `lib/physics/types.ts`)

```ts
// Atomic sim config
type SimulationConfig = {
  type: SimulationType;        // 15 types, see below
  params: Record<string, number>;
  world: { gravity: number; friction: number };
  explanationGoal: string;
};

// Compound physics
type PhysicsWorld = { bodies: Body[]; constraints: Constraint[]; gravity: number };
type Body = { id, mass, pos: Vec2, prevPos: Vec2, dof: BodyDOF, rampAngle?, mu? };
type BodyDOF = "free" | "ramp" | "vertical" | "horizontal" | "fixed";
type RopeConstraint = { kind:"rope", bodyA, bodyB, pulley?: Vec2, length: number };
type SpringConstraint = { kind:"spring", bodyA, bodyB?, anchorB?: Vec2, k, restLength };
```

---

## Atomic Simulation Types (15)

Handled in `components/MatterScene.tsx` (~1600 lines). Each scene is a self-contained SVG component with RAF animation.

| Type | Key params |
|------|-----------|
| `projectile_motion` | angle, speed, mass, initial_height |
| `collision_1d` | mass1, v1, mass2, v2, restitution |
| `pendulum` | length (px), initial_angle, mass |
| `inclined_plane` | angle, friction, mass, **distance** |
| `free_fall` | height (px), mass, air_resistance |
| `atwood_table` | mass1, mass2, friction, distance |
| `spring_mass` | spring_constant, mass, amplitude |
| `circular_motion` | radius, mass, speed |
| `torque` | force, arm_length, mass |
| `electric_field` | charge1, charge2, separation |
| `ohm_law` | voltage, resistance, internal_resistance |
| `bernoulli` | v1, area_ratio, density |
| `standing_waves` | tension, linear_density, length, harmonic |
| `bohr_model` | atomic_number, n_initial, n_final |
| `pulley` | mass1, mass2, radius, pulley_mass |

**Note:** `inclined_plane` uses `distance` (meters, 1–5) to scale block travel:  
`maxBlockTravel = clamp((distance/5) * rampLength, 0, rampLength*0.96)`

---

## API Routes

### `POST /api/parse`
- Input: `{ prompt: string }`
- Output: `SimulationConfig` JSON
- Uses: Groq llama-3.1-8b-instant with strict JSON system prompt
- Fallback: `lib/parser.ts` regex fallback if Groq fails or no key

### `POST /api/parse-compound`
- Input: `{ prompt: string }`
- Output: `ParsedCompound { components: ParsedComponent[], connections: ParsedConnection[] }`
- Uses: Groq with compound topology system prompt
- No fallback — returns 503 if no GROQ_API_KEY

---

## Compound Lab (`/compound`)

### Data flow
```
User prompt → POST /api/parse-compound → ParsedCompound
    → buildFromParsed() (lib/physics/builder.ts) → BuiltScene
    → compound/page.tsx dispatches to renderer based on sceneType
```

### `BuiltScene` type (`lib/physics/builder.ts`)
```ts
type SceneParams = {
  m1: number; m2: number;
  angle1?: number; angle2?: number;   // degrees
  mu1?: number; mu2?: number;
  springK?: number; springRestLength?: number;
};

type BuiltScene = {
  scene: CompoundScene;
  world: PhysicsWorld | null;
  circuitSolution: CircuitSolution | null;
  sceneType: "atwood" | "rampAtwood" | "springAtwood" | "doubleRamp" | "circuit" | "generic";
  atwoodParams?: { m1: number; m2: number };
  sceneParams?: SceneParams;
};
```

### Scene type dispatch (`app/compound/page.tsx`)
```tsx
atwood        → PulleyScene (from MatterScene, analytical)
rampAtwood    → RampAtwoodScene  (CompoundScenes.tsx, analytical)
doubleRamp    → DoubleRampScene  (CompoundScenes.tsx, analytical)
springAtwood  → SpringAtwoodScene (CompoundScenes.tsx, analytical SHM)
generic/world → CustomScene (XPBD Verlet fallback)
circuit       → CircuitDisplay (SVG schematic, no animation)
```

### Builder routing logic (`buildFromParsed`)
```
has "battery"                        → buildCircuit
has "spring" + "pulley"              → buildSpringAtwood
ramps.length >= 2 + "pulley"         → buildDoubleRamp
has "ramp" + "pulley"                → buildRampAtwood
has "pulley" + masses >= 2           → buildStandardAtwood
else                                 → buildGeneric (XPBD free-fall)
```

---

## Analytical Compound Renderers (`components/scenes/CompoundScenes.tsx`)

All three use RAF animation with closed-form kinematics. Constants: `M_PX=60` (px/m), `G=9.8`.

### `RampAtwoodScene`
```
a = (m2*g − m1*g*sinθ − μ1*m1*g*cosθ) / (m1+m2)
a > 0: hanging mass falls, ramp block climbs
s_px = 0.5*a*t² * M_PX  (time scaled 0.4x for visibility)
```
Layout: PULLEY at (430,110), ramp extends LEFT at angleDeg, len=240px, block starts 155px from pulley.

### `DoubleRampScene`
```
a = g*(m1*sinθ1 − μ1*m1*cosθ1 − m2*sinθ2 − μ2*m2*cosθ2) / (m1+m2)
a > 0: m1 slides DOWN left ramp, m2 slides UP right ramp
```
Layout: PULLEY at (380,110), both ramps tip at pulley — left (dir="left") and right (dir="right").

### `SpringAtwoodScene`
```
ω = sqrt(k / (m1+m2))    period T = 2π/ω
x(t) = SA_EQ_X + A*cos(ω*t)        (visual eq at x=300, A=38px)
hang_y(t) = hang_y0 + A*cos(ω*t)   (block right → hang drops)
Stops after 4 cycles.
```
Layout: surface at y=200, PULLEY at (540,200), wall anchor at x=12. Horizontal spring → block → rope over pulley → hanging block.

---

## XPBD Physics Engine (`lib/physics/engine.ts`)

**Unit conventions:**
- Position: pixels (1m = 60px)
- Mass: kg
- Gravity: `world.gravity` in px/s² (Earth = 9.8*60 = 588)
- Spring k: N/m (NOT k/M — engine divides by mass directly)
- `body.rampAngle` stores `π − visual_slope_rad` ← **important sign convention**
  - `cos(rampAngle) = −cos(visual_slope)` — use `Math.abs(Math.cos(rampAngle))` for friction

**Key fix (applied):** Friction engine bug — `Math.abs(Math.cos(body.rampAngle))` corrects the sign.

```ts
function applyRampFriction(body, gravity, dt2) {
  const cosTheta = Math.abs(Math.cos(body.rampAngle)); // was negative before fix
  const frictionDamp = body.mu * gravity * cosTheta * dt2;
  // applied as velocity damping via prevPos nudge
}
```

---

## Shared Scene Utilities (`components/scenes/_shared.tsx`)

```ts
SCENE_W = 760, SCENE_H = 520   // SVG viewport for all scenes
clamp(v, lo, hi)
fmt(v, digits?)                 // safe toFixed with "--" for non-finite
ArrowMarker({ id, color })      // SVG marker for force arrows
GuidedBreakdown({ step, steps, onStepChange })
SceneActions({ running, onRun, onReset, runLabel, runningLabel })
InfoPanels({ given, equations, results })
  // results: [string, string, string?][] — third arg is "green" for highlight
```

---

## Home Page (`app/page.tsx`)

- `DEFAULT_PROMPT`: inclined plane (30°, μ=0.2, 5kg, 3m)
- `EXAMPLE_PROMPTS[0]`: inclined plane → maps to `DEFAULT_CONFIGS.inclined_plane`
- `EXAMPLE_PROMPTS[1]`: Atwood table → maps to `DEFAULT_CONFIGS.atwood_table` (instant nav)
- `EXAMPLE_PROMPTS[2]`: electric charges → goes through API
- `isCompoundPrompt()`: checks for pulley+ramp, spring+pulley, multi-resistor → routes to `/compound`
- `normalizeAtwoodConfig()`: regex post-processing to fix atwood_table params from LLM

---

## URL State

`/sim?state=<base64>` — encoded by `lib/share.ts`:
```ts
encodeSimulation(config, prompt) → base64(JSON.stringify({config, prompt}))
decodeSimulation(state) → { config, prompt }
```

---

## Environment

```
GROQ_API_KEY   — required for LLM parsing (both routes)
```

---

## File Map (key files only)

```
app/
  page.tsx                    Home — prompt input, history, instant nav
  sim/page.tsx                Sim page — decodes URL state → SimulationClient
  compound/page.tsx           Compound lab — parse → build → dispatch to renderer
  api/parse/route.ts          Atomic sim LLM parser (Groq)
  api/parse-compound/route.ts Compound topology LLM parser (Groq)

components/
  SimulationClient.tsx        Wrapper: slider controls, reparse, explanation panel
  MatterScene.tsx             All 15 atomic scene renderers (SVG, RAF, analytical)
  scenes/
    _shared.tsx               SCENE_W/H, clamp, fmt, GuidedBreakdown, SceneActions, InfoPanels
    CompoundScenes.tsx        RampAtwoodScene, DoubleRampScene, SpringAtwoodScene (NEW, analytical)
    CustomScene.tsx           XPBD Verlet renderer for generic compound scenes
    PulleyScene.tsx           Standard Atwood (used from compound page too)
    [11 other atomic scenes]  BernoulliScene, BohrModelScene, etc.

lib/
  agentverse.ts               fetch /api/parse with fallback to parser.ts
  parser.ts                   Regex fallback parser (no API needed)
  defaults.ts                 DEFAULT_CONFIGS for all 15 types, DEFAULT_PROMPT, DEMO_SHOT
  share.ts                    encodeSimulation / decodeSimulation (base64)
  explanation.ts              LLM explanation generator for sim results
  physics/
    types.ts                  Vec2, Body, BodyDOF, Constraint, PhysicsWorld, CompoundScene
    engine.ts                 stepWorld() — Verlet + XPBD rope + spring forces + ramp friction
    builder.ts                buildFromParsed() → BuiltScene; SceneParams type
    presets.ts                solveCircuit() for series circuit analytics

types/
  simulation.ts               SimulationType, SimulationConfig, LaunchOutcome, SimulationHistoryItem
```

---

## Known Gotchas

1. **`body.rampAngle` = π − visual_slope** — Always use `Math.abs(cos(rampAngle))` for normal force.
2. **Spring k in engine** — Use SI N/m directly; engine does `force = k * ext_px / mass` which gives correct px/s² acceleration.
3. **Compound page auto-submits from URL** — `useEffect` fires `parse(urlPrompt)` on mount.
4. **`isCompoundPrompt()` in page.tsx** — intercepts specific keyword combos before calling the API.
5. **`HISTORY_KEY = "physics-visualizer-history"`** — localStorage, max 8 items.
6. **Next.js on ports 3000–3006** — dev server auto-increments if ports are taken.
