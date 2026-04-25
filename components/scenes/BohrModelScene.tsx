"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimulationConfig } from "@/types/simulation";
import {
  clamp, fmt, GuidedBreakdown, InfoPanels, SceneActions,
  SCENE_H, SCENE_W, type SceneProps,
} from "./_shared";

const A0 = 0.0529e-9; // Bohr radius in meters (just for reference)
const E_RYDBERG = 13.6; // eV

function metrics(config: SimulationConfig) {
  const Z = Math.round(clamp(config.params.atomic_number ?? 1, 1, 10));
  const ni = Math.round(clamp(config.params.n_initial ?? 3, 1, 7));
  const nf = Math.round(clamp(config.params.n_final ?? 1, 1, 6));
  const Ei = -E_RYDBERG * Z * Z / (ni * ni);
  const Ef = -E_RYDBERG * Z * Z / (nf * nf);
  const dE = Ef - Ei; // negative = emission, positive = absorption
  const emission = dE < 0;
  const lambda_nm = Math.abs(dE) > 0.001 ? 1240 / Math.abs(dE) : Infinity;
  return { Z, ni, nf, Ei, Ef, dE, emission, lambda_nm };
}

const STEPS = [
  {
    title: "Energy Levels",
    equation: "Eₙ = −13.6Z²/n² eV",
    notice: "Energy levels are quantized and negative — bound electrons need energy to escape.",
    diagram: "The rings represent allowed orbits. Larger n = higher orbit = closer to zero (less bound).",
  },
  {
    title: "Transition",
    equation: "ΔE = Eₙ_f − Eₙ_i",
    notice: "When an electron jumps between levels, it must absorb or emit a photon with exactly |ΔE|.",
    diagram: "The arrow shows the electron's transition. Downward = emission (photon released).",
  },
  {
    title: "Photon Wavelength",
    equation: "λ = 1240 / |ΔE| nm",
    notice: "Larger energy jumps produce shorter-wavelength (higher-energy) photons.",
    diagram: "The photon wavelength determines its color — UV for large jumps in hydrogen.",
  },
  {
    title: "Electron Orbit",
    equation: "rₙ = n²a₀/Z",
    notice: "The electron orbits at a quantized radius that grows as n² and shrinks for heavier atoms.",
    diagram: "Watch the electron orbiting its assigned shell. The orbit radius scales with n².",
  },
];

const CX = SCENE_W / 2;
const CY = SCENE_H / 2 + 10;
const ORBIT_SCALE = 40; // pixels per n²
const MAX_N = 6;

