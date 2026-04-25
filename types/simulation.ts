export type SimulationType =
  | "projectile_motion"
  | "collision_1d"
  | "pendulum"
  | "inclined_plane"
  | "free_fall"
  | "atwood_table"
  | "spring_mass"
  | "circular_motion"
  | "torque"
  | "electric_field"
  | "ohm_law"
  | "bernoulli"
  | "standing_waves"
  | "bohr_model";

export type SimulationConfig = {
  type: SimulationType;
  params: Record<string, number>;
  world: {
    gravity: number;
    friction: number;
  };
  explanationGoal: string;
};

export type SimulationHistoryItem = {
  id: string;
  prompt: string;
  config: SimulationConfig;
  timestamp: string;
};

export type LaunchOutcome = {
  launched: boolean;
  success: boolean;
  metrics: Record<string, number>;
};
