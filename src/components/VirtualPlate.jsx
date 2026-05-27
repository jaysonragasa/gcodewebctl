import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Box, Cylinder, Line, Html } from '@react-three/drei';
import { serialConnection } from '../utils/SerialConnection';

function Nozzle({ position, temps, fanSpeed }) {
  const fanRef = useRef();

  const nozzleTemp = temps?.nozzle || 0;
  const safeFanSpeed = fanSpeed || 0;

  // Animate the fan spinning based on fanSpeed (0-255)
  useFrame((state, delta) => {
    if (fanRef.current && safeFanSpeed > 0) {
      fanRef.current.rotation.y -= (safeFanSpeed / 255) * 25 * delta;
    }
  });

  // Calculate glow intensity safely
  const glow = Math.min(4, Math.max(0.1, (nozzleTemp / 50) || 0.1));
  const emissiveColor = nozzleTemp > 50 ? "#ff2200" : "#001122";

  // Prevent NaN coordinates from crashing Three.js
  const safePos = [
    Number.isNaN(position[0]) ? 0 : position[0],
    Number.isNaN(position[1]) ? 0 : position[1],
    Number.isNaN(position[2]) ? 0 : position[2]
  ];

  return (
    <group position={safePos}>
      {/* The actual nozzle tip */}
      <Cylinder args={[0.8, 0.2, 3, 16]} position={[0, 1.5, 0]}>
        <meshBasicMaterial color={nozzleTemp > 50 ? "#ff6600" : "#000000"} />
      </Cylinder>
      {/* Tip Glow Line */}
      <Cylinder args={[0.85, 0.25, 2.8, 16]} position={[0, 1.5, 0]}>
        <meshBasicMaterial color="#0ea5e9" wireframe />
      </Cylinder>
      
      {/* Heater block */}
      <Box args={[7, 4, 5]} position={[0, 5, 0]}>
        <meshStandardMaterial color="#000000" metalness={1} roughness={0.2} emissive={emissiveColor} emissiveIntensity={glow} />
      </Box>
      <Box args={[7.1, 4.1, 5.1]} position={[0, 5, 0]}>
        <meshBasicMaterial color={nozzleTemp > 50 ? "#ff2200" : "#0ea5e9"} wireframe />
      </Box>
      
      {/* Heatbreak/Throat */}
      <Cylinder args={[1.2, 1.2, 3, 16]} position={[0, 8.5, 0]}>
        <meshStandardMaterial color="#000" />
      </Cylinder>

      {/* Heatsink Fins (TRON Edge Glowing) */}
      {[0, 1, 2, 3, 4].map(i => (
        <group key={i} position={[0, 11 + i * 1.5, 0]}>
          <Cylinder args={[3.5, 3.5, 0.6, 32]}>
            <meshStandardMaterial color="#000" metalness={1} />
          </Cylinder>
          {/* Glowing edge for each fin */}
          <Cylinder args={[3.6, 3.6, 0.2, 32]}>
            <meshBasicMaterial color="#0ea5e9" />
          </Cylinder>
        </group>
      ))}

      {/* Main Extruder Body */}
      <Box args={[8, 12, 8]} position={[0, 24, 0]}>
        <meshStandardMaterial color="#000" metalness={1} />
      </Box>
      <Box args={[8.1, 12.1, 8.1]} position={[0, 24, 0]}>
        <meshBasicMaterial color="#0ea5e9" wireframe />
      </Box>

      {/* Animated Cooling Fan Assembly */}
      <group position={[0, 15, 4.5]}>
        {/* Fan Housing */}
        <Box args={[6, 6, 1]}>
          <meshStandardMaterial color="#000" emissive="#000" />
        </Box>
        {/* Fan wireframe edge */}
        <Box args={[6.1, 6.1, 1.1]}>
          <meshBasicMaterial color="#0ea5e9" wireframe />
        </Box>
        {/* Spinning Fan Blades */}
        <group ref={fanRef} position={[0, 0, 0.6]}>
          <Box args={[5, 1, 0.2]}>
            <meshBasicMaterial color={fanSpeed > 0 ? "#0ea5e9" : "#333"} />
          </Box>
          <Box args={[1, 5, 0.2]}>
            <meshBasicMaterial color={fanSpeed > 0 ? "#0ea5e9" : "#333"} />
          </Box>
        </group>
      </group>

      {/* HUD Pointer Line */}
      <Line points={[[0, 5, 0], [15, 15, 0], [30, 20, 0]]} color="#0ea5e9" lineWidth={1} transparent opacity={0.5} />

      {/* Hologram Info Panel */}
      <Html position={[30, 20, 0]} transform sprite distanceFactor={150}>
        <div className="flex flex-col p-1 text-[10px] text-white font-mono whitespace-nowrap pointer-events-none select-none">
          <div className="flex justify-between space-x-6 mb-1 pb-1">
            <span className="text-primary font-bold opacity-80">NOZZLE</span>
            <span className={`font-bold ${nozzleTemp > 50 ? 'text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]' : 'text-slate-200'}`}>
              {nozzleTemp.toFixed(1)}°C
            </span>
          </div>
          <div className="flex justify-between space-x-6">
            <span className="text-primary font-bold opacity-80">FAN</span>
            <span className="font-bold text-slate-200">
              {Math.round((safeFanSpeed / 255) * 100)}%
            </span>
          </div>
        </div>
      </Html>

      {/* Accent Lights */}
      {/* Floor light casting from the head - changes to RED if hot */}
      <pointLight position={[0, -2, 0]} intensity={nozzleTemp > 50 ? glow * 5 : 20} color={nozzleTemp > 50 ? "#ff2200" : "#0ea5e9"} distance={100} />
    </group>
  );
}

