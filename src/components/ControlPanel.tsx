import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Play,
  Pause,
  Orbit,
  Microscope,
  Grid3x3,
  Eye,
  Camera,
  Video,
  Layers,
  Info,
  Zap,
} from 'lucide-react';
import { PhysicsConfig } from '@/simulation/physics';
import { CameraMode } from '@/simulation/scene';

interface ControlPanelProps {
  config: PhysicsConfig;
  paused: boolean;
  cameraMode: CameraMode;
  autoRotate: boolean;
  updateConfig: (partial: Partial<PhysicsConfig>) => void;
  reset: () => void;
  togglePause: () => void;
  changeCameraMode: (mode: CameraMode) => void;
  toggleAutoRotate: () => void;
  forceCollision: () => void;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  tooltip,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  tooltip?: string;
}) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-slate-300">{label}</label>
          {tooltip && (
            <div className="relative" onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}>
              <Info className="w-3 h-3 text-slate-500 cursor-help" />
              {showTip && (
                <div className="absolute left-5 top-0 z-50 w-48 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-[10px] text-slate-300 shadow-xl">
                  {tooltip}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={Number(value.toFixed(step < 1 ? 2 : 0))}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-16 px-1.5 py-0.5 text-[11px] text-right bg-slate-800/80 border border-slate-700 rounded text-cyan-300 focus:outline-none focus:border-cyan-500"
          />
          {unit && <span className="text-[10px] text-slate-500 w-8">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer slider-cyan"
      />
    </div>
  );
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-5 first:mt-0">
      <div className="text-cyan-400">{icon}</div>
      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">{children}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-slate-700 to-transparent" />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
        active
          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
          : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function ControlPanel({
  config,
  paused,
  cameraMode,
  autoRotate,
  updateConfig,
  reset,
  togglePause,
  changeCameraMode,
  toggleAutoRotate,
  forceCollision,
}: ControlPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Collapse/expand toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-slate-900/90 border-y border-r border-slate-700/50 rounded-r-lg p-1.5 hover:bg-slate-800 transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4 text-cyan-400" /> : <ChevronLeft className="w-4 h-4 text-cyan-400" />}
      </button>

      {/* Panel */}
      <div
        className={`fixed left-0 top-0 bottom-0 w-80 z-30 transition-transform duration-300 ${
          collapsed ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        <div className="h-full bg-slate-950/95 backdrop-blur-xl border-r border-slate-800/80 overflow-y-auto custom-scroll">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/80 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center">
                <Orbit className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight">Binary Black Hole</h1>
                <p className="text-[10px] text-slate-500">Astrophysics Simulation Lab</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-5 py-4">
            {/* Playback controls */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={togglePause}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition-all text-xs font-medium"
              >
                {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                {paused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={reset}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all text-xs font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
            <button
              onClick={forceCollision}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-orange-600/80 to-red-600/80 text-white border border-orange-500/40 hover:from-orange-500 hover:to-red-500 transition-all text-xs font-semibold tracking-wide shadow-lg shadow-orange-900/30"
            >
              <Zap className="w-4 h-4 fill-orange-300" />
              Force Collision
            </button>

            {/* Simulation speed */}
            <SectionLabel icon={<Video className="w-3.5 h-3.5" />}>Simulation</SectionLabel>
            <Slider
              label="Time Speed"
              value={config.simSpeed}
              min={0}
              max={5}
              step={0.1}
              unit="x"
              onChange={(v) => updateConfig({ simSpeed: v })}
              tooltip="Accelerate or slow down the simulation. 0x freezes time, 1x is real-time."
            />

            {/* Black Hole 1 */}
            <SectionLabel icon={<Layers className="w-3.5 h-3.5" />}>Black Hole Alpha</SectionLabel>
            <Slider
              label="Mass"
              value={config.mass1}
              min={5}
              max={100}
              step={1}
              unit="M☉"
              onChange={(v) => updateConfig({ mass1: v })}
              tooltip="Mass of the first black hole in solar masses. Affects gravitational pull and event horizon size."
            />
            <Slider
              label="Spin"
              value={config.spin1}
              min={0}
              max={0.99}
              step={0.01}
              onChange={(v) => updateConfig({ spin1: v })}
              tooltip="Dimensionless spin parameter (0 = non-rotating, 1 = maximally rotating). Affects accretion disk dynamics."
            />

            {/* Black Hole 2 */}
            <SectionLabel icon={<Layers className="w-3.5 h-3.5" />}>Black Hole Beta</SectionLabel>
            <Slider
              label="Mass"
              value={config.mass2}
              min={5}
              max={100}
              step={1}
              unit="M☉"
              onChange={(v) => updateConfig({ mass2: v })}
              tooltip="Mass of the second black hole in solar masses."
            />
            <Slider
              label="Spin"
              value={config.spin2}
              min={0}
              max={0.99}
              step={0.01}
              onChange={(v) => updateConfig({ spin2: v })}
              tooltip="Dimensionless spin parameter for the second black hole."
            />

            {/* Orbital parameters */}
            <SectionLabel icon={<Orbit className="w-3.5 h-3.5" />}>Orbital Dynamics</SectionLabel>
            <Slider
              label="Initial Separation"
              value={config.separation}
              min={10}
              max={50}
              step={0.5}
              unit="AU"
              onChange={(v) => updateConfig({ separation: v })}
              tooltip="Initial distance between the two black holes. Smaller distances lead to faster mergers."
            />
            <Slider
              label="Collision Velocity"
              value={config.collisionVelocity}
              min={0.3}
              max={2.5}
              step={0.05}
              unit="x"
              onChange={(v) => updateConfig({ collisionVelocity: v })}
              tooltip="Multiplier for initial orbital velocity. Higher values create more energetic collisions."
            />

            {/* Accretion disk */}
            <SectionLabel icon={<Microscope className="w-3.5 h-3.5" />}>Accretion Disk</SectionLabel>
            <Slider
              label="Disk Temperature"
              value={config.temperature}
              min={1000}
              max={30000}
              step={100}
              unit="K"
              onChange={(v) => updateConfig({ temperature: v })}
              tooltip="Temperature of the accretion disk in Kelvin. Higher temperatures shift color toward blue/white."
            />

            {/* Visualization */}
            <SectionLabel icon={<Eye className="w-3.5 h-3.5" />}>Visualization</SectionLabel>
            <div className="flex flex-wrap gap-2 mb-3">
              <ToggleButton
                active={config.showGrid}
                onClick={() => updateConfig({ showGrid: !config.showGrid })}
                icon={<Grid3x3 className="w-3.5 h-3.5" />}
                label="Spacetime Grid"
              />
              <ToggleButton
                active={config.showLensing}
                onClick={() => updateConfig({ showLensing: !config.showLensing })}
                icon={<Eye className="w-3.5 h-3.5" />}
                label="Photon Rings"
              />
            </div>

            {/* Camera modes */}
            <SectionLabel icon={<Camera className="w-3.5 h-3.5" />}>Camera Mode</SectionLabel>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                onClick={() => changeCameraMode('cinematic')}
                className={`px-2 py-2 rounded-lg text-[10px] font-medium transition-all ${
                  cameraMode === 'cinematic'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800'
                }`}
              >
                Cinematic
              </button>
              <button
                onClick={() => changeCameraMode('scientific')}
                className={`px-2 py-2 rounded-lg text-[10px] font-medium transition-all ${
                  cameraMode === 'scientific'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800'
                }`}
              >
                Scientific
              </button>
              <button
                onClick={() => changeCameraMode('top')}
                className={`px-2 py-2 rounded-lg text-[10px] font-medium transition-all ${
                  cameraMode === 'top'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800'
                }`}
              >
                Top View
              </button>
            </div>
            <div className="flex gap-2">
              <ToggleButton
                active={autoRotate}
                onClick={toggleAutoRotate}
                icon={<Orbit className="w-3.5 h-3.5" />}
                label="Auto-Orbit"
              />
            </div>

            {/* Info */}
            <div className="mt-5 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Drag to orbit. Scroll to zoom. This simulation uses physically motivated
                approximations. Gravitational wave effects are visual representations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
