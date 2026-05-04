"use client";

import type { LaunchOutcome, SimulationConfig } from "@/types/simulation";
import CircularMotionScene from "@/components/scenes/CircularMotionScene";
import TorqueScene from "@/components/scenes/TorqueScene";
import ElectricFieldScene from "@/components/scenes/ElectricFieldScene";
import OhmLawScene from "@/components/scenes/OhmLawScene";
import BernoulliScene from "@/components/scenes/BernoulliScene";
import StandingWavesScene from "@/components/scenes/StandingWavesScene";
import BohrModelScene from "@/components/scenes/BohrModelScene";
import PulleyScene from "@/components/scenes/PulleyScene";
import SpringMassScene from "@/components/scenes/SpringMassScene";
import FreeFallScene from "@/components/scenes/FreeFallScene";
import InclinedPlaneScene from "@/components/scenes/InclinedPlaneScene";
import AtwoodTableScene from "@/components/scenes/AtwoodTableScene";
import ProjectileMotionScene from "@/components/scenes/ProjectileMotionScene";
import PendulumScene from "@/components/scenes/PendulumScene";
import CollisionScene from "@/components/scenes/CollisionScene";
import PlaceholderScene from "@/components/scenes/PlaceholderScene";

type Props = {
  config: SimulationConfig;
  onOutcome: (outcome: LaunchOutcome) => void;
  onLoadAtwoodExample?: () => void;
};

export default function MatterScene(props: Props) {
  if (props.config.type === "inclined_plane") return <InclinedPlaneScene {...props} />;
  if (props.config.type === "atwood_table") return <AtwoodTableScene {...props} />;
  if (props.config.type === "projectile_motion") return <ProjectileMotionScene {...props} />;
  if (props.config.type === "pendulum") return <PendulumScene {...props} />;
  if (props.config.type === "collision_1d") return <CollisionScene {...props} />;
  if (props.config.type === "free_fall") return <FreeFallScene {...props} />;
  if (props.config.type === "spring_mass") return <SpringMassScene {...props} />;
  if (props.config.type === "circular_motion") return <CircularMotionScene {...props} />;
  if (props.config.type === "torque") return <TorqueScene {...props} />;
  if (props.config.type === "electric_field") return <ElectricFieldScene {...props} />;
  if (props.config.type === "ohm_law") return <OhmLawScene {...props} />;
  if (props.config.type === "bernoulli") return <BernoulliScene {...props} />;
  if (props.config.type === "standing_waves") return <StandingWavesScene {...props} />;
  if (props.config.type === "bohr_model") return <BohrModelScene {...props} />;
  if (props.config.type === "pulley") return <PulleyScene {...props} />;
  return <PlaceholderScene {...props} />;
}
