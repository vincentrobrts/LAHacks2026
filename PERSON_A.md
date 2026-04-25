# Person A — AI Agent & Parsing

You are the AI/backend engineer on this project. Your job is to make natural language actually drive the simulation intelligently.

## Your files

| File | What it does |
|------|-------------|
| `lib/agentverse.ts` | Entry point — currently a stub, needs real LLM call |
| `lib/parser.ts` | Regex fallback parser — `parsePhysicsPrompt()` and `parserJson()` |
| `lib/defaults.ts` | `DEFAULT_SIMULATION`, `PERFECT_SHOT`, `DEFAULT_PROMPT` constants |
| `lib/explanation.ts` | `buildExplanation(config, outcome)` — generates observer panel text |

## Your contract with Person B

You must return a `SimulationConfig` from `parseWithAgentverse()`. That's it. The frontend never changes as long as this shape is preserved:

```ts
type SimulationConfig = {
  type: "projectile_knockdown";
  projectile: {
    speed: number;   // 8–35
    angle: number;   // 10–75 degrees
    mass: number;    // 0.5–2.0
  };
  world: {
    gravity: number;      // 1–20, Earth = 9.8
    towerBlocks: number;  // 4–14 integer
  };
  explanationGoal: string; // sentence for the LLM explanation pass
};
```

## Current state

`agentverse.ts` calls `parsePhysicsPrompt()` which is a regex extractor. It works for simple prompts ("speed 20, angle 45") but fails on anything creative or indirect. Replacing this with a real LLM call is the highest-impact task.

## What to implement

### 1. Wire a real LLM into `agentverse.ts`

Replace the stub body. The LLM should receive the user prompt and return a valid `SimulationConfig` JSON. System prompt should:
- Explain the schema and valid ranges
- Ask for JSON only, no prose
- Include `explanationGoal` describing what the observer should explain

Example system prompt skeleton:
```
You are a physics simulation configurator. Given a natural language description of a projectile scenario, output ONLY valid JSON matching this schema: { type, projectile: { speed, angle, mass }, world: { gravity, towerBlocks }, explanationGoal }.
Ranges: speed 8–35, angle 10–75, mass 0.5–2.0, gravity 1–20, towerBlocks 4–14 integer.
```

### 2. Keep the regex parser as fallback

If the LLM call fails or times out, fall back to `parsePhysicsPrompt(prompt)`. Never throw to the user.

### 3. Optionally improve `buildExplanation`

After launch, `explanation.ts` generates observer text. You can upgrade it to make a second LLM call using `config` + `LaunchOutcome` + `explanationGoal` for a richer explanation. Low priority — do this only if core works.

## What NOT to touch

- `components/MatterScene.tsx` — physics engine, that's Person B
- `components/SimulationClient.tsx` — UI wiring, that's Person B
- `app/page.tsx` — landing page, that's Person B
- `lib/share.ts` — URL encoding, touch only if schema changes

## Hard constraints

- Never change the `SimulationConfig` type shape without telling Person B first
- Always return a valid config — clamp values rather than erroring
- Keep the `PERFECT_SHOT` preset working as a no-LLM fallback for demos
