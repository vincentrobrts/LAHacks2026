"use client";

import { Clipboard, History, Share2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import MatterScene from "@/components/MatterScene";
import { DEFAULT_CONFIGS, DEFAULT_PROMPT, DEFAULT_SIMULATION, DEMO_SHOT } from "@/lib/defaults";
import { buildExplanation } from "@/lib/explanation";
import { parseWithAgentverse } from "@/lib/agentverse";
import { normalizePromptText, parsePhysicsPrompt, parserJson } from "@/lib/parser";
import { decodeSimulation, encodeSimulation } from "@/lib/share";
import type { LaunchOutcome, SimulationConfig, SimulationHistoryItem, SimulationType } from "@/types/simulation";

const HISTORY_KEY = "physics-visualizer-history";
const CONFIDENCE_THRESHOLD = 0.6;
const LOW_CONFIDENCE_MESSAGE = "Could not confidently determine the physics system. Try adding more detail (e.g. forces, motion, or setup).";
const PROMPT_HELP_MESSAGE = "Intuify couldn’t confidently build a visualization from that prompt yet. Try one of the examples below.";
const EXAMPLE_PROMPTS = [
  "A 5 kg block slides down a 30 degree incline with μₖ = 0.2 for 3 meters.",
  "A 4 kg block rests on a frictionless table and is connected over a pulley to a hanging 2 kg mass. How fast does the system accelerate if the hanging mass falls 3 meters?",
  "Problem: Two point charges are placed 2 meters apart. Charge 1: +3 μC. Charge 2: −2 μC. Question: What is the magnitude of the force between them? Is the force attractive or repulsive?",
];
const ATWOOD_PROMPT = "A 4 kg block rests on a frictionless table and is connected over a pulley to a hanging 2 kg mass. How fast does the system accelerate if the hanging mass falls 3 meters?";
const ATWOOD_EXAMPLE: SimulationConfig = {
  type: "atwood_table",
  params: {
    mass1: 4,
    mass2: 2,
    friction: 0,
    distance: 3,
  },
  world: {
    gravity: 9.8,
    friction: 0,
  },
  explanationGoal: "Show how tension and gravity determine the acceleration of a two-mass pulley system.",
};

const SCENARIO_LABELS: Record<string, string> = {
  projectile_motion: "Projectile Motion",
  collision_1d: "1D Collision",
  pendulum: "Pendulum",
  inclined_plane: "Inclined Plane",
  free_fall: "Free Fall",
  atwood_table: "Atwood Machine",
  spring_mass: "Spring-Mass",
  circular_motion: "Circular Motion",
  torque: "Torque",
  electric_field: "Electric Field",
  ohm_law: "Ohm's Law",
  bernoulli: "Bernoulli Flow",
  standing_waves: "Standing Waves",
  bohr_model: "Bohr Model",
};

const GRAVITY_SCENARIOS = new Set(["projectile_motion", "pendulum", "inclined_plane", "free_fall", "atwood_table", "circular_motion", "bernoulli"]);

const PARAM_ORDER: Record<string, string[]> = {
  projectile_motion: ["angle", "speed", "mass", "initial_height"],
  collision_1d: ["mass1", "v1", "mass2", "v2", "restitution"],
  pendulum: ["length", "initial_angle", "mass"],
  inclined_plane: ["angle", "friction", "mass", "distance"],
  free_fall: ["height", "mass", "air_resistance"],
  atwood_table: ["mass1", "mass2", "friction", "distance"],
  spring_mass: ["spring_constant", "mass", "amplitude"],
  circular_motion: ["radius", "mass", "speed"],
  torque: ["force", "arm_length", "mass"],
  electric_field: ["charge1", "charge2", "charge3", "charge4"],
  ohm_law: ["voltage", "resistance", "internal_resistance"],
  bernoulli: ["v1", "area_ratio", "density"],
  standing_waves: ["tension", "linear_density", "length", "harmonic"],
  bohr_model: ["atomic_number", "n_initial", "n_final"],
};

const SLIDER_RANGES: Record<string, { min: number; max: number; step: number }> = {
  angle: { min: 5, max: 60, step: 0.1 },
  initial_angle: { min: 1, max: 85, step: 0.1 },
  speed: { min: 1, max: 40, step: 0.1 },
  mass: { min: 0.5, max: 10, step: 0.1 },
  mass1: { min: 0.5, max: 10, step: 0.1 },
  mass2: { min: 0.5, max: 10, step: 0.1 },
  friction: { min: 0, max: 0.9, step: 0.01 },
  distance: { min: 1, max: 5, step: 0.1 },
  initial_height: { min: 0, max: 400, step: 1 },
  height: { min: 1, max: 5000, step: 1 },
  length: { min: 0.2, max: 250, step: 0.1 },
  v1: { min: -20, max: 20, step: 0.1 },
  v2: { min: -20, max: 20, step: 0.1 },
  restitution: { min: 0, max: 1, step: 0.01 },
  air_resistance: { min: 0, max: 1, step: 0.01 },
  spring_constant: { min: 1, max: 100, step: 1 },
  amplitude: { min: 0.05, max: 1.5, step: 0.05 },
  radius: { min: 0.2, max: 5, step: 0.1 },
  force: { min: 1, max: 100, step: 1 },
  arm_length: { min: 0.1, max: 5, step: 0.1 },
  charge1: { min: -10, max: 10, step: 0.1 },
  charge2: { min: -10, max: 10, step: 0.1 },
  charge3: { min: -10, max: 10, step: 0.1 },
  charge4: { min: -10, max: 10, step: 0.1 },
  separation: { min: 0.1, max: 5, step: 0.1 },
  voltage: { min: 0, max: 24, step: 0.5 },
  resistance: { min: 1, max: 100, step: 1 },
  internal_resistance: { min: 0, max: 10, step: 0.1 },
  area_ratio: { min: 0.2, max: 8, step: 0.1 },
  density: { min: 1, max: 1500, step: 1 },
  tension: { min: 1, max: 100, step: 1 },
  linear_density: { min: 0.001, max: 0.01, step: 0.001 },
  harmonic: { min: 1, max: 6, step: 1 },
  atomic_number: { min: 1, max: 10, step: 1 },
  n_initial: { min: 2, max: 8, step: 1 },
  n_final: { min: 1, max: 7, step: 1 },
};

function saveHistory(prompt: string, config: SimulationConfig) {
  const existing = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]") as SimulationHistoryItem[];
  const item: SimulationHistoryItem = {
    id: crypto.randomUUID(),
    prompt,
    config,
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem(HISTORY_KEY, JSON.stringify([item, ...existing].slice(0, 8)));
}


function paramLabel(type: string, key: string) {
  if (key === "gravity") return <>gravity g</>;
  if (type === "torque" && key === "mass") return <>attached mass m</>;
  if (key === "mass") return <>mass m</>;
  if (type === "electric_field") {
    if (key === "charge1") return <>q<sub>1</sub></>;
    if (key === "charge2") return <>q<sub>2</sub></>;
    if (key === "charge3") return <>q<sub>3</sub></>;
    if (key === "charge4") return <>q<sub>4</sub></>;
  }
  if (type === "atwood_table") {
    if (key === "mass1") return <>m<sub>1</sub></>;
    if (key === "mass2") return <>m<sub>2</sub></>;
    if (key === "friction") return <>friction μ</>;
    if (key === "distance") return <>distance d</>;
  }

  return key.replace(/_/g, " ");
}

function sliderRange(type: string, key: string) {
  if (type === "free_fall" && key === "mass") return { min: 0.1, max: 25, step: 0.1 };
  if (type === "spring_mass" && key === "mass") return { min: 0.5, max: 5, step: 0.1 };
  if (type === "standing_waves" && key === "length") return { min: 0.5, max: 3, step: 0.1 };
  return SLIDER_RANGES[key] ?? { min: 0, max: 20, step: 0.1 };
}

function metricLabel(key: string) {
  const labels = {
    fc: <>F<sub>c</sub></>,
    ac: <>a<sub>c</sub></>,
    omega: <>ω</>,
    range_m: <>range</>,
    peak_height_m: <>peak height</>,
    time_of_flight_s: <>time of flight</>,
    final_speed_m_s: <>final speed</>,
    q1q2_force_n: <>q<sub>1</sub>q<sub>2</sub> force</>,
    current_a: <>I</>,
    terminal_voltage_v: <>V<sub>t</sub></>,
    external_power_w: <>P<sub>ext</sub></>,
    internal_power_w: <>P<sub>int</sub></>,
    tau: <>τ</>,
    alpha: <>α</>,
    I: <>I</>,
    period_s: <>period</>,
    max_speed_m_s: <>v<sub>max</sub></>,
    max_force_n: <>F<sub>max</sub></>,
  } as const;
  return labels[key as keyof typeof labels] ?? key.replace(/m1/g, "m₁").replace(/m2/g, "m₂").replace(/q1/g, "q₁").replace(/q2/g, "q₂").replace(/_/g, " ");
}

function distanceLabel(value: number, digits = 1) {
  if (!Number.isFinite(value)) return "--";
  return Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(digits)} km` : `${value.toFixed(digits)} m`;
}

function paramValueLabel(type: string, key: string, value: number) {
  if (type === "free_fall" && key === "height") return distanceLabel(value, value >= 1000 ? 1 : 0);
  if (key === "mass" || key === "mass1" || key === "mass2") return `${value.toFixed(1)} kg`;
  if (key === "voltage") return `${value.toFixed(1)} V`;
  if (key === "resistance" || key === "internal_resistance") return `${value.toFixed(1)} Ω`;
  if (key === "tension") return `${value.toFixed(0)} N`;
  if (key === "linear_density") return `${value.toFixed(3)} kg/m`;
  if (key === "length") return `${value.toFixed(1)} m`;
  if (key === "harmonic") return `${Math.round(value)}`;
  return value.toFixed(1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hasNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function countMatches(text: string, pattern: RegExp) {
  return Array.from(text.matchAll(pattern)).length;
}

function hasParam(config: SimulationConfig | null, key: string) {
  return hasNumber(config?.params?.[key]);
}

function massValueCount(text: string) {
  return countMatches(text, /\b\d+(?:\.\d+)?\s*kg\b|\bmass\s*(?:of|=|is)?\s*\d+(?:\.\d+)?/g);
}

function normalizeChargeSigns(text: string) {
  return text.replace(/[\u2212\u2013\u2014]/g, "-");
}

function chargeValueCount(text: string) {
  return countMatches(normalizeChargeSigns(text), /[+-]?\d+(?:\.\d+)?\s*(?:\u03bc|µ|u|mu|micro)?\s*c\b|\bq\d?\s*(?:=|is|:)?\s*[+-]?\d+(?:\.\d+)?/gi);
}

function hasSpeedValue(text: string) {
  return /\b\d+(?:\.\d+)?\s*(?:m\/s|meters?\s+per\s+second)\b|\b(?:speed|velocity|initial velocity|v0|v₀)\s*(?:of|=|is)?\s*\d+(?:\.\d+)?/i.test(text);
}

function hasAngleValue(text: string) {
  return /\b\d+(?:\.\d+)?\s*(?:degree|degrees|deg|°)\b|\bangle\s*(?:of|=|is)?\s*\d+(?:\.\d+)?/i.test(text);
}

function hasLengthValue(text: string) {
  return /\b(?:length|distance|arm|radius|height)\s*(?:of|=|is)?\s*\d+(?:\.\d+)?|\b\d+(?:\.\d+)?\s*(?:m|meter|meters|km|kilometer|kilometers)\b/i.test(text);
}

function explicitLabType(prompt: string): SimulationType | null {
  const lower = normalizePromptText(prompt).toLowerCase();
  const checks: [SimulationType, RegExp[]][] = [
    ["inclined_plane", [/\binclined?\s+plane\b/, /\bincline\b/, /\bslope\b/, /\bramp\b/]],
    ["atwood_table", [/\batwood\b/, /\bpulley\s+system\b/, /\bhanging\s+mass\b/]],
    ["projectile_motion", [/\bprojectile\s+motion\b/, /\bprojectile\b/]],
    ["free_fall", [/\bfree\s+fall\b/]],
    ["pendulum", [/\bpendulum\b/]],
    ["circular_motion", [/\bcircular\s+motion\b/]],
    ["electric_field", [/\belectric\s+field\b/, /\bcoulomb\b/]],
    ["ohm_law", [/\bohm'?s?\s+law\b/, /\bohms\s+law\b/, /\bcircuit\b/]],
    ["spring_mass", [/\bspring[-\s]+mass\b/, /\bhooke'?s?\s+law\b/]],
    ["standing_waves", [/\bstanding\s+waves?\b/]],
    ["torque", [/\btorque\b/, /\blever\s+arm\b/]],
    ["bernoulli", [/\bbernoulli\b/, /\bfluid\s+flow\b/]],
    ["bohr_model", [/\bbohr\s+(?:model|atom)\b/, /\batom\s+model\b/]],
  ];
  return checks.find(([, patterns]) => hasAny(lower, patterns))?.[0] ?? null;
}

function validateSimulationConfig(config: SimulationConfig, prompt: string) {
  const lower = normalizePromptText(prompt).toLowerCase();
  const next: SimulationConfig = {
    ...config,
    params: { ...config.params },
    world: {
      gravity: hasNumber(config.world?.gravity) ? config.world.gravity : 9.8,
      friction: hasNumber(config.world?.friction) ? config.world.friction : 0,
    },
  };
  const assumptions: string[] = [];
  const missing: string[] = [];
  const assumed = (key: string, value: number, label: string) => {
    next.params[key] = value;
    assumptions.push(label);
  };
  const requireParam = (key: string, label = key) => {
    if (!hasNumber(next.params[key])) missing.push(label);
  };
  const defaultParam = (key: string, value: number, label: string) => {
    if (!hasNumber(next.params[key])) assumed(key, value, label);
  };

  if (!hasNumber(config.world?.gravity) && GRAVITY_SCENARIOS.has(config.type)) {
    assumptions.push("Using standard value: g = 9.8 m/s^2");
  }

  switch (config.type) {
    case "inclined_plane":
      requireParam("angle", "angle θ");
      defaultParam("mass", 1, "Using standard value: mass m = 1 kg");
      defaultParam("distance", 3, "Using standard value: distance d = 3 m for animation");
      if (!hasNumber(next.params.friction)) defaultParam("friction", 0, "Using standard value: friction mu = 0");
      if (/\bfrictionless\b/.test(lower)) {
        next.params.friction = 0;
        next.world.friction = 0;
      }
      break;
    case "atwood_table":
      requireParam("mass1", "m₁");
      requireParam("mass2", "m₂");
      defaultParam("distance", 3, "Using standard value: distance d = 3 m for animation");
      if (!hasNumber(next.params.friction)) defaultParam("friction", 0, "Using standard value: friction mu = 0");
      if (/\bfrictionless\b/.test(lower)) {
        next.params.friction = 0;
        next.world.friction = 0;
      }
      break;
    case "electric_field": {
      const charges = ["charge1", "charge2", "charge3", "charge4"].filter((key) => hasNumber(next.params[key]));
      if (charges.length < 2) missing.push("at least two charges");
      defaultParam("separation", 1, "Using standard value: charge separation r = 1 m");
      break;
    }
    case "collision_1d":
      requireParam("mass1", "m₁");
      requireParam("mass2", "m₂");
      requireParam("v1", "v₁");
      requireParam("v2", "v₂");
      if (!hasNumber(next.params.restitution)) defaultParam("restitution", /\belastic\w*\b/.test(lower) && !/\binelastic\w*\b/.test(lower) ? 1 : 0, /\belastic\w*\b/.test(lower) && !/\binelastic\w*\b/.test(lower) ? "Using standard value: restitution e = 1 for elastic collision" : "Using standard value: restitution e = 0");
      break;
    case "free_fall":
      requireParam("height", "height h");
      defaultParam("mass", 1, "Using standard value: mass m = 1 kg");
      defaultParam("air_resistance", 0, "Using standard value: air resistance = 0");
      break;
    case "pendulum":
      requireParam("length", "length L");
      requireParam("initial_angle", "initial angle θ₀");
      defaultParam("mass", 1, "Using standard value: mass m = 1 kg");
      break;
    case "projectile_motion":
      requireParam("angle", "launch angle θ");
      requireParam("speed", "speed v₀");
      defaultParam("mass", 1, "Using standard value: mass m = 1 kg");
      defaultParam("initial_height", 0, "Using standard value: initial height h0 = 0");
      break;
    case "circular_motion":
      requireParam("radius", "radius r");
      requireParam("speed", "speed v");
      defaultParam("mass", 1, "Using standard value: mass m = 1 kg");
      break;
    case "spring_mass":
      requireParam("spring_constant", "spring constant k");
      requireParam("mass", "mass m");
      defaultParam("amplitude", 0.5, "Using standard value: amplitude A = 0.5 m for visualization");
      break;
    case "ohm_law":
      if (!hasNumber(next.params.voltage) && hasNumber(next.params.emf)) next.params.voltage = next.params.emf;
      requireParam("voltage", "voltage ε");
      requireParam("resistance", "external resistance R");
      defaultParam("internal_resistance", 0, "Using standard value: internal resistance r = 0 ohm");
      break;
    default:
      Object.entries(next.params).forEach(([key, value]) => {
        if (!hasNumber(value)) missing.push(key);
      });
  }

  return { config: next, assumptions, missing, valid: missing.length === 0 };
}

function isUnsupportedHorizontalForcePrompt(prompt: string) {
  const lower = prompt.toLowerCase();
  const mentionsForcePush = /\b(push|pushed|pull|pulled|force)\b/.test(lower);
  const mentionsHorizontalSurface = /\b(horizontal|surface|table|floor)\b/.test(lower);
  const mentionsCollision = /\b(collision|collide|collides|hit|hits|crash|impact|bounce|elastic|inelastic|restitution)\b/.test(lower);
  return mentionsForcePush && mentionsHorizontalSurface && !mentionsCollision;
}

function normalizeCollisionConfig(config: SimulationConfig, prompt: string): SimulationConfig {
  if (config.type !== "collision_1d") return config;
  const lower = normalizePromptText(prompt).toLowerCase();
  const mentionsRestitution = /\b(restitution|elastic\w*|inelastic\w*|bouncy|bounce)\b/.test(lower);
  const restitution = /\binelastic\w*\b/.test(lower)
    ? 0
    : /\bperfectly\s+elastic\b|\belastic\w*\b/.test(lower)
    ? 1
    : mentionsRestitution
      ? clamp(config.params.restitution ?? 0, 0, 1)
      : 0;

  const masses = Array.from(lower.matchAll(/\b([0-9]+(?:\.[0-9]+)?)\s*kg\b/g)).map((match) => Number(match[1]));
  const speeds = Array.from(lower.matchAll(/\b([+-]?[0-9]+(?:\.[0-9]+)?)\s*m\/s\b/g)).map((match) => Number(match[1]));
  const params = { ...config.params };
  if (!hasNumber(params.mass1) && masses[0] !== undefined) params.mass1 = clamp(masses[0], 0.5, 10);
  if (!hasNumber(params.mass2) && masses[1] !== undefined) params.mass2 = clamp(masses[1], 0.5, 10);
  if (!hasNumber(params.v1) && speeds[0] !== undefined) params.v1 = clamp(speeds[0], -20, 20);
  if (!hasNumber(params.v2) && (/\bat rest\b/.test(lower) || (masses.length >= 2 && speeds.length === 1))) params.v2 = 0;
  else if (!hasNumber(params.v2) && speeds[1] !== undefined) params.v2 = clamp(speeds[1], -20, 20);
  params.restitution = restitution;

  return {
    ...config,
    params,
    world: { ...config.world, friction: config.world.friction ?? 0 },
  };
}

function electricPromptValues(prompt: string) {
  const values: number[] = [];
  const normalized = normalizeChargeSigns(prompt);
  const labeled = /(?:charge|q)\s*\d*\s*:?\s*([+-]?\d+(?:\.\d+)?)\s*(?:\u03bc|µ|u|mu|micro)?\s*c\b/gi;
  let match: RegExpExecArray | null;
  while ((match = labeled.exec(normalized)) && values.length < 4) {
    values.push(clamp(Number(match[1]), -10, 10));
  }

  const standalone = /([+-]?\d+(?:\.\d+)?)\s*(?:\u03bc|µ|u|mu|micro)\s*c\b/gi;
  while ((match = standalone.exec(normalized)) && values.length < 4) {
    const value = clamp(Number(match[1]), -10, 10);
    if (!values.some((existing) => Math.abs(existing - value) < 0.001)) values.push(value);
  }

  const electronCount = (normalized.match(/\belectron(s)?\b/gi) ?? []).length;
  for (let i = 0; i < electronCount && values.length < 4; i += 1) values.push(-1);
  return values.slice(0, 4);
}

function electricPromptSeparation(prompt: string, fallback: number) {
  const normalized = normalizeChargeSigns(prompt);
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(?:m|meter|meters)\s*(?:apart|separated|between)?/i);
  return match ? clamp(Number(match[1]), 0.1, 5) : fallback;
}

function normalizeElectricFieldConfig(config: SimulationConfig, prompt: string): SimulationConfig {
  const lower = normalizeChargeSigns(prompt).toLowerCase();
  const electricLike = /\b(charge|charges|electron|electrons|coulomb|electric)\b/.test(lower);
  if (config.type !== "electric_field" && !electricLike) return config;

  const promptCharges = electricPromptValues(prompt);
  const fallbackCharges = [config.params.charge1 ?? 5, config.params.charge2 ?? -3];
  const charges = (promptCharges.length > 0 ? promptCharges : fallbackCharges).slice(0, 4);
  if (charges.length === 1) charges.push(-3);

  const params: Record<string, number> = {
    separation: electricPromptSeparation(prompt, config.params.separation ?? 1),
  };
  charges.forEach((charge, index) => {
    params[`charge${index + 1}`] = clamp(charge, -10, 10);
  });

  return {
    type: "electric_field",
    params,
    world: { ...config.world, gravity: config.world.gravity ?? 9.8, friction: 0 },
    explanationGoal: "Show how charge signs, distance, and Coulomb's law determine electric forces.",
  };
}

function normalizeAtwoodConfig(config: SimulationConfig, prompt: string): SimulationConfig {
  const lower = prompt.toLowerCase();
  const atwoodLike = /\b(pulley|hanging|connected|table)\b/.test(lower) && /\bkg|mass|block\b/.test(lower);
  if (config.type !== "atwood_table" && !atwoodLike) return config;

  const number = "([0-9]+(?:\\.[0-9]+)?)";
  const blockMatch = lower.match(new RegExp(`${number}\\s*kg\\s+(?:block|cart|object|mass)`));
  const hangingMatch = lower.match(new RegExp(`hanging\\s+${number}\\s*kg`)) ?? lower.match(new RegExp(`${number}\\s*kg\\s+hanging`));
  const masses = Array.from(lower.matchAll(/\b([0-9]+(?:\.[0-9]+)?)\s*kg\b/g)).map((match) => Number(match[1]));
  const distanceMatch = lower.match(/falls?\s+([0-9]+(?:\.[0-9]+)?)\s*(?:m|meter|meters)\b/) ?? lower.match(/for\s+([0-9]+(?:\.[0-9]+)?)\s*(?:m|meter|meters)\b/);
  const frictionless = /\bfrictionless\b/.test(lower);
  const frictionMatch = lower.match(/(?:friction|mu|μ)\s*(?:=|is)?\s*([0-9]+(?:\.[0-9]+)?)/);

  return {
    ...config,
    type: "atwood_table",
    params: {
      ...config.params,
      ...(blockMatch ? { mass1: clamp(Number(blockMatch[1]), 0.5, 10) } : {}),
      ...(hangingMatch ? { mass2: clamp(Number(hangingMatch[1]), 0.5, 10) } : {}),
      ...(!blockMatch && masses[0] !== undefined ? { mass1: clamp(masses[0], 0.5, 10) } : {}),
      ...(!hangingMatch && masses[1] !== undefined ? { mass2: clamp(masses[1], 0.5, 10) } : {}),
      ...(distanceMatch ? { distance: clamp(Number(distanceMatch[1]), 1, 5) } : {}),
      ...(frictionless ? { friction: 0 } : frictionMatch ? { friction: clamp(Number(frictionMatch[1]), 0, 0.9) } : {}),
    },
    world: { ...config.world, friction: frictionless ? 0 : config.world.friction ?? 0 },
  };
}

function normalizeFreeFallConfig(config: SimulationConfig, prompt: string): SimulationConfig {
  if (config.type !== "free_fall") return config;
  const normalized = prompt.toLowerCase().replace(/,/g, "");
  const heightMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(km|kilometer|kilometers|m|meter|meters)\b/);
  if (!heightMatch) return config;
  const value = Number(heightMatch[1]);
  const unit = heightMatch[2];
  const height = unit.startsWith("k") ? value * 1000 : value;
  return {
    ...config,
    params: { ...config.params, height: clamp(height, 1, 5000) },
  };
}

function normalizeProjectileConfig(config: SimulationConfig, prompt: string): SimulationConfig {
  if (config.type !== "projectile_motion") return config;
  const lower = prompt.toLowerCase();
  const angle = numberAfter(lower, [/\bangle\s*(?:of|=|is)?\s*(\d+(?:\.\d+)?)/, /\b(\d+(?:\.\d+)?)\s*(?:degree|degrees|deg|°)\b/]);
  const speed = numberAfter(lower, [/\b(?:speed|velocity|initial velocity)\s*(?:of|=|is)?\s*(\d+(?:\.\d+)?)/, /\b(\d+(?:\.\d+)?)\s*(?:m\/s|meters?\s+per\s+second)\b/]);
  const params = { ...config.params };
  if (angle !== null && shouldUsePromptValue(params.angle, angle, 38)) params.angle = clamp(angle, 5, 60);
  if (speed !== null && shouldUsePromptValue(params.speed, speed, 18)) params.speed = clamp(speed, 1, 40);
  return { ...config, params };
}

function normalizeOhmConfig(config: SimulationConfig, prompt: string): SimulationConfig {
  if (config.type !== "ohm_law") return config;
  const lower = prompt.toLowerCase();
  const voltage = numberAfter(lower, [/\b(?:voltage|battery|emf)\s*(?:of|=|is)?\s*(\d+(?:\.\d+)?)/, /\b(\d+(?:\.\d+)?)\s*v\b/]);
  const resistance = numberAfter(lower, [/\b(?:resistance|resistor)\s*(?:of|=|is)?\s*(\d+(?:\.\d+)?)/, /\b(\d+(?:\.\d+)?)\s*(?:ohm|ohms|Ω)\b/]);
  const params = { ...config.params };
  if (voltage !== null && shouldUsePromptValue(params.voltage, voltage, 12)) params.voltage = clamp(voltage, 0, 24);
  if (resistance !== null && shouldUsePromptValue(params.resistance, resistance, 40)) params.resistance = clamp(resistance, 1, 100);
  if (!hasNumber(params.internal_resistance)) params.internal_resistance = 0;
  return { ...config, params };
}

function numberAfter(prompt: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

function shouldUsePromptValue(current: number | undefined, promptValue: number | null, defaultValue: number) {
  return promptValue !== null && (!hasNumber(current) || Math.abs(current - defaultValue) < 0.001);
}

function normalizeTorqueConfig(config: SimulationConfig, prompt: string): SimulationConfig {
  if (config.type !== "torque") return config;
  const lower = prompt.toLowerCase();
  const force = numberAfter(lower, [/\bforce\s*(?:of|=|is)?\s*([0-9]+(?:\.[0-9]+)?)\s*n\b/, /\b([0-9]+(?:\.[0-9]+)?)\s*n\b/]);
  const armLength = numberAfter(lower, [/\b(?:arm\s*)?length\s*(?:of|=|is)?\s*([0-9]+(?:\.[0-9]+)?)/, /\b([0-9]+(?:\.[0-9]+)?)\s*m(?:eter|eters)?\b/]);
  const mass = numberAfter(lower, [/\bmass\s*(?:of|=|is)?\s*([0-9]+(?:\.[0-9]+)?)\s*kg\b/, /\b([0-9]+(?:\.[0-9]+)?)\s*kg\b/]);
  const params = { ...config.params };
  if (force !== null && shouldUsePromptValue(params.force, force, 20)) params.force = clamp(force, 1, 100);
  if (armLength !== null && shouldUsePromptValue(params.arm_length, armLength, 1.5)) params.arm_length = clamp(armLength, 0.1, 5);
  if (mass !== null && shouldUsePromptValue(params.mass, mass, 2)) params.mass = clamp(mass, 0.5, 10);
  return { ...config, params };
}

function normalizeSpringMassConfig(config: SimulationConfig, prompt: string): SimulationConfig {
  if (config.type !== "spring_mass") return config;
  const lower = prompt.toLowerCase();
  const springConstant = numberAfter(lower, [/\bspring\s+constant\s*(?:of|=|is)?\s*([0-9]+(?:\.[0-9]+)?)/, /\bk\s*(?:=|is)?\s*([0-9]+(?:\.[0-9]+)?)/]);
  const mass = numberAfter(lower, [/\bmass\s*(?:of|=|is)?\s*([0-9]+(?:\.[0-9]+)?)\s*kg\b/, /\b([0-9]+(?:\.[0-9]+)?)\s*kg\b/]);
  const amplitude = numberAfter(lower, [/\b(?:displacement|amplitude)\s*(?:of|=|is)?\s*([0-9]+(?:\.[0-9]+)?)/]);
  const params = { ...config.params };
  if (springConstant !== null && shouldUsePromptValue(params.spring_constant, springConstant, 20)) params.spring_constant = clamp(springConstant, 1, 100);
  if (mass !== null && shouldUsePromptValue(params.mass, mass, 1)) params.mass = clamp(mass, 0.5, 10);
  if (amplitude !== null && shouldUsePromptValue(params.amplitude, amplitude, 0.5)) params.amplitude = clamp(amplitude, 0.05, 1.5);
  return { ...config, params };
}

function elementAtomicNumber(prompt: string) {
  const lower = prompt.toLowerCase();
  const elements: Record<string, number> = {
    hydrogen: 1,
    helium: 2,
    lithium: 3,
    beryllium: 4,
    boron: 5,
    carbon: 6,
    nitrogen: 7,
    oxygen: 8,
    fluorine: 9,
    neon: 10,
  };
  for (const [name, z] of Object.entries(elements)) {
    if (new RegExp(`\\b${name}\\b`).test(lower)) return z;
  }
  const atomic = lower.match(/\batomic\s+number\s*(?:of|=|is)?\s*(\d+)/);
  return atomic ? clamp(Number(atomic[1]), 1, 10) : null;
}

function normalizeBohrConfig(config: SimulationConfig, prompt: string): SimulationConfig {
  if (config.type !== "bohr_model") return config;
  const lower = prompt.toLowerCase();
  const z = elementAtomicNumber(lower);
  const ni = numberAfter(lower, [/\bn(?:_|\s*)initial\s*(?:=|is|of)?\s*(\d+)/, /\bfrom\s+(?:n\s*=\s*)?(\d+)/, /\bshell\s*(\d+)/]);
  const nf = numberAfter(lower, [/\bn(?:_|\s*)final\s*(?:=|is|of)?\s*(\d+)/, /\bto\s+(?:n\s*=\s*)?(\d+)/]);
  const params = { ...config.params };
  if (z !== null && shouldUsePromptValue(params.atomic_number, z, 1)) params.atomic_number = z;
  if (ni !== null && shouldUsePromptValue(params.n_initial, ni, 3)) params.n_initial = clamp(ni, 1, 7);
  if (nf !== null && shouldUsePromptValue(params.n_final, nf, 1)) params.n_final = clamp(nf, 1, 6);
  return { ...config, params };
}

function normalizeBernoulliConfig(config: SimulationConfig, prompt: string): SimulationConfig {
  if (config.type !== "bernoulli") return config;
  const lower = prompt.toLowerCase();
  const velocity = numberAfter(lower, [/\b(?:velocity|speed|flow speed)\s*(?:of|=|is)?\s*(\d+(?:\.\d+)?)\s*(?:m\/s)?/, /\b(\d+(?:\.\d+)?)\s*m\/s\b/]);
  const areaRatio = numberAfter(lower, [/\barea\s+ratio\s*(?:of|=|is)?\s*(\d+(?:\.\d+)?)/, /\ba1\/a2\s*(?:=|is)?\s*(\d+(?:\.\d+)?)/]);
  const density = numberAfter(lower, [/\bdensity\s*(?:of|=|is)?\s*(\d+(?:\.\d+)?)/]);
  const params = { ...config.params };
  if (velocity !== null && shouldUsePromptValue(params.v1, velocity, 2)) params.v1 = clamp(velocity, 0.5, 10);
  if (areaRatio !== null && shouldUsePromptValue(params.area_ratio, areaRatio, 3)) params.area_ratio = clamp(areaRatio, 1, 4);
  if (density !== null && shouldUsePromptValue(params.density, density, 1000)) params.density = clamp(density, 500, 1500);
  if (!hasNumber(params.density)) params.density = 1000;
  return { ...config, params };
}

function mergePromptExtraction(config: SimulationConfig, prompt: string): SimulationConfig {
  const extracted = parsePhysicsPrompt(prompt);
  if (!extracted || extracted.type !== config.type) return config;
  const defaults = DEFAULT_CONFIGS[config.type];
  const params = { ...config.params };
  for (const [key, value] of Object.entries(extracted.params)) {
    const defaultValue = defaults.params[key];
    if (!hasNumber(params[key]) || (hasNumber(defaultValue) && Math.abs(params[key] - defaultValue) < 0.001)) {
      params[key] = value;
    }
  }
  return {
    ...config,
    params,
    world: {
      ...config.world,
      gravity: hasNumber(config.world.gravity) ? config.world.gravity : extracted.world.gravity,
      friction: hasNumber(config.world.friction) ? config.world.friction : extracted.world.friction,
    },
  };
}

type ConfidenceResult = {
  simulationType: SimulationType | null;
  confidence: number;
  missingFields: string[];
  shouldRender: boolean;
};

function resolveMissingFields(simulationType: SimulationType | null, parsedOutput: SimulationConfig | null, rawPrompt = "") {
  if (!simulationType || !parsedOutput) return ["physics system"];
  const lower = normalizePromptText(rawPrompt).toLowerCase();
  const missing: string[] = [];
  const requireParam = (key: string, label = key) => {
    if (!hasParam(parsedOutput, key)) missing.push(label);
  };
  const requirePrompt = (condition: boolean, label: string) => {
    if (!condition) missing.push(label);
  };

  switch (simulationType) {
    case "inclined_plane":
      requirePrompt(hasAngleValue(lower), "angle");
      requirePrompt(massValueCount(lower) >= 1, "mass");
      requireParam("angle", "angle");
      requireParam("mass", "mass");
      break;
    case "atwood_table":
      requirePrompt(massValueCount(lower) >= 2, "two masses");
      requireParam("mass1", "m1");
      requireParam("mass2", "m2");
      break;
    case "projectile_motion":
      requirePrompt(hasSpeedValue(lower), "initial velocity");
      requirePrompt(hasAngleValue(lower), "launch angle");
      requireParam("speed", "initial velocity");
      requireParam("angle", "launch angle");
      break;
    case "free_fall":
      requirePrompt(hasAny(lower, [/\bheight\b/, /\b\d+(?:\.\d+)?\s*(?:m|meter|meters|km|kilometer|kilometers)\b/, /\btime\b/, /\bvelocity\b/, /\bspeed\b/]), "height, time, or velocity");
      requireParam("height", "height");
      break;
    case "pendulum":
      requirePrompt(hasLengthValue(lower), "length");
      requireParam("length", "length");
      break;
    case "circular_motion":
      requirePrompt(hasAny(lower, [/\bradius\b/, /\borbit\s+radius\b/, /\b\d+(?:\.\d+)?\s*m\b/]), "radius");
      requirePrompt(hasSpeedValue(lower), "velocity");
      requireParam("radius", "radius");
      requireParam("speed", "velocity");
      break;
    case "electric_field":
      requirePrompt(chargeValueCount(lower) >= 2 || /\bcharges?\s+[+-]?\d+(?:\.\d+)?\s+(?:and\s+)?[+-]?\d+(?:\.\d+)?/.test(lower), "at least two charges");
      if (["charge1", "charge2", "charge3", "charge4"].filter((key) => hasParam(parsedOutput, key)).length < 2) missing.push("at least two charges");
      break;
    case "ohm_law":
      requirePrompt(countOhmValues(lower) >= 2, "at least two of voltage, current, resistance");
      requirePrompt(hasAny(lower, [/\b(?:voltage|volt|volts|battery|emf)\b|\b\d+(?:\.\d+)?\s*v\b/]), "voltage");
      requirePrompt(hasAny(lower, [/\b(?:resistance|resistor|ohm|ohms|Ω)\b/]), "resistance");
      requireParam("voltage", "voltage");
      requireParam("resistance", "resistance");
      break;
    case "spring_mass":
      requirePrompt(hasAny(lower, [/\bspring\s+constant\b/, /\bk\s*(?:=|is|of|:)\s*\d+(?:\.\d+)?/, /\b\d+(?:\.\d+)?\s*n\/m\b/]), "spring constant");
      requirePrompt(massValueCount(lower) >= 1, "mass");
      requireParam("spring_constant", "spring constant");
      requireParam("mass", "mass");
      break;
    case "standing_waves":
      requirePrompt(hasAny(lower, [/\blength\b/, /\b\d+(?:\.\d+)?\s*(?:m|meter|meters)\b/]), "length");
      requireParam("length", "length");
      requireParam("harmonic", "harmonic");
      break;
    case "torque":
      requirePrompt(hasAny(lower, [/\bforce\b/, /\b\d+(?:\.\d+)?\s*n\b/]), "force");
      requirePrompt(hasAny(lower, [/\bdistance\b/, /\blength\b/, /\blever arm\b/, /\barm\b/]), "distance or lever arm");
      requireParam("force", "force");
      requireParam("arm_length", "distance or lever arm");
      break;
    case "bohr_model":
      requirePrompt(hasAny(lower, [/\batomic\s+number\b/, /\belectron\b/, /\bshell\b/, /\bn\s*=/]) || elementAtomicNumber(lower) !== null, "element, electron count, or shell level");
      requireParam("atomic_number", "element or atomic number");
      break;
    case "bernoulli":
      requirePrompt(hasSpeedValue(lower), "velocity");
      requirePrompt(hasAny(lower, [/\bpressure\b/, /\bheight\b/]), "pressure or height");
      requireParam("v1", "velocity");
      break;
    case "collision_1d":
      requirePrompt(massValueCount(lower) >= 2, "two masses");
      requirePrompt(countMatches(lower, /\b(?:velocity|speed|v1|v2)\b|\b-?\d+(?:\.\d+)?\s*m\/s\b|\bat rest\b/g) >= 2, "two velocities");
      requireParam("mass1", "m1");
      requireParam("mass2", "m2");
      requireParam("v1", "v1");
      requireParam("v2", "v2");
      break;
    default:
      Object.entries(parsedOutput.params).forEach(([key, value]) => {
        if (!hasNumber(value)) missing.push(key);
      });
  }
  return unique(missing);
}

function countOhmValues(prompt: string) {
  let count = 0;
  if (/\b(?:voltage|volt|volts|battery|emf)\b|\b\d+(?:\.\d+)?\s*v\b/.test(prompt)) count += 1;
  if (/\b(?:current|amp|amps|ampere|amperes)\b|\b\d+(?:\.\d+)?\s*a\b/.test(prompt)) count += 1;
  if (/\b(?:resistance|resistor|ohm|ohms|Ω)\b/.test(prompt)) count += 1;
  return count;
}

function confidenceForType(type: SimulationType, config: SimulationConfig | null, rawPrompt: string): ConfidenceResult {
  const lower = normalizePromptText(rawPrompt).toLowerCase();
  const missing: string[] = [];
  const addMissing = (condition: boolean, label: string) => {
    if (!condition) missing.push(label);
  };
  const keywordChecks: Record<SimulationType, boolean> = {
    inclined_plane: hasAny(lower, [/\bincline(d)?\b/, /\bslope\b/, /\bramp\b/, /\bplane\b/, /\bangle\b/]) && hasAny(lower, [/\bmass\b/, /\bobject\b/, /\bblock\b/, /\bkg\b/]),
    atwood_table: hasAny(lower, [/\bpulley\b/, /\bhanging\s+mass\b/, /\btwo\s+masses\b/, /\bconnected\b/]) && massValueCount(lower) >= 2,
    projectile_motion: hasAny(lower, [/\blaunch(ed)?\b/, /\bthrown?\b/, /\bprojectile\b/, /\bangle\b/, /\binitial velocity\b/]) && (hasSpeedValue(lower) || hasAngleValue(lower)),
    collision_1d: hasAny(lower, [/\bcollision\b/, /\bcollide\b/, /\bhit\b/, /\bcrash\b/, /\bbounce\b/]),
    pendulum: hasAny(lower, [/\bpendulum\b/, /\bstring\b/, /\bswing\b/, /\boscillat/]) && hasLengthValue(lower),
    free_fall: hasAny(lower, [/\bdrop\b/, /\bdropped\b/, /\bfall(?:s|ing)?\b/, /\bgravity\b/]) && !hasAny(lower, [/\bhorizontal\b/, /\bangle\b/, /\blaunch\b/]),
    spring_mass: hasAny(lower, [/\bspring\b/, /\boscillat/, /\bhooke\b/]) && hasAny(lower, [/\bspring\s+constant\b/, /\bk\s*=/, /\bn\/m\b/, /\bmass\b/, /\bkg\b/]),
    circular_motion: hasAny(lower, [/\bcircular\b/, /\brotation\b/, /\borbit\b/, /\bcentripetal\b/, /\bspinning\b/, /\bspin\b/]) && hasAny(lower, [/\bradius\b/, /\bm\b/, /\bvelocity\b/, /\bspeed\b/]),
    torque: hasAny(lower, [/\btorque\b/, /\brotation\b/, /\blever arm\b/, /\bangular\b/]) && hasAny(lower, [/\bforce\b/, /\b\d+(?:\.\d+)?\s*n\b/]) && hasAny(lower, [/\bdistance\b/, /\blength\b/, /\blever arm\b/, /\barm\b/]),
    electric_field: hasAny(lower, [/\bcharge\b/, /\bcharges\b/, /\belectric\b/, /\bcoulomb\b/]) && (chargeValueCount(lower) >= 2 || /\bcharges?\s+[+-]?\d+(?:\.\d+)?\s+(?:and\s+)?[+-]?\d+(?:\.\d+)?/.test(lower)),
    ohm_law: hasAny(lower, [/\bvoltage\b/, /\bcurrent\b/, /\bresistance\b/, /\bcircuit\b/, /\bohm\b/]) && countOhmValues(lower) >= 2,
    bernoulli: hasAny(lower, [/\bfluid\b/, /\bflow\b/, /\bpressure\b/, /\bvelocity\b/, /\bpipe\b/, /\bbernoulli\b/]) && hasSpeedValue(lower) && hasAny(lower, [/\bpressure\b/, /\bheight\b/]),
    standing_waves: hasAny(lower, [/\bwave\b/, /\bharmonic\b/, /\bstring\b/, /\bfrequency\b/, /\bwavelength\b/]) && hasAny(lower, [/\blength\b/, /\b\d+(?:\.\d+)?\s*m\b/, /\bfrequency\b/, /\btension\b/]),
    bohr_model: hasAny(lower, [/\batom\b/, /\belectron\b/, /\bshell\b/, /\borbit\b/, /\bbohr\b/, /\bhydrogen\b/, /\belement\b/, /\batomic number\b/]),
  };
  addMissing(keywordChecks[type], "matching physics context");
  const fieldMissing = resolveMissingFields(type, config, rawPrompt);
  missing.push(...fieldMissing);
  const missingFields = unique(missing);
  const confidence = keywordChecks[type] ? Math.max(0, 0.95 - missingFields.length * 0.12) : 0.2;
  return {
    simulationType: missingFields.includes("matching physics context") ? null : type,
    confidence,
    missingFields,
    shouldRender: confidence >= CONFIDENCE_THRESHOLD && missingFields.length === 0,
  };
}

function getSimulationConfidence(parsedOutput: SimulationConfig | null, rawPrompt: string): ConfidenceResult {
  const explicitType = explicitLabType(rawPrompt);
  if (explicitType) {
    const config = parsedOutput?.type === explicitType ? parsedOutput : DEFAULT_CONFIGS[explicitType];
    return {
      simulationType: explicitType,
      confidence: 0.98,
      missingFields: resolveMissingFields(explicitType, config, rawPrompt),
      shouldRender: true,
    };
  }

  const candidates = (Object.keys(DEFAULT_CONFIGS) as SimulationType[])
    .map((type) => confidenceForType(type, parsedOutput?.type === type ? parsedOutput : DEFAULT_CONFIGS[type], rawPrompt))
    .filter((result) => result.simulationType !== null)
    .sort((a, b) => b.confidence - a.confidence);
  const parsedCandidate = parsedOutput ? confidenceForType(parsedOutput.type, parsedOutput, rawPrompt) : null;
  const best = parsedCandidate?.shouldRender ? parsedCandidate : candidates[0];
  if (!best || best.confidence < CONFIDENCE_THRESHOLD) {
    return { simulationType: null, confidence: best?.confidence ?? 0, missingFields: best?.missingFields ?? ["physics system"], shouldRender: false };
  }
  return best;
}

function normalizeForPrompt(config: SimulationConfig, prompt: string): SimulationConfig {
  const normalizedPrompt = normalizePromptText(prompt);
  const extractedConfig = mergePromptExtraction(config, normalizedPrompt);
  return normalizeSpringMassConfig(
    normalizeTorqueConfig(
      normalizeOhmConfig(
        normalizeBernoulliConfig(
          normalizeBohrConfig(
            normalizeProjectileConfig(
              normalizeFreeFallConfig(
                normalizeElectricFieldConfig(
                  normalizeAtwoodConfig(normalizeCollisionConfig(extractedConfig, normalizedPrompt), normalizedPrompt),
                  normalizedPrompt
                ),
                normalizedPrompt
              ),
              normalizedPrompt
            ),
            normalizedPrompt
          ),
          normalizedPrompt
        ),
        normalizedPrompt
      ),
      normalizedPrompt
    ),
    normalizedPrompt
  );
}

function configForConfidence(parsed: SimulationConfig, confidence: ConfidenceResult, prompt: string): SimulationConfig {
  const type = confidence.simulationType ?? parsed.type;
  const defaults = DEFAULT_CONFIGS[type];
  const base = parsed.type === type
    ? {
        ...defaults,
        ...parsed,
        params: { ...defaults.params, ...parsed.params },
        world: { ...defaults.world, ...parsed.world },
      }
    : defaults;
  return normalizeForPrompt(base, prompt);
}

function displayExplanation(config: SimulationConfig, outcome: LaunchOutcome | null, fallback: string) {
  if (config.type === "atwood_table") {
    const m1 = config.params.mass1;
    const m2 = config.params.mass2;
    const mu = config.params.friction;
    const d = config.params.distance;
    const g = config.world.gravity;
    const drivingForce = m2 * g - mu * m1 * g;
    if ([m1, m2, mu, d, g].every(Number.isFinite)) {
      if (drivingForce <= 0) return `The Atwood Machine will not accelerate: friction (${(mu * m1 * g).toFixed(2)} N) is at least as large as the hanging pull (${(m2 * g).toFixed(2)} N). Lower μ or increase m₂.`;
      const a = drivingForce / (m1 + m2);
      const v = Math.sqrt(2 * a * d);
      return `The Atwood Machine accelerates at ${a.toFixed(2)} m/s². After ${d.toFixed(1)} m, the masses reach about ${v.toFixed(2)} m/s because m₂g exceeds table friction.`;
    }
  }

  if (config.type === "inclined_plane") {
    const angle = config.params.angle;
    const mu = config.params.friction;
    const d = config.params.distance;
    const g = config.world.gravity;
    const theta = (angle * Math.PI) / 180;
    const a = g * (Math.sin(theta) - mu * Math.cos(theta));
    if ([angle, mu, d, g].every(Number.isFinite)) {
      if (a <= 0) return `The block does not slide because friction cancels the downslope component of gravity. Increase θ or lower μ.`;
      const v = Math.sqrt(2 * a * d);
      return `The block slides down the incline with acceleration ${a.toFixed(2)} m/s² and reaches about ${v.toFixed(2)} m/s after ${d.toFixed(1)} m.`;
    }
  }

  if (outcome?.launched && Object.keys(outcome.metrics).length > 0) return fallback;
  return fallback || "Adjust the controls, then run the animation to see the computed result.";
}

export default function SimulationClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shared = useMemo(() => decodeSimulation(searchParams.get("state")), [searchParams]);
  const [prompt, setPrompt] = useState(shared?.prompt ?? DEFAULT_PROMPT);
  const [config, setConfig] = useState<SimulationConfig>(shared?.config ?? DEFAULT_SIMULATION);
  const [outcome, setOutcome] = useState<LaunchOutcome | null>(null);
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseMessage, setParseMessage] = useState("");
  const [submittedAttempted, setSubmittedAttempted] = useState(Boolean(shared));

  useEffect(() => {
    setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
  }, []);

  const updateShareUrl = useCallback(
    (nextConfig: SimulationConfig, nextPrompt = prompt) => {
      const state = encodeSimulation(nextConfig, nextPrompt);
      router.replace(`/sim?state=${state}`, { scroll: false });
    },
    [prompt, router]
  );

  const updateParam = (key: string, value: number) => {
    const next: SimulationConfig = {
      ...validated.config,
      params: { ...validated.config.params, [key]: value },
      world: key === "friction" ? { ...validated.config.world, friction: value } : validated.config.world,
    };
    setConfig(next);
    setOutcome(null);
    updateShareUrl(next);
  };

  const updateGravity = (value: number) => {
    const next: SimulationConfig = {
      ...validated.config,
      world: { ...validated.config.world, gravity: value },
    };
    setConfig(next);
    setOutcome(null);
    updateShareUrl(next);
  };

  const reparse = async () => {
    setParsing(true);
    setSubmittedAttempted(true);
    setParseMessage("");
    try {
      if (isUnsupportedHorizontalForcePrompt(prompt)) {
        setParseMessage("Intuify does not have a horizontal force simulation yet. Try a collision, inclined plane, Atwood Machine, or electric field prompt.");
        return;
      }

      if (prompt === ATWOOD_PROMPT) {
        setConfig(ATWOOD_EXAMPLE);
        setOutcome(null);
        setParseMessage("");
        saveHistory(prompt, ATWOOD_EXAMPLE);
        setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
        updateShareUrl(ATWOOD_EXAMPLE);
        return;
      }

      const parsed = await parseWithAgentverse(prompt);
      const requestedType = explicitLabType(prompt);

      if (!parsed || !parsed.type || !parsed.params) {
        if (requestedType) {
          const fallbackConfig = normalizeForPrompt(DEFAULT_CONFIGS[requestedType], prompt);
          const confidence = getSimulationConfidence(fallbackConfig, prompt);
          const validatedNext = validateSimulationConfig(configForConfidence(fallbackConfig, confidence, prompt), prompt);
          const nextConfig = validatedNext.config;
          setConfig(nextConfig);
          setOutcome(null);
          setParseMessage(validatedNext.assumptions.join(" "));
          saveHistory(prompt, nextConfig);
          setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
          updateShareUrl(nextConfig);
          return;
        }
        setParseMessage(PROMPT_HELP_MESSAGE);
        return;
      }

      const normalized = normalizeForPrompt(parsed, prompt);
      const confidence = getSimulationConfidence(normalized, prompt);
      if (!confidence.shouldRender) {
        setParseMessage(`${LOW_CONFIDENCE_MESSAGE}${confidence.missingFields.length ? ` Missing: ${confidence.missingFields.join(", ")}.` : ""}`);
        setOutcome(null);
        return;
      }

      const validatedNext = validateSimulationConfig(configForConfidence(normalized, confidence, prompt), prompt);
      const nextConfig = validatedNext.config;
      setConfig(nextConfig);
      setOutcome(null);
      setParseMessage(validatedNext.assumptions.join(" "));
      saveHistory(prompt, nextConfig);
      setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
      updateShareUrl(nextConfig);
    } catch {
      setParseMessage(PROMPT_HELP_MESSAGE);
    } finally {
      setParsing(false);
    }
  };

  const runDemo = () => {
    const nextPrompt = DEFAULT_PROMPT;
    setPrompt(nextPrompt);
    setConfig(DEMO_SHOT);
    setOutcome(null);
    setSubmittedAttempted(true);
    setParseMessage("");
    saveHistory(nextPrompt, DEMO_SHOT);
    setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
    updateShareUrl(DEMO_SHOT, nextPrompt);
  };

  const loadAtwoodExample = () => {
    setPrompt(ATWOOD_PROMPT);
    setConfig(ATWOOD_EXAMPLE);
    setOutcome(null);
    setSubmittedAttempted(true);
    setParseMessage("");
    saveHistory(ATWOOD_PROMPT, ATWOOD_EXAMPLE);
    setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
    updateShareUrl(ATWOOD_EXAMPLE, ATWOOD_PROMPT);
  };

  const shareLink = typeof window === "undefined" ? "" : window.location.href;
  const baseValidated = useMemo(() => validateSimulationConfig(config, prompt), [config, prompt]);
  const activeConfidence = useMemo(() => {
    if (!submittedAttempted) return { simulationType: config.type, confidence: 1, missingFields: [], shouldRender: true };
    return getSimulationConfidence(baseValidated.config, prompt);
  }, [baseValidated.config, config.type, prompt, submittedAttempted]);
  const validated = useMemo(() => {
    if (!submittedAttempted) return baseValidated;
    if (!activeConfidence.shouldRender) return baseValidated;
    return validateSimulationConfig(configForConfidence(baseValidated.config, activeConfidence, prompt), prompt);
  }, [activeConfidence, baseValidated, prompt, submittedAttempted]);
  const activeConfig = validated.config;
  const explanation = buildExplanation(activeConfig, outcome);
  const shownExplanation = displayExplanation(activeConfig, outcome, explanation);
  const scenarioLabel = SCENARIO_LABELS[activeConfig.type] ?? activeConfig.type;
  const paramKeys = PARAM_ORDER[activeConfig.type] ?? Object.keys(activeConfig.params);
  const visibleParams = Object.entries(activeConfig.params).filter(([key]) => paramKeys.includes(key));
  const showGravity = GRAVITY_SCENARIOS.has(activeConfig.type);
  const hasRun = Boolean(outcome?.launched);
  const shouldBlockRender = submittedAttempted && (!validated.valid || !activeConfidence.shouldRender);

  return (
    <main className="min-h-screen px-3 py-3 sm:px-4 lg:px-5">
      <div className="mx-auto max-w-[1280px]">
        <header className="mb-3 rounded-xl bg-white/65 p-3 shadow-sm ring-1 ring-white/70 backdrop-blur">
          <div className="grid gap-3 lg:grid-cols-[170px_minmax(380px,1fr)_auto] lg:items-center">
            <div>
              <Link href="/" className="text-sm font-semibold text-[#216869]">Intuify</Link>
              <h1 className="mt-0.5 text-xl font-black text-slate-950">{scenarioLabel}</h1>
            </div>
            <div>
              <label className="sr-only">Physics Problem</label>
              <textarea
                value={prompt}
                onChange={(event) => { setPrompt(event.target.value); setSubmittedAttempted(false); setParseMessage(""); }}
                className="min-h-14 w-full resize-none rounded-md border border-slate-200 bg-white/85 px-3 py-2 text-sm leading-5 outline-none transition focus:border-[#216869] focus:ring-2 focus:ring-[#216869]/20"
                placeholder="Describe a physics word problem..."
              />
              {parseMessage ? (
                <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">{parseMessage}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                onClick={reparse}
                disabled={parsing}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                <Clipboard size={17} />
                {parsing ? "Parsing…" : "Build Simulation"}
              </button>
            <button onClick={runDemo} className="inline-flex items-center gap-2 rounded-md bg-[#f2c14e] px-4 py-2 font-bold text-slate-950 transition hover:bg-[#e0ad36]">
              <Sparkles size={18} />
              Run Demo
            </button>
            <button
              onClick={() => navigator.clipboard?.writeText(shareLink)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              <Share2 size={18} />
              Copy Share Link
            </button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(560px,760px)_310px] xl:justify-center">
          <section className="min-w-0">
            {!shouldBlockRender ? (
              <MatterScene config={activeConfig} onOutcome={setOutcome} onLoadAtwoodExample={loadAtwoodExample} />
            ) : (
              <div className="rounded-xl bg-white/85 p-5 shadow-glow ring-1 ring-slate-200/60">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950">
                  <h2 className="text-lg font-black">We couldn&apos;t fully understand this problem.</h2>
                  <p className="mt-2 text-sm leading-6">{activeConfidence.shouldRender ? "Missing required values" : LOW_CONFIDENCE_MESSAGE}</p>
                  {(activeConfidence.missingFields.length > 0 || validated.missing.length > 0) ? (
                    <p className="mt-2 text-sm leading-6">Missing: {unique([...activeConfidence.missingFields, ...validated.missing]).join(", ")}</p>
                  ) : null}
                  <p className="mt-2 text-sm leading-6 text-amber-900">Try adding those values, or choose one of the examples below.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={runDemo} className="rounded-md bg-[#216869] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1a5556]">Use Default Demo</button>
                    <button onClick={loadAtwoodExample} className="rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-950 transition hover:bg-amber-100">Use Atwood Example</button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-3 xl:sticky xl:top-3 xl:self-start">
            <section className="rounded-xl bg-white/70 p-3 shadow-sm ring-1 ring-slate-200/50">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Controls</h2>
              <div className="mt-3 space-y-4">
                {showGravity ? <label className="block">
                  <span className="flex justify-between text-sm font-semibold">
                    <span>{paramLabel(activeConfig.type, "gravity")}</span>
                    <span>{activeConfig.world.gravity.toFixed(1)} m/s²</span>
                  </span>
                  <input
                    className="mt-2 w-full"
                    type="range" min="1" max="20" step="0.1"
                    value={activeConfig.world.gravity}
                    onChange={(e) => updateGravity(Number(e.target.value))}
                  />
                </label> : null}
                {visibleParams.map(([key, value]) => {
                  const range = sliderRange(activeConfig.type, key);
                  return (
                    <label key={key} className="block">
                      <span className="flex justify-between gap-3 text-sm font-semibold">
                        <span>{paramLabel(activeConfig.type, key)}</span>
                        <span>{paramValueLabel(activeConfig.type, key, Number(value))}</span>
                      </span>
                      <input
                        className="mt-2 w-full"
                        type="range"
                        min={range.min}
                        max={range.max}
                        step={range.step}
                        value={value}
                        onChange={(e) => updateParam(key, Number(e.target.value))}
                      />
                    </label>
                  );
                })}
              </div>
              {validated.assumptions.length > 0 ? (
                <div className="mt-3 rounded-md bg-slate-50 p-2 text-xs leading-5 text-slate-600 ring-1 ring-slate-200/60">
                  {validated.assumptions.map((assumption) => <div key={assumption}>{assumption}</div>)}
                </div>
              ) : null}
              {submittedAttempted && !validated.valid ? (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-semibold leading-5 text-amber-900">Add the missing values to enable this simulation.</p>
              ) : null}
            </section>
            <section className={`rounded-xl bg-white/75 p-3 shadow-sm ring-1 ring-slate-200/60 transition ${hasRun ? "ring-[#216869]/25" : ""}`}>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Results</h2>
              {outcome?.launched && Object.keys(outcome.metrics).length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(outcome.metrics).map(([key, val]) => (
                    <div key={key} className="rounded-md bg-[#216869]/10 p-2">
                      <div className="font-bold">{Number(val).toFixed(2)}</div>
                      <div className="text-xs text-slate-600">{metricLabel(key)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-600">Run the animation to see live results here.</p>
              )}
            </section>
            <section className={`rounded-xl bg-white/65 p-3 transition ${hasRun ? "shadow-sm ring-1 ring-[#216869]/20" : "opacity-75 ring-1 ring-slate-200/40"}`}>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Insight</h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">{hasRun ? shownExplanation : "Run the animation to unlock the explanation and results."}</p>
            </section>
            <section className="rounded-xl bg-white/55 p-3 ring-1 ring-slate-200/40">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Learning Flow</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Use the controls attached to the stage, run the animation, then step through the guided breakdown below the visual.</p>
            </section>
          </aside>
        </div>

        <section className="mt-4 rounded-xl bg-white/45 p-3 ring-1 ring-slate-200/40">
          <details>
            <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-slate-500">Examples, History, and Developer Details</summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Examples</h3>
                <div className="mt-2 space-y-2">
                  {EXAMPLE_PROMPTS.map((example, index) => (
                    <button
                      key={example}
                      onClick={() => {
                        setPrompt(example);
                        setParseMessage("");
                      }}
                      className="w-full rounded-md border border-slate-200 bg-white/70 px-3 py-2 text-left text-xs font-semibold leading-5 text-slate-700 transition hover:border-[#216869] hover:bg-white"
                    >
                      Example {index + 1}: {example}
                    </button>
                  ))}
                </div>
              </div>
              <div>
              <h3 className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><History size={16} /> Local History</h3>
              <div className="mt-3 space-y-2">
                {history.length === 0 ? <p className="text-sm text-slate-500">Parsed prompts will appear here.</p> : null}
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setPrompt(item.prompt);
                      setConfig(item.config);
                      updateShareUrl(item.config, item.prompt);
                    }}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 p-3 text-left text-sm transition hover:border-[#216869]"
                  >
                    <span className="line-clamp-2 font-semibold text-slate-800">{item.prompt}</span>
                    <span className="mt-1 block text-xs text-slate-500">{new Date(item.timestamp).toLocaleString()}</span>
                  </button>
                ))}
              </div>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Developer Details</h3>
                <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-emerald-100">{parserJson(activeConfig)}</pre>
              </div>
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}