export default function BohrModelScene({ config, onOutcome }: SceneProps) {
  const m = useMemo(() => metrics(config), [config]);
  const [guidedStep, setGuidedStep] = useState(1);
  const [running, setRunning] = useState(false);
  const [electronAngle, setElectronAngle] = useState(0);
  const [currentN, setCurrentN] = useState(m.ni);
  const [transitioning, setTransitioning] = useState(false);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const orbitR = (n: number) => clamp(n * n * ORBIT_SCALE, 30, 220);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setElectronAngle(0);
    setCurrentN(m.ni);
    setTransitioning(false);
    startRef.current = null;
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [m.Z, m.ni, m.nf, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    startRef.current = null;
    setRunning(true);
    setCurrentN(m.ni);
    setTransitioning(false);
    let transitioned = false;

    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = (now - startRef.current) / 1000;

      // Electron orbital speed: proportional to 1/n² (Bohr model)
      const omega = 4 / (currentN * currentN);
      const angle = omega * elapsed * 2;
      setElectronAngle(angle);

      // Trigger transition after 2 orbits
      if (!transitioned && elapsed > (2 * Math.PI * 2) / omega) {
        transitioned = true;
        setTransitioning(true);
        setTimeout(() => {
          setCurrentN(m.nf);
          setTransitioning(false);
          startRef.current = now + 500;
        }, 800);
      }

      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    onOutcome({ launched: true, success: true, metrics: { dE: m.dE, lambda_nm: m.lambda_nm } });
  }, [m, currentN, onOutcome]);

  const reset = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setElectronAngle(0);
    setCurrentN(m.ni);
    setTransitioning(false);
    startRef.current = null;
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [m.ni, onOutcome]);

  const goToStep = (s: number) => {
    setGuidedStep(clamp(s, 1, 4));
    if (s >= 2 && !running) run();
  };

  const electronR = orbitR(currentN);
  const ex = CX + electronR * Math.cos(electronAngle);
  const ey = CY + electronR * Math.sin(electronAngle);

  // Photon wavelength → approximate color
  const photonColor = (() => {
    const l = m.lambda_nm;
    if (l < 380) return "#8b5cf6"; // UV-ish
    if (l < 450) return "#6366f1";
    if (l < 500) return "#3b82f6";
    if (l < 565) return "#22c55e";
    if (l < 620) return "#f59e0b";
    if (l < 750) return "#ef4444";
    return "#fca5a5"; // IR
  })();

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#0f172a]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-label="Bohr model visualization">
          <rect width={SCENE_W} height={SCENE_H} fill="#0f172a" />

          {/* Orbital rings */}
          {Array.from({ length: Math.min(MAX_N, 6) }, (_, i) => {
            const n = i + 1;
            const r = orbitR(n);
            const isInitial = n === m.ni;
            const isFinal = n === m.nf;
            return (
              <circle
                key={n}
                cx={CX} cy={CY} r={r}
                fill="none"
                stroke={isInitial ? "#f2c14e" : isFinal ? "#22c55e" : "#334155"}
                strokeWidth={isInitial || isFinal ? 2 : 1}
                strokeDasharray={isInitial || isFinal ? "none" : "4 4"}
              />
            );
          })}

          {/* Energy level labels */}
          {Array.from({ length: Math.min(MAX_N, 6) }, (_, i) => {
            const n = i + 1;
            const r = orbitR(n);
            const En = -E_RYDBERG * m.Z * m.Z / (n * n);
            return (
              <text key={n} x={CX + r + 6} y={CY + 4} fill="#64748b" fontSize="11">
                n={n} ({fmt(En, 1)} eV)
              </text>
            );
          })}

          {/* Transition arrow (step 2+) */}
          {guidedStep >= 2 && (
            <line
              x1={CX + orbitR(m.ni)} y1={CY}
              x2={CX + orbitR(m.nf)} y2={CY}
              stroke={m.emission ? "#ef4444" : "#22c55e"}
              strokeWidth="3"
              markerEnd={m.emission ? "url(#bh-emit)" : "url(#bh-abs)"}
            />
          )}

          {/* Photon wavelength indicator (step 3+) */}
          {guidedStep >= 3 && Number.isFinite(m.lambda_nm) && (
            <g>
              <circle cx={CX} cy={CY - orbitR(m.nf) - 36} r={14} fill={photonColor} opacity="0.9" />
              <text x={CX} y={CY - orbitR(m.nf) - 55} textAnchor="middle" fill={photonColor} fontSize="13" fontWeight="700">
                γ {fmt(m.lambda_nm, 0)} nm
              </text>
            </g>
          )}

          {/* Transition flash */}
          {transitioning && (
            <circle cx={CX} cy={CY} r={electronR} fill="none" stroke={photonColor} strokeWidth="6" opacity="0.6" className="animate-ping" />
          )}

          {/* Nucleus */}
          <circle cx={CX} cy={CY} r={18} fill="#f97316" />
          <text x={CX} y={CY + 5} textAnchor="middle" fill="white" fontSize="13" fontWeight="900">
            {m.Z}p
          </text>

          {/* Electron */}
          <circle cx={ex} cy={ey} r={8} fill="#60a5fa" />

          {/* Info */}
          <text x={24} y={36} fill="#e2e8f0" fontSize="14" fontWeight="700">Z = {m.Z}</text>
          <text x={24} y={58} fill="#f2c14e" fontSize="14" fontWeight="700">n_i = {m.ni}  →  n_f = {m.nf}</text>
          <text x={24} y={80} fill={m.emission ? "#f87171" : "#86efac"} fontSize="14" fontWeight="700">
            {m.emission ? "Emission" : "Absorption"}: {fmt(Math.abs(m.dE), 3)} eV
          </text>

          <defs>
            <marker id="bh-emit" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#ef4444" />
            </marker>
            <marker id="bh-abs" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#22c55e" />
            </marker>
          </defs>
        </svg>
      </div>
      <SceneActions running={running} onRun={run} onReset={reset} runLabel="Trigger Transition" runningLabel="Orbiting…" />
      <GuidedBreakdown step={guidedStep} steps={STEPS} onStepChange={goToStep} />
      <InfoPanels
        given={[["Z", `${m.Z}`], ["n_i", `${m.ni}`], ["n_f", `${m.nf}`]]}
        equations={["Eₙ = −13.6Z²/n²", "ΔE = Eₙf − Eₙi", "λ = 1240/|ΔE| nm"]}
        results={[
          ["E(n_i)", `${fmt(m.Ei, 3)} eV`],
          ["E(n_f)", `${fmt(m.Ef, 3)} eV`],
          [m.emission ? "Emitted energy" : "Absorbed energy", `${fmt(Math.abs(m.dE), 3)} eV`, "green"],
          ["Photon wavelength λ", `${Number.isFinite(m.lambda_nm) ? fmt(m.lambda_nm, 1) + " nm" : "∞ (same level)"}`],
        ]}
      />
    </div>
  );
}
