# Physics Simulation & Agent Rules

---

## 1. Physics Rules

- Conservation of energy must be preserved
- Conservation of momentum must be preserved
- No direct state mutation allowed

---

## 2. Agent Rules

- All actions must go through the simulation API
- Agents must observe before acting
- Actions must follow the structured JSON schema

---

## 3. Simulation Rules

- Fixed timestep required
- Fully deterministic execution
- All randomness must be seeded

---

## 4. Safety Constraints

- Force limits enforced per step
- Velocity clamping allowed only in emergency
- No infinite loops or runaway behavior

---

## 5. Communication Rules

- JSON-only messaging between agents
- No hidden state sharing
- All actions must be logged

---

## 6. Debug Requirements

- Full simulation replay must be possible
- Every step must be logged
- Failures must be explicit — no silent fixes
