// Physics engine for binary black hole simulation
// Uses physically motivated approximations (NOT full numerical relativity)

export const C = 299_792_458; // speed of light, m/s
export const G = 6.674e-11; // gravitational constant, m^3 kg^-1 s^-2
export const SOLAR_MASS = 1.989e30; // kg
export const PARSEC = 3.0857e16; // meters

export type Phase = 'inspiral' | 'merger' | 'ringdown' | 'merged';

export interface BlackHoleState {
  mass: number; // in solar masses
  spin: number; // dimensionless spin parameter 0..1
  position: [number, number, number]; // simulation units
  velocity: [number, number, number];
  radius: number; // Schwarzschild radius in simulation units
}

export interface PhysicsConfig {
  mass1: number; // solar masses
  mass2: number; // solar masses
  spin1: number;
  spin2: number;
  separation: number; // initial separation in simulation units
  collisionVelocity: number; // multiplier for initial orbital velocity
  temperature: number; // accretion disk temperature in Kelvin
  simSpeed: number; // simulation speed multiplier
  showGrid: boolean;
  showLensing: boolean;
}

export interface PhysicsData {
  bh1: BlackHoleState;
  bh2: BlackHoleState;
  merged: BlackHoleState | null;
  phase: Phase;
  separationDistance: number; // in simulation units
  orbitalVelocity: number; // m/s (approximate)
  elapsed: number; // seconds of simulation time
  gravWaveStrain: number; // dimensionless strain amplitude
  gravWaveFreq: number; // Hz
  energyRadiated: number; // solar masses
  finalMass: number; // solar masses
  finalSpin: number;
  mergerProgress: number; // 0..1 during merger
  ringdownProgress: number; // 0..1 during ringdown
}

// Schwarzschild radius in meters
export function schwarzschildRadiusMeters(massSolar: number): number {
  const massKg = massSolar * SOLAR_MASS;
  return (2 * G * massKg) / (C * C);
}

// Convert solar masses to simulation-space radius scale
// We scale so a 10 solar mass BH has radius ~1 unit
export function massToRadius(massSolar: number): number {
  return Math.pow(massSolar / 10, 1 / 3);
}

// Temperature to color (blackbody approximation)
export function temperatureToRGB(tempK: number): [number, number, number] {
  // Approximate blackbody color from temperature
  const t = Math.max(1000, Math.min(40000, tempK)) / 100;
  let r: number, g: number, b: number;

  if (t <= 66) {
    r = 255;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
  }

  if (t <= 66) {
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
  } else {
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  }

  if (t >= 66) {
    b = 255;
  } else if (t <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  }

  return [
    Math.max(0, Math.min(255, r)) / 255,
    Math.max(0, Math.min(255, g)) / 255,
    Math.max(0, Math.min(255, b)) / 255,
  ];
}

export class BinaryBlackHolePhysics {
  config: PhysicsConfig;
  data: PhysicsData;
  private time: number = 0;
  private mergerStartTime: number = 0;
  private ringdownStartTime: number = 0;
  private mergedTime: number = 0;

  constructor(config: PhysicsConfig) {
    this.config = config;
    this.data = this.initData();
  }

  private initData(): PhysicsData {
    const r1 = massToRadius(this.config.mass1);
    const r2 = massToRadius(this.config.mass2);
    const sep = this.config.separation;
    const m1 = this.config.mass1;
    const m2 = this.config.mass2;
    const total = m1 + m2;

    // Place BHs on either side of center of mass
    const d1 = (m2 / total) * sep;
    const d2 = (m1 / total) * sep;

    // Orbital velocity for circular orbit: v = sqrt(GM_total / r)
    // We use sim units where G_sim is tuned for visual effect
    const G_sim = 50; // tuned constant for simulation space
    const v = Math.sqrt((G_sim * total) / sep) * this.config.collisionVelocity;

    return {
      bh1: {
        mass: m1,
        spin: this.config.spin1,
        position: [-d1, 0, 0],
        velocity: [0, 0, v],
        radius: r1,
      },
      bh2: {
        mass: m2,
        spin: this.config.spin2,
        position: [d2, 0, 0],
        velocity: [0, 0, -v],
        radius: r2,
      },
      merged: null,
      phase: 'inspiral',
      separationDistance: sep,
      orbitalVelocity: 0,
      elapsed: 0,
      gravWaveStrain: 0,
      gravWaveFreq: 0,
      energyRadiated: 0,
      finalMass: 0,
      finalSpin: 0,
      mergerProgress: 0,
      ringdownProgress: 0,
    };
  }

