import type { SimulationConfig } from "@/types/simulation";

export const DEFAULT_PROMPT = "Can I knock down the tower with one shot?";

export const DEFAULT_SIMULATION: SimulationConfig = {
  type: "projectile_knockdown",
  projectile: {
    speed: 18,
    angle: 38,
    mass: 1
  },
  world: {
    gravity: 9.8,
    towerBlocks: 8
  },
  explanationGoal: "Explain how launch angle and speed affect the projectile path."
};

export const PERFECT_SHOT: SimulationConfig = {
  type: "projectile_knockdown",
  projectile: {
    speed: 24,
    angle: 27,
    mass: 1.4
  },
  world: {
    gravity: 9.8,
    towerBlocks: 8
  },
  explanationGoal: "Explain why this launch has enough horizontal speed to topple the tower."
};
