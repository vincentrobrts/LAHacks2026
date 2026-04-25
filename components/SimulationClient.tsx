"use client";

import { Clipboard, History, Share2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import MatterScene from "@/components/MatterScene";
import { DEFAULT_PROMPT, DEFAULT_SIMULATION, PERFECT_SHOT } from "@/lib/defaults";
import { buildExplanation } from "@/lib/explanation";
import { parseWithAgentverse } from "@/lib/agentverse";
import { parserJson } from "@/lib/parser";
import { decodeSimulation, encodeSimulation } from "@/lib/share";
import type { LaunchOutcome, SimulationConfig, SimulationHistoryItem } from "@/types/simulation";

const HISTORY_KEY = "physics-visualizer-history";

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
  const params = useSearchParams();
  const shared = useMemo(() => decodeSimulation(params.get("state")), [params]);
  const [prompt, setPrompt] = useState(shared?.prompt ?? DEFAULT_PROMPT);
  const [config, setConfig] = useState<SimulationConfig>(shared?.config ?? DEFAULT_SIMULATION);
  const [outcome, setOutcome] = useState<LaunchOutcome | null>(null);
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);

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

  const updateConfig = (patch: Partial<SimulationConfig["projectile"] & SimulationConfig["world"]>) => {
    const next = {
      ...config,
      projectile: {
        ...config.projectile,
        speed: patch.speed ?? config.projectile.speed,
        angle: patch.angle ?? config.projectile.angle
      },
      world: {
        ...config.world,
        gravity: patch.gravity ?? config.world.gravity,
        towerBlocks: patch.towerBlocks ?? config.world.towerBlocks
      }
    };
    setConfig(next);
    setOutcome(null);
    updateShareUrl(next);
  };

  const reparse = async () => {
    const parsed = await parseWithAgentverse(prompt);
    setConfig(parsed);
    setOutcome(null);
    saveHistory(prompt, parsed);
    setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
    updateShareUrl(parsed);
  };

  const perfectShot = () => {
    const nextPrompt = "Run Perfect Shot demo";
    setConfig(PERFECT_SHOT);
    setOutcome(null);
    saveHistory(nextPrompt, PERFECT_SHOT);
    setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
    updateShareUrl(PERFECT_SHOT, nextPrompt);
  };

  const shareLink = typeof window === "undefined" ? "" : window.location.href;
  const explanation = buildExplanation(config, outcome);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex flex-col justify-between gap-4 rounded-lg border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur md:flex-row md:items-center">
          <div>
            <Link href="/" className="text-sm font-semibold text-[#216869]">Physics Visualizer</Link>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Projectile knockdown lab</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={perfectShot} className="inline-flex items-center gap-2 rounded-md bg-[#f2c14e] px-4 py-2 font-bold text-slate-950 transition hover:bg-[#e0ad36]">
              <Sparkles size={18} />
              Run Perfect Shot
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
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Original Prompt</h2>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="mt-3 min-h-28 w-full resize-none rounded-md border border-slate-300 bg-slate-50 p-3 text-sm leading-6 outline-none focus:border-[#216869] focus:ring-2 focus:ring-[#216869]/20"
              />
              <button onClick={reparse} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 font-semibold text-white transition hover:bg-slate-800">
                <Clipboard size={17} />
                Parse Prompt
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
                  <span className="flex justify-between text-sm font-semibold"><span>Angle</span><span>{config.projectile.angle} deg</span></span>
                  <input className="range mt-2 w-full" type="range" min="10" max="75" value={config.projectile.angle} onChange={(event) => updateConfig({ angle: Number(event.target.value) })} />
                </label>
                <label className="block">
                  <span className="flex justify-between text-sm font-semibold"><span>Speed</span><span>{config.projectile.speed}</span></span>
                  <input className="range mt-2 w-full" type="range" min="8" max="35" value={config.projectile.speed} onChange={(event) => updateConfig({ speed: Number(event.target.value) })} />
                </label>
                <label className="block">
                  <span className="flex justify-between text-sm font-semibold"><span>Gravity</span><span>{config.world.gravity.toFixed(1)} m/s²</span></span>
                  <input className="range mt-2 w-full" type="range" min="1" max="20" step="0.1" value={config.world.gravity} onChange={(event) => updateConfig({ gravity: Number(event.target.value) })} />
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Explanation</h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">{explanation}</p>
              {outcome?.launched ? (
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md bg-slate-100 p-3"><div className="font-bold">{outcome.blocksMoved}</div><div className="text-slate-600">blocks moved</div></div>
                  <div className="rounded-md bg-slate-100 p-3"><div className="font-bold">{outcome.success ? "Success" : "Try again"}</div><div className="text-slate-600">result</div></div>
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
