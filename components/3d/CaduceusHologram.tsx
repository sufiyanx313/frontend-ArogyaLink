"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

export function CaduceusHologram() {
  const modelGroup = useRef<THREE.Group>(null);

  // Polished Surgical Steel / Platinum Material
  const surgicalSteelMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#f8fafc"),
      metalness: 0.98,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 1.0,
      envMapIntensity: 2.0,
    });
  }, []);

  const accentRingMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#0284c7"), // Clinical Cyan metallic accent
      metalness: 0.85,
      roughness: 0.2,
      clearcoat: 0.8,
      envMapIntensity: 1.5,
    });
  }, []);

  const { snakeCurve1, snakeCurve2 } = useMemo(() => {
    const p1: THREE.Vector3[] = [];
    const p2: THREE.Vector3[] = [];
    const turns = 2.75;
    const height = 4.2;

    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const angle = t * Math.PI * 2 * turns;
      const radius = Math.sin(t * Math.PI) * 0.75 + 0.28;
      const y = (t - 0.5) * height;

      p1.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
      p2.push(new THREE.Vector3(Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius));
    }

    return {
      snakeCurve1: new THREE.CatmullRomCurve3(p1),
      snakeCurve2: new THREE.CatmullRomCurve3(p2),
    };
  }, []);

  useFrame((_, delta) => {
    if (modelGroup.current) {
      modelGroup.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group ref={modelGroup} position={[0, 0, 0]} scale={1.15}>
      <Float speed={2} rotationIntensity={0.25} floatIntensity={0.5}>
        {/* Central Staff */}
        <group>
          <mesh material={surgicalSteelMaterial} castShadow receiveShadow>
            <cylinderGeometry args={[0.07, 0.04, 5.0, 48]} />
          </mesh>

          {[-0.8, 0, 0.8, 1.6].map((y, i) => (
            <mesh key={i} position={[0, y, 0]} material={accentRingMaterial}>
              <torusGeometry args={[0.085, 0.015, 24, 48]} />
            </mesh>
          ))}

          <mesh position={[0, 2.6, 0]} material={surgicalSteelMaterial} castShadow>
            <sphereGeometry args={[0.3, 64, 64]} />
          </mesh>
        </group>

        {/* Feathered Wings */}
        <group position={[0, 2.2, 0]}>
          <group position={[-0.2, 0, 0]} rotation={[0, 0.2, 0.4]}>
            {[0, 0.25, 0.5].map((offset, i) => (
              <mesh
                key={i}
                position={[-0.5 - offset * 0.4, offset * 0.3, 0]}
                rotation={[0, 0, 0.1 * i]}
                material={surgicalSteelMaterial}
                castShadow
              >
                <boxGeometry args={[0.9, 0.04, 0.22 - i * 0.04]} />
              </mesh>
            ))}
          </group>

          <group position={[0.2, 0, 0]} rotation={[0, -0.2, -0.4]}>
            {[0, 0.25, 0.5].map((offset, i) => (
              <mesh
                key={i}
                position={[0.5 + offset * 0.4, offset * 0.3, 0]}
                rotation={[0, 0, -0.1 * i]}
                material={surgicalSteelMaterial}
                castShadow
              >
                <boxGeometry args={[0.9, 0.04, 0.22 - i * 0.04]} />
              </mesh>
            ))}
          </group>
        </group>

        {/* Dual Serpents */}
        <group>
          <mesh material={surgicalSteelMaterial} castShadow receiveShadow>
            <tubeGeometry args={[snakeCurve1, 140, 0.065, 32, false]} />
          </mesh>
          <mesh position={[0.42, 2.05, 0.2]} rotation={[0.4, 0.8, -0.6]} material={surgicalSteelMaterial} castShadow>
            <coneGeometry args={[0.11, 0.35, 32]} />
          </mesh>

          <mesh material={surgicalSteelMaterial} castShadow receiveShadow>
            <tubeGeometry args={[snakeCurve2, 140, 0.065, 32, false]} />
          </mesh>
          <mesh position={[-0.42, 2.05, -0.2]} rotation={[-0.4, -0.8, 0.6]} material={surgicalSteelMaterial} castShadow>
            <coneGeometry args={[0.11, 0.35, 32]} />
          </mesh>
        </group>
      </Float>
    </group>
  );
}