import React, { useState, useEffect } from 'react';
import ConnectionPanel from './components/ConnectionPanel';
import ManualControls from './components/ManualControls';
import TemperatureControls from './components/TemperatureControls';
import TerminalAndTools from './components/TerminalAndTools';
import VirtualPlate from './components/VirtualPlate';
import ImageToGcode from './components/ImageToGcode';
import { serialConnection } from './utils/SerialConnection';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('printer');
  const [bedSize, setBedSize] = useState({ x: 220, y: 220, z: 250 });
  const [headPos, setHeadPos] = useState({ x: 0, y: 0, z: 0 });
  const [temps, setTemps] = useState({ nozzle: 0, nozzleTarget: 0, bed: 0, bedTarget: 0 });
  const [fanSpeed, setFanSpeed] = useState(0);

  useEffect(() => {
    const handleStatus = (status) => {
      setIsConnected(status.connected);
    };
    
    // Subscribe to serial updates
    serialConnection.addListener(handleStatus);
    serialConnection.onPositionUpdate = (pos) => {
      setHeadPos(prev => ({ ...prev, ...pos }));
    };
    serialConnection.onTemperatureUpdate = (t) => {
      setTemps(t);
    };
  }, []);

  return (
    <div className="flex h-screen bg-background text-textMain overflow-hidden font-sans">
      {/* Sidebar for Controls */}
      <div className="w-80 border-r border-slate-800 bg-surface/50 flex flex-col overflow-y-auto z-10 shadow-xl">
        <div className="p-4 flex-shrink-0">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary mb-1">
            GCode WebControl
          </h1>
          <p className="text-xs text-textMuted">Local 3D Printer Controller</p>
        </div>

        <div className="px-4 pb-4 flex-shrink-0">
          <ConnectionPanel bedSize={bedSize} setBedSize={setBedSize} />
        </div>
        
        <div className="px-4 flex-shrink-0 flex space-x-2 border-b border-surface pb-4">
          <button 
            className={`flex-1 py-1.5 text-sm font-medium rounded transition-colors ${activeTab === 'printer' ? 'bg-primary text-white shadow-md' : 'text-textMuted hover:bg-surface'}`}
            onClick={() => setActiveTab('printer')}
          >
            Control
          </button>
          <button 
            className={`flex-1 py-1.5 text-sm font-medium rounded transition-colors ${activeTab === 'draw' ? 'bg-primary text-white shadow-md' : 'text-textMuted hover:bg-surface'}`}
            onClick={() => setActiveTab('draw')}
          >
            Pen Plotter
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'printer' && (
            <>
              {isConnected && (
                <TemperatureControls temps={temps} fanSpeed={fanSpeed} setFanSpeed={setFanSpeed} />
              )}
              <ManualControls />
              <TerminalAndTools />
            </>
          )}
          
          {activeTab === 'draw' && (
            <ImageToGcode />
          )}
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 relative bg-black/20">
        <VirtualPlate bedSize={bedSize} headPos={headPos} temps={temps} fanSpeed={fanSpeed} />
      </div>
    </div>
  );
}

export default App;
