import { useSimulation } from '@/hooks/useSimulation';
import { ControlPanel } from '@/components/ControlPanel';
import { DataPanel } from '@/components/DataPanel';
import { useEffect, useState } from 'react';
import { Atom } from 'lucide-react';

export default function App() {
  const sim = useSimulation();
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none">
      {/* 3D Canvas */}
      <canvas
        ref={sim.canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: 'grab' }}
      />

      {/* Control Panel (left) */}
      <ControlPanel
        config={sim.config}
        paused={sim.paused}
        cameraMode={sim.cameraMode}
        autoRotate={sim.autoRotate}
        updateConfig={sim.updateConfig}
        reset={sim.reset}
        togglePause={sim.togglePause}
        changeCameraMode={sim.changeCameraMode}
        toggleAutoRotate={sim.toggleAutoRotate}
        forceCollision={sim.forceCollision}
      />

      {/* Data Panel (right) */}
      <DataPanel data={sim.data} />

      {/* Phase indicator (bottom center) */}
      {sim.data && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-slate-950/80 backdrop-blur-xl border border-slate-800/80">
            <PhaseDot active={sim.data.phase === 'inspiral'} label="Inspiral" />
            <div className="w-6 h-px bg-slate-700" />
            <PhaseDot active={sim.data.phase === 'merger'} label="Merger" />
            <div className="w-6 h-px bg-slate-700" />
            <PhaseDot active={sim.data.phase === 'ringdown'} label="Ringdown" />
            <div className="w-6 h-px bg-slate-700" />
            <PhaseDot active={sim.data.phase === 'merged'} label="Merged" />
          </div>
        </div>
      )}

      {/* Intro overlay */}
      {showIntro && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black pointer-events-none"
          style={{ animation: 'fadeOut 0.8s ease-in 2.7s forwards' }}
        >
          <div className="text-center" style={{ animation: 'fadeInUp 1s ease-out' }}>
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-black border-2 border-cyan-500/50" />
                <div className="absolute inset-0 rounded-full border-2 border-orange-500/40 animate-ping" />
                <Atom className="absolute inset-0 m-auto w-8 h-8 text-cyan-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
              Binary Black Hole Simulation
            </h1>
            <p className="text-sm text-slate-400">Interactive Astrophysics Laboratory</p>
          </div>
        </div>
      )}

      {/* Top gradient overlay for depth */}
      <div className="fixed top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/40 to-transparent pointer-events-none z-10" />
      <div className="fixed bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/40 to-transparent pointer-events-none z-10" />
    </div>
  );
}

function PhaseDot({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2 h-2 rounded-full transition-all duration-300 ${
          active ? 'bg-cyan-400 scale-125 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-slate-700'
        }`}
      />
      <span
        className={`text-[10px] font-medium transition-colors duration-300 ${
          active ? 'text-cyan-300' : 'text-slate-600'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
