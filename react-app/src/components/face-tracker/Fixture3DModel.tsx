import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import ErrorBoundary from '../ErrorBoundary';
import styles from './Fixture3DModel.module.scss';

interface Fixture3DModelProps {
  panValue: number; // 0-255 DMX value
  tiltValue: number; // 0-255 DMX value
  zoomValue?: number; // 0-255 DMX value (optional)
  irisValue?: number; // 0-255 DMX value (optional)
  focusValue?: number; // 0-255 DMX value (optional)
  shutterValue?: number; // 0-255 DMX value (0 = closed/off, 255 = fully open)
  goboValue?: number; // 0-255 DMX value (gobo selection/rotation)
  rgbColor?: { r: number; g: number; b: number }; // RGB color from fixture (0-255)
  width?: number;
  height?: number;
  className?: string;
}

// Professional DMX Moving Head Fixture - Complete redesign
function MovingHeadFixture({ 
  panValue, 
  tiltValue, 
  zoomValue = 128, 
  irisValue = 255,
  focusValue = 128,
  shutterValue = 255, // Default: fully open
  goboValue = 0, // Default: no gobo
  rgbColor = { r: 255, g: 200, b: 100 } // Default warm white
}: { 
  panValue: number; 
  tiltValue: number; 
  zoomValue?: number; 
  irisValue?: number;
  focusValue?: number;
  shutterValue?: number;
  goboValue?: number;
  rgbColor?: { r: number; g: number; b: number };
}) {
  const baseRef = useRef<THREE.Group>(null);
  const panYokeRef = useRef<THREE.Group>(null);
  const tiltHeadRef = useRef<THREE.Group>(null);
  const zoomLensRef = useRef<THREE.Group>(null);
  const irisBladesRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const beamCoreRef = useRef<THREE.Mesh>(null);
  const goboPatternRef = useRef<THREE.Mesh>(null);

  // Convert DMX values to real-world parameters
  // Pan: 0-255 maps to 0-360° (continuous rotation)
  const panAngle = useMemo(() => {
    return (panValue / 255) * Math.PI * 2; // 0 to 2π (360°)
  }, [panValue]);

  // Tilt: 0-255 maps to -135° to +135° (270° total range, typical for moving heads)
  const tiltAngle = useMemo(() => {
    return ((tiltValue / 255) - 0.5) * Math.PI * 1.5; // -135° to +135°
  }, [tiltValue]);

  // Zoom: 0-255 maps to lens position (0.0 to 0.15 forward movement) and beam angle (60° to 5°)
  const zoomPosition = useMemo(() => {
    return (zoomValue / 255) * 0.15; // Lens moves forward for zoom
  }, [zoomValue]);

  const beamAngle = useMemo(() => {
    // Narrower beam = more zoom (smaller angle)
    return (60 - (zoomValue / 255) * 55) * (Math.PI / 180); // 60° to 5° in radians
  }, [zoomValue]);

  // Iris: 0-255 maps to iris opening (closed to fully open)
  // 0 = fully closed, 255 = fully open
  const irisOpening = useMemo(() => {
    return irisValue / 255; // 0.0 to 1.0
  }, [irisValue]);

  // Focus: 0-255 maps to focus blur (not visually represented but could affect beam)
  const focusBlur = useMemo(() => {
    return focusValue / 255;
  }, [focusValue]);

  // Shutter: 0-255 maps to beam visibility/intensity (0 = closed/off, 255 = fully open)
  const shutterOpening = useMemo(() => {
    return shutterValue / 255; // 0.0 to 1.0
  }, [shutterValue]);

  // Gobo: 0-255 maps to gobo pattern selection/rotation
  const goboPattern = useMemo(() => {
    return Math.floor((goboValue / 255) * 8); // 0-7 patterns
  }, [goboValue]);
  
  const goboRotation = useMemo(() => {
    return (goboValue / 255) * Math.PI * 4; // 0 to 4π (2 full rotations)
  }, [goboValue]);

  // Create gobo pattern texture
  const goboTexture = useMemo(() => {
    if (goboValue === 0) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 256);
    
    // Draw pattern based on goboPattern (0-7)
    ctx.fillStyle = '#ffffff';
    const centerX = 128;
    const centerY = 128;
    
    switch (goboPattern) {
      case 0: // Circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 1: // Star
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const x = centerX + Math.cos(angle) * 80;
          const y = centerY + Math.sin(angle) * 80;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 2: // Hexagon
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI * 2) / 6;
          const x = centerX + Math.cos(angle) * 80;
          const y = centerY + Math.sin(angle) * 80;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 3: // Square
        ctx.fillRect(centerX - 60, centerY - 60, 120, 120);
        break;
      case 4: // Cross
        ctx.fillRect(centerX - 10, centerY - 80, 20, 160);
        ctx.fillRect(centerX - 80, centerY - 10, 160, 20);
        break;
      case 5: // Lines
        for (let i = 0; i < 8; i++) {
          ctx.fillRect(centerX - 2, centerY - 80 + (i * 20), 4, 15);
        }
        break;
      case 6: // Dots
        for (let i = 0; i < 5; i++) {
          for (let j = 0; j < 5; j++) {
            ctx.beginPath();
            ctx.arc(centerX - 80 + (i * 40), centerY - 80 + (j * 40), 8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      case 7: // Spiral
        ctx.beginPath();
        for (let i = 0; i < 100; i++) {
          const angle = i * 0.2;
          const radius = i * 0.8;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
        break;
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, [goboPattern, goboValue]);

  // Animate all mechanisms smoothly
  useFrame(() => {
    // Pan rotation (base rotates around Y axis)
    if (panYokeRef.current) {
      panYokeRef.current.rotation.y = panAngle;
    }

    // Tilt rotation (head rotates around local X axis)
    if (tiltHeadRef.current) {
      tiltHeadRef.current.rotation.x = -tiltAngle; // Negative for correct direction
    }

    // Zoom - lens moves forward/back along Z axis
    if (zoomLensRef.current) {
      zoomLensRef.current.position.z = zoomPosition;
    }

    // Update beam position to track lens front - beam base should be at lens front face
    // Lens assembly is at [0.21, 0, 0] within tilt head, moves to [0.21, 0, zoomPosition] with zoom
    // Lens glass is at [0, 0, 0.01] within lens assembly (cylinder with height 0.02, so front face is at z=0.02)
    // Lens front face is at [0.21, 0, zoomPosition + 0.02] from tilt head origin
    // ConeGeometry has base at origin, tip extends along +Y (before rotation)
    // After rotation [0, 0, -Math.PI/2], base is at origin, tip extends along +X
    // So we position the base (mesh origin) at the lens front
    const lensFrontX = 0.21; // Lens assembly X position
    const lensFrontZ = zoomPosition + 0.02; // Lens front Z position (moves with zoom)
    if (beamRef.current) {
      // Position beam base at lens front - cone base is at mesh origin
      beamRef.current.position.set(lensFrontX, 0, lensFrontZ);
    }
    if (beamCoreRef.current) {
      // Position beam core base at lens front
      beamCoreRef.current.position.set(lensFrontX, 0, lensFrontZ);
    }

    // Update beam based on zoom (beam angle changes)
    if (beamRef.current) {
      // Beam cone angle changes with zoom
      const baseRadius = 0.12; // Match the cone base radius
      const beamLength = 0.6; // Match the shortened beam length
      const currentAngle = beamAngle;
      const beamRadius = Math.tan(currentAngle / 2) * beamLength;
      
      beamRef.current.scale.set(
        beamRadius / baseRadius,
        beamRadius / baseRadius,
        1.0 // Keep length constant, only scale width based on zoom
      );
      
      // Beam intensity based on iris opening AND shutter opening
      if (beamRef.current.material instanceof THREE.MeshStandardMaterial) {
        const baseIntensity = 0.8 + (irisOpening * 0.4);
        const baseOpacity = 0.3 + (irisOpening * 0.15);
        beamRef.current.material.emissiveIntensity = baseIntensity * shutterOpening;
        beamRef.current.material.opacity = baseOpacity * shutterOpening;
        // Hide beam completely when shutter is closed
        beamRef.current.visible = shutterOpening > 0.01;
      }
    }
    
    // Update inner beam core intensity
    if (beamCoreRef.current && beamCoreRef.current.material instanceof THREE.MeshStandardMaterial) {
      const baseIntensity = 1.0 + (irisOpening * 0.4);
      const baseOpacity = 0.4 + (irisOpening * 0.2);
      beamCoreRef.current.material.emissiveIntensity = baseIntensity * shutterOpening;
      beamCoreRef.current.material.opacity = baseOpacity * shutterOpening;
      // Hide beam core when shutter is closed
      beamCoreRef.current.visible = shutterOpening > 0.01;
    }

    // Update gobo pattern rotation
    if (goboPatternRef.current && shutterOpening > 0.01) {
      goboPatternRef.current.rotation.z = goboRotation;
      goboPatternRef.current.visible = goboValue > 0;
    } else if (goboPatternRef.current) {
      goboPatternRef.current.visible = false;
    }
  });

  // Professional DMX fixture colors - bright and visible
  const baseColor = "#3a3a4a";
  const yokeColor = "#5a5a6a";
  const headColor = "#7a7a8a";
  const trimColor = "#9a9aaa";
  const lensColor = "#ffffff";
  const irisColor = "#2a2a2a";
  
  // Beam color from fixture RGB values (normalize 0-255 to 0-1)
  const beamColor = useMemo(() => {
    const r = rgbColor.r / 255;
    const g = rgbColor.g / 255;
    const b = rgbColor.b / 255;
    return new THREE.Color(r, g, b);
  }, [rgbColor]);
  
  // Beam color as hex string for material
  const beamColorHex = useMemo(() => {
    const r = Math.round(rgbColor.r).toString(16).padStart(2, '0');
    const g = Math.round(rgbColor.g).toString(16).padStart(2, '0');
    const b = Math.round(rgbColor.b).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }, [rgbColor]);

  // Create iris blades (6 blades for realistic iris)
  const irisBlades = useMemo(() => {
    const blades = [];
    const bladeCount = 6;
    const maxRadius = 0.10;
    const minRadius = 0.02;
    const currentRadius = minRadius + (irisOpening * (maxRadius - minRadius));
    
    for (let i = 0; i < bladeCount; i++) {
      const angle = (i / bladeCount) * Math.PI * 2;
      const bladeRotation = angle + (irisOpening < 0.5 ? Math.PI / 2 : 0);
      
      blades.push(
        <mesh
          key={i}
          position={[
            Math.cos(angle) * (currentRadius * 0.5),
            Math.sin(angle) * (currentRadius * 0.5),
            0
          ]}
          rotation={[0, 0, bladeRotation]}
        >
          <boxGeometry args={[currentRadius * 1.5, 0.005, 0.01]} />
          <meshStandardMaterial 
            color={irisColor} 
            metalness={0.9} 
            roughness={0.1}
            emissive="#1a1a1a"
            emissiveIntensity={0.2}
          />
        </mesh>
      );
    }
    return blades;
  }, [irisOpening, irisColor]);

  return (
    <group>
      {/* Base Stand - Mounting base with pan motor */}
      <group ref={baseRef} position={[0, -0.6, 0]}>
        {/* Base plate - mounting surface */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.20, 0.20, 0.08, 16]} />
          <meshStandardMaterial color={baseColor} metalness={0.9} roughness={0.1} />
        </mesh>
        
        {/* DMX Input Port (5-pin XLR style) */}
        <mesh position={[-0.12, -0.02, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.015, 0.015, 0.03, 16]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[-0.12, -0.02, 0.015]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.01, 16]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.2} />
        </mesh>
        
        {/* DMX Output Port (5-pin XLR style) */}
        <mesh position={[0.12, -0.02, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.015, 0.015, 0.03, 16]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0.12, -0.02, 0.015]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.01, 16]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.2} />
        </mesh>
        
        {/* Base column */}
        <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.14, 0.16, 0.25, 16]} />
          <meshStandardMaterial color={baseColor} metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Pan motor housing */}
        <mesh position={[0, 0.18, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.13, 0.12, 16]} />
          <meshStandardMaterial color={yokeColor} metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Pan motor indicator ring */}
        <mesh position={[0, 0.24, 0]} castShadow>
          <torusGeometry args={[0.13, 0.01, 8, 16]} />
          <meshStandardMaterial color={trimColor} metalness={0.9} roughness={0.1} />
        </mesh>
      </group>

      {/* Pan Yoke - Rotates around Y axis for pan movement */}
      <group ref={panYokeRef} position={[0, -0.3, 0]}>
        {/* Yoke base connection */}
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 0.08, 16]} />
          <meshStandardMaterial color={yokeColor} metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Yoke arm - horizontal support */}
        <mesh position={[0.3, 0.15, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <boxGeometry args={[0.6, 0.06, 0.06]} />
          <meshStandardMaterial color={yokeColor} metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Yoke reinforcement */}
        <mesh position={[0.3, 0.15, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <boxGeometry args={[0.6, 0.08, 0.08]} />
          <meshStandardMaterial color={trimColor} metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Tilt motor housing (at end of yoke) */}
        <mesh position={[0.6, 0.15, 0]} castShadow>
          <boxGeometry args={[0.10, 0.10, 0.10]} />
          <meshStandardMaterial color={yokeColor} metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Tilt Head - Rotates around local X axis for tilt movement */}
        <group ref={tiltHeadRef} position={[0.6, 0.15, 0]}>
          {/* Head body - main fixture housing */}
          <mesh castShadow>
            <boxGeometry args={[0.40, 0.32, 0.32]} />
            <meshStandardMaterial color={headColor} metalness={0.7} roughness={0.3} />
          </mesh>

          {/* Head front panel */}
          <mesh position={[0.20, 0, 0]} castShadow>
            <boxGeometry args={[0.02, 0.32, 0.32]} />
            <meshStandardMaterial color={trimColor} metalness={0.8} roughness={0.2} />
          </mesh>

          {/* Cooling vents on top */}
          {Array.from({ length: 6 }).map((_, i) => (
            <mesh 
              key={i} 
              position={[0, 0.18, -0.12 + (i * 0.04)]} 
              castShadow
            >
              <boxGeometry args={[0.35, 0.015, 0.02]} />
              <meshStandardMaterial color={trimColor} metalness={0.6} roughness={0.4} />
            </mesh>
          ))}

          {/* Side panels */}
          <mesh position={[0, 0, 0.16]} castShadow>
            <boxGeometry args={[0.40, 0.32, 0.02]} />
            <meshStandardMaterial color={trimColor} metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, -0.16]} castShadow>
            <boxGeometry args={[0.40, 0.32, 0.02]} />
            <meshStandardMaterial color={trimColor} metalness={0.6} roughness={0.4} />
          </mesh>

          {/* Lens Assembly - Zoom mechanism moves this forward/back */}
          <group ref={zoomLensRef} position={[0.21, 0, 0]}>
            {/* Lens housing */}
            <mesh castShadow>
              <cylinderGeometry args={[0.13, 0.13, 0.08, 32]} />
              <meshStandardMaterial color={trimColor} metalness={0.9} roughness={0.1} />
            </mesh>

            {/* Lens bezel ring */}
            <mesh position={[0, 0, 0.04]} castShadow>
              <torusGeometry args={[0.13, 0.008, 16, 32]} />
              <meshStandardMaterial color={trimColor} metalness={0.95} roughness={0.05} />
            </mesh>

            {/* Iris mechanism - visible blades */}
            <group ref={irisBladesRef} position={[0, 0, 0.02]}>
              {irisBlades}
              
              {/* Iris housing ring */}
              <mesh castShadow>
                <torusGeometry args={[0.10, 0.003, 16, 32]} />
                <meshStandardMaterial 
                  color={irisColor} 
                  metalness={0.9} 
                  roughness={0.1}
                />
              </mesh>
            </group>

            {/* Main lens glass */}
            <mesh position={[0, 0, 0.01]} castShadow>
              <cylinderGeometry args={[0.10, 0.10, 0.02, 32]} />
              <meshStandardMaterial 
                color={lensColor}
                emissive={lensColor}
                emissiveIntensity={0.6}
                metalness={0.1}
                roughness={0.05}
                transparent
                opacity={0.9}
              />
            </mesh>

            {/* Lens reflection highlight */}
            <mesh position={[0.005, 0.015, 0.015]} castShadow>
              <sphereGeometry args={[0.03, 16, 16]} />
              <meshStandardMaterial 
                color="#ffffff"
                emissive="#ffffff"
                emissiveIntensity={1.2}
                transparent
                opacity={0.7}
              />
            </mesh>
          </group>

          {/* Light beam - realistic stage light beam (originates from lens) */}
          {/* Beam tip positioned at lens front face, pointing along +X axis */}
          {/* Position will be updated in useFrame to track lens movement with zoom */}
          <mesh 
            ref={beamRef} 
            position={[0.21, 0, 0.02]} 
            rotation={[0, 0, -Math.PI / 2]}
          >
            {/* Cone geometry: args=[radiusTop, radiusBottom, height, radialSegments, openEnded] */}
            {/* Tip is at origin, base extends along +Y (before rotation) */}
            <coneGeometry args={[0.12, 0.6, 16, 1, true]} />
            <meshStandardMaterial
              color={beamColorHex}
              transparent
              opacity={0.25}
              emissive={beamColorHex}
              emissiveIntensity={0.8}
              side={THREE.DoubleSide}
            />
          </mesh>
          
          {/* Inner beam core - brighter center, also originates from lens */}
          <mesh 
            ref={beamCoreRef}
            position={[0.21, 0, 0.02]} 
            rotation={[0, 0, -Math.PI / 2]}
          >
            <coneGeometry args={[0.06, 0.6, 8, 1, true]} />
            <meshStandardMaterial
              color={beamColorHex}
              transparent
              opacity={0.4}
              emissive={beamColorHex}
              emissiveIntensity={1.2}
              side={THREE.DoubleSide}
            />
          </mesh>
          
          {/* Gobo pattern - projected pattern on beam, positioned slightly forward from lens */}
          {goboTexture && (
            <mesh 
              ref={goboPatternRef}
              position={[0.21, 0, 0.15]} 
              rotation={[0, 0, -Math.PI / 2]}
            >
              <planeGeometry args={[0.12, 0.12, 16, 16]} />
              <meshStandardMaterial
                map={goboTexture}
                color={beamColorHex}
                transparent
                opacity={0.6}
                emissive={beamColorHex}
                emissiveIntensity={0.8}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
        </group>
      </group>

      {/* Ground plane for shadows and reference */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]} receiveShadow>
        <planeGeometry args={[4, 4]} />
        <meshStandardMaterial color="#0f0f0f" />
      </mesh>
    </group>
  );
}

