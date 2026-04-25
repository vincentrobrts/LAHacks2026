import type { LaunchOutcome, SimulationConfig } from "@/types/simulation";

const idle: Record<string, string> = {
  projectile_motion: "Adjust angle, speed, and gravity to see how the arc changes. Higher speed means more range; higher angle means more height but less distance.",
  collision_1d: "Set the masses and velocities of both objects, then launch to see how momentum is conserved through the collision.",
  pendulum: "Adjust the pendulum length and release angle. A longer pendulum swings slower; a larger angle gives more speed at the bottom.",
  inclined_plane: "Adjust the ramp angle and friction. Higher angles accelerate the block faster; more friction slows it down.",
  free_fall: "Set the drop height and mass. With no air resistance, all objects fall at the same rate regardless of mass.",
  atwood_table: "Set the two masses and friction. The heavier hanging mass drives the system; friction on the table mass opposes it.",
  spring_mass: "Pull the mass to its amplitude and release. Heavier masses or softer springs produce slower oscillations.",
  circular_motion: "Adjust radius, mass, and speed to explore centripetal force. Faster speed or tighter radius demands more inward force.",
  torque: "Apply a force at the end of a rod. More force or a longer arm creates more torque and faster angular acceleration.",
  electric_field: "Adjust charge magnitudes and separation. Opposite charges attract; same-sign charges repel, with force falling as 1/r².",
  ohm_law: "Set voltage, resistance, and internal resistance to see current and power. Higher resistance reduces current; internal resistance wastes power inside the battery.",
  bernoulli: "Adjust the area ratio to see fluid speed up in the narrow section. Faster flow means lower pressure — Bernoulli's principle.",
  standing_waves: "Change tension, density, or harmonic number. Higher tension or lower density gives faster waves and higher frequencies.",
  bohr_model: "Select atomic number and initial/final quantum levels. Downward transitions emit photons; the wavelength reveals the energy gap.",
  pulley: "Set the two masses and pulley radius. The heavier mass descends; a larger or heavier pulley wheel reduces acceleration by adding rotational inertia.",
};

const metricsLabel: Record<string, Record<string, string>> = {
  projectile_motion: { flightDistance: "range (px)", peakHeight: "peak height (px)", timeOfFlight: "flight time (s)" },
  collision_1d: { v1_final: "v₁ final", v2_final: "v₂ final", kineticEnergyLost: "KE lost" },
  pendulum: { period: "period (s)", maxSpeed: "max speed" },
  inclined_plane: { timeToBottom: "time (s)", finalSpeed: "final speed" },
  free_fall: { timeToGround: "time (s)", finalSpeed: "impact speed" },
  atwood_table: { acceleration: "acceleration (m/s²)", tension: "tension (N)", timeToBottom: "time (s)" },
  spring_mass: { period: "period (s)", maxSpeed: "max speed (m/s)", maxForce: "max force (N)" },
  circular_motion: { fc: "centripetal force (N)", ac: "centripetal acc (m/s²)", period: "period (s)" },
  torque: { tau: "torque (N·m)", alpha: "angular acc (rad/s²)", I: "moment of inertia" },
  electric_field: { F: "Coulomb force (N)" },
  ohm_law: { I: "current (A)", Vt: "terminal voltage (V)", P_ext: "power (W)" },
  bernoulli: { v1: "v₁ (m/s)", v2: "v₂ (m/s)", dP: "pressure drop (Pa)" },
  standing_waves: { freq: "frequency (Hz)", wavelength: "wavelength (m)", waveSpeed: "wave speed (m/s)" },
  bohr_model: { dE: "energy gap (eV)", lambda_nm: "photon λ (nm)" },
  pulley: { acceleration: "acceleration (m/s²)", T1: "tension T₁ (N)", T2: "tension T₂ (N)" },
};

