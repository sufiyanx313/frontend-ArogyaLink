"use client";

import React, { useEffect, useState, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import { CaduceusHologram } from "@/components/3d/CaduceusHologram";
import { CheckCircle2 } from "lucide-react";

interface MedicalPreloaderProps {
  onComplete: () => void;
}

function RotatingEmblem() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.55;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.2, 0]} scale={0.95}>
      <CaduceusHologram />
    </group>
  );
}

export function MedicalPreloader({ onComplete }: MedicalPreloaderProps) {
  const [phase, setPhase] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    // 3.5s par progress bar 100% hoga aur text "READY" me badal jayega
    const readyTimer = setTimeout(() => {
      setPhase("ready");
    }, 3500);

    // 4.3s par preloader cleanly unmount hoga, tab tak user "READY" dekh chuka hoga
    const finishTimer = setTimeout(() => {
      onComplete();
    }, 4300);

    return () => {
      clearTimeout(readyTimer);
      clearTimeout(finishTimer);
    };
  }, [onComplete]);

  return (
    <motion.div
      key="preloader"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }} // Fade-out with slight premium pop out
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[100] bg-[#f8fafc] flex flex-col items-center justify-center select-none overflow-hidden"
    >
      {/* Soft Clinical Radial Glow */}
      <div className="absolute w-[600px] h-[600px] rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

      {/* Real 3D Viewport with CaduceusHologram */}
      <div className="relative w-full max-w-[500px] h-[440px] flex items-center justify-center">
        <Canvas
          camera={{ position: [0, 0, 8.5], fov: 42 }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            powerPreference: "high-performance",
          }}
        >
          <Environment preset="city" />
          <ambientLight intensity={1.5} />
          <directionalLight position={[10, 15, 10]} intensity={3.5} color="#ffffff" />
          <directionalLight position={[-10, 5, -10]} intensity={1.8} color="#bae6fd" />
          <pointLight position={[0, -2, 2]} intensity={2.5} color="#0284c7" />
          
          <RotatingEmblem />
        </Canvas>
      </div>

      {/* Healthcare Branding + 2-Phase Animated Loading */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="flex flex-col items-center gap-3.5 z-10 -mt-3"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-600 animate-ping" />
          <p className="text-[11px] font-mono font-bold tracking-[0.25em] text-slate-600 uppercase">
            Government of Maharashtra • आरोग्य विभाग
          </p>
        </div>

        {/* Text Switcher (Loading -> System Ready) */}
        <div className="h-5 flex items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            {phase === "loading" ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center text-sm font-extrabold tracking-widest text-slate-900 font-mono"
              >
                LOADING
                <motion.span
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  className="tracking-normal ml-0.5 text-sky-600"
                >
                  ...
                </motion.span>
              </motion.div>
            ) : (
              <motion.div
                key="ready"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-sm font-extrabold tracking-widest text-emerald-600 font-mono"
              >
                <CheckCircle2 className="w-4 h-4" />
                SYSTEM READY
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dynamic Medical Progress Indicator */}
        <div className="w-56 h-[3px] bg-slate-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 3.5, ease: "easeInOut" }}
            className={`h-full rounded-full transition-colors duration-500 ${
              phase === "ready"
                ? "bg-emerald-500"
                : "bg-gradient-to-r from-sky-600 via-amber-500 to-sky-600"
            }`}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}