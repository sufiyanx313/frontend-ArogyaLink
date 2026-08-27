"use client";

import React, { Suspense, useRef, useMemo } from "react";
import Image from "next/image";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  PerspectiveCamera,
  Center,
  Environment,
  Lightformer,
} from "@react-three/drei";
import * as THREE from "three";
import { SVGLoader } from "three-stdlib";

interface CanvasStageProps {
  isAiMode?: boolean;
}

// Wordmark geometry ----------------------------------------------------------
// public/aarogyalink.svg is a generated 1000 x 165 unit wordmark (Poppins Bold
// outlines baked to two <path> elements). WORDMARK_SCALE maps SVG units to
// world units; 0.003225 is 25% down from the previous 0.0043 so the wordmark
// frames the entrance rather than filling it.
const WORDMARK_SVG_WIDTH = 1000;
const WORDMARK_SVG_HEIGHT = 165;
const WORDMARK_SCALE = 0.003225;

const WORDMARK_WIDTH = WORDMARK_SVG_WIDTH * WORDMARK_SCALE; // 3.225 world units
const WORDMARK_HEIGHT = WORDMARK_SVG_HEIGHT * WORDMARK_SCALE; // 0.532 world units

// Pulse wave is derived from the wordmark box so the two stay aligned if the
// scale is ever retuned: same width, sitting directly below the descenders.
// The offset accounts for the QRS spike height, so the tallest point of the
// trace clears the letters instead of stabbing into the "g"/"y" descenders.
const PULSE_HALF_WIDTH = WORDMARK_WIDTH / 2;
const PULSE_AMPLITUDE = 0.42;
const PULSE_SPIKE_PEAK = 0.3 * PULSE_AMPLITUDE; // 0.3 = tallest point in the curve below
const PULSE_CLEARANCE = 0.055;
const PULSE_Y = -(WORDMARK_HEIGHT / 2) - PULSE_SPIKE_PEAK - PULSE_CLEARANCE;

// Vertical placement of the wordmark + ECG group.
// The camera sits at z=6 with fov 45, so the visible height at z=0 is
// 2 * 6 * tan(22.5deg) = 4.9706 world units, and a screen fraction f maps to
// world Y = (0.5 - f) * 4.9706. Measuring hospital.png as object-cover puts the
// entrance doors at roughly 60-67% of the viewport, the steps at 67-76%, the
// planting bed at 76-89% and the water reflection pool at 89-97%. GROUP_Y of
// -1.15 lands the ECG baseline near 82% and the wordmark across 68-79%: clear
// of the building entrance, sitting just above the pool.
const GROUP_Y = -1.15;

// Gentle vertical bob, applied to the single group that holds both the wordmark
// and the pulse line so the two rise and fall in sync.
const FLOAT_SPEED = 1.2;
const FLOAT_AMPLITUDE = 0.15;

// The teal fill in the SVG marks the "Link" half; the second path is "Link"
// too, so either signal identifies it if the other ever changes.
// No leading "#" — this is compared against THREE.Color#getHexString().
const LINK_FILL_HEX = "00d2b4";

const BRAND_TEAL = "#00D2B4";

// Deep blue, polished metal — needs the environment map below to read as metal.
const TONE_AAROGYA = {
  color: "#1E3A8A",
  emissive: "#000000",
  emissiveIntensity: 0,
  metalness: 0.7,
  roughness: 0.2,
  envMapIntensity: 1.1,
};

// Radiant medical teal
const TONE_LINK = {
  color: BRAND_TEAL,
  emissive: BRAND_TEAL,
  emissiveIntensity: 0.5,
  metalness: 0.45,
  roughness: 0.2,
  envMapIntensity: 1.0,
};

const EXTRUDE_SETTINGS = {
  depth: 18,
  bevelEnabled: true,
  bevelSegments: 3,
  steps: 1,
  bevelSize: 1.1,
  bevelThickness: 1.3,
};

