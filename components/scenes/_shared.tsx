"use client";

import { RotateCcw, Target, Zap } from "lucide-react";
import type { LaunchOutcome, SimulationConfig } from "@/types/simulation";

export type SceneProps = {
  config: SimulationConfig;
  onOutcome: (outcome: LaunchOutcome) => void;
};

export const SCENE_W = 760;
export const SCENE_H = 520;

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function fmt(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "--";
  return v.toFixed(digits);
}

export function ArrowMarker({ id, color = "currentColor" }: { id: string; color?: string }) {
  return (
    <marker id={id} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 Z" fill={color} />
    </marker>
  );
}

type StepCopy = { title: string; equation: string; notice: string; diagram: string };

export function GuidedBreakdown({
  step,
  steps,
  onStepChange,
}: {
  step: number;
  steps: StepCopy[];
  onStepChange: (n: number) => void;
}) {
  const copy = steps[step - 1];
  return (
    <section className="mt-4 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Guided Breakdown</div>
          <h3 className="mt-1 text-lg font-black text-slate-950">
            Step {step} / {steps.length}: {copy.title}
          </h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onStepChange(step - 1)}
            disabled={step === 1}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous Step
          </button>
          <button
            onClick={() => onStepChange(step + 1)}
            disabled={step === steps.length}
            className="rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next Step
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-md bg-slate-100 p-4 text-sm font-bold leading-6 text-slate-900">{copy.equation}</div>
        <p className="rounded-md bg-[#216869]/10 p-3 text-sm leading-6 text-slate-700">
          <span className="font-bold text-slate-950">Notice:</span> {copy.notice}
        </p>
        <p className="rounded-md bg-[#f2c14e]/20 p-3 text-sm leading-6 text-slate-700">
          <span className="font-bold text-slate-950">Diagram cue:</span> {copy.diagram}
        </p>
      </div>
    </section>
  );
}

export function SceneActions({
  running,
  onRun,
  onReset,
  runLabel = "Run",
  runningLabel = "Running…",
}: {
  running: boolean;
  onRun: () => void;
  onReset: () => void;
  runLabel?: string;
  runningLabel?: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <button
        onClick={onRun}
        disabled={running}
        className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#1a5556] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Zap size={18} />
        {running ? runningLabel : runLabel}
      </button>
      <button
        onClick={onReset}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-50"
      >
        <RotateCcw size={18} />
        Reset
      </button>
      <div className="inline-flex items-center gap-2 rounded-md bg-[#f2c14e]/20 px-3 py-2 text-sm font-semibold text-slate-800">
        <Target size={17} />
        Textbook Equations
      </div>
    </div>
  );
}

export function InfoPanels({
  given,
  equations,
  results,
}: {
  given: [string, string][];
  equations: string[];
  results: [string, string, string?][];
}) {
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Textbook Model</h3>
        <div className="mt-3 grid gap-4 text-sm text-slate-700 md:grid-cols-[0.85fr_1.3fr_0.85fr]">
          <div>
            <div className="font-bold text-slate-900">Given</div>
            <p className="mt-2 leading-7">
              {given.map(([k, v]) => (
                <span key={k}>
                  {k} = {v}
                  <br />
                </span>
              ))}
            </p>
          </div>
          <div>
            <div className="font-bold text-slate-900">Equations</div>
            <div className="mt-2 space-y-2">
              {equations.map((eq) => (
                <div key={eq} className="rounded-md bg-white px-3 py-2 font-semibold leading-6 text-slate-900">
                  {eq}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="font-bold text-slate-900">Results</div>
            <p className="mt-2 leading-7">
              {results.map(([k, v]) => (
                <span key={k}>
                  {k} = {v}
                  <br />
                </span>
              ))}
            </p>
          </div>
        </div>
      </section>
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Results</h3>
        <div className="mt-3 space-y-2 text-sm">
          {results.map(([k, v, color]) => (
            <div
              key={k}
              className={`rounded-md p-3 ${color === "green" ? "bg-[#216869]/10 text-[#174f50]" : "bg-slate-100"}`}
            >
              <span className="font-bold">{k}:</span> {v}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
