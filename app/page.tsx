"use client";

import { ArrowRight, History, Sparkles, Layers } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parseWithAgentverse } from "@/lib/agentverse";
import { DEFAULT_CONFIGS, DEFAULT_PROMPT, DEMO_SHOT } from "@/lib/defaults";
import { encodeSimulation } from "@/lib/share";
import type { SimulationConfig, SimulationHistoryItem } from "@/types/simulation";

const HISTORY_KEY = "physics-visualizer-history";

const EXAMPLE_PROMPTS = [
  "A 5 kg block slides down a 30 degree incline with μₖ = 0.2 for 3 meters.",
  "A 4 kg block rests on a frictionless table and is connected over a pulley to a hanging 2 kg mass. How fast does the system accelerate if the hanging mass falls 3 meters?",
  "Problem: Two point charges are placed 2 meters apart. Charge 1: +3 μC. Charge 2: −2 μC. Question: What is the magnitude of the force between them? Is the force attractive or repulsive?",
];

const ATWOOD_PROMPT = EXAMPLE_PROMPTS[1];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeAtwoodConfig(config: SimulationConfig, prompt: string): SimulationConfig {
  const lower = prompt.toLowerCase();
  const atwoodLike = /\b(pulley|hanging|connected|table)\b/.test(lower) && /\bkg|mass|block\b/.test(lower);
  if (config.type !== "atwood_table" && !atwoodLike) return config;

  const number = "([0-9]+(?:\\.[0-9]+)?)";
  const blockMatch = lower.match(new RegExp(`${number}\\s*kg\\s+(?:block|cart|object|mass)`));
  const hangingMatch = lower.match(new RegExp(`hanging\\s+${number}\\s*kg`)) ?? lower.match(new RegExp(`${number}\\s*kg\\s+hanging`));
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
      ...(distanceMatch ? { distance: clamp(Number(distanceMatch[1]), 1, 5) } : {}),
      ...(frictionless ? { friction: 0 } : frictionMatch ? { friction: clamp(Number(frictionMatch[1]), 0, 0.9) } : {}),
    },
    world: { ...config.world, friction: frictionless ? 0 : config.world?.friction ?? 0 },
  };
}

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
  }, []);

  const isCompoundPrompt = (text: string) => {
    const t = text.toLowerCase();
    const multiResistor = (t.match(/\br\d+\b/g) ?? []).length >= 2 || t.includes(" series");
    const compoundPulley = t.includes("pulley") && (t.includes("ramp") || t.includes("spring"));
    return (
      compoundPulley ||
      (t.includes("ramp") && t.includes("connected")) ||
      multiResistor ||
      (t.includes("spring") && t.includes("pulley"))
    );
  };

  const start = async (perfect = false) => {
    setMessage("");
    if (!perfect && isCompoundPrompt(prompt)) {
      router.push(`/compound?prompt=${encodeURIComponent(prompt)}`);
      return;
    }
    const parsed = perfect ? DEMO_SHOT : prompt === ATWOOD_PROMPT ? DEFAULT_CONFIGS.atwood_table : await parseWithAgentverse(prompt);
    const config = perfect || prompt === ATWOOD_PROMPT ? parsed : normalizeAtwoodConfig(parsed, prompt);
    const nextPrompt = perfect ? DEFAULT_PROMPT : prompt;
    const item: SimulationHistoryItem = {
      id: crypto.randomUUID(),
      prompt: nextPrompt,
      config,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(HISTORY_KEY, JSON.stringify([item, ...history].slice(0, 8)));
    router.push(`/sim?state=${encodeSimulation(config, nextPrompt)}`);
  };

  return (
    <main className="min-h-screen px-4 py-5 sm:px-5 lg:px-6">
      <section className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-5xl content-center gap-7 lg:grid-cols-[1.05fr_0.85fr] lg:items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-[#216869]">Intuify</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
            From text to physics in real time
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">
            Explore how systems behave, not just how they’re solved.
          </p>

          <div className="mt-5 rounded-lg border border-white/75 bg-white/85 p-3 shadow-glow backdrop-blur">
            <label className="text-sm font-bold uppercase tracking-wide text-slate-500">Physics word problem</label>
            <textarea
              value={prompt}
              onChange={(event) => { setPrompt(event.target.value); setMessage(""); }}
              className="mt-2 min-h-24 w-full resize-none rounded-md border border-slate-300 bg-slate-50 p-3 text-sm leading-6 outline-none transition focus:border-[#216869] focus:ring-4 focus:ring-[#216869]/15"
            />
            <div className="mt-2 grid gap-2">
              {EXAMPLE_PROMPTS.map((example, index) => (
                <button
                  key={example}
                  onClick={() => { setPrompt(example); setMessage(""); }}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold leading-5 text-slate-700 transition hover:border-[#216869] hover:bg-white"
                >
                  Example {index + 1}: {example}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button onClick={() => start(false)} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#1a5556]">
                Build Simulation
                <ArrowRight size={19} />
              </button>
            </div>
            {message ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-5 text-amber-900">{message}</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-glow">
          <div className="aspect-[1.08] overflow-hidden rounded-md bg-[#eef5f1] p-4">
            <div className="relative h-full rounded-md">
              <svg viewBox="0 0 420 380" className="h-full w-full" role="img" aria-label="Interactive physics preview">
                <defs>
                  <marker id="preview-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                    <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
                  </marker>
                </defs>
                <text x="34" y="48" fill="#172033" fontSize="18" fontWeight="900">Interactive incline</text>
                <text x="34" y="74" fill="#475569" fontSize="14">m = 5 kg, μₖ = 0.2, d = 3 m</text>
                <path d="M74 306 L356 306 L356 144 Z" fill="#dfe8e4" stroke="#172033" strokeWidth="5" />
                <path d="M74 306 L356 144" stroke="#172033" strokeWidth="8" strokeLinecap="round" />
                <g transform="translate(205 205)">
                  <g>
                    <animateTransform attributeName="transform" type="translate" values="0 0; -7 4; 0 0" dur="3.2s" repeatCount="indefinite" />
                    <g transform="rotate(-30)">
                      <rect x="-35" y="-23" width="70" height="46" rx="6" fill="#216869" />
                      <rect x="-25" y="-13" width="50" height="26" rx="4" fill="#2e8b88" />
                    </g>
                  </g>
                </g>
                <g className="animate-pulse" strokeLinecap="round" strokeWidth="5" markerEnd="url(#preview-arrow)">
                  <line x1="205" y1="205" x2="205" y2="280" stroke="#c2410c" />
                  <line x1="197" y1="199" x2="164" y2="140" stroke="#1d4ed8" />
                  <line x1="218" y1="218" x2="282" y2="181" stroke="#7c3aed" />
                </g>
                <text x="214" y="276" fill="#9a3412" fontSize="13" fontWeight="800">mg</text>
                <text x="132" y="140" fill="#1d4ed8" fontSize="13" fontWeight="800">N</text>
                <text x="286" y="181" fill="#6d28d9" fontSize="13" fontWeight="800">friction</text>
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <h2 className="text-lg font-black text-slate-950">Live system</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Start with a problem, then interact with the system it creates.
            </p>
          </div>
          <div className="mt-3 rounded-md bg-slate-100 p-3">
            <h3 className="inline-flex items-center gap-2 text-sm font-bold text-slate-700"><History size={16} /> Recent prompts</h3>
            <div className="mt-3 space-y-2">
              {history.length === 0 ? <p className="text-sm text-slate-500">No local history yet.</p> : null}
              {history.slice(0, 3).map((item) => (
                <button 
                  key={item.id} 
                  onClick={() => router.push(`/sim?state=${encodeSimulation(item.config, item.prompt)}`)} 
                  className="block w-full rounded-md bg-white p-3 text-left text-sm font-semibold text-slate-700 hover:text-[#216869]">
                  {item.prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}