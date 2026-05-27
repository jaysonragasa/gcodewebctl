import React, { useState } from 'react';
import { Flame, Fan, Thermometer } from 'lucide-react';
import { serialConnection } from '../utils/SerialConnection';

export default function TemperatureControls({ temps, fanSpeed, setFanSpeed }) {
  const [targetNozzle, setTargetNozzle] = useState(0);
  const [targetBed, setTargetBed] = useState(0);
  const [targetFan, setTargetFan] = useState(0);

  const sendTemp = (type) => {
    if (type === 'nozzle') {
      serialConnection.write(`M104 S${targetNozzle}`);
    } else if (type === 'bed') {
      serialConnection.write(`M140 S${targetBed}`);
    }
  };

  const sendFan = () => {
    serialConnection.write(`M106 S${targetFan}`);
    setFanSpeed(targetFan);
  };

  const turnOffAll = () => {
    serialConnection.write('M104 S0');
    serialConnection.write('M140 S0');
    serialConnection.write('M106 S0');
    setFanSpeed(0);
  };

  return (
    <div className="bg-surface rounded-lg p-4 border border-slate-700 shadow-sm mt-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xs font-semibold text-textMuted uppercase tracking-wider">Temperatures & Fan</h2>
        <button onClick={turnOffAll} className="text-[10px] bg-red-900/50 hover:bg-red-800 text-red-200 px-2 py-1 rounded transition-colors">
          ALL OFF
        </button>
      </div>

      <div className="space-y-4">
        {/* Nozzle */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-800 rounded text-red-400">
            <Flame size={18} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-textMuted">Nozzle</span>
              <span className="font-mono text-primary">{(temps?.nozzle || 0).toFixed(1)}° / {temps?.nozzleTarget || 0}°C</span>
            </div>
            <div className="flex space-x-2">
              <input 
                type="number" min="0" max="300" step="1" 
                value={targetNozzle} onChange={e => setTargetNozzle(Number(e.target.value))}
                className="w-full bg-background border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
              />
              <button onClick={() => sendTemp('nozzle')} className="bg-slate-700 hover:bg-slate-600 px-3 rounded text-xs font-bold transition-colors">SET</button>
            </div>
          </div>
        </div>

        {/* Bed */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-800 rounded text-orange-400">
            <Thermometer size={18} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-textMuted">Bed</span>
              <span className="font-mono text-primary">{(temps?.bed || 0).toFixed(1)}° / {temps?.bedTarget || 0}°C</span>
            </div>
            <div className="flex space-x-2">
              <input 
                type="number" min="0" max="150" step="1" 
                value={targetBed} onChange={e => setTargetBed(Number(e.target.value))}
                className="w-full bg-background border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
              />
              <button onClick={() => sendTemp('bed')} className="bg-slate-700 hover:bg-slate-600 px-3 rounded text-xs font-bold transition-colors">SET</button>
            </div>
          </div>
        </div>

        {/* Fan */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-800 rounded text-cyan-400">
            <Fan size={18} className={(fanSpeed || 0) > 0 ? "animate-spin" : ""} style={{ animationDuration: (fanSpeed || 0) > 0 ? `${Math.max(50, 400 - (fanSpeed || 0))}ms` : '0ms' }} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-textMuted">Part Fan</span>
              <span className="font-mono text-primary">{Math.round(((fanSpeed || 0)/255)*100)}%</span>
            </div>
            <div className="flex space-x-2">
              <input 
                type="range" min="0" max="255" step="1" 
                value={targetFan} onChange={e => setTargetFan(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <button onClick={sendFan} className="bg-slate-700 hover:bg-slate-600 px-3 rounded text-xs font-bold transition-colors">SET</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
