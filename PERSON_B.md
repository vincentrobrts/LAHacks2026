# Person B — Physics Simulation & Frontend

You are the frontend/simulation engineer on this project. Your job is to make the simulation look great and feel responsive.

## Your files

| File | What it does |
|------|-------------|
| `components/MatterScene.tsx` | Matter.js canvas — world build, launch, trajectory arc, outcome detection |
| `components/SimulationClient.tsx` | Full sim page layout — controls, prompt panel, explanation panel, history |
| `app/page.tsx` | Landing page — prompt input, preview SVG, history list |
| `app/sim/page.tsx` | Thin wrapper — just renders `<SimulationClient>` in a Suspense boundary |
| `lib/share.ts` | URL state encoding/decoding — `encodeSimulation` / `decodeSimulation` |
| `tailwind.config.ts` | Styling config |
| `app/globals.css` | Global styles |

## Your contract with Person A

You consume `SimulationConfig` from `parseWithAgentverse()`. You must not change the type shape without telling Person A:

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
  explanationGoal: string;
};
```

## Current state

The simulation is fully working:
- Matter.js engine running in `MatterScene.tsx` with ground, backstop, and block tower
- Trajectory arc rendered as SVG overlay on top of the canvas
- Launch button fires the projectile; outcome detected after 2600ms timeout
- Reset button rebuilds the world via `runId` increment
- Sliders for angle (10–75), speed (8–35), gravity (1–20) all live-update the arc
- Share links encode full state in the URL as base64 JSON
- Local history stores last 8 prompts in `localStorage`

## Key implementation details

**Canvas dimensions:** `760 × 520px`, ground at `y=462`, launcher at `x=92, y=430`

**Tower position:** centered at `x=600`, blocks are `46×24px`, alternating orange/red rows

**Trajectory arc:** computed in `trajectoryPoints()` — 44 sample points using `gravity * 0.028` as the scaled gravity constant. This magic number maps `config.world.gravity` to pixel/tick units — don't change it without re-tuning

**Outcome detection:** fires 2600ms after launch. A block "moved" if `|dx| > 18px` from tower center OR `|angle| > 0.18 rad` OR fell through ground. Success = ≥70% of blocks moved (min 4)

**World rebuild:** controlled by `runId` state — incrementing it triggers `useEffect → buildWorld()`. Config changes that come from sliders do NOT auto-reset; only the Reset button does

## What to work on

The simulation works but these would improve the demo:

1. **Visual polish** — trajectory arc label, speed/angle indicators on the canvas, launch animation
2. **Responsive canvas** — canvas is fixed `760×520`, doesn't scale on small screens
3. **Sound or particle effect on impact** — optional but high demo value
4. **Loading state** — when "Parse Prompt" is clicked, `agentverse.ts` will eventually hit a real API; add a spinner or disabled state to the button during the async call
5. **Better outcome feedback** — the result panel is text-only; a win/fail animation would land better in a demo

## What NOT to touch

- `lib/agentverse.ts` — LLM call logic, that's Person A
- `lib/parser.ts` — regex parser, that's Person A
- `lib/explanation.ts` — observer text, that's Person A
- `lib/defaults.ts` — simulation constants, coordinate with Person A before changing

## Hard constraints

- Always keep `PERFECT_SHOT` working — it's the demo fallback if the LLM is down
- Don't change the `SimulationConfig` type without telling Person A
- The `onOutcome` callback in `MatterScene` must always be called — both before launch (reset state) and after launch (result)
