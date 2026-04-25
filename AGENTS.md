# Agents Specification

## MVP Agent Strategy
Use one main agent for the hackathon demo.

## 1. Physics Parser Agent

### Purpose
Convert natural language physics prompts into structured simulation JSON.

### Input
User physics prompt.

Example:
"Can I knock down the tower with one shot?"

### Output
JSON only:

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

### Constraints
- Output JSON only.
- If uncertain, choose the projectile_knockdown demo scenario.
- Never return free-form text in the parser response.

## 2. Optional Explanation Agent

### Purpose
Explain the current simulation state in simple educational language.

### Input
Simulation state and outcome.

### Output
Short explanation:
- what happened
- why it happened
- what the user should try changing

## Deferred Agents
Do not implement these unless MVP is finished:
- Controller Agent
- Validator Agent
- Observer Agent as separate service
- multi-agent feedback loop