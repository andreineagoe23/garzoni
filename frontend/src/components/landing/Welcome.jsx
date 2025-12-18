import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Robot,
  Trophy,
  BookHalf,
  LightningCharge,
  GraphUpArrow,
  ChevronDown,
  StarFill,
} from "react-bootstrap-icons";
import { ArrowRight, PlayCircle } from "lucide-react";
import * as THREE from "three";
import Header from "components/layout/Header";
import { GlassCard, GlassButton } from "components/ui";
import "./welcome.css";

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

function Welcome() {
  const navigate = useNavigate();
  const featureRef = useRef(null);
  const landingShellRef = useRef(null);

  const heroRef = useRef(null);
  const brainStageRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const svgRef = useRef(null);
  const trackersRef = useRef(null);
  const topicRefs = useRef({});
  const lineRefs = useRef([]);

  const flowRef = useRef(PARTICLE_DEFAULTS.xpFlow);

  const difficulty = PARTICLE_DEFAULTS.difficulty;
  const mastery = PARTICLE_DEFAULTS.mastery;
  const focus = PARTICLE_DEFAULTS.focus;
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  const features = useMemo(
    () => [
      {
        title: "Bite-sized lessons",
        text: "Learn in 3–7 minutes with clear takeaways you can apply immediately.",
        icon: <BookHalf size={22} />,
        bullets: [
          "Short, focused topics",
          "Interactive checks",
          "Repeat anytime",
        ],
      },
      {
        title: "Gamification & missions",
        text: "Turn progress into momentum with points, streaks, and challenges.",
        icon: <Trophy size={22} />,
        bullets: ["Badges & streaks", "Weekly goals", "Leaderboards"],
      },
      {
        title: "AI finance assistant",
        text: "Ask questions, get explanations, and learn the “why” behind each step.",
        icon: <Robot size={22} />,
        bullets: [
          "Personalized guidance",
          "Explain concepts simply",
          "24/7 support",
        ],
      },
      {
        title: "Smart tools & practice",
        text: "Simulate decisions with calculators and exercises that build confidence.",
        icon: <LightningCharge size={22} />,
        bullets: [
          "Hands-on exercises",
          "Scenario practice",
          "Actionable insights",
        ],
      },
      {
        title: "Track progress",
        text: "See growth over time with clear milestones and next-step nudges.",
        icon: <GraphUpArrow size={22} />,
        bullets: [
          "Milestones",
          "Progress snapshots",
          "Personalized next steps",
        ],
      },
    ],
    []
  );

  const reviews = useMemo(
    () => [
      {
        id: "amina",
        name: "Amina K.",
        title: "Student",
        quote:
          "I finally understand budgeting without feeling overwhelmed. The lessons are short and the missions keep me consistent.",
      },
      {
        id: "marco",
        name: "Marco R.",
        title: "Early-career professional",
        quote:
          "The AI assistant explains things like a friend. I stopped guessing and started making decisions with confidence.",
      },
      {
        id: "sofia",
        name: "Sofia D.",
        title: "Freelancer",
        quote:
          "The gamified streaks are addictive (in a good way). I’ve learned more in two weeks than months of random videos.",
      },
      {
        id: "daniel",
        name: "Daniel P.",
        title: "New investor",
        quote:
          "I used to procrastinate learning finance. The bite-sized lessons make it easy to show up daily.",
      },
      {
        id: "lina",
        name: "Lina S.",
        title: "Entrepreneur",
        quote:
          "The missions feel like a game, but the results are real. I’m tracking expenses consistently now.",
      },
      {
        id: "noah",
        name: "Noah T.",
        title: "College grad",
        quote:
          "The tools + explanations helped me finally understand interest, debt payoff, and how to prioritize.",
      },
    ],
    []
  );

  const marqueeReviews = useMemo(() => [...reviews, ...reviews], [reviews]);
  const marqueeDuration = useMemo(
    () => `${Math.max(36, reviews.length * 7)}s`,
    [reviews.length]
  );

  const scrollToFeatures = () => {
    featureRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Make the landing background parallax match the hero particles (subtle + smoothed).
  useEffect(() => {
    const shell = landingShellRef.current;
    if (!shell) return undefined;

    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;
    if (prefersReducedMotion) return undefined;

    let rafId = 0;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      // Smooth follow (similar vibe to the particle group's mouse easing)
      current.x += (target.x - current.x) * 0.08;
      current.y += (target.y - current.y) * 0.08;
      shell.style.setProperty(
        "--landing-parallax-x",
        `${current.x.toFixed(2)}px`
      );
      shell.style.setProperty(
        "--landing-parallax-y",
        `${current.y.toFixed(2)}px`
      );
    };

    const onPointerMove = (e) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const nx = (e.clientX / w) * 2 - 1; // -1..1
      const ny = (e.clientY / h) * 2 - 1; // -1..1

      // Invert slightly so it feels like depth (background lags behind pointer).
      const maxX = 10;
      const maxY = 7;
      target.x = -nx * maxX;
      target.y = -ny * maxY;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      shell.style.removeProperty("--landing-parallax-x");
      shell.style.removeProperty("--landing-parallax-y");
    };
  }, []);

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

  return (
    <div
      ref={landingShellRef}
      className="landing-shell landing-theme app-container min-h-screen flex flex-col bg-[color:var(--bg-color,#0B0F14)] text-[color:var(--text-color,#e5e7eb)]"
      style={{
        // Make the sections below the hero match the hero's neutral dark palette
        // (instead of the default slightly blue-tinted surface).
        "--card-bg": "#15191E",
        "--input-bg": "#15191E",
      }}
    >
      <div className="landing-animated-bg" aria-hidden="true" />

      <Header />

      <main className="relative z-[1] flex-1 pt-[96px]">
        {/* Hero (Three.js knowledge constellation) */}
        <section
          ref={heroRef}
          className="welcome-hero relative isolate bg-[#0B0F14] min-h-[calc(100vh-96px)]"
          aria-label="Finance Knowledge Constellation hero"
        >
          <div className="w-full pl-6 pr-3 sm:pl-10 sm:pr-5 lg:pl-14 lg:pr-8 min-h-[calc(100vh-96px)]">
            <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-12 min-h-[calc(100vh-96px)] items-stretch">
              {/* Left: copy + CTAs */}
              <div className="relative z-10 flex flex-col items-start justify-center py-6 sm:py-8 lg:py-0 pl-2 sm:pl-4">
                <div className="inline-flex w-fit self-start items-center gap-1.5 whitespace-nowrap rounded-full border border-[#1D5330]/25 bg-[#1D5330]/10 px-2.5 py-0.5 backdrop-blur-sm">
                  <span className="relative inline-flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E6C87A] opacity-40" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E6C87A]" />
                  </span>
                  <span className="welcome-font-mono text-[11px] uppercase tracking-wide text-[#E6C87A]">
                    New: AI Financial Tutor
                  </span>
                </div>

                <h1 className="welcome-font-display mt-7 text-5xl font-semibold tracking-tight text-white leading-[0.95] sm:text-6xl md:text-7xl lg:text-7xl xl:text-8xl">
                  Turn knowledge <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-500">
                    into net worth.
                  </span>
                </h1>

                <p className="mt-6 max-w-xl text-sm leading-relaxed text-neutral-400 sm:text-base">
                  The gamified financial education platform. Connect the nodes
                  of your financial literacy, earn XP, and unlock real‑world
                  wealth strategies.
                </p>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center pointer-events-auto">
                  <GlassButton
                    onClick={() => navigate("/register")}
                    variant="active"
                    size="lg"
                    className="group"
                  >
                    <span>Start Learning Path</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </GlassButton>

                  <GlassButton
                    onClick={() => setIsDemoOpen(true)}
                    variant="ghost"
                    size="lg"
                  >
                    <PlayCircle className="h-4 w-4" />
                    <span>Watch Demo</span>
                  </GlassButton>

                  <button
                    type="button"
                    onClick={scrollToFeatures}
                    className="group inline-flex items-center justify-center gap-3 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/85 backdrop-blur hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/50 sm:ml-2"
                    aria-label="Scroll to explore"
                  >
                    <span>Scroll to explore</span>
                    <ChevronDown
                      size={18}
                      className="transition-transform duration-200 group-hover:translate-y-0.5"
                    />
                  </button>
                </div>

                {/* Stats */}
                <div className="mt-10 hidden md:flex gap-8 pointer-events-auto">
                  <div className="flex flex-col gap-1">
                    <span className="welcome-font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                      Current Streak
                    </span>
                    <div className="flex items-end gap-1">
                      <span className="welcome-font-display text-2xl font-medium text-white">
                        12
                      </span>
                      <span className="text-xs text-neutral-500 mb-1">
                        days
                      </span>
                    </div>
                  </div>
                  <div className="h-10 w-px bg-white/10" />
                  <div className="flex flex-col gap-1">
                    <span className="welcome-font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                      Total XP
                    </span>
                    <div className="flex items-end gap-1">
                      <span className="welcome-font-display text-2xl font-medium text-white">
                        8,450
                      </span>
                      <span className="text-xs text-[#E6C87A] mb-1">
                        +240 today
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: particle brain stage */}
              <div className="relative z-0 flex items-stretch py-2 sm:py-4 lg:py-0">
                <div
                  ref={brainStageRef}
                  className="relative w-full overflow-hidden bg-[#0B0F14] h-[420px] sm:h-[520px] lg:h-full"
                >
                  <div
                    ref={canvasContainerRef}
                    className="absolute inset-0 z-0"
                    aria-hidden="true"
                  />

                  <svg
                    ref={svgRef}
                    id="tracker-lines"
                    aria-hidden="true"
                    className="transition-opacity duration-300"
                    style={{ opacity: 1 }}
                  >
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <line
                        // eslint-disable-next-line react/no-array-index-key
                        key={idx}
                        ref={(el) => {
                          lineRefs.current[idx] = el;
                        }}
                        className={[
                          "welcome-svg-line",
                          idx === 2 ? "active" : "",
                        ].join(" ")}
                      />
                    ))}
                  </svg>

                  {/* Node labels (HUD) */}
                  <div
                    ref={trackersRef}
                    className="welcome-trackers transition-opacity duration-300"
                    aria-hidden="true"
                    style={{ opacity: 1 }}
                  >
                    <div
                      className="welcome-point-marker"
                      ref={(el) => {
                        topicRefs.current.budgeting = el;
                      }}
                    >
                      <div className="welcome-point-dot" />
                      <div className="welcome-point-corner welcome-pc-tl" />
                      <div className="welcome-point-corner welcome-pc-br" />
                      <div className="welcome-point-label">BUDGETING</div>
                    </div>

                    <div
                      className="welcome-point-marker"
                      ref={(el) => {
                        topicRefs.current.saving = el;
                      }}
                    >
                      <div className="welcome-point-dot" />
                      <div className="welcome-point-corner welcome-pc-tl" />
                      <div className="welcome-point-corner welcome-pc-br" />
                      <div className="welcome-point-label">SAVING</div>
                    </div>

                    <div
                      className="welcome-point-marker"
                      ref={(el) => {
                        topicRefs.current.investing = el;
                      }}
                    >
                      <div className="welcome-point-dot" />
                      <div className="welcome-point-corner welcome-pc-tl" />
                      <div className="welcome-point-corner welcome-pc-br" />
                      <div className="welcome-point-label">INVESTING</div>
                    </div>

                    <div
                      className="welcome-point-marker"
                      ref={(el) => {
                        topicRefs.current.credit = el;
                      }}
                    >
                      <div className="welcome-point-dot" />
                      <div className="welcome-point-corner welcome-pc-tl" />
                      <div className="welcome-point-corner welcome-pc-br" />
                      <div className="welcome-point-label">CREDIT</div>
                    </div>

                    <div
                      className="welcome-point-marker"
                      ref={(el) => {
                        topicRefs.current.taxes = el;
                      }}
                    >
                      <div className="welcome-point-dot" />
                      <div className="welcome-point-corner welcome-pc-tl" />
                      <div className="welcome-point-corner welcome-pc-br" />
                      <div className="welcome-point-label">TAXES</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Demo modal (lightweight, self-contained) */}
          {isDemoOpen && (
            <div
              className="fixed inset-0 z-[1200] flex items-center justify-center px-4"
              role="dialog"
              aria-modal="true"
              aria-label="Demo"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/60"
                onClick={() => setIsDemoOpen(false)}
                aria-label="Close demo"
              />
              <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0B0F14]/85 p-6 backdrop-blur-xl shadow-2xl shadow-black/50">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <PlayCircle className="h-5 w-5 text-[#E6C87A]" />
                    <span className="welcome-font-display text-base font-semibold text-white">
                      Demo
                    </span>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/10"
                    onClick={() => setIsDemoOpen(false)}
                  >
                    Close
                  </button>
                </div>
                <p className="mt-3 text-sm text-white/70">
                  Demo video coming soon. For now, start a learning path to see
                  the curriculum and XP system in action.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    className="rounded border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
                    onClick={() => setIsDemoOpen(false)}
                  >
                    Not now
                  </button>
                  <button
                    type="button"
                    className="rounded bg-[#E6C87A] px-5 py-2 text-sm font-semibold text-[#0B0F14] hover:bg-[#d4b669]"
                    onClick={() => navigate("/register")}
                  >
                    Start Learning Path
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 py-12 sm:px-6 lg:px-8">
          {/* Zig-zag Features */}
          <section ref={featureRef} className="relative scroll-mt-[110px]">
            <div className="mx-auto max-w-4xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need to learn, practice, and win.
              </h2>
              <p className="mt-4 text-sm text-[color:var(--muted-text,rgba(229,231,235,0.72))] sm:text-base">
                Built for consistency: small lessons, real practice, and a
                system that keeps you coming back.
              </p>
            </div>

            <div className="relative mt-12">
              <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-white/10 lg:block" />

              <div className="space-y-8 lg:space-y-10">
                {features.map((feature, index) => {
                  const isLeft = index % 2 === 0;
                  const sideColStart = isLeft
                    ? "lg:col-start-1"
                    : "lg:col-start-8";

                  return (
                    <div
                      key={feature.title}
                      className="relative grid grid-cols-1 items-center gap-4 lg:grid-cols-12 lg:gap-6"
                    >
                      <div className={`lg:col-span-5 ${sideColStart}`}>
                        <GlassCard
                          padding="lg"
                          className="p-6 lg:p-8 bg-[color:var(--card-bg,#15191E)]/70 border-white/10"
                        >
                          <div className="flex items-start gap-4">
                            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/90">
                              {feature.icon}
                            </span>
                            <div className="min-w-0 text-left">
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                                Feature {index + 1}
                              </p>
                              <h3 className="mt-1 text-xl font-bold text-white">
                                {feature.title}
                              </h3>
                              <p className="mt-2 text-sm text-white/70">
                                {feature.text}
                              </p>
                              <ul className="mt-4 space-y-2 text-sm text-white/75">
                                {feature.bullets.map((bullet) => (
                                  <li
                                    key={bullet}
                                    className="flex items-start gap-2"
                                  >
                                    <span className="mt-[3px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)]/20 text-[color:var(--primary,#1d5330)]">
                                      ✓
                                    </span>
                                    <span>{bullet}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </GlassCard>
                      </div>

                      {/* Middle node */}
                      <div className="relative hidden lg:col-span-2 lg:flex lg:items-center lg:justify-center">
                        <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--primary,#1d5330)]/70 blur-[0.5px]" />
                        <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[color:var(--card-bg,#15191E)]/70 text-sm font-bold text-white/85 shadow-lg shadow-black/40 backdrop-blur">
                          {index + 1}
                        </div>
                        <div
                          className={`pointer-events-none absolute top-1/2 h-px w-10 -translate-y-1/2 bg-white/10 ${
                            isLeft
                              ? "left-[calc(50%+24px)]"
                              : "right-[calc(50%+24px)]"
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Reviews */}
          <section className="relative">
            <div className="mx-auto max-w-4xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Loved by learners.
              </h2>
              <p className="mt-4 text-sm text-[color:var(--muted-text,rgba(229,231,235,0.72))] sm:text-base">
                Real people. Real progress. All five stars.
              </p>
            </div>

            <div
              className="landing-review-marquee mt-10"
              style={{ "--landing-review-duration": marqueeDuration }}
              aria-label="Customer reviews"
            >
              <div className="landing-review-track" aria-hidden="true">
                {marqueeReviews.map((review, idx) => (
                  <GlassCard
                    key={`${review.id}-${idx}`}
                    padding="lg"
                    tabIndex={0}
                    role="article"
                    aria-label={`5-star review by ${review.name}`}
                    className="landing-review-card h-full p-6 bg-[color:var(--card-bg,#15191E)]/65 border-white/10"
                  >
                    <div className="flex items-center gap-1 text-[color:var(--gold,#E6C87A)]">
                      {Array.from({ length: 5 }).map((_, starIdx) => (
                        <StarFill key={starIdx} size={16} />
                      ))}
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-white/80">
                      “{review.quote}”
                    </p>
                    <div className="mt-6 border-t border-white/10 pt-4">
                      <p className="text-sm font-semibold text-white">
                        {review.name}
                      </p>
                      <p className="text-xs text-white/60">{review.title}</p>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="relative pb-8">
            <GlassCard
              padding="xl"
              className="p-8 text-center sm:p-10 bg-[color:var(--card-bg,#15191E)]/70 border-white/10"
            >
              <h3 className="text-2xl font-bold text-white sm:text-3xl">
                Ready to start your money journey?
              </h3>
              <p className="mt-3 text-sm text-white/70 sm:text-base">
                Create an account in seconds, or log in to continue where you
                left off.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <GlassButton
                  type="button"
                  onClick={() => navigate("/register")}
                  variant="active"
                >
                  Create account
                </GlassButton>
                <GlassButton
                  type="button"
                  onClick={() => navigate("/login")}
                  variant="ghost"
                >
                  Log in
                </GlassButton>
              </div>
            </GlassCard>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Welcome;
