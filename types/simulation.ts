export type SimulationType = "inclined_plane" | "projectile_knockdown";

export type SimulationConfig = {
  type: SimulationType;
  projectile: {
    speed: number;
    angle: number;
    mass: number;
  };
  world: {
    gravity: number;
    towerBlocks: number;
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
  blocksMoved: number;
  success: boolean;
  peakHeight: number;
  flightDistance: number;
  metrics?: {
    acceleration: number;
    timeToBottom: number | null;
    finalSpeed: number;
  };
};
