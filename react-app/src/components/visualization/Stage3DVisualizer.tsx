import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../store';
import styles from './Stage3DVisualizer.module.scss';

interface Stage3DVisualizerProps {
  width?: number;
  height?: number;
  className?: string;
}

// Simplified fixture representation in 3D space
function Fixture3DRepresentation({ 
  fixture, 
  position 
}: { 
  fixture: any; 
  position: [number, number, number];
}) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  
  // Get DMX values for this fixture
  const dmxChannels = useStore(state => state.dmxChannels);
  const fixtureStartAddress = fixture.startAddress - 1; // Convert to 0-based
  
  // Extract channel values
  const panChannel = fixture.channels.find((c: any) => c.type === 'pan');
  const tiltChannel = fixture.channels.find((c: any) => c.type === 'tilt');
  const dimmerChannel = fixture.channels.find((c: any) => c.type === 'dimmer');
  const redChannel = fixture.channels.find((c: any) => c.type === 'red');
  const greenChannel = fixture.channels.find((c: any) => c.type === 'green');
  const blueChannel = fixture.channels.find((c: any) => c.type === 'blue');
  
  const panValue = panChannel ? dmxChannels[fixtureStartAddress + fixture.channels.indexOf(panChannel)] || 128 : 128;
  const tiltValue = tiltChannel ? dmxChannels[fixtureStartAddress + fixture.channels.indexOf(tiltChannel)] || 128 : 128;
  const dimmerValue = dimmerChannel ? dmxChannels[fixtureStartAddress + fixture.channels.indexOf(dimmerChannel)] || 0 : 0;
  
  const redValue = redChannel ? dmxChannels[fixtureStartAddress + fixture.channels.indexOf(redChannel)] || 0 : 0;
  const greenValue = greenChannel ? dmxChannels[fixtureStartAddress + fixture.channels.indexOf(greenChannel)] || 0 : 0;
  const blueValue = blueChannel ? dmxChannels[fixtureStartAddress + fixture.channels.indexOf(blueChannel)] || 0 : 0;
  
  const rgbColor = new THREE.Color(redValue / 255, greenValue / 255, blueValue / 255);
  const isOn = dimmerValue > 0;
  
  // Convert DMX values to angles
  const panAngle = useMemo(() => (panValue / 255) * Math.PI * 2, [panValue]);
  const tiltAngle = useMemo(() => ((tiltValue / 255) - 0.5) * Math.PI * 1.5, [tiltValue]);
  
  // Animate pan/tilt
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = panAngle;
    }
    if (headRef.current) {
      headRef.current.rotation.x = -tiltAngle;
    }
  });
  
  return (
    <group ref={groupRef} position={position}>
      {/* Fixture base */}
      <mesh position={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.3, 8]} />
        <meshStandardMaterial 
          color={isOn ? '#4ade80' : '#64748b'} 
          emissive={isOn ? '#4ade80' : '#000000'}
          emissiveIntensity={isOn ? 0.3 : 0}
        />
      </mesh>
      
      {/* Pan yoke */}
      <group position={[0, 0.25, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.2, 0.1, 0.2]} />
          <meshStandardMaterial color="#5a5a6a" metalness={0.8} roughness={0.2} />
        </mesh>
        
        {/* Tilt head */}
        <group ref={headRef} position={[0.15, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.3, 0.15, 0.15]} />
            <meshStandardMaterial color="#7a7a8a" metalness={0.8} roughness={0.2} />
          </mesh>
          
          {/* Beam (if on) */}
          {isOn && (
            <mesh position={[0.2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <coneGeometry args={[0.05, 0.5, 8]} />
              <meshStandardMaterial 
                color={rgbColor}
                emissive={rgbColor}
                emissiveIntensity={0.8}
                transparent
                opacity={0.6}
              />
            </mesh>
          )}
        </group>
      </group>
      
      {/* Label */}
      <mesh position={[0, 0.5, 0]}>
        <planeGeometry args={[0.6, 0.12]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

export const Stage3DVisualizer: React.FC<Stage3DVisualizerProps> = ({
  width = 800,
  height = 600,
  className
}) => {
  const fixtures = useStore(state => state.fixtures);
  const fixtureLayout = useStore(state => state.fixtureLayout);
  
  // Map fixtures to 3D positions
  const fixturePositions = useMemo(() => {
    return fixtures.map((fixture, index) => {
      // Try to get position from fixtureLayout
      const placedFixture = fixtureLayout.find((pf: any) => pf.fixtureId === fixture.id);
      
      if (placedFixture) {
        // Convert 2D canvas position to 3D stage position
        // Assuming canvas is normalized 0-1, map to stage coordinates
        const stageX = (placedFixture.x - 0.5) * 10; // -5 to 5 meters
        const stageZ = (placedFixture.y - 0.5) * 10; // -5 to 5 meters
        const stageY = 2.5; // Mount height in meters
        return [stageX, stageY, stageZ] as [number, number, number];
      }
      
      // Default grid layout if no position specified
      const cols = Math.ceil(Math.sqrt(fixtures.length));
      const row = Math.floor(index / cols);
      const col = index % cols;
      const spacing = 2; // 2 meters between fixtures
      const startX = -(cols - 1) * spacing / 2;
      const startZ = -(Math.ceil(fixtures.length / cols) - 1) * spacing / 2;
      
      return [
        startX + col * spacing,
        2.5, // Mount height
        startZ + row * spacing
      ] as [number, number, number];
    });
  }, [fixtures, fixtureLayout]);
  
  return (
    <div className={`${styles.stage3DVisualizer} ${className || ''}`} style={{ width, height }}>
      <Canvas
        shadows
        camera={{ position: [10, 8, 10], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <PerspectiveCamera makeDefault position={[10, 8, 10]} />
        
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1.0} castShadow />
        <directionalLight position={[-5, 5, -5]} intensity={0.5} />
        
        {/* Camera controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={30}
          target={[0, 2, 0]}
        />
        
        {/* Stage grid */}
        <Grid
          args={[20, 20]}
          cellColor="#444"
          sectionColor="#666"
          cellThickness={0.5}
          sectionThickness={1}
          position={[0, 0, 0]}
        />
        
        {/* Stage floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        
        {/* Render all fixtures */}
        {fixtures.map((fixture, index) => {
          const position = fixturePositions[index];
          if (!position) return null;
          
          return (
            <Fixture3DRepresentation
              key={fixture.id}
              fixture={fixture}
              position={position}
            />
          );
        })}
      </Canvas>
      
      <div className={styles.controls}>
        <div className={styles.info}>
          <span>Fixtures: {fixtures.length}</span>
          <span>View: 3D Stage</span>
        </div>
      </div>
    </div>
  );
};

