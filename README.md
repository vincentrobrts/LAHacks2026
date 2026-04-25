# Physics-Grounded Multi-Agent Simulation System

A physics-first multi-agent AI system where agents reason, plan, and execute actions inside a deterministic physics simulation environment.

Built for LA Hacks 2026 — targeting Fetch.ai Agentverse + ASI:One track.

---

## Overview

Most AI agents hallucinate physical outcomes.

This system forces agents to operate inside a real physics engine where:
- All actions are physically simulated
- All outcomes are deterministic and replayable
- Agents cannot directly modify world state

Agents must reason about forces, motion, and collisions before acting.

---

## Core Features

- Multi-agent system (Planner, Executor, Evaluator)
- Deterministic physics simulation engine
- Structured JSON tool-calling protocol
- Agent-to-agent communication layer
- ASI:One / Agentverse integration (Chat Protocol)
- Replayable simulation logs

---

## Tech Stack

- Python (core simulation + orchestration)
- Custom 2D physics engine (rigid body simulation)
- Claude SDK / OpenAI Agent SDK (agent orchestration)
- Fetch.ai Agentverse (agent deployment + discovery)
- ASI:One (query routing + interaction layer)

---

## How It Works

```
User → ASI:One → Planner Agent → Executor Agent → Physics Engine → Evaluator Agent → Response
```

---

## Install

```bash
git clone <repo>
cd project
pip install -r requirements.txt
python main.py
```

---

## Agents

| Agent | Role |
|---|---|
| Planner | Converts user intent into simulation goals |
| Executor | Converts plans into physics actions |
| Evaluator | Validates outcomes against goals |

---

## Key Idea

Instead of asking:
> "What will happen?"

We simulate:
> "What *actually* happens under physics constraints?"

See [ARCHITECTURE.md](ARCHITECTURE.md), [AGENTS.md](AGENTS.md), [rules.md](rules.md), and [demo.md](demo.md) for full specs.
