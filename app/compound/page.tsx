"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import CustomScene, { buildWorldFromScene } from "@/components/scenes/CustomScene";
import CircuitScene from "@/components/scenes/CircuitScene";
import PulleyScene from "@/components/scenes/PulleyScene";
import { RampAtwoodScene, DoubleRampScene, SpringAtwoodScene } from "@/components/scenes/CompoundScenes";
import { buildFromParsed } from "@/lib/physics/builder";
import { encodeSimulation } from "@/lib/share";
import { validateParsedCompound } from "@/lib/simulations/schema";
import type { BuiltScene } from "@/lib/physics/builder";
import type { LaunchOutcome } from "@/types/simulation";


const EXAMPLES = [
  "A 3 kg mass on a 30 degree ramp with friction μ=0.2 is connected by a rope over a pulley to a 2 kg hanging mass.",
  "Two masses 5 kg and 3 kg hang over a frictionless pulley (Atwood machine).",
  "A spring with k=40 N/m connects a wall to a 2 kg block on a horizontal rail. A rope over a pulley connects the block to a 1.5 kg hanging mass.",
  "A 4 kg mass on a 40 degree ramp is connected by rope over a pulley to a 2 kg mass on a 20 degree ramp.",
  "A 9V battery in series with a 10 ohm resistor and a 20 ohm resistor.",
  "12V battery with R1=5Ω, R2=10Ω, R3=15Ω in series.",
];

function isCompoundNeeded(text: string): boolean {
  const t = text.toLowerCase();
  const hasPulley = /\bpulley\b/.test(t);
  const hasBattery = /\bbattery\b/.test(t);
  const multiKg = (t.match(/\b\d+(?:\.\d+)?\s*kg\b/g) ?? []).length >= 2;
  const multiResistor =
    (t.match(/\d+(?:\.\d+)?\s*(?:ohm|Ω|ω)/gi) ?? []).length >= 2 ||
    (t.match(/\br\d+\b/g) ?? []).length >= 2 ||
    (t.match(/\bresist/g) ?? []).length >= 2;

  // table + pulley + hanging mass = atomic atwood_table, not compound
  const isAtwoodTable =
    /\b(table|surface|horizontal)\b/.test(t) &&
    hasPulley &&
    multiKg &&
    !/\bramp\b|\bincline\b|\bslope\b|\bspring\b/.test(t);
  if (isAtwoodTable) return false;

  return (
    (hasPulley && multiKg) ||
    (hasPulley && /\bramp\b|\bincline\b|\bslope\b/.test(t)) ||
    (hasPulley && /\bspring\b/.test(t)) ||
    (hasBattery && multiResistor)
  );
}

function CompoundPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [prompt, setPrompt] = useState(() => searchParams.get("prompt") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [built, setBuilt] = useState<BuiltScene | null>(null);
  const [outcome, setOutcome] = useState<LaunchOutcome | null>(null);
  const [sceneKey, setSceneKey] = useState(0);

  // Auto-submit if prompt came from URL
  useEffect(() => {
    const urlPrompt = searchParams.get("prompt");
    if (urlPrompt) parse(urlPrompt);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const parse = async (text: string) => {
    setLoading(true);
    setError("");
    setBuilt(null);
    setOutcome(null);

    // Try atomic sim first when the prompt doesn't require compound elements
    if (!isCompoundNeeded(text)) {
      try {
        const res = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text }),
        });
        if (res.ok) {
          const config = await res.json();
          setLoading(false);
          router.push(`/sim?state=${encodeSimulation(config, text)}`);
          return;
        }
      } catch {
        // fall through to compound parsing
      }
    }

    try {
      const res = await fetch("/api/parse-compound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const parsed = validateParsedCompound(await res.json());
      if (!parsed) throw new Error("Invalid component graph");
      const result = buildFromParsed(parsed);
      setBuilt(result);
      setSceneKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (prompt.trim()) parse(prompt.trim());
  };

  const handleExample = (ex: string) => {
    setPrompt(ex);
    parse(ex);
  };

  const circuitSolution = built?.circuitSolution ?? null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-950">Compound Physics Lab</h1>
            <p className="text-sm text-slate-500">Describe any system in plain English — masses, ramps, pulleys, springs, circuits</p>
          </div>
        </div>

        {/* Text input */}
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Describe the system</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleSubmit(); }}
            placeholder="e.g. a 3 kg mass on a 30° ramp connected by rope over a pulley to a 2 kg hanging mass"
            className="mt-2 min-h-[80px] w-full resize-none rounded-md border border-slate-300 bg-slate-50 p-3 text-sm leading-6 outline-none transition focus:border-[#216869] focus:ring-4 focus:ring-[#216869]/15"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleSubmit}
              disabled={loading || !prompt.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#1a5556] disabled:opacity-50"
            >
              {loading ? "Building…" : "Build System"}
              {!loading && <ArrowRight size={15} />}
            </button>
          </div>
          {error && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}
        </div>

        {/* Example prompts */}
        <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => handleExample(ex)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold leading-4 text-slate-700 transition hover:border-[#216869] hover:bg-white"
            >
              <span className="mr-1 text-slate-400">#{i + 1}</span>
              {ex}
            </button>
          ))}
        </div>

        {/* Results */}
        {built && (
          <>
            {/* Component graph */}
            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Detected System</div>
              <div className="mb-2 text-sm font-semibold text-slate-800">{built.scene.label}</div>
              <div className="flex flex-wrap items-center gap-2">
                {built.scene.components.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <div className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
                      c.kind === "mass" ? "bg-[#216869]/10 border-[#216869]/30 text-[#216869]" :
                      c.kind === "ramp" ? "bg-slate-100 border-slate-300 text-slate-700" :
                      c.kind === "pulley" ? "bg-amber-50 border-amber-200 text-amber-800" :
                      c.kind === "spring" ? "bg-purple-50 border-purple-200 text-purple-800" :
                      c.kind === "battery" ? "bg-red-50 border-red-200 text-red-800" :
                      c.kind === "resistor" ? "bg-blue-50 border-blue-200 text-blue-800" :
                      c.kind === "capacitor" ? "bg-green-50 border-green-200 text-green-800" :
                      "bg-slate-100 border-slate-300 text-slate-700"
                    }`}>
                      <span className="text-xs opacity-60 mr-1">{c.kind}</span>
                      {c.label}
                    </div>
                    {built.scene.connections
                      .filter((conn) => conn.from === c.id)
                      .map((conn) => (
                        <span key={conn.from + conn.to} className="font-mono text-sm text-slate-400">
                          —{conn.label}→
                        </span>
                      ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Simulation or circuit */}
            {built.sceneType === "atwood" && built.atwoodParams ? (
              <PulleyScene
                key={`${built.scene.id}-${sceneKey}`}
                config={{
                  type: "pulley",
                  params: {
                    mass1: built.atwoodParams.m1,
                    mass2: built.atwoodParams.m2,
                    radius: 0.15,
                    pulley_mass: 0.5,
                  },
                  world: { gravity: 9.8, friction: 0 },
                  explanationGoal: "Show how mass difference drives acceleration in an Atwood machine.",
                }}
                onOutcome={setOutcome}
              />
            ) : built.sceneType === "rampAtwood" && built.sceneParams ? (
              <RampAtwoodScene
                key={`${built.scene.id}-${sceneKey}`}
                params={built.sceneParams}
                onOutcome={setOutcome}
                label={built.scene.label}
              />
            ) : built.sceneType === "doubleRamp" && built.sceneParams ? (
              <DoubleRampScene
                key={`${built.scene.id}-${sceneKey}`}
                params={built.sceneParams}
                onOutcome={setOutcome}
                label={built.scene.label}
              />
            ) : built.sceneType === "springAtwood" && built.sceneParams ? (
              <SpringAtwoodScene
                key={`${built.scene.id}-${sceneKey}`}
                params={built.sceneParams}
                onOutcome={setOutcome}
                label={built.scene.label}
              />
            ) : built.world ? (
              <CustomScene
                key={`${built.scene.id}-${sceneKey}`}
                scene={built.scene}
                world={buildWorldFromScene(built.scene)}
                onOutcome={setOutcome}
              />
            ) : circuitSolution ? (
              <CircuitScene scene={built.scene} solution={circuitSolution} />
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Could not build a simulation from this description. Try being more specific about masses, angles, or connections.
              </div>
            )}
          </>
        )}

        {/* Initial placeholder */}
        {!built && !loading && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
            <Sparkles size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-semibold">Describe a physics system above and click Build System</p>
            <p className="mt-1 text-xs">Supports ramp-Atwood machines, double ramps, spring systems, Atwood machines, and series circuits</p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function CompoundPage() {
  return (
    <Suspense>
      <CompoundPageInner />
    </Suspense>
  );
}
