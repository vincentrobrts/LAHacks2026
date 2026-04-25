"use client";

import { Clipboard, History, Share2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import MatterScene from "@/components/MatterScene";
import { DEFAULT_PROMPT, DEFAULT_SIMULATION, DEMO_SHOT } from "@/lib/defaults";
import { buildExplanation } from "@/lib/explanation";
import { parseWithAgentverse } from "@/lib/agentverse";
import { parserJson } from "@/lib/parser";
import { decodeSimulation, encodeSimulation } from "@/lib/share";
import type { LaunchOutcome, SimulationConfig, SimulationHistoryItem } from "@/types/simulation";

const HISTORY_KEY = "physics-visualizer-history";
const PROMPT_HELP_MESSAGE = "Intuify couldn’t confidently build a visualization from that prompt yet. Try one of the examples below.";
const EXAMPLE_PROMPTS = [
  "A 5 kg block slides down a 30 degree incline with μk = 0.2 for 3 meters.",
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

const GRAVITY_SCENARIOS = new Set(["projectile_motion", "pendulum", "inclined_plane", "free_fall", "atwood_table", "spring_mass", "circular_motion", "torque", "bernoulli"]);

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
  height: { min: 10, max: 400, step: 1 },
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
  voltage: { min: 0, max: 48, step: 0.5 },
  resistance: { min: 1, max: 200, step: 1 },
  internal_resistance: { min: 0, max: 20, step: 0.1 },
  area_ratio: { min: 0.2, max: 8, step: 0.1 },
  density: { min: 1, max: 1500, step: 1 },
  tension: { min: 1, max: 200, step: 1 },
  linear_density: { min: 0.001, max: 0.05, step: 0.001 },
  harmonic: { min: 1, max: 8, step: 1 },
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
  return SLIDER_RANGES[key] ?? { min: 0, max: 20, step: 0.1 };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
  const lower = prompt.toLowerCase();
  const mentionsRestitution = /\b(restitution|elastic|inelastic|bouncy|bounce)\b/.test(lower);
  const restitution = /\binelastic\b/.test(lower)
    ? 0
    : /\bperfectly\s+elastic\b|\belastic\b/.test(lower)
    ? 1
    : mentionsRestitution
      ? clamp(config.params.restitution ?? 0, 0, 1)
      : 0;

  return {
    ...config,
    params: { ...config.params, restitution },
    world: { ...config.world, friction: config.world.friction ?? 0 },
  };
}

function electricPromptValues(prompt: string) {
  const values: number[] = [];
  const normalized = prompt.replace(/−/g, "-");
  const labeled = /(?:charge|q)\s*\d*\s*:?\s*([+-]?\d+(?:\.\d+)?)\s*(?:μ|u|micro)?c/gi;
  let match: RegExpExecArray | null;
  while ((match = labeled.exec(normalized)) && values.length < 4) {
    values.push(clamp(Number(match[1]), -10, 10));
  }

  const standalone = /([+-]?\d+(?:\.\d+)?)\s*(?:μ|u|micro)c/gi;
  while ((match = standalone.exec(normalized)) && values.length < 4) {
    const value = clamp(Number(match[1]), -10, 10);
    if (!values.some((existing) => Math.abs(existing - value) < 0.001)) values.push(value);
  }

  const electronCount = (normalized.match(/\belectron(s)?\b/gi) ?? []).length;
  for (let i = 0; i < electronCount && values.length < 4; i += 1) values.push(-1);
  return values.slice(0, 4);
}

function electricPromptSeparation(prompt: string, fallback: number) {
  const normalized = prompt.replace(/−/g, "-");
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(?:m|meter|meters)\s*(?:apart|separated|between)?/i);
  return match ? clamp(Number(match[1]), 0.1, 5) : fallback;
}

