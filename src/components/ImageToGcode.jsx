import React, { useState, useRef, useEffect } from 'react';
import { serialConnection } from '../utils/SerialConnection';
import { Upload, Play, Square, Settings2, Image as ImageIcon, Repeat } from 'lucide-react';

export default function ImageToGcode() {
  const [image, setImage] = useState(null);
  const [isLineArt, setIsLineArt] = useState(true);
  const [threshold, setThreshold] = useState(128);
  const [edgeSensitivity, setEdgeSensitivity] = useState(60); // Lower is more sensitive
  
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
  
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const cancelRef = useRef(false);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImage(url);
    }
  };

  const drawAndProcess = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const img = imgRef.current;
    
    // Scale down for processing to avoid millions of GCode lines
    const maxDim = 250; // Increased resolution slightly for better edge tracing
    let w = img.width;
    let h = img.height;
    if (w > maxDim || h > maxDim) {
      const ratio = Math.min(maxDim/w, maxDim/h);
      w = Math.floor(w * ratio);
      h = Math.floor(h * ratio);
    }
    
    canvas.width = w;
    canvas.height = h;
    
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    
    // Convert to grayscale
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < data.length; i += 4) {
      gray[i/4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    if (isLineArt) {
      // Sobel Edge Detection
      const sobelData = new Uint8Array(w * h);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const p = y * w + x;
          const p00 = gray[p - w - 1]; const p01 = gray[p - w]; const p02 = gray[p - w + 1];
          const p10 = gray[p - 1];                            const p12 = gray[p + 1];
          const p20 = gray[p + w - 1]; const p21 = gray[p + w]; const p22 = gray[p + w + 1];

          const gx = -p00 + p02 - 2 * p10 + 2 * p12 - p20 + p22;
          const gy = -p00 - 2 * p01 - p02 + p20 + 2 * p21 + p22;
          const mag = Math.sqrt(gx * gx + gy * gy);
          
          sobelData[p] = mag > edgeSensitivity ? 0 : 255; // 0 is black (draw)
        }
      }
      
      // Clear borders
      for(let x=0; x<w; x++) { sobelData[x] = 255; sobelData[(h-1)*w + x] = 255; }
      for(let y=0; y<h; y++) { sobelData[y*w] = 255; sobelData[y*w + w - 1] = 255; }

      for (let i = 0; i < w * h; i++) {
        data[i * 4] = sobelData[i];
        data[i * 4 + 1] = sobelData[i];
        data[i * 4 + 2] = sobelData[i];
      }
    } else {
      // Standard Solid Thresholding
      for (let i = 0; i < w * h; i++) {
        const val = gray[i] < threshold ? 0 : 255;
        data[i * 4] = val;
        data[i * 4 + 1] = val;
        data[i * 4 + 2] = val;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  };

  useEffect(() => {
    if (image && canvasRef.current && imgRef.current) {
      const img = imgRef.current;
      if (img.complete) {
        drawAndProcess();
      } else {
        img.onload = () => drawAndProcess();
      }
    }
  }, [image, threshold, edgeSensitivity, isLineArt]);

  const generateAndSendGCode = async () => {
    if (!canvasRef.current || isGenerating) return;
    setIsGenerating(true);
    setProgress(0);
    setCurrentRep(0);
    cancelRef.current = false;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    
    const pixelSize = widthMm / w;
    
    // --- CONTINUOUS PATH TRACER ALGORITHM ---
    const paths = [];
    const visited = new Uint8Array(w * h);
    
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (data[i * 4] === 0 && !visited[i]) {
          const currentPath = [{x, y}];
          visited[i] = 1;
          let currX = x;
          let currY = y;
          
          while (true) {
            let found = false;
            // Look for unvisited black neighbors (8-way)
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = currX + dx;
                const ny = currY + dy;
                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                  const ni = ny * w + nx;
                  if (data[ni * 4] === 0 && !visited[ni]) {
                    currentPath.push({x: nx, y: ny});
                    visited[ni] = 1;
                    currX = nx;
                    currY = ny;
                    found = true;
                    break;
                  }
                }
              }
              if (found) break;
            }
            if (!found) break; // End of continuous line
          }
          if (currentPath.length > 1) { // Only keep paths with at least 2 points to avoid dots
            paths.push(currentPath);
          }
        }
      }
    }

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
        gcode.push(`M400 ; Wait for homing to finish`);
      }
      gcode.push(`G90 ; Absolute positioning`);
      gcode.push(`G0 Z${zLift} F1000 ; Lift Z safely`);

      paths.forEach(path => {
        // Move to start of path (Pen Up)
        const startPx = (path[0].x * pixelSize).toFixed(2);
        const startPy = ((h - path[0].y) * pixelSize).toFixed(2);
        gcode.push(`G0 X${startPx} Y${startPy} F4000`);
        
        // Pen Down
        gcode.push(`G1 Z${zDraw} F1000`);
        
        // Draw continuous path
        for (let i = 1; i < path.length; i++) {
          const px = (path[i].x * pixelSize).toFixed(2);
          const py = ((h - path[i].y) * pixelSize).toFixed(2);
          gcode.push(`G1 X${px} Y${py} F${feedrate}`);
        }
        
        // Pen Up
        gcode.push(`G0 Z${zLift} F1000`);
      });
      
      if (!isInfinite && repCount === repetitions - 1) {
        gcode.push(`G0 X0 Y0 F4000 ; Return Home`);
      }
      
      // Send to printer via serial queue
      const totalLines = gcode.length;
      for (let i = 0; i < totalLines; i++) {
        if (cancelRef.current) {
          await serialConnection.write(`G0 Z${zLift} F1000 ; Lift Pen (Cancelled)`);
          await serialConnection.write(`G0 X0 Y0 F4000 ; Return Home (Cancelled)`);
          break;
        }
        await serialConnection.write(gcode[i]);
        if (i % 20 === 0) {
          setProgress(Math.round((i / totalLines) * 100));
          await new Promise(r => setTimeout(r, 5)); // let UI update
        }
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
        <ImageIcon size={18} className="text-primary" />
        <h2 className="text-sm font-bold text-textMain uppercase tracking-wider">Pen Plotter Generator</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {/* Upload */}
        <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center hover:bg-slate-800 transition-colors cursor-pointer relative">
          <input 
            type="file" accept="image/*" onChange={handleImageUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <Upload size={24} className="mx-auto mb-2 text-textMuted" />
          <p className="text-xs text-textMuted font-medium">Click or drag image to upload</p>
        </div>

        {image && (
          <div className="space-y-4">
            <div className="bg-background rounded border border-slate-700 p-2 flex justify-center overflow-hidden">
              <img ref={imgRef} src={image} alt="Original" className="hidden" />
              <canvas ref={canvasRef} className="max-w-full h-auto rounded" style={{ imageRendering: 'pixelated' }}></canvas>
            </div>
            
            <div className="space-y-3 p-3 bg-slate-900 rounded border border-slate-700">
              <h3 className="text-xs font-semibold text-textMuted flex items-center mb-2">
                <Settings2 size={14} className="mr-1" /> Style & Adjustments
              </h3>

              <div className="flex space-x-2 mb-3">
                <button 
                  onClick={() => setIsLineArt(true)} 
                  className={`flex-1 py-1.5 text-[10px] font-bold rounded uppercase ${isLineArt ? 'bg-primary text-white' : 'bg-slate-800 text-textMuted'}`}
                >
                  Line Art
                </button>
                <button 
                  onClick={() => setIsLineArt(false)} 
                  className={`flex-1 py-1.5 text-[10px] font-bold rounded uppercase ${!isLineArt ? 'bg-primary text-white' : 'bg-slate-800 text-textMuted'}`}
                >
                  Solid Fill
                </button>
              </div>
              
              {isLineArt ? (
                <div>
                  <label className="flex justify-between text-[10px] text-textMuted mb-1 font-bold">
                    <span>Edge Sensitivity</span>
                    <span>{edgeSensitivity}</span>
                  </label>
                  <input 
                    type="range" min="10" max="150" value={edgeSensitivity} 
                    onChange={(e) => setEdgeSensitivity(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              ) : (
                <div>
                  <label className="flex justify-between text-[10px] text-textMuted mb-1 font-bold">
                    <span>Darkness Threshold</span>
                    <span>{threshold}</span>
                  </label>
                  <input 
                    type="range" min="0" max="255" value={threshold} 
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              )}

              <div className="border-t border-slate-700 my-2 pt-2"></div>

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
                  <input 
                    type="number" step="0.1" value={zLift} onChange={(e) => setZLift(Number(e.target.value))}
                    className="w-full bg-background border border-slate-700 rounded px-2 py-1 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-textMuted block mb-1">Z-Draw (mm)</label>
                  <input 
                    type="number" step="0.1" value={zDraw} onChange={(e) => setZDraw(Number(e.target.value))}
                    className="w-full bg-background border border-slate-700 rounded px-2 py-1 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-textMuted block mb-1">Draw Feedrate (mm/min)</label>
                  <input 
                    type="number" value={feedrate} onChange={(e) => setFeedrate(Number(e.target.value))}
                    className="w-full bg-background border border-slate-700 rounded px-2 py-1 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {!isGenerating ? (
              <button 
                onClick={generateAndSendGCode}
                className="w-full py-2.5 rounded font-bold text-white shadow-lg flex items-center justify-center space-x-2 transition-all bg-gradient-to-r from-primary to-secondary hover:from-blue-600 hover:to-emerald-600"
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
        )}
      </div>
    </div>
  );
}