// 1. Locally baked studio environment.
// Chrome needs something to reflect: a metalness 0.85 surface with no envMap
// renders almost black. These lightformers are baked once into a cube map, so
// there is no remote HDRI fetch and nothing to stall on.
function StudioEnvironment() {
  return (
    <Environment resolution={256} frames={1}>
      {/* Broad soft key from above — the main highlight across the chrome */}
      <Lightformer
        form="rect"
        intensity={2.2}
        color="#ffffff"
        position={[0, 3.5, 2]}
        scale={[10, 4, 1]}
        target={[0, 0, 0]}
      />
      {/* Cool rim from behind left, to separate the letters from the backdrop */}
      <Lightformer
        form="rect"
        intensity={1.1}
        color="#bcd4ff"
        position={[-4.5, 0.5, -3]}
        scale={[6, 3, 1]}
        target={[0, 0, 0]}
      />
      {/* Teal accent from below right, tying the chrome into the Link half */}
      <Lightformer
        form="circle"
        intensity={1.6}
        color={BRAND_TEAL}
        position={[3.5, -2, 1.5]}
        scale={4}
        target={[0, 0, 0]}
      />
    </Environment>
  );
}

// 2a. Soft radial sprite texture, so the pulse reads as a glow without
// needing a postprocessing bloom pass.
function createGlowTexture() {
  if (typeof document === "undefined") return null;

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, "rgba(127, 245, 230, 0.95)");
  gradient.addColorStop(0.3, "rgba(0, 210, 180, 0.5)");
  gradient.addColorStop(1, "rgba(0, 210, 180, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 2b. Glowing ECG pulse wave, aligned directly below the wordmark.
function PulseWave() {
  const pulseRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const curve = useMemo(() => {
    // Normalized x in -1..1 across the wordmark width, y in design units:
    // flat baseline -> P bump -> QRS spike -> T wave -> flat baseline.
    const points: [number, number][] = [
      [-1, 0],
      [-0.79, 0],
      [-0.63, 0],
      [-0.52, 0.05],
      [-0.43, 0],
      [-0.28, 0],
      [-0.16, -0.055],
      [-0.09, 0.3],
      [-0.02, -0.12],
      [0.05, 0],
      [0.17, 0.085],
      [0.29, 0],
      [0.51, 0],
      [0.74, 0],
      [1, 0],
    ];

    return new THREE.CatmullRomCurve3(
      points.map(
        ([x, y]) =>
          new THREE.Vector3(x * PULSE_HALF_WIDTH, y * PULSE_AMPLITUDE, 0)
      ),
      false,
      "catmullrom",
      0.25
    );
  }, []);

  const traceGeometry = useMemo(
    () => new THREE.TubeGeometry(curve, 260, 0.008, 8, false),
    [curve]
  );
  const haloGeometry = useMemo(
    () => new THREE.TubeGeometry(curve, 180, 0.026, 8, false),
    [curve]
  );

  const glowTexture = useMemo(() => createGlowTexture(), []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    if (pulseRef.current) {
      // Sweep the pulse along the trace on a ~4.5s loop.
      const progress = (t * 0.22) % 1;
      const point = curve.getPointAt(progress);
      pulseRef.current.position.set(point.x, point.y, 0.03);

      // Breathe, and flare as it climbs the QRS spike.
      const breathe = 1 + Math.sin(t * 6) * 0.1;
      pulseRef.current.scale.setScalar(breathe * (1 + point.y * 1.6));
    }

    if (lightRef.current) {
      lightRef.current.intensity = 1.8 + Math.sin(t * 6) * 0.5;
    }
  });

  return (
    <group position={[0, PULSE_Y, 0]}>
      {/* Soft outer halo of the line itself */}
      <mesh geometry={haloGeometry}>
        <meshBasicMaterial
          color={BRAND_TEAL}
          transparent
          opacity={0.16}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Crisp inner trace */}
      <mesh geometry={traceGeometry}>
        <meshBasicMaterial
          color={BRAND_TEAL}
          transparent
          opacity={0.7}
          toneMapped={false}
        />
      </mesh>

      {/* Travelling pulse */}
      <group ref={pulseRef}>
        <mesh>
          <sphereGeometry args={[0.017, 16, 16]} />
          <meshBasicMaterial color="#7ff5e6" toneMapped={false} />
        </mesh>

        {glowTexture && (
          <sprite scale={0.255}>
            <spriteMaterial
              map={glowTexture}
              transparent
              opacity={0.6}
              depthWrite={false}
              toneMapped={false}
            />
          </sprite>
        )}

        <pointLight
          ref={lightRef}
          color={BRAND_TEAL}
          intensity={1.8}
          distance={2.2}
          decay={2}
        />
      </group>
    </group>
  );
}

