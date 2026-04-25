import type { SimulationConfig } from "@/types/simulation";

export const DEFAULT_PROMPT =
  "A 5 kg block is placed on a 30 degree inclined plane. The coefficient of kinetic friction between the block and the plane is 0.2. Find the acceleration of the block as it slides down the plane, the time to travel 3 meters from rest, and the final velocity after 3 meters.";

export const DEFAULT_SIMULATION: SimulationConfig = {
  type: "inclined_plane",
  projectile: {
    speed: 0,
    angle: 30,
    mass: 5
  },
  world: {
    gravity: 9.8,
    towerBlocks: 0
  },
  explanationGoal: "Explain acceleration, friction, time, and final velocity for a block sliding down an inclined plane."
};

export const PERFECT_SHOT: SimulationConfig = {
  type: "inclined_plane",
  projectile: {
    speed: 0,
    angle: 30,
    mass: 5
  },
  world: {
    gravity: 9.8,
    towerBlocks: 0
  },
  explanationGoal: "Explain acceleration, friction, time, and final velocity for a block sliding down an inclined plane."
};
