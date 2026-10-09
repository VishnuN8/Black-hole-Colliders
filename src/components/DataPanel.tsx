import {
  ChevronRight,
  ChevronLeft,
  Circle,
  Zap,
  Activity,
  Timer,
  Waves,
  Atom,
  Gauge,
  Ruler,
  Thermometer,
} from 'lucide-react';
import { PhysicsData, schwarzschildRadiusMeters } from '@/simulation/physics';
import { useState } from 'react';

interface DataPanelProps {
  data: PhysicsData | null;
}

function formatNum(n: number, decimals = 2): string {
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(decimals)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(decimals)}k`;
  return n.toFixed(decimals);
}

function formatTime(s: number): string {
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${(s % 60).toFixed(0)}s`;
}

function DataCard({
  icon,
  label,
  value,
  unit,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  accent: string;
}) {
  return (
    <div className="px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={accent}>{icon}</span>
        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-bold text-white tabular-nums">{value}</span>
        {unit && <span className="text-[10px] text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

function BlackHoleStats({
  name,
  color,
  mass,
  spin,
  radius,
  velocity,
}: {
  name: string;
  color: string;
  mass: number;
  spin: number;
  radius: number;
  velocity: number;
}) {
  const rsMeters = schwarzschildRadiusMeters(mass);
  return (
    <div className="rounded-xl bg-slate-900/50 border border-slate-800/80 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/60">
        <Circle className={`w-2.5 h-2.5 ${color} fill-current`} />
        <span className="text-[11px] font-semibold text-slate-200">{name}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Mass</div>
          <div className="text-xs font-bold text-white tabular-nums">{mass.toFixed(1)} <span className="text-slate-500 font-normal">M☉</span></div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Spin</div>
          <div className="text-xs font-bold text-white tabular-nums">{spin.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Schwarzschild R</div>
          <div className="text-xs font-bold text-white tabular-nums">{formatNum(rsMeters / 1000)} <span className="text-slate-500 font-normal">km</span></div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Orbital Velocity</div>
          <div className="text-xs font-bold text-white tabular-nums">{formatNum(velocity / 1000)} <span className="text-slate-500 font-normal">km/s</span></div>
        </div>
      </div>
    </div>
  );
}

const phaseColors: Record<string, string> = {
  inspiral: 'text-cyan-400',
  merger: 'text-orange-400',
  ringdown: 'text-amber-400',
  merged: 'text-emerald-400',
};

const phaseLabels: Record<string, string> = {
  inspiral: 'Inspiral',
  merger: 'Merger',
  ringdown: 'Ringdown',
  merged: 'Merged',
};

export function DataPanel({ data }: DataPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!data) return null;

  const showMerged = data.phase === 'ringdown' || data.phase === 'merged';

  return (
    <>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-slate-900/90 border-y border-l border-slate-700/50 rounded-l-lg p-1.5 hover:bg-slate-800 transition-colors"
      >
        {collapsed ? <ChevronLeft className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4 text-cyan-400" />}
      </button>

      <div
        className={`fixed right-0 top-0 bottom-0 w-72 z-30 transition-transform duration-300 ${
          collapsed ? 'translate-x-full' : 'translate-x-0'
        }`}
      >
        <div className="h-full bg-slate-950/95 backdrop-blur-xl border-l border-slate-800/80 overflow-y-auto custom-scroll">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/80 px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-white">Live Data</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${phaseColors[data.phase]} bg-current animate-pulse`} />
                <span className={`text-[10px] font-semibold ${phaseColors[data.phase]}`}>
                  {phaseLabels[data.phase]}
                </span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 py-4 space-y-3">
            {/* Elapsed time */}
            <DataCard
              icon={<Timer className="w-3 h-3" />}
              label="Elapsed Time"
              value={formatTime(data.elapsed)}
              accent="text-cyan-400"
            />

            {/* Separation */}
            {!showMerged && (
              <DataCard
                icon={<Ruler className="w-3 h-3" />}
                label="Separation Distance"
                value={data.separationDistance.toFixed(2)}
                unit="sim units"
                accent="text-blue-400"
              />
            )}

            {/* Orbital velocity */}
            {!showMerged && (
              <DataCard
                icon={<Gauge className="w-3 h-3" />}
                label="Orbital Velocity"
                value={formatNum(data.orbitalVelocity / 1000)}
                unit="km/s"
                accent="text-blue-400"
              />
            )}

            {/* Black hole stats */}
            {!showMerged ? (
              <div className="space-y-2.5">
                <BlackHoleStats
                  name="Black Hole Alpha"
                  color="text-cyan-400"
                  mass={data.bh1.mass}
                  spin={data.bh1.spin}
                  radius={data.bh1.radius}
                  velocity={data.orbitalVelocity * (data.bh2.mass / (data.bh1.mass + data.bh2.mass))}
                />
                <BlackHoleStats
                  name="Black Hole Beta"
                  color="text-orange-400"
                  mass={data.bh2.mass}
                  spin={data.bh2.spin}
                  radius={data.bh2.radius}
                  velocity={data.orbitalVelocity * (data.bh1.mass / (data.bh1.mass + data.bh2.mass))}
                />
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Merged BH stats */}
                {data.merged && (
                  <div className="rounded-xl bg-gradient-to-br from-emerald-900/30 to-slate-900/50 border border-emerald-800/40 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-emerald-800/30">
                      <Atom className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[11px] font-semibold text-emerald-200">Merged Black Hole</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-3">
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Final Mass</div>
                        <div className="text-xs font-bold text-white tabular-nums">{data.merged.mass.toFixed(2)} <span className="text-slate-500 font-normal">M☉</span></div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Final Spin</div>
                        <div className="text-xs font-bold text-white tabular-nums">{data.merged.spin.toFixed(3)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Schwarzschild R</div>
                        <div className="text-xs font-bold text-white tabular-nums">{formatNum(schwarzschildRadiusMeters(data.merged.mass) / 1000)} <span className="text-slate-500 font-normal">km</span></div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Energy Radiated</div>
                        <div className="text-xs font-bold text-orange-300 tabular-nums">{data.energyRadiated.toFixed(2)} <span className="text-slate-500 font-normal">M☉</span></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Gravitational waves */}
            <div className="rounded-xl bg-slate-900/50 border border-slate-800/80 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/60">
                <Waves className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[11px] font-semibold text-slate-200">Gravitational Waves</span>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Strain Amplitude</div>
                  <div className="text-xs font-bold text-white tabular-nums">{data.gravWaveStrain.toFixed(4)}</div>
                  {/* Strain bar */}
                  <div className="mt-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-100"
                      style={{ width: `${Math.min(100, data.gravWaveStrain * 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Frequency</div>
                  <div className="text-xs font-bold text-white tabular-nums">{formatNum(data.gravWaveFreq)} <span className="text-slate-500 font-normal">Hz</span></div>
                  {/* Freq bar */}
                  <div className="mt-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-400 to-blue-400 transition-all duration-100"
                      style={{ width: `${Math.min(100, (data.gravWaveFreq / 500) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Merger progress */}
            {(data.phase === 'merger' || data.phase === 'ringdown') && (
              <div className="rounded-xl bg-slate-900/50 border border-slate-800/80 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-[11px] font-semibold text-slate-200">
                    {data.phase === 'merger' ? 'Merger Progress' : 'Ringdown Progress'}
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${
                      data.phase === 'merger'
                        ? 'bg-gradient-to-r from-orange-500 to-red-500'
                        : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    }`}
                    style={{
                      width: `${(data.phase === 'merger' ? data.mergerProgress : data.ringdownProgress) * 100}%`,
                    }}
                  />
                </div>
                <div className="mt-1 text-right text-[10px] text-slate-500 tabular-nums">
                  {((data.phase === 'merger' ? data.mergerProgress : data.ringdownProgress) * 100).toFixed(0)}%
                </div>
              </div>
            )}

            {/* Energy radiated */}
            {showMerged && (
              <DataCard
                icon={<Thermometer className="w-3 h-3" />}
                label="Mass-Energy Radiated as GW"
                value={data.energyRadiated.toFixed(3)}
                unit="M☉ (≈ 5%)"
                accent="text-orange-400"
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
