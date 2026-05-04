"use client";

import { RotateCcw, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import type { LaunchOutcome, SimulationConfig } from "@/types/simulation";

type Props = {
  config: SimulationConfig;
  onOutcome: (outcome: LaunchOutcome) => void;
};

const WIDTH = 760;
const HEIGHT = 520;

export default function PlaceholderScene({ config, onOutcome }: Props) {
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [config, onOutcome, runId]);

  return (
    <div className="rounded-xl bg-white/85 p-3 shadow-glow ring-1 ring-slate-200/60">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <canvas
          width={WIDTH}
          height={HEIGHT}
          className="aspect-[1.46] w-full"
          ref={(canvas) => {
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.clearRect(0, 0, WIDTH, HEIGHT);
            ctx.fillStyle = "#eef5f1";
            ctx.fillRect(0, 0, WIDTH, HEIGHT);
            ctx.fillStyle = "#2f3d3f";
            ctx.fillRect(0, HEIGHT - 40, WIDTH, 40);
            ctx.fillStyle = "#172033";
            ctx.font = "bold 22px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`Scene: ${config.type.replace(/_/g, " ")}`, WIDTH / 2, HEIGHT / 2 - 20);
            ctx.font = "16px sans-serif";
            ctx.fillStyle = "#216869";
            ctx.fillText("Person B: wire up the Matter.js scene here", WIDTH / 2, HEIGHT / 2 + 16);
          }}
        />
      </div>
      <div className="mt-4 flex gap-3">
        <button onClick={() => { onOutcome({ launched: true, success: true, metrics: {} }); }} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#1a5556]">
          <Zap size={18} /> Launch
        </button>
        <button onClick={() => setRunId((id) => id + 1)} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-50">
          <RotateCcw size={18} /> Reset
        </button>
      </div>
    </div>
  );
}
