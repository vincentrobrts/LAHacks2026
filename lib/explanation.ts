import type { LaunchOutcome, SimulationConfig } from "@/types/simulation";

export function buildExplanation(config: SimulationConfig, outcome: LaunchOutcome | null) {
  if (!outcome?.launched) {
    return "Adjust the angle, speed, and gravity to see how the predicted arc changes. Higher speed carries the projectile farther, while gravity pulls it down sooner.";
  }

  if (outcome.success) {
    return `The projectile hit with enough horizontal momentum to move ${outcome.blocksMoved} tower blocks. At ${config.projectile.angle} degrees and speed ${config.projectile.speed}, the arc stays low enough to reach the tower while still carrying energy into the stack. Try lowering speed or increasing gravity to see the shot fall short.`;
  }

  return `The shot did not fully topple the tower. It moved ${outcome.blocksMoved} blocks, which means the launch either missed the center of mass or arrived with too little speed. Try a faster launch, a slightly flatter angle, or lower gravity.`;
}
