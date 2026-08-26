"use client";

import React, { useRef, useEffect } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Three.js Official Verified Rigged Character (Direct Cloud Link)
const MODEL_URL = "https://threejs.org/examples/models/gltf/Xbot.glb";

export function Real3DDoctor({ isTalking = false }: { isTalking?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    if (names.length > 0) {
      // Default idle / gesture animation
      const activeAnim = names[0]; // e.g., 'idle' or 'agree'
      actions[activeAnim]?.reset().fadeIn(0.5).play();

      return () => {
        actions[activeAnim]?.fadeOut(0.5);
      };
    }
  }, [actions, names, isTalking]);

  useFrame((state) => {
    if (group.current) {
      // Smooth Mouse-Following Parallax
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        (state.mouse.x * Math.PI) / 6,
        0.05
      );
    }
  });

  return (
    <group ref={group} position={[0, -1.8, 0]} scale={1.8} dispose={null}>
      <primitive object={scene} castShadow receiveShadow />
    </group>
  );
}

useGLTF.preload(MODEL_URL);