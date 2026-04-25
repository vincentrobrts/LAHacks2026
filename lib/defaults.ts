import type { SimulationConfig, SimulationType } from "@/types/simulation";

export const DEFAULT_PROMPT = "A 5 kg block slides down a 30 degree incline with μk = 0.2 for 3 meters.";

export const DEFAULT_CONFIGS: Record<SimulationType, SimulationConfig> = {
  projectile_motion: {
    type: "projectile_motion",
    params: { angle: 38, speed: 18, mass: 1, initial_height: 0 },
    world: { gravity: 9.8, friction: 0.1 },
    explanationGoal: "Explain how launch angle and speed affect the range and peak height of the projectile.",
  },
  collision_1d: {
    type: "collision_1d",
    params: { mass1: 2, v1: 5, mass2: 1, v2: -2, restitution: 0.8 },
    world: { gravity: 9.8, friction: 0.05 },
    explanationGoal: "Explain how momentum is conserved and how restitution affects the final velocities.",
  },
  pendulum: {
    type: "pendulum",
    params: { length: 150, initial_angle: 45, mass: 1 },
    world: { gravity: 9.8, friction: 0 },
    explanationGoal: "Explain how pendulum length and initial angle affect the period and maximum speed.",
  },
  inclined_plane: {
    type: "inclined_plane",
    params: { angle: 30, friction: 0.2, mass: 5, distance: 3 },
    world: { gravity: 9.8, friction: 0.2 },
    explanationGoal: "Explain how the ramp angle and friction coefficient affect how fast the block slides.",
  },
  free_fall: {
    type: "free_fall",
    params: { height: 200, mass: 1, air_resistance: 0 },
    world: { gravity: 9.8, friction: 0 },
    explanationGoal: "Explain how gravity and air resistance affect the time and speed of the falling object.",
  },
  atwood_table: {
    type: "atwood_table",
    params: { mass1: 4, mass2: 2, friction: 0, distance: 3 },
    world: { gravity: 9.8, friction: 0 },
    explanationGoal: "Show how tension and gravity determine the acceleration of a two-mass pulley system.",
  },
};

export const DEFAULT_SIMULATION = DEFAULT_CONFIGS.inclined_plane;

export const DEMO_SHOT: SimulationConfig = {
  type: "inclined_plane",
  params: { angle: 30, friction: 0.2, mass: 5, distance: 3 },
  world: { gravity: 9.8, friction: 0.2 },
  explanationGoal: "Explain acceleration, friction, time, and final velocity for a block sliding down an inclined plane.",
};