export default function VirtualPlate({ bedSize = { x: 220, y: 220, z: 250 }, headPos = { x: 0, y: 0, z: 0 }, temps = { nozzle: 0, bed: 0 }, fanSpeed = 0 }) {
  const bedSizeX = bedSize?.x || 220;
  const bedSizeY = bedSize?.y || 220;
  
  const safeHeadX = headPos?.x || 0;
  const safeHeadY = headPos?.y || 0;
  const safeHeadZ = headPos?.z || 0;
  
  const bedTemp = temps?.bed || 0;

  // Draw Mode States
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawColor, setDrawColor] = useState('#0ea5e9');
  const [drawThickness, setDrawThickness] = useState(1);
  const [drawnPath, setDrawnPath] = useState([]);

  // Calculate 3D visual position from physical printer headPos
  const visualNozzlePos = [
    safeHeadX - bedSizeX / 2, 
    safeHeadZ, 
    (bedSizeY / 2) - safeHeadY 
  ]; 

  // Record path for Draw Mode
  useEffect(() => {
    if (isDrawMode) {
      setDrawnPath(prev => {
        const last = prev[prev.length - 1];
        // Only add if position actually changed to avoid massive arrays of identical points
        if (!last || last[0] !== visualNozzlePos[0] || last[1] !== visualNozzlePos[1] || last[2] !== visualNozzlePos[2]) {
          return [...prev, [...visualNozzlePos]];
        }
        return prev;
      });
    }
  }, [visualNozzlePos[0], visualNozzlePos[1], visualNozzlePos[2], isDrawMode]);

  const handlePointerDown = (e) => {
    e.stopPropagation();
    
    // Ignore right clicks (which are used for camera orbit)
    if (e.button !== 0) return;

    if (e.object.name === 'printBed') {
      // Calculate real printer coordinates (0 to bedSize)
      // In 3D: Front-Left is (-110, 110)
      const printerX = Math.max(0, Math.min(bedSizeX, e.point.x + bedSizeX / 2));
      const printerY = Math.max(0, Math.min(bedSizeY, (bedSizeY / 2) - e.point.z));
      
      // Send GCode
      serialConnection.write('G90'); // Absolute positioning
      serialConnection.write(`G1 X${printerX.toFixed(2)} Y${printerY.toFixed(2)} F2500`);
      
      // Ask printer for its new exact position to auto-update the 3D visual
      serialConnection.write('M114');
    }
  };

  return (
    <div className="w-full h-full bg-slate-950 absolute inset-0">
      <Canvas camera={{ position: [0, 180, 250], fov: 45 }}>
        <color attach="background" args={['#020617']} />
        {/* Environment / Lighting */}
        <ambientLight intensity={1.5} />
        <directionalLight position={[20, 50, 20]} intensity={2.5} />
        <directionalLight position={[-20, 30, -20]} intensity={1.5} />

        {/* Orbit Controls */}
        <OrbitControls 
          makeDefault 
          maxPolarAngle={Math.PI / 2 - 0.05} 
          mouseButtons={{
            LEFT: THREE.MOUSE.NONE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE
          }}
        />

        {/* The Print Bed */}
        <group position={[0, 0, 0]}>
          <mesh 
            name="printBed"
            rotation={[-Math.PI / 2, 0, 0]} 
            onPointerDown={handlePointerDown}
            onPointerOver={() => document.body.style.cursor = 'crosshair'}
            onPointerOut={() => document.body.style.cursor = 'auto'}
          >
            <planeGeometry args={[bedSizeX, bedSizeY]} />
            <meshStandardMaterial 
              color="#0f172a" 
              roughness={0.1} 
              metalness={0.8} 
              transparent 
              opacity={0.8} 
              emissive={bedTemp > 40 ? "#ff3300" : "#000000"}
              emissiveIntensity={Math.min(2, Math.max(0, bedTemp / 60) || 0)}
            />
          </mesh>

          <Grid
            args={[bedSizeX, bedSizeY]}
            position={[0, 0.1, 0]}
            cellSize={10}
            cellThickness={1}
            cellColor="#334155"
            sectionSize={50}
            sectionThickness={1.5}
            sectionColor={bedTemp > 40 ? "#ff2200" : "#0ea5e9"}
            fadeDistance={400}
            fadeStrength={1}
          />
          
          {/* Origin Marker (Front-Left) */}
          <group position={[-bedSizeX/2, 0.1, bedSizeY/2]}>
            <Box args={[10, 2, 2]} position={[5, 1, 0]}>
              <meshStandardMaterial color="#ef4444" /> {/* X axis red */}
            </Box>
            <Box args={[2, 2, 10]} position={[0, 1, -5]}>
              <meshStandardMaterial color="#22c55e" /> {/* Y axis green */}
            </Box>
          </group>

          {/* Bed Temperature HUD */}
          <Line points={[[0, 0.2, bedSizeY/2], [30, 20, bedSizeY/2 + 20], [50, 20, bedSizeY/2 + 20]]} color={bedTemp > 40 ? "#ff2200" : "#0ea5e9"} lineWidth={1} transparent opacity={0.5} />
          <Html position={[50, 20, bedSizeY/2 + 20]} transform sprite distanceFactor={250}>
            <div className="flex flex-col p-1 text-[10px] text-white font-mono whitespace-nowrap pointer-events-none select-none">
              <div className="flex justify-between space-x-6 mb-1 pb-1">
                <span className="text-primary font-bold opacity-80">BED</span>
                <span className={`font-bold ${bedTemp > 40 ? 'text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]' : 'text-slate-200'}`}>
                  {bedTemp.toFixed(1)}°C
                </span>
              </div>
            </div>
          </Html>
        </group>

        {/* Drawn Path */}
        {drawnPath.length > 1 && (
          <Line 
            points={drawnPath} 
            color={drawColor} 
            lineWidth={drawThickness}
            transparent
            opacity={0.9}
          />
        )}

        {/* The Nozzle */}
        <Nozzle position={visualNozzlePos} temps={temps} fanSpeed={fanSpeed} />
      </Canvas>
      
      {/* Overlay info */}
      <div className="absolute top-4 right-4 bg-surface/80 backdrop-blur border border-slate-700 rounded p-3 text-xs text-textMain pointer-events-none shadow-xl">
        <h3 className="mb-2 text-primary font-bold uppercase tracking-wider">Virtual Build Plate</h3>
        <ul className="space-y-1 text-textMuted">
          <li><span className="text-secondary">•</span> Left click grid to move toolhead</li>
          <li><span className="text-secondary">•</span> Scroll to zoom</li>
          <li><span className="text-secondary">•</span> Right click & drag to rotate camera</li>
        </ul>
      </div>

      {/* Draw Mode Control Panel */}
      <div className="absolute top-4 left-4 bg-surface/80 backdrop-blur border border-slate-700 rounded p-4 text-xs text-textMain shadow-xl w-64 pointer-events-auto">
        <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
          <h3 className="text-primary font-bold uppercase tracking-wider">Draw Mode</h3>
          <button 
            onClick={() => setIsDrawMode(!isDrawMode)}
            className={`px-3 py-1 rounded font-bold transition-colors ${isDrawMode ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-textMuted'}`}
          >
            {isDrawMode ? 'ON' : 'OFF'}
          </button>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-textMuted font-semibold">Color</span>
            <input 
              type="color" 
              value={drawColor} 
              onChange={e => setDrawColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
            />
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-textMuted font-semibold">Thickness</span>
              <span className="font-mono text-primary">{drawThickness}px</span>
            </div>
            <input 
              type="range" min="1" max="10" step="0.5"
              value={drawThickness}
              onChange={e => setDrawThickness(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <button 
            onClick={() => setDrawnPath([])}
            className="w-full mt-2 py-1.5 bg-slate-700 hover:bg-red-600 text-white rounded font-bold transition-colors"
          >
            Clear Path
          </button>
        </div>
      </div>

      {/* Z-Height Controller */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-surface/80 backdrop-blur border border-slate-700 rounded-full px-6 py-3 flex items-center space-x-4 shadow-xl">
        <label className="text-xs font-bold text-textMuted uppercase tracking-widest">Z Height</label>
        <input 
          type="range" 
          min="0" 
          max={bedSize.z} 
          step="0.1"
          value={headPos.z}
          onChange={(e) => {
            const z = parseFloat(e.target.value);
            serialConnection.write('G90');
            serialConnection.write(`G1 Z${z.toFixed(2)} F1000`);
            serialConnection.write('M114');
          }}
          className="w-64 accent-primary cursor-ew-resize"
        />
        <span className="text-sm text-primary font-bold w-16 text-right">{headPos.z.toFixed(1)} mm</span>
      </div>
    </div>
  );
}
