# System Architecture

## Overview

This system combines:
- AI agents (reasoning layer)
- Physics simulation engine (ground truth layer)
- ASI:One / Agentverse (interaction layer)

---

## Architecture Layers

### 1. Agent Layer (Reasoning)

Agents:
- Planner Agent
- Execution Agent
- Evaluation Agent

Responsibilities:
- Interpret user intent
- Generate structured plans
- Convert plans into tool calls

---

### 2. Simulation Layer (Physics Engine)

Core functions:
- Force simulation
- Collision detection
- Momentum propagation
- Timestep-based updates

Key rule:
> Agents cannot directly modify world state. All changes must pass through physics resolution.

---

### 3. Interface Layer (ASI:One / Agentverse)

- Receives natural language input
- Routes to correct agent(s)
- Handles Chat Protocol communication
- Enables agent discovery on Agentverse

---

## Data Flow

```
User → ASI:One → Planner → Executor → Physics Engine → Evaluator → Response
```

---

## Execution Loop

1. Observe state
2. Plan action
3. Validate against rules
4. Execute action
5. Step physics
6. Evaluate result

---

## Design Philosophy

- No hallucinated physics
- Fully deterministic execution
- Transparent agent reasoning
- Replayable simulations

---

## Failure Handling

If instability occurs:
- Clamp velocity/forces
- Rollback timestep
- Log error state explicitly
