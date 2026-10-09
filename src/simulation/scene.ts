import * as THREE from 'three';
import {
  BinaryBlackHolePhysics,
  PhysicsData,
  massToRadius,
} from './physics';
import {
  createDiskMaterial,
  gridVertexShader,
  gridFragmentShader,
  starVertexShader,
  starFragmentShader,
  photonRingVertexShader,
  photonRingFragmentShader,
  nebulaFragmentShader,
  nebulaVertexShader,
} from './shaders';

export type CameraMode = 'cinematic' | 'scientific' | 'top';

export class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  physics: BinaryBlackHolePhysics;

  // Objects
  private bhGroup1: THREE.Group;
  private bhGroup2: THREE.Group;
  private mergedGroup: THREE.Group | null = null;
  private disk1: THREE.Mesh;
  private disk2: THREE.Mesh;
  private mergedDisk: THREE.Mesh | null = null;
  private starField: THREE.Points;
  private nebulaMesh: THREE.Mesh;
  private gridMesh: THREE.Mesh;
  private gridMaterial: THREE.ShaderMaterial;
  private gwParticles: THREE.Points;
  private gwParticleData: Float32Array;
  private gwParticleVel: Float32Array;
  private gwCount = 3000;

  // Camera control
  private cameraMode: CameraMode = 'cinematic';
  private cameraAngle = 0;
  private cameraElevation = 0.3;
  private cameraDistance = 60;
  private cameraTarget = new THREE.Vector3(0, 0, 0);
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private autoRotate = true;

  // Clock
  private clock = new THREE.Clock();
  private accumTime = 0;

  // Particle effects for merger
  private burstParticles: THREE.Points | null = null;
  private burstLife = 0;

  constructor(
    canvas: HTMLCanvasElement,
    physics: BinaryBlackHolePhysics,
  ) {
    this.physics = physics;
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      2000,
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000005, 1);

    // Create scene objects
    this.nebulaMesh = this.createNebula();
    this.starField = this.createStarField(8000);
    this.gridMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBh1Pos: { value: new THREE.Vector3() },
        uBh2Pos: { value: new THREE.Vector3() },
        uBh1Mass: { value: 10 },
        uBh2Mass: { value: 10 },
        uMergedPos: { value: new THREE.Vector3() },
        uMergedPosition: { value: new THREE.Vector3() },
        uMergedMass: { value: 0 },
        uHasMerged: { value: 0 },
        uColor: { value: new THREE.Color(0.15, 0.3, 0.6) },
      },
      vertexShader: gridVertexShader,
      fragmentShader: gridFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.gridMesh = this.createGrid();

    const bhData = this.createBlackHole(1.0, physics.config.temperature, physics.config.spin1);
    this.bhGroup1 = bhData.group;
    this.disk1 = bhData.disk;

    const bhData2 = this.createBlackHole(1.0, physics.config.temperature, physics.config.spin2);
    this.bhGroup2 = bhData2.group;
    this.disk2 = bhData2.disk;

    this.scene.add(this.nebulaMesh);
    this.scene.add(this.starField);
    this.scene.add(this.gridMesh);
    this.scene.add(this.bhGroup1);
    this.scene.add(this.bhGroup2);

    // Gravitational wave particles
    const gwResult = this.createGWParticles();
    this.gwParticles = gwResult.points;
    this.gwParticleData = gwResult.positions;
    this.gwParticleVel = gwResult.velocities;
    this.scene.add(this.gwParticles);

    this.updateCamera();
    this.setupControls(canvas);
  }

  private createNebula(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        },
      },
      vertexShader: nebulaVertexShader,
      fragmentShader: nebulaFragmentShader,
      depthWrite: false,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -100;
    return mesh;
  }

  private createStarField(count: number): THREE.Points {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Distribute on a large sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 400 + Math.random() * 500;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Star color: mostly white/blue, some warm
      const colorType = Math.random();
      if (colorType < 0.6) {
        colors[i * 3] = 0.8 + Math.random() * 0.2;
        colors[i * 3 + 1] = 0.85 + Math.random() * 0.15;
        colors[i * 3 + 2] = 1.0;
      } else if (colorType < 0.85) {
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.9 + Math.random() * 0.1;
        colors[i * 3 + 2] = 0.7 + Math.random() * 0.2;
      } else {
        colors[i * 3] = 0.6 + Math.random() * 0.2;
        colors[i * 3 + 1] = 0.7 + Math.random() * 0.2;
        colors[i * 3 + 2] = 1.0;
      }

      sizes[i] = Math.random() * 4 + 0.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: starVertexShader,
      fragmentShader: starFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    return points;
  }

  private createGrid(): THREE.Mesh {
    const size = 80;
    const divisions = 40;
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    // Fix UVs for grid
    const uvs = geo.attributes.uv;
    for (let i = 0; i < uvs.count; i++) {
      const x = i % 2;
      const y = Math.floor(i / 2) % 2;
      uvs.setXY(i, x, y);
    }

    const mesh = new THREE.Mesh(geo, this.gridMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -3;
    mesh.visible = this.physics.config.showGrid;
    return mesh;
  }

  private createBlackHole(
    radius: number,
    temperature: number,
    spin: number,
  ): { group: THREE.Group; disk: THREE.Mesh } {
    const group = new THREE.Group();

    // Event horizon (black sphere)
    const horizonGeo = new THREE.SphereGeometry(radius, 32, 32);
    const horizonMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
    });
    const horizon = new THREE.Mesh(horizonGeo, horizonMat);
    group.add(horizon);

    // Photon ring
    const ringGeo = new THREE.PlaneGeometry(radius * 3.5, radius * 3.5);
    const ringMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.8 },
      },
      vertexShader: photonRingVertexShader,
      fragmentShader: photonRingFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const photonRing = new THREE.Mesh(ringGeo, ringMat);
    photonRing.userData.isPhotonRing = true;
    group.add(photonRing);

    // Accretion disk
    const diskInner = radius * 1.3;
    const diskOuter = radius * 5.5;
    const diskGeo = new THREE.RingGeometry(diskInner, diskOuter, 128, 8);
    const diskMat = createDiskMaterial(temperature, spin);
    const disk = new THREE.Mesh(diskGeo, diskMat);
    disk.rotation.x = -Math.PI / 2 + 0.15; // slight tilt
    group.add(disk);

    // Glow halo
    const glowGeo = new THREE.SphereGeometry(radius * 1.5, 32, 32);
    const glowMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float fresnel = 1.0 - abs(dot(vNormal, vViewDir));
          fresnel = pow(fresnel, 3.0);
          vec3 color = vec3(1.0, 0.5, 0.15);
          gl_FragColor = vec4(color, fresnel * 0.4);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    group.add(glow);

    return { group, disk };
  }

  private createGWParticles(): {
    points: THREE.Points;
    positions: Float32Array;
    velocities: Float32Array;
  } {
    const positions = new Float32Array(this.gwCount * 3);
    const velocities = new Float32Array(this.gwCount * 3);
    const sizes = new Float32Array(this.gwCount);

    for (let i = 0; i < this.gwCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 5 + Math.random() * 40;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.3;
      positions[i * 3 + 2] = r * Math.cos(phi);

      velocities[i * 3] = Math.sin(theta) * 2;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = Math.cos(theta) * 2;
      sizes[i] = Math.random() * 2 + 0.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
      },
      vertexShader: `
        attribute float aSize;
        uniform float uIntensity;
        varying float vAlpha;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (200.0 / -mvPos.z) * (0.5 + uIntensity);
          vAlpha = uIntensity;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d) * vAlpha * 0.5;
          gl_FragColor = vec4(0.3, 0.6, 1.0, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    return { points, positions, velocities };
  }

  setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    if (mode === 'cinematic') {
      this.cameraElevation = 0.3;
      this.cameraDistance = 60;
      this.autoRotate = true;
    } else if (mode === 'scientific') {
      this.cameraElevation = 0.15;
      this.cameraDistance = 80;
      this.autoRotate = false;
    } else if (mode === 'top') {
      this.cameraElevation = Math.PI / 2 - 0.05;
      this.cameraDistance = 70;
      this.autoRotate = false;
    }
  }

  setAutoRotate(on: boolean): void {
    this.autoRotate = on;
  }

  private setupControls(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.autoRotate = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.cameraAngle -= dx * 0.005;
      this.cameraElevation = Math.max(
        -Math.PI / 2 + 0.1,
        Math.min(Math.PI / 2 - 0.1, this.cameraElevation + dy * 0.005),
      );
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.cameraDistance = Math.max(
          15,
          Math.min(300, this.cameraDistance + e.deltaY * 0.05),
        );
      },
      { passive: false },
    );

    // Touch
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
        this.autoRotate = false;
      }
    });

    canvas.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length === 1) {
        const dx = e.touches[0].clientX - this.lastMouseX;
        const dy = e.touches[0].clientY - this.lastMouseY;
        this.cameraAngle -= dx * 0.005;
        this.cameraElevation = Math.max(
          -Math.PI / 2 + 0.1,
          Math.min(
            Math.PI / 2 - 0.1,
            this.cameraElevation + dy * 0.005,
          ),
        );
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
      }
    });

    canvas.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }

  private updateCamera(): void {
    if (this.autoRotate) {
      this.cameraAngle += 0.001;
    }

    const x =
      this.cameraTarget.x +
      this.cameraDistance * Math.cos(this.cameraElevation) * Math.cos(this.cameraAngle);
    const y = this.cameraTarget.y + this.cameraDistance * Math.sin(this.cameraElevation);
    const z =
      this.cameraTarget.z +
      this.cameraDistance * Math.cos(this.cameraElevation) * Math.sin(this.cameraAngle);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.cameraTarget);
  }

  updateConfig(config: Partial<import('./physics').PhysicsConfig>): void {
    Object.assign(this.physics.config, config);
    if (config.temperature !== undefined || config.spin1 !== undefined || config.spin2 !== undefined) {
      this.updateDiskMaterials();
    }
    if (config.showGrid !== undefined) {
      this.setShowGrid(config.showGrid);
    }
    if (config.showLensing !== undefined) {
      this.setShowLensing(config.showLensing);
    }
  }

  reset(): void {
    this.physics.reset();
    if (this.mergedGroup) {
      this.scene.remove(this.mergedGroup);
      this.mergedGroup = null;
      this.mergedDisk = null;
    }
    if (this.burstParticles) {
      this.scene.remove(this.burstParticles);
      this.burstParticles = null;
    }
    this.burstLife = 0;
    this.lastPhase = 'inspiral';
    this.updateDiskMaterials();
  }

  forceCollision(): void {
    this.physics.forceCollision();
  }

  private updateDiskMaterials(): void {
    const temp = this.physics.config.temperature;
    const tempToColor = (tempK: number): [number, number, number] => {
      const t = Math.max(1000, Math.min(40000, tempK)) / 100;
      let r, g, b;
      if (t <= 66) r = 255;
      else r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
      if (t <= 66) g = 99.4708025861 * Math.log(t) - 161.1195681661;
      else g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
      if (t >= 66) b = 255;
      else if (t <= 19) b = 0;
      else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
      return [
        Math.max(0, Math.min(255, r)) / 255,
        Math.max(0, Math.min(255, g)) / 255,
        Math.max(0, Math.min(255, b)) / 255,
      ];
    };

    const colors = tempToColor(temp);
    const hotColor = new THREE.Color(colors[0], colors[1], colors[2]);
    const coolColor = new THREE.Color(colors[1] * 0.3, colors[2] * 0.2, 0.05);

    const mat1 = this.disk1.material as THREE.ShaderMaterial;
    mat1.uniforms.uColorHot.value = hotColor;
    mat1.uniforms.uColorCool.value = coolColor;
    mat1.uniforms.uSpin.value = this.physics.config.spin1;

    const mat2 = this.disk2.material as THREE.ShaderMaterial;
    mat2.uniforms.uColorHot.value = hotColor;
    mat2.uniforms.uColorCool.value = coolColor;
    mat2.uniforms.uSpin.value = this.physics.config.spin2;

    if (this.mergedDisk) {
      const matM = this.mergedDisk.material as THREE.ShaderMaterial;
      matM.uniforms.uColorHot.value = hotColor;
      matM.uniforms.uColorCool.value = coolColor;
    }
  }

  private createMergerBurst(pos: THREE.Vector3): void {
    const count = 2000;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 10 + Math.random() * 40;
      velocities[i * 3] = speed * Math.sin(phi) * Math.cos(theta);
      velocities[i * 3 + 1] = speed * Math.sin(phi) * Math.sin(theta) * 0.5;
      velocities[i * 3 + 2] = speed * Math.cos(phi);
      sizes[i] = Math.random() * 4 + 1;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uLife: { value: 1.0 },
      },
      vertexShader: `
        attribute float aSize;
        uniform float uLife;
        varying float vLife;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (200.0 / -mvPos.z) * uLife;
          vLife = uLife;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying float vLife;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d) * vLife;
          vec3 col = mix(vec3(1.0, 0.8, 0.3), vec3(0.3, 0.6, 1.0), 1.0 - vLife);
          gl_FragColor = vec4(col, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.burstParticles = new THREE.Points(geo, mat);
    this.burstParticles.userData.velocities = velocities;
    this.scene.add(this.burstParticles);
    this.burstLife = 1.0;
  }

  private lastPhase: string = 'inspiral';

  update(): PhysicsData {
    const dt = Math.min(this.clock.getDelta(), 0.033);
    this.accumTime += dt;

    // Update physics
    this.physics.update(dt);
    const data = this.physics.data;

    // Check for merger transition to create burst
    if (data.phase === 'ringdown' && this.lastPhase === 'merger') {
      if (data.merged) {
        this.createMergerBurst(
          new THREE.Vector3(...data.merged.position),
        );
      }
    }
    if (data.phase === 'merger' && this.lastPhase === 'inspiral') {
      // Start creating merged group
      if (!this.mergedGroup && data.merged) {
        this.createMergedGroup(data.merged.mass, this.physics.config.temperature, data.merged.spin);
      }
    }
    this.lastPhase = data.phase;

    // Update BH positions
    this.bhGroup1.position.set(...data.bh1.position);
    this.bhGroup2.position.set(...data.bh2.position);

    // Scale BH groups based on mass
    const s1 = massToRadius(data.bh1.mass);
    const s2 = massToRadius(data.bh2.mass);
    this.bhGroup1.scale.setScalar(s1);
    this.bhGroup2.scale.setScalar(s2);

    // Hide BHs during ringdown/merged
    if (data.phase === 'ringdown' || data.phase === 'merged') {
      this.bhGroup1.visible = false;
      this.bhGroup2.visible = false;
    } else {
      this.bhGroup1.visible = true;
      this.bhGroup2.visible = true;
    }

    // Show merged BH
    if (data.merged && (data.phase === 'ringdown' || data.phase === 'merged')) {
      if (!this.mergedGroup) {
        this.createMergedGroup(data.merged.mass, this.physics.config.temperature, data.merged.spin);
      }
      if (this.mergedGroup) {
        this.mergedGroup.visible = true;
        this.mergedGroup.position.set(...data.merged.position);
        const ms = data.merged.radius / massToRadius(data.merged.mass);
        this.mergedGroup.scale.setScalar(ms);
      }
    }

    // Update shader uniforms
    this.updateAllShaderUniforms(data, dt);

    // Update photon rings to face camera
    this.bhGroup1.children.forEach((child) => {
      if (child.userData.isPhotonRing) {
        child.lookAt(this.camera.position);
      }
    });
    this.bhGroup2.children.forEach((child) => {
      if (child.userData.isPhotonRing) {
        child.lookAt(this.camera.position);
      }
    });
    if (this.mergedGroup) {
      this.mergedGroup.children.forEach((child) => {
        if (child.userData.isPhotonRing) {
          child.lookAt(this.camera.position);
        }
      });
    }

    // Update GW particles
    this.updateGWParticles(data, dt);

    // Update burst particles
    if (this.burstParticles && this.burstLife > 0) {
      this.burstLife -= dt * 0.5;
      const positions = this.burstParticles.geometry.attributes.position as THREE.BufferAttribute;
      const velocities = this.burstParticles.userData.velocities as Float32Array;
      const arr = positions.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += velocities[i] * dt;
        arr[i + 1] += velocities[i + 1] * dt;
        arr[i + 2] += velocities[i + 2] * dt;
        velocities[i] *= 0.98;
        velocities[i + 1] *= 0.98;
        velocities[i + 2] *= 0.98;
      }
      positions.needsUpdate = true;
      (this.burstParticles.material as THREE.ShaderMaterial).uniforms.uLife.value = Math.max(0, this.burstLife);
      if (this.burstLife <= 0) {
        this.scene.remove(this.burstParticles);
        this.burstParticles = null;
      }
    }

    // Update camera
    this.updateCamera();

    // Update target to follow center of mass
    if (data.merged) {
      this.cameraTarget.lerp(new THREE.Vector3(...data.merged.position), 0.05);
    } else {
      const cx =
        (data.bh1.mass * data.bh1.position[0] + data.bh2.mass * data.bh2.position[0]) /
        (data.bh1.mass + data.bh2.mass);
      const cz =
        (data.bh1.mass * data.bh1.position[2] + data.bh2.mass * data.bh2.position[2]) /
        (data.bh1.mass + data.bh2.mass);
      this.cameraTarget.lerp(new THREE.Vector3(cx, 0, cz), 0.05);
    }

    // Render
    this.renderer.render(this.scene, this.camera);

    return data;
  }

  private createMergedGroup(mass: number, temperature: number, spin: number): void {
    const bhData = this.createBlackHole(1.0, temperature, spin);
    this.mergedGroup = bhData.group;
    this.mergedDisk = bhData.disk;
    this.mergedGroup.visible = false;
    this.scene.add(this.mergedGroup);
  }

  private updateAllShaderUniforms(data: PhysicsData, dt: number): void {
    // Nebula
    (this.nebulaMesh.material as THREE.ShaderMaterial).uniforms.uTime.value = this.accumTime;

    // Disk materials
    const d1Mat = this.disk1.material as THREE.ShaderMaterial;
    d1Mat.uniforms.uTime.value = this.accumTime;

    const d2Mat = this.disk2.material as THREE.ShaderMaterial;
    d2Mat.uniforms.uTime.value = this.accumTime;

    if (this.mergedDisk) {
      const mMat = this.mergedDisk.material as THREE.ShaderMaterial;
      mMat.uniforms.uTime.value = this.accumTime;
    }

    // Photon rings
    this.bhGroup1.children.forEach((child) => {
      if (child.userData.isPhotonRing) {
        ((child as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uTime.value = this.accumTime;
      }
    });
    this.bhGroup2.children.forEach((child) => {
      if (child.userData.isPhotonRing) {
        ((child as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uTime.value = this.accumTime;
      }
    });
    if (this.mergedGroup) {
      this.mergedGroup.children.forEach((child) => {
        if (child.userData.isPhotonRing) {
          ((child as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uTime.value = this.accumTime;
        }
      });
    }

    // Grid
    const gridMat = this.gridMaterial;
    gridMat.uniforms.uTime.value = this.accumTime;
    gridMat.uniforms.uBh1Pos.value.set(...data.bh1.position);
    gridMat.uniforms.uBh2Pos.value.set(...data.bh2.position);
    gridMat.uniforms.uBh1Mass.value = data.bh1.mass / 10;
    gridMat.uniforms.uBh2Mass.value = data.bh2.mass / 10;
    if (data.merged) {
      gridMat.uniforms.uMergedPosition.value.set(...data.merged.position);
      gridMat.uniforms.uMergedMass.value = data.merged.mass / 10;
    }
    gridMat.uniforms.uHasMerged.value =
      data.phase === 'ringdown' || data.phase === 'merged' ? 1 : 0;
    this.gridMesh.visible = this.physics.config.showGrid;

    // GW particles
    const gwMat = this.gwParticles.material as THREE.ShaderMaterial;
    gwMat.uniforms.uTime.value = this.accumTime;
    gwMat.uniforms.uIntensity.value = Math.min(1, data.gravWaveStrain * 2);
  }

  private updateGWParticles(data: PhysicsData, dt: number): void {
    const positions = this.gwParticles.geometry.attributes.position as THREE.BufferAttribute;
    const arr = positions.array as Float32Array;
    const intensity = Math.min(1, data.gravWaveStrain * 2);

    for (let i = 0; i < this.gwCount; i++) {
      const i3 = i * 3;
      // Expand outward
      arr[i3] += this.gwParticleVel[i3] * dt * (0.5 + intensity * 3);
      arr[i3 + 1] += this.gwParticleVel[i3 + 1] * dt * (0.5 + intensity * 3);
      arr[i3 + 2] += this.gwParticleVel[i3 + 2] * dt * (0.5 + intensity * 3);

      // Reset particles that go too far
      const dist = Math.sqrt(arr[i3] ** 2 + arr[i3 + 1] ** 2 + arr[i3 + 2] ** 2);
      if (dist > 150) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 5 + Math.random() * 10;
        arr[i3] = r * Math.sin(phi) * Math.cos(theta);
        arr[i3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.3;
        arr[i3 + 2] = r * Math.cos(phi);
      }
    }
    positions.needsUpdate = true;
  }

  setShowGrid(show: boolean): void {
    this.physics.config.showGrid = show;
    this.gridMesh.visible = show;
  }

  setShowLensing(show: boolean): void {
    this.physics.config.showLensing = show;
    // Toggle photon rings visibility
    this.bhGroup1.children.forEach((child) => {
      if (child.userData.isPhotonRing) child.visible = show;
    });
    this.bhGroup2.children.forEach((child) => {
      if (child.userData.isPhotonRing) child.visible = show;
    });
    if (this.mergedGroup) {
      this.mergedGroup.children.forEach((child) => {
        if (child.userData.isPhotonRing) child.visible = show;
      });
    }
  }

  resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    (this.nebulaMesh.material as THREE.ShaderMaterial).uniforms.uResolution.value.set(
      window.innerWidth,
      window.innerHeight,
    );
  }

  dispose(): void {
    this.renderer.dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}
