import React, { useState, useRef, useEffect } from 'react';
import { serialConnection } from '../utils/SerialConnection';
import { Pencil, Square as SquareIcon, Circle as CircleIcon, Minus, Play, Square, Eraser, Settings2, Repeat } from 'lucide-react';

export default function ShapeDrawer() {
  const canvasRef = useRef(null);
  const [shapes, setShapes] = useState([]);
  const [currentPath, setCurrentPath] = useState(null); // Used for freehand or bounding box
  const [tool, setTool] = useState('freehand'); // 'freehand', 'line', 'rect', 'circle'
  const [isDrawing, setIsDrawing] = useState(false);
  
  const [widthMm, setWidthMm] = useState(100);
  const [zLift, setZLift] = useState(5);
  const [zDraw, setZDraw] = useState(0);
  const [feedrate, setFeedrate] = useState(2000);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const [homeZ, setHomeZ] = useState(true);
  const [isInfinite, setIsInfinite] = useState(false);
  const [repetitions, setRepetitions] = useState(1);
  const [currentRep, setCurrentRep] = useState(0);
  const cancelRef = useRef(false);

  // Redraw canvas whenever shapes change
  useEffect(() => {
    redrawCanvas();
  }, [shapes, currentPath]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawShape = (s) => {
      ctx.beginPath();
      if (s.type === 'freehand' || s.type === 'line') {
        if (!s.points || s.points.length === 0) return;
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }
      } else if (s.type === 'rect') {
        const x = Math.min(s.start.x, s.end.x);
        const y = Math.min(s.start.y, s.end.y);
        const w = Math.abs(s.start.x - s.end.x);
        const h = Math.abs(s.start.y - s.end.y);
        ctx.rect(x, y, w, h);
      } else if (s.type === 'circle') {
        const dx = s.end.x - s.start.x;
        const dy = s.end.y - s.start.y;
        const radius = Math.sqrt(dx*dx + dy*dy);
        ctx.arc(s.start.x, s.start.y, radius, 0, 2 * Math.PI);
      }
      ctx.stroke();
    };

    shapes.forEach(drawShape);
    if (currentPath) drawShape(currentPath);
  };

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    // Scaling is important because CSS width is max-w-[400px] but logical width is 400
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e) => {
    e.target.setPointerCapture(e.pointerId);
    const pos = getPos(e);
    setIsDrawing(true);
    if (tool === 'freehand') {
      setCurrentPath({ type: 'freehand', points: [pos] });
    } else {
      setCurrentPath({ type: tool, start: pos, end: pos });
    }
  };

  const handlePointerMove = (e) => {
    if (!isDrawing || !currentPath) return;
    const pos = getPos(e);
    
    if (tool === 'freehand') {
      setCurrentPath(prev => ({ ...prev, points: [...prev.points, pos] }));
    } else if (tool === 'line') {
      setCurrentPath(prev => ({ ...prev, type: 'line', points: [prev.start, pos] }));
    } else {
      setCurrentPath(prev => ({ ...prev, end: pos }));
    }
  };

  const handlePointerUp = (e) => {
    if (!isDrawing || !currentPath) return;
    e.target.releasePointerCapture(e.pointerId);
    setIsDrawing(false);
    
    // Only save if it's substantial
    let isValid = false;
    if (tool === 'freehand' && currentPath.points && currentPath.points.length > 1) isValid = true;
    if (tool === 'line' && currentPath.points && currentPath.points.length === 2) {
       const dx = currentPath.points[0].x - currentPath.points[1].x;
       const dy = currentPath.points[0].y - currentPath.points[1].y;
       if (Math.sqrt(dx*dx + dy*dy) > 2) isValid = true;
    }
    if ((tool === 'rect' || tool === 'circle') && currentPath.start && currentPath.end) {
      const dx = currentPath.start.x - currentPath.end.x;
      const dy = currentPath.start.y - currentPath.end.y;
      if (Math.sqrt(dx*dx + dy*dy) > 2) isValid = true;
    }

    if (isValid) {
      setShapes(prev => [...prev, currentPath]);
    }
    setCurrentPath(null);
  };

  const generateAndSendGCode = async () => {
    if (shapes.length === 0 || isGenerating) return;
    setIsGenerating(true);
    setProgress(0);
    setCurrentRep(0);
    cancelRef.current = false;
    
    const canvas = canvasRef.current;
    const scale = widthMm / canvas.width;
    
    // Helper to map canvas coords to printer coords
    const mapPt = (pt) => ({
      x: (pt.x * scale).toFixed(2),
      y: ((canvas.height - pt.y) * scale).toFixed(2) // invert Y for plotter
    });

    let repCount = 0;
    while (!cancelRef.current && (isInfinite || repCount < repetitions)) {
      setCurrentRep(repCount + 1);
      
      let gcode = [];
      if (repCount === 0) {
        if (homeZ) {
          gcode.push(`G28 ; Home All Axes`);
        } else {
          gcode.push(`G28 X Y ; Home X and Y only`);
        }
        gcode.push(`M400 ; Wait for homing`);
      }
      gcode.push(`G90 ; Absolute positioning`);
      gcode.push(`G0 Z${zLift} F1000 ; Lift Z safely`);

      shapes.forEach(s => {
        if (s.type === 'freehand' || s.type === 'line') {
          const start = mapPt(s.points[0]);
          gcode.push(`G0 X${start.x} Y${start.y} F4000`);
          gcode.push(`G1 Z${zDraw} F1000`);
          for (let i = 1; i < s.points.length; i++) {
            const pt = mapPt(s.points[i]);
            gcode.push(`G1 X${pt.x} Y${pt.y} F${feedrate}`);
          }
          gcode.push(`G0 Z${zLift} F1000`);
        } else if (s.type === 'rect') {
          const p1 = mapPt({ x: s.start.x, y: s.start.y });
          const p2 = mapPt({ x: s.end.x, y: s.start.y });
          const p3 = mapPt({ x: s.end.x, y: s.end.y });
          const p4 = mapPt({ x: s.start.x, y: s.end.y });
          
          gcode.push(`G0 X${p1.x} Y${p1.y} F4000`);
          gcode.push(`G1 Z${zDraw} F1000`);
          gcode.push(`G1 X${p2.x} Y${p2.y} F${feedrate}`);
          gcode.push(`G1 X${p3.x} Y${p3.y} F${feedrate}`);
          gcode.push(`G1 X${p4.x} Y${p4.y} F${feedrate}`);
          gcode.push(`G1 X${p1.x} Y${p1.y} F${feedrate}`);
          gcode.push(`G0 Z${zLift} F1000`);
        } else if (s.type === 'circle') {
          const center = mapPt(s.start);
          const dx = s.end.x - s.start.x;
          const dy = s.end.y - s.start.y;
          const rCanvas = Math.sqrt(dx*dx + dy*dy);
          const r = rCanvas * scale;
          
          // Use 36 segments for a smooth circle (safe for non-arc firmwares)
          const segments = 36;
          for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * 2 * Math.PI;
            const cx = (parseFloat(center.x) + r * Math.cos(theta)).toFixed(2);
            const cy = (parseFloat(center.y) + r * Math.sin(theta)).toFixed(2);
            
            if (i === 0) {
              gcode.push(`G0 X${cx} Y${cy} F4000`);
              gcode.push(`G1 Z${zDraw} F1000`);
            } else {
              gcode.push(`G1 X${cx} Y${cy} F${feedrate}`);
            }
          }
          gcode.push(`G0 Z${zLift} F1000`);
        }
      });

      if (!isInfinite && repCount === repetitions - 1) {
        gcode.push(`G0 X0 Y0 F4000 ; Return Home`);
      }

      const totalLines = gcode.length;
      for (let i = 0; i < totalLines; i++) {
        if (cancelRef.current) {
          await serialConnection.write(`G0 Z${zLift} F1000 ; Lift Pen (Cancelled)`);
          await serialConnection.write(`G0 X0 Y0 F4000 ; Return Home (Cancelled)`);
          break;
        }
        await serialConnection.write(gcode[i]);
        setProgress(Math.round((i / totalLines) * 100));
      }
      
      if (cancelRef.current) break;
      
      setProgress(100);
      repCount++;
      
      if (!cancelRef.current && (isInfinite || repCount < repetitions)) {
        await new Promise(r => setTimeout(r, 1000)); // Pause between reps
        setProgress(0);
      }
    }
    
    setTimeout(() => {
      setIsGenerating(false);
      setProgress(0);
      setCurrentRep(0);
    }, 1000);
  };

  return (
    <div className="bg-surface rounded-lg p-4 border border-slate-700 shadow-sm flex flex-col h-full">
      <div className="flex items-center space-x-2 mb-4">
        <Pencil size={18} className="text-primary" />
        <h2 className="text-sm font-bold text-textMain uppercase tracking-wider">Vector Shape Drawer</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 flex flex-col">
        {/* Toolbar */}
        <div className="flex space-x-2 bg-slate-900 p-2 rounded border border-slate-700">
          <button onClick={() => setTool('freehand')} className={`p-2 rounded transition-colors ${tool === 'freehand' ? 'bg-primary text-white' : 'text-textMuted hover:bg-slate-700'}`} title="Freehand">
            <Pencil size={16} />
          </button>
          <button onClick={() => setTool('line')} className={`p-2 rounded transition-colors ${tool === 'line' ? 'bg-primary text-white' : 'text-textMuted hover:bg-slate-700'}`} title="Line">
            <Minus size={16} />
          </button>
          <button onClick={() => setTool('rect')} className={`p-2 rounded transition-colors ${tool === 'rect' ? 'bg-primary text-white' : 'text-textMuted hover:bg-slate-700'}`} title="Rectangle">
            <SquareIcon size={16} />
          </button>
          <button onClick={() => setTool('circle')} className={`p-2 rounded transition-colors ${tool === 'circle' ? 'bg-primary text-white' : 'text-textMuted hover:bg-slate-700'}`} title="Circle">
            <CircleIcon size={16} />
          </button>
          <div className="flex-1"></div>
          <button onClick={() => setShapes([])} className="p-2 rounded text-red-400 hover:bg-red-900/30 transition-colors" title="Clear Canvas">
            <Eraser size={16} />
          </button>
        </div>

        {/* Canvas Area */}
        <div className="bg-background rounded border border-slate-700 flex justify-center overflow-hidden cursor-crosshair relative flex-shrink-0">
          <canvas 
            ref={canvasRef} 
            width={400} 
            height={400}
            className="w-full max-w-[400px] aspect-square bg-slate-950 touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
        
        {/* Settings */}
        <div className="space-y-3 p-3 bg-slate-900 rounded border border-slate-700 mt-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-textMuted uppercase flex items-center">
              <Repeat size={12} className="mr-1" /> Plot Loop Settings
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <label className="flex items-center space-x-2 text-xs text-textMuted cursor-pointer bg-background p-2 rounded border border-slate-700 hover:bg-slate-800 transition-colors">
              <input type="checkbox" checked={homeZ} onChange={e => setHomeZ(e.target.checked)} className="rounded bg-slate-800 border-slate-600 text-primary focus:ring-primary" />
              <span>Home Z Axis</span>
            </label>
            <label className="flex items-center space-x-2 text-xs text-textMuted cursor-pointer bg-background p-2 rounded border border-slate-700 hover:bg-slate-800 transition-colors">
              <input type="checkbox" checked={isInfinite} onChange={e => setIsInfinite(e.target.checked)} className="rounded bg-slate-800 border-slate-600 text-primary focus:ring-primary" />
              <span>Infinite Loop</span>
            </label>
          </div>
          {!isInfinite && (
            <div>
              <label className="flex justify-between text-[10px] text-textMuted mb-1 font-bold">
                <span>Repetitions</span>
                <span>{repetitions}</span>
              </label>
              <input 
                type="range" min="1" max="50" value={repetitions} 
                onChange={(e) => setRepetitions(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          )}

          <div className="border-t border-slate-700 my-2 pt-2"></div>

          <h3 className="text-xs font-semibold text-textMuted flex items-center mb-2">
            <Settings2 size={14} className="mr-1" /> Plot Settings
          </h3>
          <div>
            <label className="flex justify-between text-xs text-textMuted mb-1">
              <span>Print Width (mm)</span>
              <span>{widthMm} mm</span>
            </label>
            <input 
              type="range" min="10" max="200" value={widthMm} 
              onChange={(e) => setWidthMm(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-[10px] text-textMuted block mb-1">Z-Lift (mm)</label>
              <input type="number" step="0.1" value={zLift} onChange={(e) => setZLift(Number(e.target.value))} className="w-full bg-background border border-slate-700 rounded px-2 py-1 text-xs focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-textMuted block mb-1">Z-Draw (mm)</label>
              <input type="number" step="0.1" value={zDraw} onChange={(e) => setZDraw(Number(e.target.value))} className="w-full bg-background border border-slate-700 rounded px-2 py-1 text-xs focus:border-primary focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-textMuted block mb-1">Draw Feedrate (mm/min)</label>
              <input type="number" value={feedrate} onChange={(e) => setFeedrate(Number(e.target.value))} className="w-full bg-background border border-slate-700 rounded px-2 py-1 text-xs focus:border-primary focus:outline-none" />
            </div>
          </div>
        </div>

        {!isGenerating ? (
          <button 
            onClick={generateAndSendGCode}
            disabled={shapes.length === 0}
            className="w-full py-2.5 rounded font-bold text-white shadow-lg flex items-center justify-center space-x-2 transition-all bg-gradient-to-r from-primary to-secondary hover:from-blue-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play size={18} fill="currentColor" />
            <span>Generate & Draw</span>
          </button>
        ) : (
          <button 
            onClick={() => { cancelRef.current = true; }}
            className="w-full py-2.5 rounded font-bold text-white shadow-lg flex items-center justify-center space-x-2 transition-all bg-red-600 hover:bg-red-500"
          >
            <Square size={16} fill="currentColor" />
            <span>Stop Plotting (Rep {currentRep}{isInfinite ? '' : `/${repetitions}`} - {progress}%)</span>
          </button>
        )}

        {isGenerating && (
          <div className="w-full bg-surface rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-secondary h-1.5 rounded-full transition-all duration-200" style={{ width: `${progress}%` }}></div>
          </div>
        )}
      </div>
    </div>
  );
}
