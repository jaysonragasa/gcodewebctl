import React, { useState } from 'react';
import { serialConnection } from '../utils/SerialConnection';
import { Home, MoveUp, MoveDown, MoveLeft, MoveRight, ArrowUpFromLine, ArrowDownToLine } from 'lucide-react';

export default function ManualControls() {
  const [distance, setDistance] = useState(10);
  const [feedrate, setFeedrate] = useState(3000);

  const sendGCode = async (code) => {
    await serialConnection.write(code);
  };

  const handleJog = async (axis, dir) => {
    // Relative positioning
    await sendGCode('G91');
    const move = dir > 0 ? distance : -distance;
    // Use a much slower feedrate for the Extruder to prevent motor skipping/stripping filament
    const currentFeedrate = axis === 'E' ? Math.min(feedrate, 300) : feedrate;
    await sendGCode(`G1 ${axis}${move} F${currentFeedrate}`);
    // Absolute positioning back
    await sendGCode('G90');
    // Auto-update position in UI
    await sendGCode('M114');
  };

  return (
    <div className="bg-surface rounded-lg p-4 border border-slate-700 shadow-sm">
      <h2 className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-4">Manual Controls</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs text-textMuted block mb-1">Distance (mm)</label>
          <div className="flex bg-background rounded overflow-hidden border border-slate-700">
            {[0.1, 1, 10, 50].map((d) => (
              <button
                key={d}
                onClick={() => setDistance(d)}
                className={`flex-1 py-1 text-xs font-medium transition-colors ${distance === d ? 'bg-primary text-white' : 'text-textMuted hover:bg-surface'}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-textMuted block mb-1">Feedrate (mm/min)</label>
          <input 
            type="number" 
            value={feedrate}
            onChange={(e) => setFeedrate(Number(e.target.value))}
            className="w-full bg-background border border-slate-700 rounded px-2 py-1 text-sm text-textMain focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={async () => { await sendGCode('G28'); await sendGCode('M114'); }}
          className="flex flex-col items-center justify-center p-2 rounded bg-slate-700 hover:bg-slate-600 transition-colors w-16 h-16 shadow-inner"
          title="Home All"
        >
          <Home size={20} className="mb-1 text-primary" />
          <span className="text-[10px] font-bold">ALL</span>
        </button>
        
        <div className="grid grid-cols-3 gap-1">
          <div />
          <button onClick={() => handleJog('Y', 1)} className="p-2 rounded bg-slate-700 hover:bg-slate-600 transition-colors flex justify-center items-center h-10 w-10">
            <MoveUp size={16} />
          </button>
          <div />
          
          <button onClick={() => handleJog('X', -1)} className="p-2 rounded bg-slate-700 hover:bg-slate-600 transition-colors flex justify-center items-center h-10 w-10">
            <MoveLeft size={16} />
          </button>
          <button onClick={async () => { await sendGCode('G28 X Y'); await sendGCode('M114'); }} className="p-2 rounded bg-slate-700 hover:bg-slate-600 transition-colors flex justify-center items-center h-10 w-10">
            <Home size={14} className="text-textMuted" />
          </button>
          <button onClick={() => handleJog('X', 1)} className="p-2 rounded bg-slate-700 hover:bg-slate-600 transition-colors flex justify-center items-center h-10 w-10">
            <MoveRight size={16} />
          </button>
          
          <div />
          <button onClick={() => handleJog('Y', -1)} className="p-2 rounded bg-slate-700 hover:bg-slate-600 transition-colors flex justify-center items-center h-10 w-10">
            <MoveDown size={16} />
          </button>
          <div />
        </div>

        <div className="flex flex-col gap-1">
          <button onClick={() => handleJog('Z', 1)} className="p-2 rounded bg-slate-700 hover:bg-slate-600 transition-colors flex justify-center items-center h-10 w-10">
            <ArrowUpFromLine size={16} />
          </button>
          <button onClick={async () => { await sendGCode('G28 Z'); await sendGCode('M114'); }} className="p-2 rounded bg-slate-700 hover:bg-slate-600 transition-colors flex justify-center items-center h-10 w-10 text-[10px] font-bold">
            Z
          </button>
          <button onClick={() => handleJog('Z', -1)} className="p-2 rounded bg-slate-700 hover:bg-slate-600 transition-colors flex justify-center items-center h-10 w-10">
            <ArrowDownToLine size={16} />
          </button>
        </div>
      </div>
      
      {/* Extruder Controls */}
      <div className="flex items-center justify-between mb-6 bg-background/50 p-2 rounded border border-slate-700/50">
        <span className="text-xs font-bold text-textMuted uppercase tracking-wider w-16 text-center">Extruder</span>
        <div className="flex space-x-2 flex-1 ml-2">
          <button 
            onClick={() => handleJog('E', -1)} 
            className="flex-1 py-2 rounded bg-slate-700 hover:bg-slate-600 text-xs font-bold transition-colors shadow-sm"
          >
            Retract
          </button>
          <button 
            onClick={() => handleJog('E', 1)} 
            className="flex-1 py-2 rounded bg-slate-700 hover:bg-slate-600 text-xs font-bold transition-colors shadow-sm text-primary"
          >
            Extrude
          </button>
        </div>
      </div>

      <div className="flex space-x-2">
        <button onClick={() => sendGCode('M18')} className="flex-1 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs font-medium transition-colors">
          Motors Off
        </button>
        <button onClick={() => sendGCode('M114')} className="flex-1 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs font-medium transition-colors">
          Get Position
        </button>
      </div>
    </div>
  );
}
