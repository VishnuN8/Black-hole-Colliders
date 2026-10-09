import * as THREE from 'three';

// Accretion disk vertex shader
export const diskVertexShader = `
  varying vec2 vUv;
  varying float vAngle;
  varying float vRadius;

  void main() {
    vUv = uv;
    vAngle = atan(position.y, position.x);
    vRadius = length(position.xy);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Accretion disk fragment shader with Doppler beaming and temperature gradient
export const diskFragmentShader = `
  uniform float uTime;
  uniform vec3 uColorHot;
  uniform vec3 uColorCool;
  uniform float uInnerRadius;
  uniform float uOuterRadius;
  uniform float uOpacity;
  uniform float uSpin;

  varying vec2 vUv;
  varying float vAngle;
  varying float vRadius;

  // Simple hash noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float r = (vRadius - uInnerRadius) / (uOuterRadius - uInnerRadius);
    r = clamp(r, 0.0, 1.0);

    // Temperature falls off with radius
    float tempFactor = pow(1.0 - r, 0.75);

    // Swirl pattern rotating with spin
    float swirlAngle = vAngle + uTime * uSpin * 2.0 - r * 3.0;
    vec2 swirlUv = vec2(cos(swirlAngle) * vRadius * 0.3, sin(swirlAngle) * vRadius * 0.3);
    float n = fbm(swirlUv + uTime * 0.1);

    // Doppler beaming: brighter on approaching side
    float dopplerSide = sin(vAngle + uTime * uSpin);
    float doppler = 0.6 + 0.4 * dopplerSide;

    // Color: hot inner -> cool outer
    vec3 color = mix(uColorCool, uColorHot, tempFactor);

    // Brightness with turbulence
    float brightness = tempFactor * (0.5 + n * 0.8) * doppler * 2.0;

    // Inner edge glow
    float innerGlow = smoothstep(0.0, 0.15, r) * smoothstep(1.0, 0.85, r);

    float alpha = innerGlow * uOpacity * (0.4 + n * 0.6) * doppler;

    // Fade at edges
    alpha *= smoothstep(0.0, 0.05, r) * smoothstep(1.0, 0.9, r);

    gl_FragColor = vec4(color * brightness, alpha);
  }
`;

export function createDiskMaterial(
  temperature: number,
  spin: number,
): THREE.ShaderMaterial {
  // Import temperatureToRGB at call site
  const colors = tempToColor(temperature);
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorHot: { value: new THREE.Color(colors[0], colors[1], colors[2]) },
      uColorCool: { value: new THREE.Color(colors[1] * 0.3, colors[2] * 0.2, 0.05) },
      uInnerRadius: { value: 1.2 },
      uOuterRadius: { value: 5.0 },
      uOpacity: { value: 0.85 },
      uSpin: { value: spin },
    },
    vertexShader: diskVertexShader,
    fragmentShader: diskFragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function tempToColor(tempK: number): [number, number, number] {
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

// Spacetime curvature grid shader
export const gridVertexShader = `
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const gridFragmentShader = `
  uniform float uTime;
  uniform vec3 uBh1Pos;
  uniform vec3 uBh2Pos;
  uniform float uBh1Mass;
  uniform float uBh2Mass;
  uniform float uMergedPos;
  uniform vec3 uMergedPosition;
  uniform float uMergedMass;
  uniform float uHasMerged;
  uniform vec3 uColor;

  varying vec3 vWorldPos;
  varying vec2 vUv;

  // Gravitational well depth at a point
  float wellDepth(vec3 pos, vec3 bhPos, float mass) {
    float d = distance(pos, bhPos);
    return -mass / (d * d + 0.5);
  }

  void main() {
    vec3 pos = vWorldPos;

    // Compute spacetime curvature from both black holes
    float depth = 0.0;
    depth += wellDepth(pos, uBh1Pos, uBh1Mass);
    depth += wellDepth(pos, uBh2Pos, uBh2Mass);

    if (uHasMerged > 0.5) {
      depth += wellDepth(pos, uMergedPosition, uMergedMass) * uHasMerged;
    }

    // Grid lines
    vec2 grid = abs(fract(vUv * 40.0 - 0.5) - 0.5) / fwidth(vUv * 40.0);
    float line = min(grid.x, grid.y);
    float gridAlpha = 1.0 - min(line, 1.0);

    // Deformation visualization: stronger near black holes
    float intensity = clamp(-depth * 0.5, 0.0, 1.0);

    // Gravitational wave ripples
    float dist1 = distance(pos, uBh1Pos);
    float dist2 = distance(pos, uBh2Pos);
    float wave = sin(dist1 * 3.0 - uTime * 4.0) * 0.5 + 0.5;
    wave *= sin(dist2 * 3.0 - uTime * 4.0) * 0.5 + 0.5;
    wave *= intensity * 0.3;

    float alpha = gridAlpha * (0.15 + intensity * 0.85) + wave * 0.2;

    vec3 color = mix(uColor, vec3(0.4, 0.7, 1.0), intensity);

    gl_FragColor = vec4(color, alpha * 0.6);
  }
`;

// Starfield shader with lensing
export const starVertexShader = `
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vSize;

  void main() {
    vColor = aColor;
    vSize = aSize;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const starFragmentShader = `
  varying vec3 vColor;
  varying float vSize;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    float core = smoothstep(0.5, 0.0, d);
    float glow = smoothstep(0.5, 0.2, d) * 0.5;
    float alpha = core + glow;

    // Star spike effect for larger stars
    float spike = 0.0;
    if (vSize > 3.0) {
      float s1 = smoothstep(0.02, 0.0, abs(uv.y)) * smoothstep(0.5, 0.1, abs(uv.x));
      float s2 = smoothstep(0.02, 0.0, abs(uv.x)) * smoothstep(0.5, 0.1, abs(uv.y));
      spike = (s1 + s2) * 0.4;
    }

    gl_FragColor = vec4(vColor, alpha + spike);
  }
`;

// Black hole event horizon + photon ring shader
export const blackHoleFragmentShader = `
  uniform float uTime;
  uniform float uRadius;

  void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  }
`;

export const photonRingVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const photonRingFragmentShader = `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float d = distance(vUv, vec2(0.5));
    float ring = smoothstep(0.5, 0.42, d) * smoothstep(0.35, 0.42, d);
    float glow = smoothstep(0.5, 0.38, d) * smoothstep(0.3, 0.38, d) * 0.5;

    // Rotating brightness asymmetry (Doppler)
    float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
    float doppler = 0.5 + 0.5 * sin(angle + uTime * 2.0);

    vec3 color = mix(vec3(1.0, 0.6, 0.2), vec3(1.0, 0.9, 0.5), doppler);
    float alpha = (ring * 0.9 + glow * 0.4) * uOpacity;

    gl_FragColor = vec4(color * (1.0 + doppler * 0.5), alpha);
  }
`;

// Nebula background shader
export const nebulaFragmentShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv * 3.0;
    float n1 = fbm(uv + uTime * 0.02);
    float n2 = fbm(uv * 2.0 - uTime * 0.03 + 100.0);

    vec3 color1 = vec3(0.05, 0.08, 0.25); // deep blue
    vec3 color2 = vec3(0.15, 0.05, 0.3);  // violet hint
    vec3 color3 = vec3(0.02, 0.03, 0.08); // dark

    vec3 col = mix(color3, color1, n1 * 0.5);
    col = mix(col, color2, n2 * 0.3);

    // Vignette
    float vig = smoothstep(1.2, 0.4, length(vUv - 0.5));
    col *= vig;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export const nebulaVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;
