# AI Agents Specification — Physics Simulation System

This document defines all AI agents used in the system, their responsibilities, inputs, outputs, and constraints.

---

## 1. ASI:One Router Agent (Fetch.ai Entry Layer)

### Purpose
Routes user natural language input to the correct internal agent system.

### Input
Natural language from user.

Example:
> "build a stable bridge across this gap"

### Output
Structured task for Planner Agent.

```json
{
  "task": "build_bridge",
  "context": "gap detected between platforms"
}
```

---

## 2. Planner Agent (Core Intelligence Layer)

### Purpose
Converts user intent into a sequence of physics actions.

### Responsibilities
- Interpret goal
- Break into steps
- Ensure physical feasibility
- Output ordered action plan

### Input
Structured task from ASI:One or raw user intent.

### Output
JSON array of actions:

```json
[
  { "action": "spawn_object", "type": "box", "x": 100, "y": 300 },
  { "action": "spawn_object", "type": "box", "x": 100, "y": 250 }
]
```

### Constraints
- Must respect physics realism
- Must not output invalid object placements
- Must be deterministic (no free text)

---

## 3. Controller Agent (Execution Layer)

### Purpose
Executes planner output step-by-step.

### Responsibilities
- Send actions to backend API
- Maintain execution order
- Handle retries on failure

### Input
Action list from Planner Agent.

### Output
Execution status logs:

```json
{
  "status": "success",
  "executed_actions": 5
}
```

---

## 4. Validator Agent (Physics Constraint System)

### Purpose
Ensures all actions obey physical rules before execution.

### Responsibilities
- Check stability
- Prevent floating objects
- Validate collision constraints
- Reject invalid forces

### Input
Single action.

### Output
Validation result:

```json
{
  "valid": false,
  "reason": "object has no support base"
}
```

---

## 5. Observer Agent (World Understanding Layer)

### Purpose
Explains simulation state in natural language.

### Input
Full world state JSON.

### Output
Human-readable explanation.

Example:
> "The tower collapsed due to uneven weight distribution on the left side."

---

## 6. System Constraints

- Agents must only communicate via structured JSON
- No direct UI manipulation allowed
- All actions must go through Validator Agent before execution
- Physics engine is the single source of truth

---

## 7. Agent Interaction Flow

```
User Input
   ↓
ASI:One Router
   ↓
Planner Agent
   ↓
Validator Agent
   ↓
Controller Agent
   ↓
Physics Engine
   ↓
Observer Agent (feedback loop)
```
