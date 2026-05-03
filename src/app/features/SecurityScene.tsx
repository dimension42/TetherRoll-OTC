'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Float } from '@react-three/drei';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

function Shield() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.3;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.1;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.8, 4]} />
        <MeshDistortMaterial
          color="#00c9a7"
          transparent
          opacity={0.6}
          distort={0.2}
          speed={2}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[1.2, 2]} />
        <meshStandardMaterial
          color="#6366f1"
          transparent
          opacity={0.4}
          wireframe
        />
      </mesh>
    </Float>
  );
}

function OrbitingParticles() {
  const groupRef = useRef<THREE.Group>(null);

  const particles = useMemo(() => {
    const count = 40;
    return Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const radius = 2.5 + (i * 37 % 15) / 10;
      const y = ((i * 53 % 30) - 15) / 10;
      const size = 0.04 + (i * 17 % 4) / 100;
      return { angle, radius, y, size, even: i % 2 === 0 };
    });
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.5;
      groupRef.current.rotation.x = state.clock.elapsedTime * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(p.angle) * p.radius,
            p.y,
            Math.sin(p.angle) * p.radius,
          ]}
        >
          <sphereGeometry args={[p.size, 8, 8]} />
          <meshStandardMaterial
            color={p.even ? '#00ff88' : '#00c9a7'}
            emissive={p.even ? '#00ff88' : '#00c9a7'}
            emissiveIntensity={2}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function SecurityScene() {
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 50 }}>
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1} color="#00c9a7" />
      <pointLight position={[-5, -5, -3]} intensity={0.5} color="#6366f1" />
      <Shield />
      <OrbitingParticles />
    </Canvas>
  );
}
