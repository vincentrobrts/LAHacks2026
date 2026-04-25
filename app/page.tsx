"use client";

import { ArrowRight, History, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parseWithAgentverse } from "@/lib/agentverse";
import { DEFAULT_CONFIGS, DEFAULT_PROMPT, DEMO_SHOT } from "@/lib/defaults";
import { encodeSimulation } from "@/lib/share";
import type { SimulationConfig, SimulationHistoryItem } from "@/types/simulation";

const HISTORY_KEY = "physics-visualizer-history";
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function extractAtwoodConfig(prompt: string): SimulationConfig | null {
  const lower = prompt.toLowerCase();
  const isAtwood = /table/.test(lower) && /pulley|hanging|connected/.test(lower);
  if (!isAtwood) return null;

  const kgValues = Array.from(lower.matchAll(/(\d+(?:\.\d+)?)\s*kg\b/g)).map((match) => Number(match[1]));
  const distance =
    lower.match(/(?:falls|fall|moves|travels|over)\s*(\d+(?:\.\d+)?)\s*(?:meter|meters|m)\b/)?.[1] ??
    lower.match(/(\d+(?:\.\d+)?)\s*(?:meter|meters|m)\b/)?.[1];
  const friction =
    lower.includes("frictionless")
      ? "0"
      : lower.match(/(?:Î¼|mu)\s*=\s*(\d+(?:\.\d+)?)/)?.[1] ??
        lower.match(/friction\D{0,40}(\d+(?:\.\d+)?)/)?.[1];
  const gravity = lower.match(/\bgravity\s*(?:is|=|of)?\s*(\d+(?:\.\d+)?)\b|\bg\s*=\s*(\d+(?:\.\d+)?)/);

  if (kgValues.length < 2 || !distance || friction === undefined) return null;

  const frictionValue = clamp(Number(friction), 0, 0.9);

  return {
    ...DEFAULT_CONFIGS.atwood_table,
    params: {
      mass1: clamp(kgValues[0], 0.5, 10),
      mass2: clamp(kgValues[1], 0.5, 10),
      friction: frictionValue,
      distance: clamp(Number(distance), 1, 5),
    },
    world: {
      gravity: gravity ? clamp(Number(gravity[1] ?? gravity[2]), 1, 20) : 9.8,
      friction: frictionValue,
    },
  };
}

const EXAMPLE_PROMPTS = [
  "A 5 kg block slides down a 30 degree incline with μk = 0.2 for 3 meters.",
  "A 2 kg crate slides down a 45 degree ramp with coefficient of kinetic friction 0.1 over 4 meters.",
  "A 4 kg block rests on a frictionless table and is connected over a pulley to a hanging 2 kg mass. How fast does the system accelerate if the hanging mass falls 3 meters?",
];

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
  }, []);

  const start = async (perfect = false) => {
    setMessage("");
    const config = perfect ? DEMO_SHOT : extractAtwoodConfig(prompt) ?? await parseWithAgentverse(prompt);
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
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl content-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#216869]/25 bg-white/70 px-3 py-2 text-sm font-semibold text-[#216869] shadow-sm">
            <Sparkles size={16} />
            LA Hacks 2026 demo MVP
          </div>
          <h1 className="max-w-3xl text-5xl font-black leading-tight text-slate-950 sm:text-6xl">
            Intuify
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
            Turn a textbook word problem into a live physics lab. Tune angle, friction, mass, and gravity, then watch the simulation run according to the equations.
          </p>

          <div className="mt-8 rounded-lg border border-white/75 bg-white/85 p-4 shadow-glow backdrop-blur">
            <label className="text-sm font-bold uppercase tracking-wide text-slate-500">Physics word problem</label>
            <textarea
              value={prompt}
              onChange={(event) => { setPrompt(event.target.value); setMessage(""); }}
              className="mt-3 min-h-32 w-full resize-none rounded-md border border-slate-300 bg-slate-50 p-4 text-base leading-7 outline-none transition focus:border-[#216869] focus:ring-4 focus:ring-[#216869]/15"
            />
            <div className="mt-3 grid gap-2">
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
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => start(false)} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-5 py-3 font-bold text-white shadow-sm transition hover:bg-[#1a5556]">
                Build Simulation
                <ArrowRight size={19} />
              </button>
              <button onClick={() => start(true)} className="inline-flex items-center gap-2 rounded-md bg-[#f2c14e] px-5 py-3 font-bold text-slate-950 transition hover:bg-[#e0ad36]">
                <Sparkles size={19} />
                Run Demo
              </button>
            </div>
            {message ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-5 text-amber-900">{message}</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-glow">
          <div className="aspect-[1.08] overflow-hidden rounded-md bg-[#eef5f1] p-5">
            <div className="relative h-full rounded-md">
              <svg viewBox="0 0 420 380" className="h-full w-full" role="img" aria-label="Inclined plane preview">
                <path d="M72 304 L354 304 L354 142 Z" fill="#dfe8e4" stroke="#172033" strokeWidth="5" />
                <path d="M72 304 L354 142" stroke="#172033" strokeWidth="8" strokeLinecap="round" />
                <g transform="translate(184 240) rotate(-30)">
                  <rect x="-35" y="-23" width="70" height="46" rx="6" fill="#216869" />
                  <rect x="-25" y="-13" width="50" height="26" rx="4" fill="#2e8b88" />
                </g>
                <line x1="184" y1="240" x2="184" y2="318" stroke="#c2410c" strokeWidth="5" strokeLinecap="round" />
                <line x1="184" y1="240" x2="224" y2="171" stroke="#1d4ed8" strokeWidth="5" strokeLinecap="round" />
                <line x1="184" y1="240" x2="118" y2="278" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" />
                <line x1="196" y1="262" x2="272" y2="218" stroke="#15803d" strokeWidth="5" strokeLinecap="round" />
                <path d="M262 304 A72 72 0 0 0 292 249" fill="none" stroke="#f2c14e" strokeWidth="5" />
                <text x="238" y="292" fill="#172033" fontSize="18" fontWeight="800">30 deg</text>
                <text x="42" y="54" fill="#172033" fontSize="17" fontWeight="800">Inclined Plane Visualizer</text>
                <text x="42" y="82" fill="#172033" fontSize="15">m = 5 kg, μₖ = 0.2, d = 3 m</text>
              </svg>
            </div>
          </div>
          <div className="mt-5">
            <h2 className="text-xl font-black text-slate-950">Physics from plain English</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The AI parser extracts angle, mass, friction, and gravity from your problem automatically. Share links encode state in the URL.
            </p>
          </div>
          <div className="mt-4 rounded-md bg-slate-100 p-4">
            <h3 className="inline-flex items-center gap-2 text-sm font-bold text-slate-700"><History size={16} /> Recent prompts</h3>
            <div className="mt-3 space-y-2">
              {history.length === 0 ? <p className="text-sm text-slate-500">No local history yet.</p> : null}
              {history.slice(0, 3).map((item) => (
                <button key={item.id} onClick={() => router.push(`/sim?state=${encodeSimulation(item.config, item.prompt)}`)} className="block w-full rounded-md bg-white p-3 text-left text-sm font-semibold text-slate-700 hover:text-[#216869]">
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
