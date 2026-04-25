# Intuify

Intuify is a polished LA Hacks 2026 MVP that turns a textbook physics word problem into an interactive frontend simulation. The main reliable demo is an inclined-plane problem:

> A 5 kg block is placed on a 30 degree inclined plane. The coefficient of kinetic friction between the block and the plane is 0.2. Find the acceleration of the block as it slides down the plane, the time to travel 3 meters from rest, and the final velocity after 3 meters.

The app uses a local rule-based parser, React, TypeScript, Tailwind, localStorage history, and URL-encoded share links. The inclined-plane demo uses direct kinematics for educational correctness.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Flow

1. Enter or use the default inclined-plane prompt.
2. Click **Build Simulation**.
3. Inspect the original prompt and parsed JSON.
4. Adjust angle, friction, mass, travel distance, and gravity.
5. Click **Run Animation** to slide the block down the ramp.
6. Read the result panel for acceleration, time, and final velocity.
7. Copy the share link to preserve the prompt and simulation state in the URL.

## Architecture

```text
Prompt
  -> local parser abstraction
  -> SimulationConfig JSON
  -> Next.js / React UI
  -> inclined-plane kinematics scene
  -> explanation + local history + share URL
```

Important files:

- `app/page.tsx` - polished landing/input page.
- `app/sim/page.tsx` - simulation route shell.
- `components/SimulationClient.tsx` - panels, controls, history, sharing, explanation.
- `components/MatterScene.tsx` - inclined-plane scene plus projectile fallback.
- `lib/parser.ts` - local rule-based parser that outputs the simulation schema.
- `lib/agentverse.ts` - placeholder for future Fetch.ai Agentverse parser integration.
- `types/simulation.ts` - shared simulation schema.

## Inclined-Plane Equations

```text
N = mg cos θ
F<sub>f</sub> = μₖN
a = g(sin θ − μₖ cos θ)
t = sqrt(2d / a)
v = sqrt(2ad)
```

If acceleration is less than or equal to zero, the visualization explains that friction prevents the block from sliding.

## Agentverse Integration Notes

The MVP works fully without external APIs. Later, `lib/agentverse.ts` can call a deployed Agentverse/Fetch.ai Physics Parser Agent. That agent should return JSON matching `SimulationConfig` exactly, so the frontend renderer does not need to change.

Deferred from the MVP:

- PyBullet
- FastAPI backend
- WebSocket streaming
- full multi-agent orchestration
- accounts or databases
- additional physics scenarios
