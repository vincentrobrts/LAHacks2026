import type { LaunchOutcome, SimulationConfig } from "@/types/simulation";

const idle: Record<string, string> = {
  projectile_motion: "Adjust angle, speed, and gravity to see how the arc changes. Higher speed means more range; higher angle means more height but less distance.",
  collision_1d: "Set the masses and velocities of both objects, then launch to see how momentum is conserved through the collision.",
  pendulum: "Adjust the pendulum length and release angle. A longer pendulum swings slower; a larger angle gives more speed at the bottom.",
  inclined_plane: "Adjust the ramp angle and friction. Higher angles accelerate the block faster; more friction slows it down.",
  free_fall: "Set the drop height and mass. With no air resistance, all objects fall at the same rate regardless of mass.",
};

const metricsLabel: Record<string, Record<string, string>> = {
  projectile_motion: { flightDistance: "range (px)", peakHeight: "peak height (px)", timeOfFlight: "flight time (s)" },
  collision_1d: { v1_final: "v₁ final", v2_final: "v₂ final", kineticEnergyLost: "KE lost" },
  pendulum: { period: "period (s)", maxSpeed: "max speed" },
  inclined_plane: { timeToBottom: "time (s)", finalSpeed: "final speed" },
  free_fall: { timeToGround: "time (s)", finalSpeed: "impact speed" },
};

export function buildExplanation(config: SimulationConfig, outcome: LaunchOutcome | null): string {
  if (!outcome?.launched) {
    return idle[config.type] ?? "Run the simulation to see results.";
  }

  const p = config.params;

  switch (config.type) {
    case "projectile_motion": {
      const dist = outcome.metrics.flightDistance ?? 0;
      const peak = outcome.metrics.peakHeight ?? 0;
      return `Launched at ${p.angle}° and ${p.speed} m/s under ${config.world.gravity} m/s² gravity. ` +
        `The projectile travelled ${dist}px horizontally and reached a peak of ${peak}px. ` +
        `Increasing the angle raises the peak but reduces horizontal range beyond 45°.`;
    }
    case "collision_1d": {
      const v1f = (outcome.metrics.v1_final ?? 0).toFixed(2);
      const v2f = (outcome.metrics.v2_final ?? 0).toFixed(2);
      return `Object 1 (${p.mass1} kg at ${p.v1} m/s) collided with Object 2 (${p.mass2} kg at ${p.v2} m/s). ` +
        `After collision: v₁ = ${v1f} m/s, v₂ = ${v2f} m/s. ` +
        `Restitution ${p.restitution} — 1.0 is perfectly elastic, 0 is perfectly inelastic.`;
    }
    case "pendulum": {
      const period = (outcome.metrics.period ?? 0).toFixed(2);
      const maxSpeed = (outcome.metrics.maxSpeed ?? 0).toFixed(2);
      return `Pendulum released at ${p.initial_angle}° with length ${p.length}px. ` +
        `Period ≈ ${period}s, max speed at bottom ≈ ${maxSpeed} px/s. ` +
        `Period depends on length, not mass or angle (for small angles).`;
    }
    case "inclined_plane": {
      const time = (outcome.metrics.timeToBottom ?? 0).toFixed(2);
      const speed = (outcome.metrics.finalSpeed ?? 0).toFixed(2);
      return `Block on ${p.angle}° ramp with friction ${p.friction}. ` +
        `Reached the bottom in ${time}s at ${speed} px/s. ` +
        `Net acceleration = g·sin(θ) − μ·g·cos(θ).`;
    }
    case "free_fall": {
      const time = (outcome.metrics.timeToGround ?? 0).toFixed(2);
      const speed = (outcome.metrics.finalSpeed ?? 0).toFixed(2);
      return `Object dropped from ${p.height}px with air resistance ${p.air_resistance}. ` +
        `Hit the ground in ${time}s at ${speed} px/s. ` +
        `${p.air_resistance === 0 ? "In a vacuum, all masses fall identically." : "Air resistance reduces final speed and extends fall time."}`;
    }
    default:
      return "Simulation complete.";
  }
}

export function outcomeMetricLabels(config: SimulationConfig): Record<string, string> {
  return metricsLabel[config.type] ?? {};
}
