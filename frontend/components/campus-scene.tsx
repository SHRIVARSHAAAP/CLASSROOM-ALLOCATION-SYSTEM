"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import type { Group } from "three";
function Campus(){const group=useRef<Group>(null);useFrame(state=>{if(group.current)group.current.rotation.y=Math.sin(state.clock.elapsedTime/8)*0.13;});return <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.2}><group ref={group}><mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.3,0]}><planeGeometry args={[9,7]}/><meshStandardMaterial color="#0a3943"/></mesh>{Array.from({length:9},(_,i)=>{const h=0.6+(i%3)*0.45;return <group key={i} position={[(i%3)*2.5-2.5,h/2,Math.floor(i/3)*2-2]}><mesh><boxGeometry args={[1.8,h,1.25]}/><meshStandardMaterial color={i===4?"#2ce4cd":"#286577"} roughness={0.7}/></mesh><mesh position={[0,h/2+0.04,0]}><boxGeometry args={[1.9,0.08,1.35]}/><meshStandardMaterial color="#6cd5d4"/></mesh></group>;})}</group></Float>;}
export default function CampusScene(){return <Canvas camera={{position:[8,7,9],fov:40}} dpr={[1,1.5]}><ambientLight intensity={1.8}/><directionalLight position={[4,8,5]} intensity={2}/><Campus/><OrbitControls enableZoom={false} enablePan={false} minPolarAngle={0.5} maxPolarAngle={1.2}/></Canvas>;}
