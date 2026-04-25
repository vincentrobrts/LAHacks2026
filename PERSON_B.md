# Person B — Physics Simulation & Frontend

You are the frontend/simulation engineer. Your job is to render any `SimulationConfig` that Person A produces as a live 2D Matter.js animation.

## The product vision

User pastes a physics problem → AI identifies the scenario and extracts parameters → Matter.js animates it live.

## Your files

| File | What it does |
|------|-------------|
| `components/MatterScene.tsx` | Matter.js canvas — needs to support multiple scene types |
| `components/SimulationClient.tsx` | Full sim page — controls, panels, history, explanation |
| `app/page.tsx` | Landing page — prompt input, preview, history |
| `app/sim/page.tsx` | Thin wrapper around SimulationClient |
| `lib/share.ts` | URL state encoding — update if schema changes |
| `tailwind.config.ts` | Styling |
| `app/globals.css` | Global styles |

## Your contract with Person A

You receive a `SimulationConfig` and render it. Never change this shape without telling Person A.

```ts
type SimulationType =
  | "projectile_motion"
  | "collision_1d"
  | "pendulum"
  | "inclined_plane"
  | "free_fall";

type SimulationConfig = {
  type: SimulationType;
  params: Record<string, number>;
  world: {
    gravity: number;   // m/s², Earth = 9.8
    friction: number;  // 0–1
  };
  explanationGoal: string;
};
```

## Parameters per scenario type

These are the exact keys you read from `params`. Always read with a fallback default.

### `projectile_motion`
```json
{ "angle": 38, "speed": 18, "mass": 1, "initial_height": 0 }
```

### `collision_1d`
```json
{ "mass1": 2, "v1": 5, "mass2": 1, "v2": -3, "restitution": 0.8 }
```

### `pendulum`
```json
{ "length": 150, "initial_angle": 45, "mass": 1 }
```

### `inclined_plane`
```json
{ "angle": 30, "friction": 0.3, "mass": 1 }
```

### `free_fall`
```json
{ "height": 200, "mass": 1, "air_resistance": 0.01 }
```

## What to build

### Refactor `MatterScene.tsx`

The current file is hardcoded to the tower knockdown scene. Refactor it to a dispatcher:

```tsx
export default function MatterScene({ config, onOutcome }) {
  switch (config.type) {
    case "projectile_motion":   return <ProjectileScene config={config} onOutcome={onOutcome} />;
    case "collision_1d":        return <CollisionScene config={config} onOutcome={onOutcome} />;
    case "pendulum":            return <PendulumScene config={config} onOutcome={onOutcome} />;
    case "inclined_plane":      return <InclinedPlaneScene config={config} onOutcome={onOutcome} />;
    case "free_fall":           return <FreeFallScene config={config} onOutcome={onOutcome} />;
  }
}
```

Each scene is its own component that sets up a Matter.js world and calls `onOutcome` when done.

### Scene implementation notes

**Canvas size:** Keep `760 × 520`, ground at `y=462` — consistent across all scenes.

**`projectile_motion`**
- Launcher at bottom-left, projectile fires at `angle`/`speed`
- No tower — just show the arc, measure range and peak height
- `onOutcome`: `{ flightDistance, peakHeight, timeOfFlight }`

**`collision_1d`**
- Two labeled balls on a horizontal track, ground at bottom
- Ball 1 enters from left at `v1`, ball 2 from right at `v2` (negative = leftward)
- `restitution` controls bounce
- `onOutcome`: `{ v1_final, v2_final, kineticEnergyLost }`

**`pendulum`**
- Pivot pinned at top-center, bob hangs at `length`, released from `initial_angle`
- Show the arc trace
- `onOutcome`: `{ period, maxSpeed }`

**`inclined_plane`**
- Draw a ramp at `angle` degrees, block sits at top and slides
- `friction` is Matter.js `friction` on the block
- `onOutcome`: `{ timeToBottom, finalSpeed }`

**`free_fall`**
- Object dropped from `height`, falls to ground
- `air_resistance` maps to Matter.js `frictionAir`
- `onOutcome`: `{ timeToGround, finalSpeed }`

### Update `LaunchOutcome` type

The current type is tower-specific. Make it generic:

```ts
type LaunchOutcome = {
  launched: boolean;
  success: boolean;
  metrics: Record<string, number>; // scenario-specific values
};
```

### Labels and annotations

Each scene should draw SVG labels over the canvas (like the current trajectory arc overlay) showing:
- Key measurements (distance, angle, velocity)
- What to watch for

### Controls panel

The current sliders (angle, speed, gravity) are tower-specific. Update `SimulationClient.tsx` to show different sliders per scenario type. Only show controls that are relevant.

## What NOT to touch

- `lib/agentverse.ts` — LLM call, that's Person A
- `lib/parser.ts` — regex fallback, that's Person A
- `lib/explanation.ts` — observer text, that's Person A
- `app/api/parse/route.ts` — server route, that's Person A

## Hard constraints

- Always handle unknown/missing param keys with a sensible default — don't crash if Person A sends unexpected values
- Keep a working fallback scene for demo safety (projectile_motion with defaults)
- `onOutcome` must always be called — once on reset (launched: false) and once after simulation runs
- Never change param key names without telling Person A — they are set by the Gemini prompt
