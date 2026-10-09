import { useRef, useState, useEffect, useCallback } from 'react';
import { SceneManager, CameraMode } from '@/simulation/scene';
import { BinaryBlackHolePhysics, PhysicsConfig, PhysicsData } from '@/simulation/physics';

const defaultConfig: PhysicsConfig = {
  mass1: 30,
  mass2: 25,
  spin1: 0.5,
  spin2: 0.3,
  separation: 25,
  collisionVelocity: 1.0,
  temperature: 8000,
  simSpeed: 1.0,
  showGrid: true,
  showLensing: true,
};

export function useSimulation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneManager | null>(null);
  const rafRef = useRef<number>(0);
  const [data, setData] = useState<PhysicsData | null>(null);
  const [config, setConfig] = useState<PhysicsConfig>(defaultConfig);
  const [paused, setPaused] = useState(false);
  const [cameraMode, setCameraModeState] = useState<CameraMode>('cinematic');
  const [autoRotate, setAutoRotate] = useState(true);

  // Refs to avoid stale closures in the animation loop
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  useEffect(() => {
    if (!canvasRef.current) return;

    const physics = new BinaryBlackHolePhysics(defaultConfig);
    const scene = new SceneManager(canvasRef.current, physics);
    sceneRef.current = scene;

    const loop = () => {
      const s = sceneRef.current;
      if (!s) return;
      if (!pausedRef.current) {
        const d = s.update();
        setData(d);
      } else {
        s.renderer.render(s.scene, s.camera);
        setData(s.physics.data);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const onResize = () => sceneRef.current?.resize();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      sceneRef.current?.dispose();
    };
  }, []);

  const updateConfig = useCallback((partial: Partial<PhysicsConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
    sceneRef.current?.updateConfig(partial);
  }, []);

  const reset = useCallback(() => {
    sceneRef.current?.reset();
  }, []);

  const togglePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const changeCameraMode = useCallback((mode: CameraMode) => {
    setCameraModeState(mode);
    sceneRef.current?.setCameraMode(mode);
  }, []);

  const toggleAutoRotate = useCallback(() => {
    setAutoRotate((prev) => {
      const next = !prev;
      sceneRef.current?.setAutoRotate(next);
      return next;
    });
  }, []);

  const forceCollision = useCallback(() => {
    sceneRef.current?.forceCollision();
  }, []);

  return {
    canvasRef,
    data,
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
  };
}
