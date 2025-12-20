import { useEffect } from "react";
import * as THREE from "three";

const BRAND = Object.freeze({
  bg: "#0B0F14",
  primary: "#1D5330",
  accent: "#E6C87A",
});

// Locked particle / HUD settings (Learning Engine removed).
const PARTICLE_DEFAULTS = Object.freeze({
  xpFlow: 0.15, // 15%
  difficulty: 1.2, // Hard (>= 1.0)
  mastery: 2.0, // 2x
  focus: 0.8, // 80%
});

// Vertex / Fragment shaders adapted from `landing-page-prototype.html`
const VERTEX_SHADER = `
uniform float uTime;
uniform float uDistortion; // Difficulty (Chaos)
uniform float uSize;       // Mastery (Particle Size)
uniform float uSpread;     // Focus (Dispersal)
uniform vec2 uMouse;       // NDC mouse (-1..1)

attribute float aSeed;

varying float vSeed;
varying float vDistToCenter;

// Simplex Noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod289(i);
  vec4 p = permute( permute( permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 1.0/7.0;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}

void main() {
  vec3 pos = position;
  vec3 dir = normalize(pos);

  // Slow, heavy liquid noise for "Finance Knowledge Constellation"
  float noise = snoise(vec3(
    pos.x * 0.28 + uTime * 0.10,
    pos.y * 0.28 + uTime * 0.06,
    pos.z * 0.28 + uTime * 0.08
  ));

  // Difficulty: push particles outward based on noise
  float expansion = smoothstep(-0.25, 1.0, noise) * uDistortion;

  // Focus Mode: higher spread value scatters more
  vec3 scatter = dir * noise * uSpread * 1.4;
  vec3 basePos = pos + (dir * expansion) + scatter;

  // Mouse repel in screen-space (NDC) for subtle parallax interaction
  vec4 mvBase = modelViewMatrix * vec4(basePos, 1.0);
  vec4 clipBase = projectionMatrix * mvBase;
  vec2 ndc = clipBase.xy / clipBase.w;
  float mouseDist = distance(ndc, uMouse);
  float mouseForce = smoothstep(0.38, 0.0, mouseDist);

  vec3 finalPos = basePos + dir * mouseForce * (0.85 + aSeed * 0.55);

  vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Size: Mastery (uSize) makes nodes bigger
  gl_PointSize = (uSize * 70.0) / -mvPosition.z;

  vSeed = aSeed;
  vDistToCenter = length(finalPos);
}
`;

const FRAGMENT_SHADER = `
uniform vec3 uColorPrimary; // Green
uniform vec3 uColorAccent;  // Gold
uniform float uOpacity;
uniform float uTime;

varying float vSeed;
varying float vDistToCenter;

void main() {
  // Soft circle point sprite
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  if (dist > 0.5) discard;

  float alpha = smoothstep(0.5, 0.18, dist) * uOpacity;

  // Mostly-green palette with occasional gold pulses
  float depthMix = smoothstep(3.6, 6.2, vDistToCenter);
  vec3 baseColor = mix(uColorPrimary * 1.05, uColorPrimary * 0.55, depthMix);

  float p = 0.5 + 0.5 * sin(uTime * 0.9 + vSeed * 12.0);
  float pulse = smoothstep(0.92, 1.0, p);
  vec3 finalColor = mix(baseColor, uColorAccent, pulse);

  // Tiny inner glow (kept subtle to avoid turning everything gold)
  finalColor += (1.0 - smoothstep(0.0, 0.5, dist)) * (uColorPrimary * 0.12);

  gl_FragColor = vec4(finalColor, alpha);
}
`;