export const Fixture3DModel: React.FC<Fixture3DModelProps> = ({
  panValue,
  tiltValue,
  zoomValue = 128,
  irisValue = 255,
  focusValue = 128,
  shutterValue = 255,
  goboValue = 0,
  rgbColor = { r: 255, g: 200, b: 100 },
  width = 400,
  height = 400,
  className
}) => {
  const [webglError, setWebglError] = useState<string | null>(null);
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);

  // Check WebGL support on mount
  useEffect(() => {
    const checkWebGL = () => {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
          setWebglSupported(false);
          setWebglError('WebGL is not supported in this browser');
          return;
        }
        setWebglSupported(true);
      } catch (e) {
        setWebglSupported(false);
        setWebglError('WebGL check failed: ' + (e instanceof Error ? e.message : String(e)));
      }
    };
    checkWebGL();
  }, []);

  // Handle WebGL context creation errors
  const handleWebGLError = (error: Error) => {
    console.error('WebGL Context Error:', error);
    setWebglError(error.message || 'Failed to create WebGL context');
    setWebglSupported(false);
  };

  // Fallback UI when WebGL is not available
  if (webglSupported === false) {
    return (
      <div className={`${styles.fixture3DContainer} ${className || ''}`} style={{ width, height }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '2rem',
          textAlign: 'center',
          color: '#999',
          background: '#1a1a1a'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            WebGL Not Available
          </div>
          <div style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
            {webglError || 'WebGL is required for 3D visualization'}
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
            <div>Pan: {panValue} | Tilt: {tiltValue}</div>
            <div>RGB: ({rgbColor.r}, {rgbColor.g}, {rgbColor.b})</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.fixture3DContainer} ${className || ''}`} style={{ width, height }}>
      <ErrorBoundary>
        <Canvas
          shadows
          camera={{ position: [1.8, 0.6, 1.8], fov: 50 }}
          gl={{ 
            antialias: true, 
            alpha: true,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false,
            preserveDrawingBuffer: false
          }}
          onCreated={({ gl }) => {
            // Check if WebGL renderer was created successfully
            // If we get here, WebGL context was created successfully
            // The pre-flight check already validated WebGL support
            if (!gl || !gl.domElement) {
              handleWebGLError(new Error('Canvas or WebGL renderer is null'));
            }
          }}
        >
          {/* Professional lighting setup */}
          <ambientLight intensity={0.9} />
          <directionalLight position={[5, 5, 5]} intensity={2.0} castShadow />
          <directionalLight position={[-3, 3, -3]} intensity={0.9} />
          <pointLight position={[-5, 5, -5]} intensity={0.8} />
          <spotLight position={[2, 3, 2]} angle={0.3} penumbra={0.5} intensity={1.2} castShadow />

          {/* Camera controls */}
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={1.2}
            maxDistance={5}
            autoRotate={false}
          />

          {/* Fixture model */}
          <MovingHeadFixture 
            panValue={panValue} 
            tiltValue={tiltValue} 
            zoomValue={zoomValue}
            irisValue={irisValue}
            focusValue={focusValue}
            shutterValue={shutterValue}
            goboValue={goboValue}
            rgbColor={rgbColor}
          />

          {/* Grid helper - positioned below fixture */}
          <gridHelper args={[2, 20, '#555', '#333']} position={[0, -0.8, 0]} />
        </Canvas>
      </ErrorBoundary>
    </div>
  );
};
