import { isSimulationType, SIMULATION_REGISTRY } from "@/lib/simulations/registry";
import type { ParsedCompound } from "@/lib/physics/builder";
import type { ComponentKind } from "@/lib/physics/types";
import type { SimulationConfig } from "@/types/simulation";

const COMPONENT_KINDS: ComponentKind[] = ["mass", "ramp", "pulley", "spring", "resistor", "capacitor", "battery"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function finiteParams(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, raw]) => [key, finiteNumber(raw)] as const)
      .filter((entry): entry is [string, number] => entry[1] !== null),
  );
}

export function validateSimulationConfig(raw: unknown): SimulationConfig | null {
  if (!isRecord(raw) || !isSimulationType(raw.type)) return null;

  const metadata = SIMULATION_REGISTRY[raw.type];
  const world = isRecord(raw.world) ? raw.world : {};
  const gravity = finiteNumber(world.gravity) ?? metadata.defaultConfig.world.gravity;
  const friction = finiteNumber(world.friction) ?? metadata.defaultConfig.world.friction;
  const explanationGoal = typeof raw.explanationGoal === "string" && raw.explanationGoal
    ? raw.explanationGoal
    : metadata.defaultConfig.explanationGoal;

  return {
    type: raw.type,
    params: finiteParams(raw.params),
    world: {
      gravity,
      friction,
    },
    explanationGoal,
  };
}

export function validateSharedSimulation(raw: unknown): { config: SimulationConfig; prompt: string } | null {
  if (!isRecord(raw)) return null;
  const config = validateSimulationConfig(raw.config);
  if (!config) return null;

  return {
    config,
    prompt: typeof raw.prompt === "string" ? raw.prompt : "",
  };
}

function validateParsedComponent(raw: unknown) {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || !raw.id.trim()) return null;
  if (typeof raw.kind !== "string" || !COMPONENT_KINDS.includes(raw.kind as ComponentKind)) return null;
  if (typeof raw.label !== "string") return null;
  if (!isRecord(raw.props)) return null;

  const props: Record<string, number | string> = {};
  for (const [key, value] of Object.entries(raw.props)) {
    if (typeof value === "string") props[key] = value;
    else {
      const numberValue = finiteNumber(value);
      if (numberValue !== null) props[key] = numberValue;
    }
  }

  return {
    id: raw.id,
    kind: raw.kind,
    label: raw.label,
    props,
  };
}

function validateParsedConnection(raw: unknown) {
  if (!isRecord(raw)) return null;
  if (typeof raw.from !== "string" || !raw.from.trim()) return null;
  if (typeof raw.to !== "string" || !raw.to.trim()) return null;

  return {
    from: raw.from,
    to: raw.to,
    ...(typeof raw.label === "string" ? { label: raw.label } : {}),
  };
}

export function validateParsedCompound(raw: unknown): ParsedCompound | null {
  if (!isRecord(raw) || !Array.isArray(raw.components) || !Array.isArray(raw.connections)) return null;

  const components = raw.components.map(validateParsedComponent);
  const connections = raw.connections.map(validateParsedConnection);

  if (components.some((component) => component === null) || connections.some((connection) => connection === null)) {
    return null;
  }

  const ids = new Set(components.map((component) => component!.id));
  if (ids.size !== components.length) return null;
  if (connections.some((connection) => !ids.has(connection!.from) || !ids.has(connection!.to))) return null;

  return {
    components: components as ParsedCompound["components"],
    connections: connections as ParsedCompound["connections"],
  };
}
