# Physics Visualizer

Physics Visualizer is a polished LA Hacks 2026 MVP that turns a physics word problem into an interactive projectile-motion simulation. The core demo is:

> Can I knock down the tower with one shot?

The app uses a local rule-based parser, Matter.js, React, TypeScript, Tailwind, localStorage history, and URL-encoded share links. It intentionally avoids backend orchestration so the demo stays fast and reliable.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Flow

1. Enter a physics prompt on the landing page.
2. Click **Build Simulation**.
3. Inspect the original prompt and parsed JSON.
4. Adjust angle, speed, and gravity.
5. Click **Launch** to fire the projectile at the block tower.
6. Use **Run Perfect Shot** for a reliable successful knockdown.
7. Copy the share link to preserve the prompt and simulation state in the URL.

## Architecture

```text
Prompt
  -> local parser abstraction
  -> SimulationConfig JSON
  -> Next.js / React UI
  -> Matter.js projectile knockdown scene
  -> explanation + local history + share URL
```

Important files:

- `app/page.tsx` - polished landing/input page.
- `app/sim/page.tsx` - simulation route shell.
- `components/SimulationClient.tsx` - panels, controls, history, sharing, explanation.
- `components/MatterScene.tsx` - Matter.js world, projectile, tower, trajectory preview.
- `lib/parser.ts` - local rule-based parser that outputs the simulation schema.
- `lib/agentverse.ts` - placeholder for future Fetch.ai Agentverse parser integration.
- `types/simulation.ts` - shared simulation schema.

## Simulation Schema

```json
{
  "type": "projectile_knockdown",
  "projectile": {
    "speed": 18,
    "angle": 38,
    "mass": 1
  },
  "world": {
    "gravity": 9.8,
    "towerBlocks": 8
  },
  "explanationGoal": "Explain how launch angle and speed affect the projectile path."
}
```

## Agentverse Integration Notes

The MVP works fully without external APIs. Later, `lib/agentverse.ts` can call a deployed Agentverse/Fetch.ai Physics Parser Agent. That agent should return JSON matching `SimulationConfig` exactly, so the frontend renderer does not need to change.

Deferred from the MVP:

- PyBullet
- FastAPI backend
- WebSocket streaming
- full multi-agent orchestration
- accounts or databases
- additional physics scenarios
