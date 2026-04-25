# Person A — AI Agent & Parsing

You are the AI/backend engineer. Your job is to take any physics problem in plain English and return a typed, parameterized config that Person B can render.

## The product vision

User pastes a physics problem → AI identifies the scenario and extracts parameters → Matter.js animates it live.

Examples:
- "A ball rolls off a table at 2 m/s" → `projectile_motion`
- "Two carts collide on a frictionless track" → `collision_1d`
- "A 1kg mass hangs from a 2m string" → `pendulum`
- "A block slides down a 30 degree ramp" → `inclined_plane`
- "Drop a feather and a bowling ball" → `free_fall`

## Your files

| File | What it does |
|------|-------------|
| `lib/agentverse.ts` | Calls `/api/parse`, falls back to regex parser |
| `lib/parser.ts` | Regex fallback — update to handle new scenario types |
| `lib/defaults.ts` | Default configs per scenario type |
| `lib/explanation.ts` | `buildExplanation(config, outcome)` — observer panel text |
| `app/api/parse/route.ts` | Server-side Gemini call — this is your main file |

## Your contract with Person B

You return a `SimulationConfig`. Person B renders it. Never change this shape without telling them.

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

These are the exact keys Person B will read from `params`. Do not add keys they don't expect.

### `projectile_motion`
```json
{ "angle": 38, "speed": 18, "mass": 1, "initial_height": 0 }
```
- `angle`: 0–85 degrees above horizontal
- `speed`: 5–40 m/s
- `mass`: 0.5–5 kg
- `initial_height`: 0–300 (pixels from ground)

### `collision_1d`
```json
{ "mass1": 2, "v1": 5, "mass2": 1, "v2": -3, "restitution": 0.8 }
```
- `mass1`, `mass2`: 0.5–10 kg
- `v1`, `v2`: -20 to 20 m/s (negative = leftward)
- `restitution`: 0 (perfectly inelastic) – 1 (perfectly elastic)

### `pendulum`
```json
{ "length": 150, "initial_angle": 45, "mass": 1 }
```
- `length`: 50–250 pixels
- `initial_angle`: 5–80 degrees from vertical
- `mass`: 0.5–5 kg

### `inclined_plane`
```json
{ "angle": 30, "friction": 0.3, "mass": 1 }
```
- `angle`: 5–60 degrees
- `friction`: 0–0.9
- `mass`: 0.5–5 kg

### `free_fall`
```json
{ "height": 200, "mass": 1, "air_resistance": 0.01 }
```
- `height`: 50–400 pixels from ground
- `mass`: 0.5–10 kg
- `air_resistance`: 0–0.1 (0 = vacuum)

## What to implement

### 1. Update `types/simulation.ts`

Replace the current `SimulationType` and `SimulationConfig` with the schema above.

### 2. Update `app/api/parse/route.ts`

Update the Gemini system prompt to:
- List all 5 scenario types with their parameter ranges
- Ask Gemini to identify the type from the problem, then extract parameters
- Return JSON only, no prose
- Default to `projectile_motion` if uncertain

### 3. Update `lib/defaults.ts`

Add a default config for each scenario type so the fallback always works.

### 4. Update `lib/parser.ts`

Update the regex fallback to at least detect the scenario type from keywords:
- "pendulum", "string", "hang" → `pendulum`
- "collide", "crash", "hit" → `collision_1d`
- "ramp", "slope", "incline" → `inclined_plane`
- "drop", "fall", "free fall" → `free_fall`
- default → `projectile_motion`

### 5. Update `lib/explanation.ts`

`buildExplanation` currently has hardcoded tower text. Update it to branch on `config.type`.

## What NOT to touch

- `components/MatterScene.tsx` — that's Person B
- `components/SimulationClient.tsx` — that's Person B
- `app/page.tsx` — that's Person B

## Hard constraints

- Always return a valid config with all required params — clamp and default rather than error
- Keep `PERFECT_SHOT` or equivalent fallback working for demo safety
- Never change param key names without telling Person B — they read these directly
- If Gemini returns an unrecognized type, default to `projectile_motion`
