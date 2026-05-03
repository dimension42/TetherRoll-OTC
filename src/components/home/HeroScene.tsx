'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Float, Stars, Torus, Ring } from '@react-three/drei';
import * as THREE from 'three';

function GoldSphere() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.3;
      meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.2) * 0.1;
    }
  });
  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.8}>
      <Sphere ref={meshRef} args={[1.4, 64, 64]} position={[0, 0, 0]}>
        <MeshDistortMaterial
          color="#f0b429"
          distort={0.35}
          speed={2}
          roughness={0.1}
          metalness={0.9}
          emissive="#c9922a"
          emissiveIntensity={0.3}
        />
      </Sphere>
    </Float>
  );
}

function OrbitRing({ radius, speed, color }: { radius: number; speed: number; color: string }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = clock.getElapsedTime() * speed;
    }
  });
  return (
    <group ref={groupRef} rotation={[Math.PI / 3, 0, 0]}>
      <Torus args={[radius, 0.008, 16, 100]}>
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </Torus>
    </group>
  );
}

function FloatingParticles() {
  const count = 80;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return arr;
  }, []);

  const pointsRef = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = clock.getElapsedTime() * 0.04;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#f0b429" size={0.025} transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

export default function HeroScene() {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[5, 5, 5]} intensity={2} color="#f0b429" />
        <pointLight position={[-5, -3, -5]} intensity={1} color="#6366f1" />
        <spotLight position={[0, 8, 0]} intensity={1.5} color="#ffffff" />

        <GoldSphere />
        <OrbitRing radius={2.2} speed={0.4} color="#f0b429" />
        <OrbitRing radius={3} speed={-0.25} color="#6366f1" />
        <OrbitRing radius={3.8} speed={0.15} color="#00ff88" />
        <FloatingParticles />
        <Stars radius={30} depth={30} count={300} factor={2} saturation={0} fade speed={0.5} />
      </Canvas>
    </div>
  );
}
