# Demo Walkthrough

---

## Scenario

> "Use a projectile to knock over a structure."

---

## Step 1: User Input

User:
> "Can I knock it down with one shot?"

---

## Step 2: Planner Agent

Output:
- Identify structural weak point
- Compute required force vector
- Define success condition (structure collapses)

---

## Step 3: Execution Agent

- Spawns projectile at computed position
- Applies force vector
- Sends action to physics engine

---

## Step 4: Physics Simulation

- Projectile moves under gravity
- Collision detected at weak point
- Momentum transfers to structure
- Structure collapses

---

## Step 5: Evaluation Agent

Output:
```json
{
  "success": true,
  "efficiency": 0.81,
  "physics_validity": "pass",
  "goal_met": true
}
```

---

## What This Demonstrates

- Agents reason about physics before acting
- Outcomes are deterministic and explainable
- The system can verify its own success
- Full replay available from logs
