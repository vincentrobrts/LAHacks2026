# Physics Agent Simulation System — Architecture

## Overview
This project is a physics-driven simulation environment where AI agents interpret user intent, generate structured plans, and execute actions inside a real-time physics engine.

Users interact via natural language (through ASI:One), and AI agents translate those instructions into physically valid actions that manipulate a simulated world.

---

## High-Level System Flow

```
User Input
   ↓
ASI:One (Fetch.ai routing layer)
   ↓
Planner Agent (LLM reasoning layer)
   ↓
Validator Agent (physics constraint checker)
   ↓
FastAPI Backend (action execution layer)
   ↓
Physics Engine (Matter.js / PyBullet simulation core)
   ↓
World State Stream (WebSocket)
   ↓
Frontend (Next.js + Canvas rendering)
```

---

## Core Components

### 1. Frontend (apps/web)
- Next.js application
- Canvas-based physics rendering (Matter.js renderer)
- UI:
  - Natural language input box
  - Live simulation view
  - Agent reasoning logs
  - Action history panel

---

### 2. Backend (apps/backend)
- FastAPI server
- Handles:
  - Simulation API
  - Agent orchestration
  - WebSocket world state streaming

Endpoints:
- `POST /action` → apply agent action
- `GET /state` → full world snapshot
- `WS /stream` → real-time simulation updates
- `POST /reset` → reset world

---

### 3. Physics Engine (simulation/)
- Responsible for:
  - Rigid body simulation
  - Gravity and collisions
  - Constraints (joints, ropes)
  - Stability evaluation

Key files:
- `world.py` → global simulation state
- `stepper.py` → physics update loop

---

### 4. AI Agent Layer (apps/agents)

#### Planner Agent
- Converts natural language → structured action plan
- Produces ordered JSON action sequences

#### Controller Agent
- Sends actions to backend execution API
- Ensures correct sequencing

#### Observer Agent
- Reads world state
- Generates human-readable explanations

#### Validator Agent
- Checks if actions obey physics constraints
- Rejects impossible or unstable operations

---

### 5. Fetch.ai Integration (fetchai/)
- ASI:One acts as entry point for user queries
- Agentverse registration required
- Chat Protocol enabled for agent communication

Flow:
```
User → ASI:One → Planner Agent → Backend → Physics Engine
```

---

## Data Flow (Key Concept)

### Action Schema (AI → Backend)
```json
{
  "action": "spawn_object",
  "type": "box",
  "x": 100,
  "y": 200
}
```

### World State (Backend → Frontend)
```json
{
  "objects": [
    { "id": 1, "x": 120, "y": 300, "vx": 0.1, "vy": -0.5 }
  ],
  "events": []
}
```

---

## Key Design Principle

> The AI does NOT directly control pixels or UI — it only manipulates structured physical actions.

This ensures:
- Deterministic simulation
- Physics correctness
- Debuggability
- Agent accountability