function normalizeElectricFieldConfig(config: SimulationConfig, prompt: string): SimulationConfig {
  const lower = prompt.toLowerCase();
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
      ...config,
      params: { ...config.params, [key]: value },
      world: key === "friction" ? { ...config.world, friction: value } : config.world,
    };
    setConfig(next);
    setOutcome(null);
    updateShareUrl(next);
  };

  const updateGravity = (value: number) => {
    const next: SimulationConfig = {
      ...config,
      world: { ...config.world, gravity: value },
    };
    setConfig(next);
    setOutcome(null);
    updateShareUrl(next);
  };

  const reparse = async () => {
    setParsing(true);
    setParseMessage("");
    try {
      if (isUnsupportedHorizontalForcePrompt(prompt)) {
        setParseMessage("Intuify does not have a horizontal force simulation yet. Try a collision, inclined plane, Atwood Machine, or electric field prompt.");
        return;
      }

      if (prompt === ATWOOD_PROMPT) {
        setConfig(ATWOOD_EXAMPLE);
        setOutcome(null);
        saveHistory(prompt, ATWOOD_EXAMPLE);
        setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
        updateShareUrl(ATWOOD_EXAMPLE);
        return;
      }

      const parsed = await parseWithAgentverse(prompt);

      if (!parsed || !parsed.type || !parsed.params) {
        setParseMessage(PROMPT_HELP_MESSAGE);
        return;
      }

      const nextConfig = normalizeElectricFieldConfig(normalizeCollisionConfig(parsed, prompt), prompt);
      setConfig(nextConfig);
      setOutcome(null);
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
    setConfig(DEMO_SHOT);
    setOutcome(null);
    setParseMessage("");
    saveHistory(nextPrompt, DEMO_SHOT);
    setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
    updateShareUrl(DEMO_SHOT, nextPrompt);
  };

  const loadAtwoodExample = () => {
    setPrompt(ATWOOD_PROMPT);
    setConfig(ATWOOD_EXAMPLE);
    setOutcome(null);
    setParseMessage("");
    saveHistory(ATWOOD_PROMPT, ATWOOD_EXAMPLE);
    setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
    updateShareUrl(ATWOOD_EXAMPLE, ATWOOD_PROMPT);
  };

  const shareLink = typeof window === "undefined" ? "" : window.location.href;
  const explanation = buildExplanation(config, outcome);
  const shownExplanation = displayExplanation(config, outcome, explanation);
  const scenarioLabel = SCENARIO_LABELS[config.type] ?? config.type;
  const paramKeys = PARAM_ORDER[config.type] ?? Object.keys(config.params);
  const visibleParams = Object.entries(config.params).filter(([key]) => paramKeys.includes(key));
  const showGravity = GRAVITY_SCENARIOS.has(config.type);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex flex-col justify-between gap-4 rounded-lg border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur md:flex-row md:items-center">
          <div>
            <Link href="/" className="text-sm font-semibold text-[#216869]">Intuify</Link>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{scenarioLabel}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
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
        </header>

        <div className="grid gap-5 xl:grid-cols-[330px_minmax(520px,1fr)_340px]">
          <aside className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Physics Problem</h2>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="mt-3 min-h-28 w-full resize-none rounded-md border border-slate-300 bg-slate-50 p-3 text-sm leading-6 outline-none focus:border-[#216869] focus:ring-2 focus:ring-[#216869]/20"
              />
              {parseMessage ? (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-5 text-amber-900">{parseMessage}</p>
              ) : null}
              <div className="mt-3 space-y-2">
                {EXAMPLE_PROMPTS.map((example, index) => (
                  <button
                    key={example}
                    onClick={() => {
                      setPrompt(example);
                      setParseMessage("");
                    }}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold leading-5 text-slate-700 transition hover:border-[#216869] hover:bg-white"
                  >
                    Example {index + 1}: {example}
                  </button>
                ))}
              </div>
              <button
                onClick={reparse}
                disabled={parsing}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                <Clipboard size={17} />
                {parsing ? "Parsing…" : "Build Simulation"}
              </button>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <details className="rounded-md border border-slate-200 bg-white">
                <summary className="cursor-pointer px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">Developer details</summary>
                <pre className="max-h-72 overflow-auto border-t border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-emerald-100">{parserJson(config)}</pre>
              </details>
            </section>
          </aside>

          <section>
            <MatterScene config={config} onOutcome={setOutcome} onLoadAtwoodExample={loadAtwoodExample} />
          </section>

          <aside className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Controls</h2>
              <div className="mt-4 space-y-5">
                {showGravity ? <label className="block">
                  <span className="flex justify-between text-sm font-semibold">
                    <span>{paramLabel(config.type, "gravity")}</span>
                    <span>{config.world.gravity.toFixed(1)} m/s²</span>
                  </span>
                  <input
                    className="mt-2 w-full"
                    type="range" min="1" max="20" step="0.1"
                    value={config.world.gravity}
                    onChange={(e) => updateGravity(Number(e.target.value))}
                  />
                </label> : null}
                {visibleParams.map(([key, value]) => {
                  const range = sliderRange(config.type, key);
                  return (
                  <label key={key} className="block">
                    <span className="flex justify-between text-sm font-semibold">
                      <span>{paramLabel(config.type, key)}</span>
                      <span>{Number(value).toFixed(1)}{key === "mass" || key === "mass1" || key === "mass2" ? " kg" : ""}</span>
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
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Explanation</h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">{shownExplanation}</p>
              {outcome?.launched && Object.keys(outcome.metrics).length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  {Object.entries(outcome.metrics).map(([key, val]) => (
                    <div key={key} className="rounded-md bg-slate-100 p-3">
                      <div className="font-bold">{Number(val).toFixed(2)}</div>
                      <div className="text-slate-600 text-xs">{key.replace(/_/g, " ")}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500"><History size={16} /> Local History</h2>
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
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