  forceCollision(): void {
    if (this.data.phase !== 'inspiral') return;
    const { bh1, bh2 } = this.data;
    const dx = bh2.position[0] - bh1.position[0];
    const dy = bh2.position[1] - bh1.position[1];
    const dz = bh2.position[2] - bh1.position[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 0.01) return;

    // Boost both black holes directly toward each other
    const boost = 15 + dist * 0.8;
    const ux = dx / dist;
    const uy = dy / dist;
    const uz = dz / dist;

    bh1.velocity[0] += ux * boost;
    bh1.velocity[1] += uy * boost;
    bh1.velocity[2] += uz * boost;
    bh2.velocity[0] -= ux * boost;
    bh2.velocity[1] -= uy * boost;
    bh2.velocity[2] -= uz * boost;
  }

  reset(config?: Partial<PhysicsConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.time = 0;
    this.data = this.initData();
  }

  update(dt: number): void {
    const speed = this.config.simSpeed;
    const simDt = dt * speed;
    this.time += simDt;
    this.data.elapsed = this.time;

    const { bh1, bh2 } = this.data;

    if (this.data.phase === 'inspiral') {
      this.updateInspiral(simDt);
    } else if (this.data.phase === 'merger') {
      this.updateMerger(simDt);
    } else if (this.data.phase === 'ringdown') {
      this.updateRingdown(simDt);
    } else if (this.data.phase === 'merged') {
      this.updateMerged(simDt);
    }

    this.computeGravitationalWaves();
  }