// 2c. Interactive 3D "AarogyaLink" wordmark
function Real3DAarogyaLinkText({ isAiMode }: { isAiMode: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const svg = useLoader(SVGLoader, "/aarogyalink.svg");

  // One entry per <path> in the SVG: "Aarogya" then "Link". SVGLoader parses
  // each path's fill into path.color, so the SVG itself tags which word is which.
  const words = useMemo(() => {
    return svg.paths.map((path, index) => {
      const isLink = path.color.getHexString() === LINK_FILL_HEX || index === 1;

      return {
        shapes: path.toShapes(),
        tone: isLink ? TONE_LINK : TONE_AAROGYA,
      };
    });
  }, [svg]);

  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.getElapsedTime();

      const targetRotY = Math.sin(t * 0.4) * 0.05 + state.pointer.x * 0.4;
      const targetRotX = Math.cos(t * 0.3) * 0.03 - state.pointer.y * 0.2;

      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.08);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.08);

      // Slow, minimal vertical float. Both the wordmark and the ECG line are
      // children of this group, so one sine wave moves them together.
      groupRef.current.position.y =
        GROUP_Y + Math.sin(state.clock.elapsedTime * FLOAT_SPEED) * FLOAT_AMPLITUDE;

      const targetZ = isAiMode ? -3 : 0;

      // Keep the wordmark inside the frustum on narrow viewports.
      const fit = Math.min(1, (state.viewport.width * 0.82) / WORDMARK_WIDTH);
      const targetScale = (isAiMode ? 0.7 : 1) * fit;

      groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetZ, 0.08);
      groupRef.current.scale.setScalar(THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, 0.08));
    }
  });

  return (
    <group ref={groupRef} position={[0, GROUP_Y, 0]}>
      <Center scale={[WORDMARK_SCALE, -WORDMARK_SCALE, WORDMARK_SCALE]}>
        {words.map((word, wordIndex) =>
          word.shapes.map((shape, shapeIndex) => (
            <mesh key={`${wordIndex}-${shapeIndex}`}>
              <extrudeGeometry args={[shape, EXTRUDE_SETTINGS]} />
              <meshStandardMaterial
                color={word.tone.color}
                emissive={word.tone.emissive}
                emissiveIntensity={word.tone.emissiveIntensity}
                metalness={word.tone.metalness}
                roughness={word.tone.roughness}
                envMapIntensity={word.tone.envMapIntensity}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))
        )}
      </Center>

      <PulseWave />
    </group>
  );
}

// 3. Main Stage Component
// Layer order: photographic backdrop -> WebGL wordmark. The backdrop stays in
// the DOM rather than as a textured plane so the wordmark composites over it
// cleanly. No overlay, tint or blur: hospital.png renders at full clarity and
// keeps its bright daytime look.
export default function CanvasStage({ isAiMode = false }: CanvasStageProps) {
  return (
    <div className="fixed inset-0 z-0 h-full w-full pointer-events-none bg-slate-100">
      <Image
        src="/hospital.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

      <div className="absolute inset-0">
        <Canvas
          shadows={false}
          dpr={[1, 1.5]} // Limit pixel ratio to avoid rendering lag
          gl={{
            antialias: true,
            powerPreference: "high-performance",
          }}
        >
          <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={45} />

          <StudioEnvironment />

          <ambientLight intensity={0.35} />
          <directionalLight
            position={[5, 10, 5]}
            intensity={1.4}
            color="#ffffff"
          />
          <directionalLight
            position={[-5, -2, 2]}
            intensity={0.5}
            color="#bcd4ff"
          />

          <Suspense fallback={null}>
            <Real3DAarogyaLinkText isAiMode={isAiMode} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