export function buildExplanation(config: SimulationConfig, outcome: LaunchOutcome | null): string {
  if (!outcome?.launched) {
    return idle[config.type] ?? "Run the simulation to see results.";
  }

  const p = config.params;
  const g = config.world.gravity;

  switch (config.type) {
    case "projectile_motion": {
      const dist = outcome.metrics.flightDistance ?? 0;
      const peak = outcome.metrics.peakHeight ?? 0;
      return `Launched at ${p.angle}° and ${p.speed} m/s under ${g} m/s² gravity. ` +
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
        `Period ≈ ${period}s, max speed at bottom ≈ ${maxSpeed} m/s. ` +
        `Period depends on length and gravity, not mass or angle (for small angles).`;
    }
    case "inclined_plane": {
      const time = (outcome.metrics.timeToBottom ?? 0).toFixed(2);
      const speed = (outcome.metrics.finalSpeed ?? 0).toFixed(2);
      return `Block on ${p.angle}° ramp with friction μ=${p.friction}. ` +
        `Reached the bottom in ${time}s at ${speed} m/s. ` +
        `Net acceleration = g·sin(θ) − μ·g·cos(θ) = ${(g * (Math.sin(p.angle * Math.PI / 180) - p.friction * Math.cos(p.angle * Math.PI / 180))).toFixed(2)} m/s².`;
    }
    case "free_fall": {
      const time = (outcome.metrics.timeToGround ?? 0).toFixed(2);
      const speed = (outcome.metrics.finalSpeed ?? 0).toFixed(2);
      return `Object dropped from ${(p.height / 10).toFixed(0)} m with air resistance ${p.air_resistance}. ` +
        `Hit the ground in ${time}s at ${speed} m/s. ` +
        `${p.air_resistance === 0 ? "In a vacuum, all masses fall identically." : "Air resistance reduces final speed and extends fall time."}`;
    }
    case "atwood_table": {
      const a = (outcome.metrics.acceleration ?? 0).toFixed(3);
      const T = (outcome.metrics.tension ?? 0).toFixed(2);
      const t = (outcome.metrics.timeToBottom ?? 0).toFixed(2);
      return `${p.mass1} kg table mass connected to ${p.mass2} kg hanging mass. ` +
        `System accelerates at ${a} m/s² with tension ${T} N. ` +
        `Time to travel ${p.distance} m: ${t}s. Net force = (m₂ − μm₁)g.`;
    }
    case "spring_mass": {
      const period = (outcome.metrics.period ?? 0).toFixed(3);
      const maxSpeed = (outcome.metrics.maxSpeed ?? 0).toFixed(2);
      return `${p.mass} kg mass on a ${p.spring_constant} N/m spring, amplitude ${p.amplitude} m. ` +
        `Period T = ${period}s, max speed ${maxSpeed} m/s at the equilibrium point. ` +
        `ω = √(k/m) = ${Math.sqrt(p.spring_constant / p.mass).toFixed(3)} rad/s.`;
    }
    case "circular_motion": {
      const fc = (outcome.metrics.fc ?? 0).toFixed(2);
      const ac = (outcome.metrics.ac ?? 0).toFixed(2);
      const period = (outcome.metrics.period ?? 0).toFixed(3);
      return `${p.mass} kg object orbiting at r=${p.radius} m, v=${p.speed} m/s. ` +
        `Centripetal force F_c = ${fc} N, centripetal acceleration ${ac} m/s². ` +
        `Period T = ${period}s. Without this inward force the object would fly outward.`;
    }
    case "torque": {
      const tau = (outcome.metrics.tau ?? 0).toFixed(2);
      const alpha = (outcome.metrics.alpha ?? 0).toFixed(2);
      return `${p.force} N applied at ${p.arm_length} m from pivot on a ${p.mass} kg rod. ` +
        `Torque τ = ${tau} N·m, angular acceleration α = ${alpha} rad/s². ` +
        `I = ¹⁄₃mL² = ${(p.mass * p.arm_length ** 2 / 3).toFixed(4)} kg·m².`;
    }
    case "electric_field": {
      const F = (outcome.metrics.F ?? 0).toFixed(4);
      const attractive = (p.charge1 * p.charge2) < 0;
      return `${p.charge1} μC and ${p.charge2} μC charges separated by ${p.separation} m. ` +
        `Coulomb force F = ${F} N (${attractive ? "attractive" : "repulsive"}). ` +
        `Force scales as 1/r² — halving the distance quadruples the force.`;
    }
    case "ohm_law": {
      const I = (outcome.metrics.I ?? 0).toFixed(4);
      const Vt = (outcome.metrics.Vt ?? 0).toFixed(3);
      const P = (outcome.metrics.P_ext ?? 0).toFixed(3);
      return `${p.voltage} V battery (r=${p.internal_resistance} Ω) driving R=${p.resistance} Ω. ` +
        `Current I = ${I} A, terminal voltage V_t = ${Vt} V, external power P = ${P} W. ` +
        `Internal resistance wastes ${(Number(I) ** 2 * p.internal_resistance).toFixed(3)} W inside the battery.`;
    }
    case "bernoulli": {
      const v2 = (outcome.metrics.v2 ?? 0).toFixed(2);
      const dP = (outcome.metrics.dP ?? 0).toFixed(0);
      return `Fluid at ${p.v1} m/s enters a pipe narrowing by factor ${p.area_ratio}. ` +
        `Speed in narrow section v₂ = ${v2} m/s. Pressure drops by ${dP} Pa. ` +
        `Energy conservation: faster flow compensates with lower pressure (Bernoulli).`;
    }
    case "standing_waves": {
      const freq = (outcome.metrics.freq ?? 0).toFixed(2);
      const lam = (outcome.metrics.wavelength ?? 0).toFixed(3);
      const v = (outcome.metrics.waveSpeed ?? 0).toFixed(2);
      return `String: T=${p.tension} N, μ=${p.linear_density} kg/m, L=${p.length} m, harmonic n=${p.harmonic}. ` +
        `Wave speed v = ${v} m/s, λ = ${lam} m, frequency f = ${freq} Hz. ` +
        `${p.harmonic + 1} nodes and ${p.harmonic} anti-nodes form the standing pattern.`;
    }
    case "bohr_model": {
      const dE = (outcome.metrics.dE ?? 0).toFixed(3);
      const lam = outcome.metrics.lambda_nm;
      const emission = p.n_final < p.n_initial;
      return `Z=${p.atomic_number} atom, electron transitions from n=${p.n_initial} to n=${p.n_final}. ` +
        `Energy ${emission ? "released" : "absorbed"}: |ΔE| = ${dE} eV. ` +
        `${lam ? `Photon wavelength λ = ${Number(lam).toFixed(1)} nm.` : "Same level — no photon."} ` +
        `${emission ? "Emission produces a spectral line." : "Absorption requires incoming photon."}`;
    }
    case "pulley": {
      const a = (outcome.metrics.acceleration ?? 0).toFixed(3);
      const t1 = (outcome.metrics.T1 ?? 0).toFixed(2);
      const t2 = (outcome.metrics.T2 ?? 0).toFixed(2);
      const I_eff = (0.5 * Number(p.pulley_mass)).toFixed(3);
      return `${p.mass1} kg vs ${p.mass2} kg over a pulley (R=${p.radius} m, M=${p.pulley_mass} kg). ` +
        `Effective rotational inertia I/R² = ½M = ${I_eff} kg. ` +
        `System accelerates at ${a} m/s². Tensions: T₁ = ${t1} N, T₂ = ${t2} N. ` +
        `The rope exits the wheel at fixed angles — only rope length changes as masses move.`;
    }
    default:
      return "Simulation complete.";
  }
}

export function outcomeMetricLabels(config: SimulationConfig): Record<string, string> {
  return metricsLabel[config.type] ?? {};
}
