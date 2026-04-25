"use client";

import { RotateCcw, Target, Zap } from "lucide-react";
import Matter from "matter-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LaunchOutcome, SimulationConfig } from "@/types/simulation";

type Props = {
  config: SimulationConfig;
  onOutcome: (outcome: LaunchOutcome) => void;
};

const WIDTH = 760;
const HEIGHT = 520;
const GROUND_Y = 462;
const LAUNCHER = { x: 92, y: GROUND_Y - 32 };
const TOWER_X = 600;

function velocityFromConfig(config: SimulationConfig) {
  const radians = (config.projectile.angle * Math.PI) / 180;
  return {
    x: Math.cos(radians) * config.projectile.speed,
    y: -Math.sin(radians) * config.projectile.speed
  };
}

function trajectoryPoints(config: SimulationConfig) {
  const velocity = velocityFromConfig(config);
  const gravity = config.world.gravity * 0.028;
  return Array.from({ length: 44 }, (_, index) => {
    const t = index * 4.8;
    return {
      x: LAUNCHER.x + velocity.x * t,
      y: LAUNCHER.y + velocity.y * t + 0.5 * gravity * t * t
    };
  }).filter((point) => point.x < WIDTH - 20 && point.y < GROUND_Y);
}

export default function MatterScene({ config, onOutcome }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const blocksRef = useRef<Matter.Body[]>([]);
  const projectileRef = useRef<Matter.Body | null>(null);
  const [runId, setRunId] = useState(0);

  const points = useMemo(() => trajectoryPoints(config), [config]);

  const buildWorld = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    Matter.Composite.clear(engine.world, false);
    engine.gravity.y = config.world.gravity / 9.8;

    const ground = Matter.Bodies.rectangle(WIDTH / 2, GROUND_Y + 30, WIDTH + 80, 60, {
      isStatic: true,
      render: { fillStyle: "#2f3d3f" }
    });
    const backstop = Matter.Bodies.rectangle(WIDTH - 8, HEIGHT / 2, 16, HEIGHT, {
      isStatic: true,
      render: { fillStyle: "transparent" }
    });

    const blocks: Matter.Body[] = [];
    const blockWidth = 46;
    const blockHeight = 24;
    const rows = Math.min(config.world.towerBlocks, 14);

    for (let row = 0; row < rows; row += 1) {
      const offset = row % 2 === 0 ? 0 : blockWidth / 2;
      const count = row < 4 ? 3 : 2;
      for (let col = 0; col < count; col += 1) {
        const x = TOWER_X + (col - (count - 1) / 2) * blockWidth + offset * 0.35;
        const y = GROUND_Y - blockHeight / 2 - row * (blockHeight + 1);
        blocks.push(
          Matter.Bodies.rectangle(x, y, blockWidth, blockHeight, {
            density: 0.003,
            friction: 0.75,
            restitution: 0.08,
            chamfer: { radius: 3 },
            render: { fillStyle: row % 2 === 0 ? "#d7603d" : "#f0a23d" }
          })
        );
      }
    }

    blocksRef.current = blocks;
    projectileRef.current = null;
    Matter.Composite.add(engine.world, [ground, backstop, ...blocks]);
  }, [config]);

  useEffect(() => {
    if (!containerRef.current) return;

    const engine = Matter.Engine.create({ enableSleeping: false });
    const render = Matter.Render.create({
      element: containerRef.current,
      engine,
      options: {
        width: WIDTH,
        height: HEIGHT,
        background: "#eef5f1",
        wireframes: false,
        pixelRatio: window.devicePixelRatio
      }
    });
    const runner = Matter.Runner.create();

    engineRef.current = engine;
    renderRef.current = render;
    runnerRef.current = runner;

    Matter.Render.run(render);
    Matter.Runner.run(runner, engine);

    return () => {
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      render.canvas.remove();
      render.textures = {};
    };
  }, []);

  useEffect(() => {
    buildWorld();
    onOutcome({ launched: false, blocksMoved: 0, success: false, peakHeight: 0, flightDistance: 0 });
  }, [buildWorld, onOutcome, runId]);

  const launch = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (projectileRef.current) {
      Matter.Composite.remove(engine.world, projectileRef.current);
    }

    const projectile = Matter.Bodies.circle(LAUNCHER.x, LAUNCHER.y, 15, {
      density: 0.012 * config.projectile.mass,
      frictionAir: 0.004,
      restitution: 0.18,
      render: { fillStyle: "#216869" }
    });
    projectileRef.current = projectile;
    Matter.Composite.add(engine.world, projectile);
    Matter.Body.setVelocity(projectile, velocityFromConfig(config));

    window.setTimeout(() => {
      const moved = blocksRef.current.filter((block) => {
        const dx = Math.abs(block.position.x - TOWER_X);
        const dy = Math.abs(block.angle);
        return dx > 18 || dy > 0.18 || block.position.y > GROUND_Y - 10;
      }).length;
      onOutcome({
        launched: true,
        blocksMoved: moved,
        success: moved >= Math.max(4, Math.round(config.world.towerBlocks * 0.7)),
        peakHeight: Math.max(0, Math.round(GROUND_Y - Math.min(...points.map((point) => point.y)))),
        flightDistance: Math.round((config.projectile.speed ** 2 * Math.sin((2 * config.projectile.angle * Math.PI) / 180)) / config.world.gravity)
      });
    }, 2600);
  }, [config, onOutcome, points]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <div ref={containerRef} className="canvas-shell aspect-[1.46] w-full" />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
          <polyline
            points={points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke="#216869"
            strokeDasharray="8 8"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <line x1="58" y1={GROUND_Y - 8} x2="128" y2={GROUND_Y - 45} stroke="#172033" strokeWidth="7" strokeLinecap="round" />
          <circle cx={LAUNCHER.x} cy={LAUNCHER.y} r="18" fill="none" stroke="#172033" strokeWidth="4" />
          <text x="500" y="70" fill="#172033" fontSize="18" fontWeight="700">Block tower</text>
          <text x="55" y="365" fill="#172033" fontSize="18" fontWeight="700">Launcher</text>
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={launch} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#1a5556]">
          <Zap size={18} />
          Launch
        </button>
        <button onClick={() => setRunId((id) => id + 1)} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-50">
          <RotateCcw size={18} />
          Reset
        </button>
        <div className="inline-flex items-center gap-2 rounded-md bg-[#f2c14e]/20 px-3 py-2 text-sm font-semibold text-slate-800">
          <Target size={17} />
          Preview updates live
        </div>
      </div>
    </div>
  );
}
