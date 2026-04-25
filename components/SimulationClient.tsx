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

const SCENARIO_LABELS: Record<string, string> = {
  projectile_motion: "Projectile Motion",
  collision_1d: "1D Collision",
  pendulum: "Pendulum",
  inclined_plane: "Inclined Plane",
  free_fall: "Free Fall",
};

function saveHistory(prompt: string, config: SimulationConfig) {
  const existing = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]") as SimulationHistoryItem[];
  const item: SimulationHistoryItem = {
    id: crypto.randomUUID(),
    prompt,
    config,
    timestamp: new Date().toISOString()
  };
  localStorage.setItem(HISTORY_KEY, JSON.stringify([item, ...existing].slice(0, 8)));
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
    try {
      const parsed = await parseWithAgentverse(prompt);
      setConfig(parsed);
      setOutcome(null);
      saveHistory(prompt, parsed);
      setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
      updateShareUrl(parsed);
    } finally {
      setParsing(false);
    }
  };

  const runDemo = () => {
    const nextPrompt = "Demo: projectile at 45° for maximum range";
    setConfig(DEMO_SHOT);
    setOutcome(null);
    saveHistory(nextPrompt, DEMO_SHOT);
    setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
    updateShareUrl(DEMO_SHOT, nextPrompt);
  };

  const shareLink = typeof window === "undefined" ? "" : window.location.href;
  const explanation = buildExplanation(config, outcome);
  const scenarioLabel = SCENARIO_LABELS[config.type] ?? config.type;

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex flex-col justify-between gap-4 rounded-lg border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur md:flex-row md:items-center">
          <div>
            <Link href="/" className="text-sm font-semibold text-[#216869]">Physics Visualizer</Link>
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
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Parsed JSON</h2>
              <pre className="mt-3 max-h-[420px] overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-emerald-100">{parserJson(config)}</pre>
            </section>
          </aside>

          <section>
            <MatterScene config={config} onOutcome={setOutcome} />
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
                      <span>{key.replace(/_/g, " ")}</span>
                      <span>{Number(value).toFixed(1)}</span>
                    </span>
                    <input
                      className="mt-2 w-full"
                      type="range"
                      min={key === "v1" || key === "v2" ? -20 : 0}
                      max={key === "speed" ? 40 : key === "angle" || key === "initial_angle" ? 85 : key === "height" ? 400 : key === "length" ? 250 : key === "mass" || key === "mass1" || key === "mass2" ? 10 : 20}
                      step="0.1"
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
