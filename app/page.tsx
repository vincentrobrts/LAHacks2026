"use client";

import { ArrowRight, History, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parseWithAgentverse } from "@/lib/agentverse";
import { DEFAULT_PROMPT, PERFECT_SHOT } from "@/lib/defaults";
import { encodeSimulation } from "@/lib/share";
import type { SimulationHistoryItem } from "@/types/simulation";

const HISTORY_KEY = "physics-visualizer-history";

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);

  useEffect(() => {
    setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
  }, []);

  const start = async (perfect = false) => {
    const config = perfect ? PERFECT_SHOT : await parseWithAgentverse(prompt);
    const nextPrompt = perfect ? "Run Perfect Shot demo" : prompt;
    const item: SimulationHistoryItem = {
      id: crypto.randomUUID(),
      prompt: nextPrompt,
      config,
      timestamp: new Date().toISOString()
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
            Physics Visualizer
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
            Turn a word problem into a live projectile-motion lab. Tune speed, angle, and gravity, then watch Matter.js decide whether one shot can topple the tower.
          </p>

          <div className="mt-8 rounded-lg border border-white/75 bg-white/85 p-4 shadow-glow backdrop-blur">
            <label className="text-sm font-bold uppercase tracking-wide text-slate-500">Physics word problem</label>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="mt-3 min-h-32 w-full resize-none rounded-md border border-slate-300 bg-slate-50 p-4 text-base leading-7 outline-none transition focus:border-[#216869] focus:ring-4 focus:ring-[#216869]/15"
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => start(false)} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-5 py-3 font-bold text-white shadow-sm transition hover:bg-[#1a5556]">
                Build Simulation
                <ArrowRight size={19} />
              </button>
              <button onClick={() => start(true)} className="inline-flex items-center gap-2 rounded-md bg-[#f2c14e] px-5 py-3 font-bold text-slate-950 transition hover:bg-[#e0ad36]">
                <Sparkles size={19} />
                Run Perfect Shot
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-glow">
          <div className="aspect-[1.08] overflow-hidden rounded-md bg-[#eef5f1] p-5">
            <div className="relative h-full rounded-md border-b-8 border-[#2f3d3f]">
              <svg viewBox="0 0 420 380" className="h-full w-full" role="img" aria-label="Projectile tower preview">
                <path d="M48 282 C150 105, 255 95, 344 208" fill="none" stroke="#216869" strokeWidth="6" strokeDasharray="12 12" strokeLinecap="round" />
                <line x1="42" y1="318" x2="92" y2="286" stroke="#172033" strokeWidth="10" strokeLinecap="round" />
                <circle cx="74" cy="292" r="20" fill="#eef5f1" stroke="#172033" strokeWidth="7" />
                {Array.from({ length: 8 }).map((_, row) =>
                  Array.from({ length: row < 4 ? 3 : 2 }).map((__, col) => (
                    <rect
                      key={`${row}-${col}`}
                      x={286 + col * 37 - (row < 4 ? 18 : 0)}
                      y={292 - row * 24}
                      width="34"
                      height="20"
                      rx="3"
                      fill={row % 2 === 0 ? "#d7603d" : "#f0a23d"}
                    />
                  ))
                )}
                <circle cx="48" cy="282" r="15" fill="#216869" />
              </svg>
            </div>
          </div>
          <div className="mt-5">
            <h2 className="text-xl font-black text-slate-950">Demo reliable by default</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The parser runs locally, share links encode state in the URL, and local history keeps the last prompts on this device.
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
