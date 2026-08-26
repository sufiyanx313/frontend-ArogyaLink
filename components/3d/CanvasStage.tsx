"use client";

import React, { Suspense, useRef, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  PerspectiveCamera,
  Float,
  Center,
  useTexture,
} from "@react-three/drei";
import * as THREE from "three";
import { SVGLoader } from "three-stdlib";

useTexture.preload("/hospital.png");

interface CanvasStageProps {
  isAiMode?: boolean;
}

// 1. Static Hospital Background
function HospitalBackground() {
  const texture = useTexture("/hospital.png");

  return (
    <mesh position={[0, 0, -10]}>
      <planeGeometry args={[30, 16.8]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

// 2. Interactive 3D "महाराष्ट्र"
function Real3DMaharashtraText({ isAiMode }: { isAiMode: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const svg = useLoader(SVGLoader, "/maharashtra.svg");

  const shapes = useMemo(() => {
    return svg.paths.flatMap((path) => path.toShapes());
  }, [svg]);

  const extrudeSettings = {
    depth: 14,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 1,
    bevelThickness: 1.2,
  };

  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.getElapsedTime();
      
      const targetRotY = Math.sin(t * 0.4) * 0.05 + state.pointer.x * 0.4;
      const targetRotX = Math.cos(t * 0.3) * 0.03 - state.pointer.y * 0.2;

      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.08);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.08);

      const targetZ = isAiMode ? -3 : 0;
      const targetScale = isAiMode ? 0.7 : 1;

      groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetZ, 0.08);
      groupRef.current.scale.setScalar(THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, 0.08));
    }
  });

  return (
    <Float speed={1.8} rotationIntensity={0.08} floatIntensity={0.4} position={[0, 0.2, 0]}>
      <group ref={groupRef}>
        <Center scale={[0.0058, -0.0058, 0.0058]}>
          {shapes.map((shape, index) => (
            <mesh key={index} castShadow receiveShadow>
              <extrudeGeometry args={[shape, extrudeSettings]} />
              <meshStandardMaterial
                color="#f59e0b"
                roughness={0.25}
                metalness={0.8}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
        </Center>
      </group>
    </Float>
  );
}

// 3. Main Stage Component
export default function CanvasStage({ isAiMode = false }: CanvasStageProps) {
  return (
    <div className="fixed inset-0 z-0 h-full w-full pointer-events-none bg-[#0f172a]">
      <Canvas
        shadows={false}
        dpr={[1, 1.5]} // Limit pixel ratio to avoid rendering lag
        gl={{
          antialias: true,
          powerPreference: "high-performance",
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={45} />

        <ambientLight intensity={1.8} />
        <directionalLight 
          position={[5, 10, 5]} 
          intensity={2.8} 
          color="#ffffff" 
        />
        <directionalLight 
          position={[-5, -2, 2]} 
          intensity={1.0} 
          color="#fef08a" 
        />

        <Suspense fallback={null}>
          <HospitalBackground />
          <Real3DMaharashtraText isAiMode={isAiMode} />
        </Suspense>
      </Canvas>
    </div>
  );
}