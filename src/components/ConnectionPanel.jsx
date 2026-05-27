import React, { useState, useEffect } from 'react';
import { serialConnection } from '../utils/SerialConnection';
import { Plug, Unplug, Settings, AlertTriangle } from 'lucide-react';

export default function ConnectionPanel({ bedSize, setBedSize }) {
  const [isConnected, setIsConnected] = useState(false);
  const [baudRate, setBaudRate] = useState(250000);

  useEffect(() => {
    serialConnection.onDisconnectCallback = () => {
      setIsConnected(false);
    };
  }, []);

  const handleConnect = async () => {
    if (isConnected) {
      await serialConnection.disconnect();
      setIsConnected(false);
    } else {
      const portSelected = await serialConnection.requestPort();
      if (portSelected) {
        const connected = await serialConnection.connect(baudRate);
        if (connected) {
          setIsConnected(true);
        }
      }
    }
  };

  return (
    <div className="bg-surface rounded-lg p-4 border border-slate-700 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-textMuted uppercase tracking-wider">Connection</h2>
        <div className="flex items-center text-xs">
          {isConnected ? (
            <span className="flex items-center text-secondary font-medium">
              <span className="w-2 h-2 rounded-full bg-secondary mr-1.5 animate-pulse"></span>
              Connected
            </span>
          ) : (
            <span className="flex items-center text-textMuted">
              <span className="w-2 h-2 rounded-full bg-slate-600 mr-1.5"></span>
              Disconnected
            </span>
          )}
        </div>
      </div>
      
      <div className="flex flex-col space-y-3">
        {!isConnected && (
          <div className="flex items-center space-x-2">
            <Settings size={16} className="text-textMuted" />
            <select 
              value={baudRate} 
              onChange={(e) => setBaudRate(Number(e.target.value))}
              disabled={isConnected}
              className="flex-1 bg-background border border-slate-700 rounded px-2 py-1 text-sm text-textMain focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
            >
              <option value={9600}>9600</option>
              <option value={57600}>57600</option>
              <option value={115200}>115200</option>
              <option value={250000}>250000</option>
            </select>
          </div>
        )}

        <div className="flex space-x-2">
          <button
            onClick={handleConnect}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded text-sm font-medium transition-all ${
              isConnected 
                ? 'bg-slate-700 text-white hover:bg-slate-600 border border-slate-600' 
                : 'bg-primary text-white hover:bg-blue-600 shadow-md hover:shadow-lg'
            }`}
          >
            {isConnected ? <Unplug size={16} /> : <Plug size={16} />}
            <span>{isConnected ? 'Disconnect' : 'Connect'}</span>
          </button>

          {isConnected && (
            <button
              onClick={() => serialConnection.emergencyStop()}
              className="flex items-center justify-center space-x-1 px-3 py-2 rounded text-sm font-bold bg-red-600 text-white hover:bg-red-500 shadow-md hover:shadow-lg transition-all"
              title="Emergency Stop (M112)"
            >
              <AlertTriangle size={16} />
              <span>E-STOP</span>
            </button>
          )}
        </div>

        {/* Bed Size Settings - Only show when disconnected */}
        {!isConnected && (
          <div className="mt-2 pt-3 border-t border-slate-700">
            <h3 className="text-[10px] uppercase text-textMuted font-bold mb-2">Printer Volume (mm)</h3>
            <div className="flex space-x-2">
              <div className="flex-1">
                <span className="text-[9px] text-textMuted block mb-0.5">X (Width)</span>
                <input type="number" value={bedSize.x || 0} onChange={e => setBedSize(p => ({...p, x: Number(e.target.value)}))} className="w-full bg-background border border-slate-700 rounded px-1.5 py-1 text-xs text-textMain focus:outline-none focus:border-primary text-center" />
              </div>
              <div className="flex-1">
                <span className="text-[9px] text-textMuted block mb-0.5">Y (Depth)</span>
                <input type="number" value={bedSize.y || 0} onChange={e => setBedSize(p => ({...p, y: Number(e.target.value)}))} className="w-full bg-background border border-slate-700 rounded px-1.5 py-1 text-xs text-textMain focus:outline-none focus:border-primary text-center" />
              </div>
              <div className="flex-1">
                <span className="text-[9px] text-textMuted block mb-0.5">Z (Height)</span>
                <input type="number" value={bedSize.z || 0} onChange={e => setBedSize(p => ({...p, z: Number(e.target.value)}))} className="w-full bg-background border border-slate-700 rounded px-1.5 py-1 text-xs text-textMain focus:outline-none focus:border-primary text-center" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