  private updateInspiral(dt: number): void {
    const { bh1, bh2 } = this.data;
    const G_sim = 50;
    const m1 = bh1.mass;
    const m2 = bh2.mass;

    const dx = bh2.position[0] - bh1.position[0];
    const dy = bh2.position[1] - bh1.position[1];
    const dz = bh2.position[2] - bh1.position[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const distSq = Math.max(dist * dist, 0.01);

    this.data.separationDistance = dist;

    // Gravitational force
    const F = (G_sim * m1 * m2) / distSq;
    const fx = (F * dx) / dist;
    const fy = (F * dy) / dist;
    const fz = (F * dz) / dist;

    // Accelerations
    const a1x = fx / m1;
    const a1y = fy / m1;
    const a1z = fz / m1;
    const a2x = -fx / m2;
    const a2y = -fy / m2;
    const a2z = -fz / m2;

    // Gravitational wave back-reaction: energy loss causes inspiral
    // P_gw ∝ (m1*m2)^2 * (m1+m2) / r^5 (quadrupole formula)
    const gwPower =
      (Math.pow(m1 * m2, 2) * (m1 + m2)) / Math.pow(dist, 5) * 0.0001;
    const inspiralFactor = 1 + gwPower * 100;

    // Update velocities
    bh1.velocity[0] += a1x * dt;
    bh1.velocity[1] += a1y * dt;
    bh1.velocity[2] += a1z * dt;
    bh2.velocity[0] += a2x * dt;
    bh2.velocity[1] += a2y * dt;
    bh2.velocity[2] += a2z * dt;

    // Update positions
    bh1.position[0] += bh1.velocity[0] * dt;
    bh1.position[1] += bh1.velocity[1] * dt;
    bh1.position[2] += bh1.velocity[2] * dt;
    bh2.position[0] += bh2.velocity[0] * dt;
    bh2.position[1] += bh2.velocity[1] * dt;
    bh2.position[2] += bh2.velocity[2] * dt;

    // Orbital velocity estimate
    const v1 = Math.sqrt(
      bh1.velocity[0] ** 2 +
        bh1.velocity[1] ** 2 +
        bh1.velocity[2] ** 2,
    );
    const v2 = Math.sqrt(
      bh2.velocity[0] ** 2 +
        bh2.velocity[1] ** 2 +
        bh2.velocity[2] ** 2,
    );
    this.data.orbitalVelocity = (v1 + v2) * 1000; // scale to m/s for display

    // Check for merger condition: when separation < sum of radii * 1.5
    const mergeThreshold = (bh1.radius + bh2.radius) * 1.5;
    if (dist < mergeThreshold) {
      this.data.phase = 'merger';
      this.mergerStartTime = this.time;
      this.data.mergerProgress = 0;
    }
  }

  private updateMerger(dt: number): void {
    const progress = Math.min(1, (this.time - this.mergerStartTime) / 0.8);
    this.data.mergerProgress = progress;

    // Spiral the BHs together rapidly
    const { bh1, bh2 } = this.data;
    const angle = progress * Math.PI * 4;
    const r = (1 - progress) * (bh1.radius + bh2.radius) * 0.8;

    const cx =
      (bh1.mass * bh1.position[0] + bh2.mass * bh2.position[0]) /
      (bh1.mass + bh2.mass);
    const cy =
      (bh1.mass * bh1.position[1] + bh2.mass * bh2.position[1]) /
      (bh1.mass + bh2.mass);
    const cz =
      (bh1.mass * bh1.position[2] + bh2.mass * bh2.position[2]) /
      (bh1.mass + bh2.mass);

    bh1.position = [
      cx + r * Math.cos(angle) * (bh2.mass / (bh1.mass + bh2.mass)),
      cy,
      cz + r * Math.sin(angle) * (bh2.mass / (bh1.mass + bh2.mass)),
    ];
    bh2.position = [
      cx - r * Math.cos(angle) * (bh1.mass / (bh1.mass + bh2.mass)),
      cy,
      cz - r * Math.sin(angle) * (bh1.mass / (bh1.mass + bh2.mass)),
    ];

    if (progress >= 1) {
      // Create merged black hole
      const totalMass = bh1.mass + bh2.mass;
      // Energy radiated as gravitational waves: ~3-5% of total mass
      const radiatedFraction = 0.03 + 0.02 * Math.min(1, totalMass / 100);
      const energyRadiated = totalMass * radiatedFraction;
      const finalMass = totalMass - energyRadiated;

      // Final spin from angular momentum conservation (simplified)
      const L1 = bh1.spin * bh1.mass * bh1.mass;
      const L2 = bh2.spin * bh2.spin * bh2.mass * bh2.mass;
      const finalSpin = Math.min(
        0.99,
        (L1 + L2) / (finalMass * finalMass) + 0.3,
      );

      this.data.merged = {
        mass: finalMass,
        spin: finalSpin,
        position: [cx, cy, cz],
        velocity: [0, 0, 0],
        radius: massToRadius(finalMass) * 1.3,
      };
      this.data.finalMass = finalMass;
      this.data.finalSpin = finalSpin;
      this.data.energyRadiated = energyRadiated;
      this.data.phase = 'ringdown';
      this.ringdownStartTime = this.time;
      this.data.ringdownProgress = 0;
    }
  }

  private updateRingdown(dt: number): void {
    const progress = Math.min(1, (this.time - this.ringdownStartTime) / 2.0);
    this.data.ringdownProgress = progress;

    if (this.data.merged) {
      // Oscillating ringdown - slight wobble that decays
      const wobble = (1 - progress) * 0.15 * Math.sin(progress * Math.PI * 8);
      this.data.merged.radius =
        massToRadius(this.data.merged.mass) * 1.3 * (1 + wobble);
    }

    if (progress >= 1) {
      this.data.phase = 'merged';
      this.mergedTime = this.time;
    }
  }

  private updateMerged(dt: number): void {
    // Stable merged black hole, just spin
    if (this.data.merged) {
      this.data.merged.radius = massToRadius(this.data.merged.mass) * 1.3;
    }
  }

  private computeGravitationalWaves(): void {
    const { bh1, bh2 } = this.data;
    let totalMass: number;
    let dist: number;

    if (this.data.merged && this.data.phase !== 'inspiral') {
      totalMass = this.data.merged.mass;
      dist = 0;
    } else {
      totalMass = bh1.mass + bh2.mass;
      const dx = bh2.position[0] - bh1.position[0];
      const dy = bh2.position[1] - bh1.position[1];
      const dz = bh2.position[2] - bh1.position[2];
      dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    if (this.data.phase === 'inspiral' && dist > 0) {
      // GW frequency is 2x orbital frequency
      const v = Math.sqrt(
        bh1.velocity[0] ** 2 +
          bh1.velocity[1] ** 2 +
          bh1.velocity[2] ** 2,
      );
      const orbitalFreq = v / (2 * Math.PI * Math.max(dist, 0.1));
      this.data.gravWaveFreq = orbitalFreq * 2 * 50; // scale for display

      // Strain amplitude h ~ (GM/rc^2)^(2/3) * (orbital_freq)^(2/3)
      const strainBase = Math.pow(totalMass / Math.max(dist, 0.1), 0.667);
      this.data.gravWaveStrain = strainBase * 0.01;
    } else if (this.data.phase === 'merger') {
      this.data.gravWaveFreq = 250 + this.data.mergerProgress * 200;
      this.data.gravWaveStrain = 0.5 * (1 - this.data.mergerProgress * 0.3);
    } else if (this.data.phase === 'ringdown') {
      const decay = 1 - this.data.ringdownProgress;
      this.data.gravWaveFreq = 300 * decay;
      this.data.gravWaveStrain = 0.3 * decay * decay;
    } else {
      this.data.gravWaveStrain *= 0.95;
      this.data.gravWaveFreq *= 0.95;
    }
  }
}
