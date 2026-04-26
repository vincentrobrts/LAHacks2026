# Intuify

**Turn physics word problems into interactive simulations — instantly.**

Intuify takes a plain English physics problem and generates a live, interactive visualization. Instead of solving equations in isolation, you can see the system behave, adjust parameters in real time, and follow a step-by-step guided breakdown that connects the math to the motion.

Built at LA Hacks 2026.

---

## Demo

Paste any physics word problem on the home page or compound lab:

> *"A 5 kg block slides down a 30° ramp with μₖ = 0.2 for 3 meters."*  
> *"A 3 kg mass on a 30° ramp connected by rope over a pulley to a 2 kg hanging mass."*  
> *"A 9V battery in series with a 10 Ω and 20 Ω resistor."*

---

## Features

**Atomic simulations** (14 scene types, fully analytical):

| Scene | Physics |
|---|---|
| Inclined Plane | N, friction, net force, kinematics |
| Atwood Machine | Pulley inertia, acceleration |
| Atwood Table | Table + hanging mass system |
| Projectile Motion | 2D kinematics |
| Free Fall | Gravity + air resistance |
| Pendulum | SHM, period |
| Spring-Mass | SHM, energy |
| Circular Motion | Centripetal force |
| Torque | Moment of inertia, angular acceleration |
| Ohm's Law | Current, voltage drop, power |
| Electric Field | Coulomb force |
| Bernoulli | Fluid continuity, pressure |
| Standing Waves | Harmonics, nodes |
| Bohr Model | Electron transitions, photon emission |

**Compound Lab** (multi-body systems):

- Ramp-Atwood machine (block on ramp + hanging mass)
- Double ramp Atwood (two blocks on opposing ramps)
- Spring-Atwood machine (spring + pulley + hanging mass)
- Standard Atwood machine
- Series circuits (battery + resistors + capacitors)

All compound scenes use closed-form analytical kinematics — no unstable physics solver.

---

## Stack

- **Framework:** Next.js 14 App Router, TypeScript, Tailwind CSS
- **AI parsing:** Groq API (`llama-3.1-8b-instant`) via `POST /api/parse` and `POST /api/parse-compound`
- **Rendering:** SVG + `requestAnimationFrame` analytical animation (no physics engine dependency)
- **State:** URL-encoded simulation state (`/sim?state=...`) for shareable links; `localStorage` for history

---

## Getting Started

```bash
npm install
```

Create a `.env.local` file:

```
GROQ_API_KEY=your_groq_api_key_here
```

Then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
app/
  page.tsx              # Home — prompt input + history
  sim/page.tsx          # Atomic simulation viewer
  compound/page.tsx     # Compound physics lab
  api/
    parse/              # Atomic: Groq → SimulationConfig
    parse-compound/     # Compound: Groq → ParsedCompound

components/
  SimulationClient.tsx  # Atomic scene dispatcher
  MatterScene.tsx       # Inclined plane + Atwood table scenes
  scenes/               # One file per scene type

lib/
  agentverse.ts         # Atomic parse call
  physics/
    builder.ts          # ParsedCompound → BuiltScene
    presets.ts          # Circuit solver
    types.ts            # Compound type definitions
  share.ts              # URL encode/decode simulation state
  defaults.ts           # Default configs and prompts

types/
  simulation.ts         # SimulationConfig, SimulationType, etc.
```

---

## Claude Desktop MCP Server

Intuify ships an MCP server so Claude Desktop can generate physics simulations inline — animated HTML + a link to the interactive web app.

**Setup:**

```bash
cd agent
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

Add to your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "intuify": {
      "command": "/absolute/path/to/agent/venv/bin/python",
      "args": ["/absolute/path/to/agent/mcp_server.py"],
      "env": {
        "GROQ_API_KEY": "your_groq_api_key",
        "WEB_APP_URL": "http://localhost:3000"
      }
    }
  }
}
```

Then ask Claude: *"Simulate a 5 kg block sliding down a 30° ramp with friction 0.2"* — it will render an animation inline and give you a link to the full interactive app.

---

## Team

Yifan Fang — AI + backend  
Vincent Roberts — frontend + simulation + UI/UX