export default function ParticleGlobe({
  canvasContainerRef,
  brainStageRef,
  topicRefs,
  lineRefs,
  flowRef,
}) {
  const difficulty = PARTICLE_DEFAULTS.difficulty;
  const mastery = PARTICLE_DEFAULTS.mastery;
  const focus = PARTICLE_DEFAULTS.focus;

  // Three.js: particle globe behind hero content
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return undefined;

    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b0f14, 0.03);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 24);

    const renderer = new THREE.WebGLRenderer({
      antialias: !prefersReducedMotion,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x0b0f14, 0);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.pointerEvents = "none";
    container.appendChild(renderer.domElement);

    const constellationGroup = new THREE.Group();
    scene.add(constellationGroup);

    const updateGroupLayout = () => {
      const isMobile = window.innerWidth < 768;
      // With the hero split into left/right columns, the brain lives in its own stage.
      // Keep it centered inside that stage.
      constellationGroup.position.x = 0;
      constellationGroup.position.y = isMobile ? 0.35 : 0;
    };
    updateGroupLayout();

    const pointCount = window.innerWidth < 768 ? 1600 : 3200;
    const sphereRadius = 4.7;
    const positions = new Float32Array(pointCount * 3);
    const seeds = new Float32Array(pointCount);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < pointCount; i += 1) {
      const t = pointCount === 1 ? 0 : i / (pointCount - 1);
      const y = 1 - 2 * t;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * i;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;

      const jitter = 0.12;
      const px = (x + (Math.random() - 0.5) * jitter) * sphereRadius;
      const py = (y + (Math.random() - 0.5) * jitter) * sphereRadius;
      const pz = (z + (Math.random() - 0.5) * jitter) * sphereRadius;

      positions[i * 3 + 0] = px;
      positions[i * 3 + 1] = py;
      positions[i * 3 + 2] = pz;
      seeds[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geometry.computeBoundingSphere();

    const uniforms = {
      uTime: { value: 0 },
      uDistortion: { value: difficulty },
      uSize: { value: mastery },
      uSpread: { value: (1 - focus) * 0.6 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uColorPrimary: { value: new THREE.Color(BRAND.primary) },
      uColorAccent: { value: new THREE.Color(BRAND.accent) },
      uOpacity: { value: 0.9 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(geometry, material);
    constellationGroup.add(particleSystem);

    // Neural HUD: anchor small points on the particle sphere and project to screen,
    // so they move with the same mouse-driven parallax/rotation as the particles.
    const makeHudPoint = (x, y, z) =>
      new THREE.Vector3(x, y, z).normalize().multiplyScalar(sphereRadius);

    const hudPoints = {
      budgeting: makeHudPoint(-0.65, 0.45, 0.55),
      saving: makeHudPoint(-0.15, 0.85, 0.25),
      investing: makeHudPoint(0.6, 0.22, 0.65),
      credit: makeHudPoint(0.7, -0.12, 0.55),
      taxes: makeHudPoint(0.12, -0.75, 0.65),
    };

    const hudConnections = [
      ["budgeting", "saving"],
      ["saving", "investing"],
      ["investing", "credit"],
      ["credit", "taxes"],
    ];

    const hudTemp = new THREE.Vector3();
    const hudScreen = {};

    // Subtle, low-opacity connection lines in 3D
    const segmentCount = window.innerWidth < 768 ? 420 : 900;
    const linePositions = new Float32Array(segmentCount * 2 * 3);
    for (let s = 0; s < segmentCount; s += 1) {
      const a = Math.floor(Math.random() * pointCount);
      const b = (a + 1 + Math.floor(Math.random() * 48)) % pointCount;

      linePositions[s * 6 + 0] = positions[a * 3 + 0];
      linePositions[s * 6 + 1] = positions[a * 3 + 1];
      linePositions[s * 6 + 2] = positions[a * 3 + 2];
      linePositions[s * 6 + 3] = positions[b * 3 + 0];
      linePositions[s * 6 + 4] = positions[b * 3 + 1];
      linePositions[s * 6 + 5] = positions[b * 3 + 2];
    }

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(linePositions, 3)
    );

    const lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(BRAND.primary),
      transparent: true,
      opacity: 0.12,
    });
    const lineMesh = new THREE.LineSegments(lineGeo, lineMat);
    constellationGroup.add(lineMesh);

    const mouseTarget = { x: 0, y: 0 };
    const rotTarget = { x: 0, y: 0 };

    const onPointerMove = (e) => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      mouseTarget.x = Math.max(-1, Math.min(1, nx));
      mouseTarget.y = Math.max(-1, Math.min(1, ny));

      // Gentle parallax on the whole group
      rotTarget.y = mouseTarget.x * 0.22;
      rotTarget.x = mouseTarget.y * 0.12;
    };

    const onResize = () => {
      updateGroupLayout();
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    let rafId = 0;
    let last = performance.now();
    let time = 0;

    const tick = (now) => {
      rafId = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // XP flow controls time progression (particle motion + pulses)
      time += dt * (0.65 + flowRef.current * 2.8);
      uniforms.uTime.value = time;

      // Smooth mouse -> uniform
      uniforms.uMouse.value.x +=
        (mouseTarget.x - uniforms.uMouse.value.x) * 0.12;
      uniforms.uMouse.value.y +=
        (mouseTarget.y - uniforms.uMouse.value.y) * 0.12;

      // "Planet" spin lives on the particle brain itself (like the original),
      // while the outer group handles mouse-driven parallax.
      particleSystem.rotation.y += prefersReducedMotion ? 0 : dt * 0.22;
      particleSystem.rotation.z = Math.sin(time * 0.22) * 0.06;

      constellationGroup.rotation.y +=
        (rotTarget.y - constellationGroup.rotation.y) * 0.04;
      constellationGroup.rotation.x +=
        (rotTarget.x - constellationGroup.rotation.x) * 0.04;
      const baseY = window.innerWidth < 768 ? 0.35 : 0;
      constellationGroup.position.y +=
        (Math.sin(time * 0.7) * 0.18 + baseY - constellationGroup.position.y) *
        0.06;

      // Update Neural HUD overlay (markers + lines) in the same frame loop
      // so it stays locked to the particle brain.
      const stageEl = brainStageRef.current;
      const stageRect = stageEl?.getBoundingClientRect();
      if (stageRect?.width && stageRect?.height) {
        // Ensure matrices are current before projecting.
        particleSystem.updateMatrixWorld(true);

        Object.keys(hudPoints).forEach((key) => {
          const el = topicRefs.current[key];
          if (!el) return;
          hudTemp.copy(hudPoints[key]);
          hudTemp.applyMatrix4(particleSystem.matrixWorld);
          hudTemp.project(camera);

          const x = (hudTemp.x * 0.5 + 0.5) * stageRect.width;
          const y = (-hudTemp.y * 0.5 + 0.5) * stageRect.height;
          hudScreen[key] = { x, y };
          el.style.transform = `translate(${x}px, ${y}px)`;
        });

        hudConnections.forEach(([a, b], idx) => {
          const lineEl = lineRefs.current[idx];
          const p1 = hudScreen[a];
          const p2 = hudScreen[b];
          if (!lineEl || !p1 || !p2) return;
          lineEl.setAttribute("x1", String(p1.x));
          lineEl.setAttribute("y1", String(p1.y));
          lineEl.setAttribute("x2", String(p2.x));
          lineEl.setAttribute("y2", String(p2.y));
        });
      }

      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);

      // Dispose GPU resources
      lineGeo.dispose();
      lineMat.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();

      if (renderer.domElement?.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
    // Intentionally mount once; settings are locked via PARTICLE_DEFAULTS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
