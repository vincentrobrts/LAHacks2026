export type SimulationType =
  | "projectile_motion"
  | "collision_1d"
  | "pendulum"
  | "inclined_plane"
  | "free_fall";

export type SimulationConfig = {
  type: SimulationType;
  params: Record<string, number>;
  world: {
    gravity: number;  // m/s², Earth = 9.8
    friction: number; // 0–1
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
