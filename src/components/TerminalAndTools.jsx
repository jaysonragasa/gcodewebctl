import React, { useState, useEffect, useRef } from 'react';
import { serialConnection } from '../utils/SerialConnection';
import { Send, TerminalSquare, Activity, Copy } from 'lucide-react';

export default function TerminalAndTools() {
  const [logs, setLogs] = useState([]);
  const [input, setInput] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef(null);

  useEffect(() => {
    serialConnection.onDataCallback = (data) => {
      // Very basic line handling, assuming text stream chunks
      setLogs(prev => [...prev, { type: 'rx', text: data.trim() }]);
    };
  }, []);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleCopyLogs = () => {
    const logText = logs.map(l => `${l.type === 'tx' ? '>' : '<'} ${l.text}`).join('\n');
    navigator.clipboard.writeText(logText).catch(err => console.error('Failed to copy', err));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    setLogs(prev => [...prev, { type: 'tx', text: input }]);
    await serialConnection.write(input);
    setInput('');
  };

  const handlePID = async (target, temp) => {
    const cmd = `M303 ${target} S${temp} U1`;
    setLogs(prev => [...prev, { type: 'tx', text: cmd }]);
    await serialConnection.write(cmd);
  };

  return (
    <div className="bg-surface rounded-lg p-4 border border-slate-700 shadow-sm flex flex-col h-[400px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <TerminalSquare size={16} className="text-textMuted" />
          <h2 className="text-xs font-semibold text-textMuted uppercase tracking-wider">Terminal & Tools</h2>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-[9px] px-2 py-1 rounded border font-bold uppercase transition-colors ${autoScroll ? 'bg-primary/20 text-primary border-primary/30 hover:bg-primary/30' : 'bg-slate-800 text-textMuted border-slate-700 hover:bg-slate-700'}`}
          >
            {autoScroll ? 'Auto-Scroll' : 'Scroll Paused'}
          </button>
          <button 
            onClick={handleCopyLogs}
            className="text-[9px] px-2 py-1 rounded bg-slate-700 text-textMuted hover:bg-slate-600 hover:text-white border border-slate-600 font-bold uppercase transition-colors flex items-center space-x-1"
            title="Copy Full Log Status"
          >
            <Copy size={10} />
            <span>Copy</span>
          </button>
        </div>
      </div>
      
      {/* Tools / PID */}
      <div className="grid grid-cols-2 gap-2 mb-3 border-b border-slate-700 pb-3">
        <button 
          onClick={() => handlePID('E0', 200)}
          className="flex flex-col items-center justify-center py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-[10px] font-medium transition-colors"
        >
          <div className="flex items-center space-x-1 mb-0.5">
            <Activity size={12} className="text-accent" />
            <span>PID Extruder</span>
          </div>
          <span className="text-[9px] text-textMuted opacity-80">(200°C)</span>
        </button>
        <button 
          onClick={() => handlePID('E-1', 60)}
          className="flex flex-col items-center justify-center py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-[10px] font-medium transition-colors"
        >
          <div className="flex items-center space-x-1 mb-0.5">
            <Activity size={12} className="text-primary" />
            <span>PID Bed</span>
          </div>
          <span className="text-[9px] text-textMuted opacity-80">(60°C)</span>
        </button>
        <button 
          onClick={async () => {
            const cmd = 'M108'; // M108 cancels heating/PID loops
            setLogs(prev => [...prev, { type: 'tx', text: cmd }]);
            await serialConnection.write(cmd);
          }}
          className="col-span-2 flex items-center justify-center space-x-1 py-1.5 rounded bg-red-900/40 hover:bg-red-800/60 border border-red-800/50 text-[10px] font-bold text-red-200 transition-colors"
          title="Cancel Heating / PID Autotune (M108)"
        >
          <span>Cancel PID Tuning</span>
        </button>
      </div>

      {/* Terminal Output */}
      <div ref={logContainerRef} className="flex-1 bg-background rounded border border-slate-700 overflow-y-auto p-2 mb-3 font-mono text-[10px] leading-relaxed">
        {logs.length === 0 ? (
          <div className="text-textMuted/50 italic text-center mt-10">No data. Connect to printer.</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={`mb-1 ${log.type === 'tx' ? 'text-primary' : 'text-textMuted'}`}>
              <span className="opacity-50 mr-2">{log.type === 'tx' ? '>' : '<'}</span>
              {log.text}
            </div>
          ))
        )}
      </div>

      {/* Terminal Input */}
      <form onSubmit={handleSend} className="flex space-x-2">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="Send GCode..."
          className="flex-1 bg-background border border-slate-700 rounded px-2 py-1.5 text-xs text-textMain focus:outline-none focus:border-primary font-mono"
        />
        <button 
          type="submit"
          className="bg-primary hover:bg-blue-600 text-white rounded px-3 py-1.5 transition-colors flex items-center justify-center"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
