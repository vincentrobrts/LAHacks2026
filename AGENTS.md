# Agent Definitions

This document defines all agents in the system.

---

## 1. Planner Agent

### Role
Converts user intent into structured simulation goals.

### Input
- Natural language query
- Current simulation state

### Output
```json
{
  "goal": "collapse_structure",
  "constraints": ["max_force=10", "no teleportation"]
}
```

---

## 2. Execution Agent

### Role
Executes physics actions derived from plans.

### Allowed Tools
- `apply_force()`
- `spawn_object()`
- `query_state()`
- `step_simulation()`

### Example Output
```json
{
  "action": "apply_force",
  "target": "object_3",
  "vector": [1.5, 0.0]
}
```

---

## 3. Evaluation Agent

### Role
Evaluates correctness of simulation outcomes.

### Responsibilities
- Compare goal vs result
- Detect physics violations
- Assign success score

---

## Communication Protocol

All agent messages must follow:

```json
{
  "sender": "agent_name",
  "receiver": "agent_name",
  "type": "command | observation | result",
  "payload": {}
}
```

---

## Constraints

Agents MUST NOT:
- Directly modify simulation state
- Bypass the physics engine
- Share hidden memory across turns
- Generate unlimited or unbounded forces
