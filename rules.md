# Rules

## Build Priority
1. Working demo first
2. Clean UI second
3. Agentverse integration third
4. Extra physics polish last

## Physics Rules
- Use Matter.js for deterministic 2D rigid-body physics.
- Use fixed or stable timestep where possible.
- Prioritize visually understandable physics over perfect realism.
- Support only the demo scenario first: projectile knocking over a block tower.
- Do not build a general physics engine.

## Agent Rules
- Agents must output structured JSON only.
- Agents do not directly manipulate UI.
- Agents return actions like spawn_projectile, set_velocity, reset_world.
- If parsing fails, fall back to demo preset.

## Demo Reliability
- The default demo must work without AI.
- AI/Agentverse is an enhancement, not a dependency for the core visual demo.
- Include a “Run Demo” button that always loads the winning scenario.

## Logging
- Log user input, parsed intent, agent output, actions executed, and final result.