"use client";

import { Clipboard, History, Layers, Share2, Sparkles } from "lucide-react";
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
  "A 2 kg crate slides down a 45 degree ramp with coefficient of kinetic friction 0.1 over 4 meters.",
  "A 4 kg block rests on a frictionless table and is connected over a pulley to a hanging 2 kg mass. How fast does the system accelerate if the hanging mass falls 3 meters?",
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
  atwood_table: "Atwood Table",
  spring_mass: "Spring-Mass",
  circular_motion: "Circular Motion",
  torque: "Torque",
  electric_field: "Electric Field",
  ohm_law: "Ohm's Law",
  bernoulli: "Bernoulli Flow",
  standing_waves: "Standing Waves",
  bohr_model: "Bohr Model",
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
  if (type === "atwood_table") {
    if (key === "mass1") return <>m<sub>1</sub></>;
    if (key === "mass2") return <>m<sub>2</sub></>;
    if (key === "friction") return <>friction μ</>;
    if (key === "distance") return <>distance d</>;
  }

  return key.replace(/_/g, " ");
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

  const isCompoundPrompt = (text: string) => {
    const t = text.toLowerCase();
    // Multi-component circuit: needs battery + resistor together, or "series", or R1/R2 notation
    const multiResistor = (t.match(/\br\d+\b/g) ?? []).length >= 2 || t.includes("series");
    const compoundCircuit = multiResistor || (t.includes("battery") && t.includes("resistor"));
    return (
      (t.includes("pulley") && (t.includes("ramp") || t.includes("hanging") || t.includes("spring") || t.includes("connected"))) ||
      (t.includes("ramp") && t.includes("connected")) ||
      t.includes("atwood") ||
      compoundCircuit ||
      (t.includes("spring") && t.includes("pulley"))
    );
  };

  const reparse = async () => {
    if (isCompoundPrompt(prompt)) {
      router.push(`/compound?prompt=${encodeURIComponent(prompt)}`);
      return;
    }
    setParsing(true);
    setParseMessage("");
    try {
      const parsed = await parseWithAgentverse(prompt);

      if (!parsed || !parsed.type || !parsed.params) {
        setParseMessage(PROMPT_HELP_MESSAGE);
        return;
      }

      setConfig(parsed);
      setOutcome(null);
      saveHistory(prompt, parsed);
      setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
      updateShareUrl(parsed);
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
  const scenarioLabel = SCENARIO_LABELS[config.type] ?? config.type;

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex flex-col justify-between gap-4 rounded-lg border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur md:flex-row md:items-center">
          <div>
            <Link href="/" className="text-sm font-semibold text-[#216869]">Intuify</Link>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{scenarioLabel}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/compound" className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:border-[#216869] hover:text-[#216869]">
              <Layers size={18} />
              Compound Lab
            </Link>
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
                <label className="block">
                  <span className="flex justify-between text-sm font-semibold">
                    <span>Gravity</span>
                    <span>{config.world.gravity.toFixed(1)} m/s²</span>
                  </span>
                  <input
                    className="mt-2 w-full"
                    type="range" min="1" max="20" step="0.1"
                    value={config.world.gravity}
                    onChange={(e) => updateGravity(Number(e.target.value))}
                  />
                </label>
                {Object.entries(config.params).map(([key, value]) => (
                  <label key={key} className="block">
                    <span className="flex justify-between text-sm font-semibold">
                      <span>{paramLabel(config.type, key)}</span>
                      <span>{Number(value).toFixed(1)}</span>
                    </span>
                    <input
                      className="mt-2 w-full"
                      type="range"
                      min={key === "v1" || key === "v2" ? -20 : 0}
                      max={key === "speed" ? 40 : key === "angle" || key === "initial_angle" ? 85 : key === "height" ? 400 : key === "length" ? 250 : key === "mass" || key === "mass1" || key === "mass2" ? 10 : key === "distance" ? 5 : key === "friction" ? 0.9 : 20}
                      step={key === "friction" || key === "air_resistance" || key === "restitution" ? 0.01 : 0.1}
                      value={value}
                      onChange={(e) => updateParam(key, Number(e.target.value))}
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Explanation</h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">{explanation}</p>
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
