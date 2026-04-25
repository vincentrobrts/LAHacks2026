"use client";

import { Clipboard, History, Share2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import MatterScene from "@/components/MatterScene";
import { DEFAULT_PROMPT, DEFAULT_SIMULATION, PERFECT_SHOT } from "@/lib/defaults";
import { buildExplanation } from "@/lib/explanation";
import { parseInclinedPlanePrompt } from "@/lib/inclinedPrompt";
import { parserJson } from "@/lib/parser";
import { decodeSimulation, encodeSimulation } from "@/lib/share";
import type { LaunchOutcome, SimulationConfig, SimulationHistoryItem } from "@/types/simulation";

const HISTORY_KEY = "physics-visualizer-history";
const DEFAULT_FRICTION = 0.2;
const DEFAULT_DISTANCE = 3;
const EXAMPLE_PROMPTS = [
  "A 5 kg block slides down a 30 degree incline with μk = 0.2 for 3 meters.",
  "A 2 kg crate slides down a 45 degree ramp with coefficient of kinetic friction 0.1 over 4 meters.",
  "A 7 kg box rests on a 20 degree slope with μk = 0.5 over 2 meters."
];

function numberParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = value === null ? Number.NaN : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

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
  const [friction, setFriction] = useState(() => numberParam(params.get("friction"), DEFAULT_FRICTION, 0, 0.9));
  const [travelDistance, setTravelDistance] = useState(() => numberParam(params.get("distance"), DEFAULT_DISTANCE, 1, 5));
  const [outcome, setOutcome] = useState<LaunchOutcome | null>(null);
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);
  const [parseMessage, setParseMessage] = useState("");
  const [extractionFlash, setExtractionFlash] = useState(false);

  useEffect(() => {
    setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
  }, []);

  const updateShareUrl = useCallback(
    (nextConfig: SimulationConfig, nextPrompt = prompt, nextFriction = friction, nextDistance = travelDistance) => {
      const state = encodeSimulation(nextConfig, nextPrompt);
      const extras =
        nextConfig.type === "inclined_plane"
          ? `&friction=${nextFriction.toFixed(2)}&distance=${nextDistance.toFixed(1)}`
          : "";
      router.replace(`/sim?state=${state}${extras}`, { scroll: false });
    },
    [friction, prompt, router, travelDistance]
  );

  const updateConfig = (patch: Partial<SimulationConfig["projectile"] & SimulationConfig["world"]>) => {
    const next = {
      ...config,
      projectile: {
        ...config.projectile,
        speed: patch.speed ?? config.projectile.speed,
        angle: patch.angle ?? config.projectile.angle,
        mass: patch.mass ?? config.projectile.mass
      },
      world: {
        ...config.world,
        gravity: patch.gravity ?? config.world.gravity,
        towerBlocks: patch.towerBlocks ?? config.world.towerBlocks
      }
    };
    setConfig(next);
    setOutcome(null);
    setParseMessage("");
    setExtractionFlash(false);
    updateShareUrl(next);
  };

  const reparse = () => {
    const parsed = parseInclinedPlanePrompt(prompt);
    if (!parsed) {
      setParseMessage("Intuify currently supports inclined plane problems in this demo. Try one of the examples.");
      return;
    }

    setConfig(parsed.config);
    setFriction(parsed.friction);
    setTravelDistance(parsed.travelDistance);
    setOutcome(null);
    setParseMessage("Intuify extracted the variables and rebuilt the diagram.");
    setExtractionFlash(true);
    window.setTimeout(() => setExtractionFlash(false), 1000);
    saveHistory(prompt, parsed.config);
    setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
    updateShareUrl(parsed.config, prompt, parsed.friction, parsed.travelDistance);
  };

  const runDefaultDemo = () => {
    setConfig(PERFECT_SHOT);
    setFriction(DEFAULT_FRICTION);
    setTravelDistance(DEFAULT_DISTANCE);
    setOutcome(null);
    setParseMessage("");
    saveHistory(DEFAULT_PROMPT, PERFECT_SHOT);
    setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
    updateShareUrl(PERFECT_SHOT, DEFAULT_PROMPT, DEFAULT_FRICTION, DEFAULT_DISTANCE);
  };

  const shareLink = typeof window === "undefined" ? "" : window.location.href;
  const explanation = buildExplanation(config, outcome);
  const isInclinedPlane = config.type === "inclined_plane";

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex flex-col justify-between gap-4 rounded-lg border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur md:flex-row md:items-center">
          <div>
            <Link href="/" className="text-sm font-semibold text-[#216869]">Intuify</Link>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{isInclinedPlane ? "Inclined Plane Lab" : "Projectile knockdown lab"}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={runDefaultDemo} className="inline-flex items-center gap-2 rounded-md bg-[#f2c14e] px-4 py-2 font-bold text-slate-950 transition hover:bg-[#e0ad36]">
              <Sparkles size={18} />
              Run Inclined Plane Demo
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
              <button onClick={reparse} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 font-semibold text-white transition hover:bg-slate-800">
                <Clipboard size={17} />
                Parse Prompt
              </button>
              {parseMessage ? (
                <div className={`mt-3 rounded-md border p-3 text-sm font-semibold leading-5 ${parseMessage.startsWith("Intuify extracted") ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                  {parseMessage}
                </div>
              ) : null}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">AI Extraction</h2>
              <div className={`mt-3 space-y-2 rounded-md border p-3 text-sm transition ${extractionFlash ? "border-[#f2c14e] bg-[#f2c14e]/20 shadow-sm" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Detected problem type</span><span className="font-bold text-slate-950">{isInclinedPlane ? "Inclined plane" : "Projectile"}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Mass</span><span className="font-bold text-slate-950">{config.projectile.mass.toFixed(1)} kg</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Angle θ</span><span className="font-bold text-slate-950">{config.projectile.angle}°</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Friction μₖ</span><span className="font-bold text-slate-950">{friction.toFixed(2)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Distance d</span><span className="font-bold text-slate-950">{travelDistance.toFixed(1)} m</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Gravity g</span><span className="font-bold text-slate-950">{config.world.gravity.toFixed(1)} m/s²</span></div>
              </div>
              {isInclinedPlane ? (
                <div className="mt-3 rounded-md bg-[#216869]/10 p-3 text-xs font-semibold leading-5 text-[#174f50]">
                  Parsed problem details include μₖ and d, which drive the sliders, results, and share link for this demo.
                </div>
              ) : null}
              <details className="mt-3 rounded-md border border-slate-200 bg-white">
                <summary className="cursor-pointer px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">Developer JSON</summary>
                <pre className="max-h-72 overflow-auto border-t border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-emerald-100">{parserJson(config)}</pre>
                {isInclinedPlane ? (
                  <pre className="overflow-auto border-t border-slate-800 bg-slate-900 p-3 text-xs leading-5 text-amber-100">{JSON.stringify({ friction, travelDistance }, null, 2)}</pre>
                ) : null}
              </details>
            </section>
          </aside>

          <section>
            <MatterScene config={config} friction={friction} travelDistance={travelDistance} onOutcome={setOutcome} />
          </section>

          <aside className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Controls</h2>
              {isInclinedPlane ? (
                <div className="mt-4 space-y-5">
                  <label className="block">
                    <span className="flex justify-between text-sm font-semibold"><span>Angle</span><span>{config.projectile.angle} deg</span></span>
                    <input className="range mt-2 w-full" type="range" min="5" max="60" value={config.projectile.angle} onChange={(event) => updateConfig({ angle: Number(event.target.value) })} />
                  </label>
                  <label className="block">
                    <span className="flex justify-between text-sm font-semibold"><span>Friction coefficient</span><span>{friction.toFixed(2)}</span></span>
                    <input
                      className="range mt-2 w-full"
                      type="range"
                      min="0"
                      max="0.9"
                      step="0.01"
                      value={friction}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setFriction(next);
                        setOutcome(null);
                        setParseMessage("");
                        updateShareUrl(config, prompt, next, travelDistance);
                      }}
                    />
                  </label>
                  <label className="block">
                    <span className="flex justify-between text-sm font-semibold"><span>Mass</span><span>{config.projectile.mass.toFixed(1)} kg</span></span>
                    <input className="range mt-2 w-full" type="range" min="0.5" max="10" step="0.1" value={config.projectile.mass} onChange={(event) => updateConfig({ mass: Number(event.target.value) })} />
                  </label>
                  <label className="block">
                    <span className="flex justify-between text-sm font-semibold"><span>Travel distance</span><span>{travelDistance.toFixed(1)} m</span></span>
                    <input
                      className="range mt-2 w-full"
                      type="range"
                      min="1"
                      max="5"
                      step="0.1"
                      value={travelDistance}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setTravelDistance(next);
                        setOutcome(null);
                        setParseMessage("");
                        updateShareUrl(config, prompt, friction, next);
                      }}
                    />
                  </label>
                  <label className="block">
                    <span className="flex justify-between text-sm font-semibold"><span>Gravity</span><span>{config.world.gravity.toFixed(1)} m/s^2</span></span>
                    <input className="range mt-2 w-full" type="range" min="1" max="20" step="0.1" value={config.world.gravity} onChange={(event) => updateConfig({ gravity: Number(event.target.value) })} />
                  </label>
                </div>
              ) : (
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
                    <span className="flex justify-between text-sm font-semibold"><span>Gravity</span><span>{config.world.gravity.toFixed(1)} m/s^2</span></span>
                    <input className="range mt-2 w-full" type="range" min="1" max="20" step="0.1" value={config.world.gravity} onChange={(event) => updateConfig({ gravity: Number(event.target.value) })} />
                  </label>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Explanation</h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">{explanation}</p>
              {outcome?.launched && isInclinedPlane ? (
                <div className="mt-4 space-y-2 text-sm">
                  <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Acceleration:</span> {(outcome.metrics?.acceleration ?? 0).toFixed(2)} m/s^2</div>
                  <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Time over {travelDistance.toFixed(1)} m:</span> {outcome.metrics?.timeToBottom === null ? "No slide" : `${(outcome.metrics?.timeToBottom ?? 0).toFixed(2)} s`}</div>
                  <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Final velocity:</span> {(outcome.metrics?.finalSpeed ?? 0).toFixed(2)} m/s</div>
                </div>
              ) : null}
              {outcome?.launched && !isInclinedPlane ? (
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
                      setOutcome(null);
                      setParseMessage("");
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
