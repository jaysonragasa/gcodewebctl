# GCode WebControl

A sleek, futuristic, browser-based web controller for standard Marlin 3D Printers. 
Powered by React, TailwindCSS, and Three.js for real-time 3D simulation!

## Features

- **Direct Web Serial API**: Connect directly to your 3D printer over USB natively from the browser. No middleware or extra servers required!
- **Interactive 3D Virtual Bed**: See exactly what your printer is doing in real-time. Features an animated 3D nozzle with thermodynamic lighting that shifts from blue to glowing red when the hotend is active.
- **Draw Mode & HUD**: Enable Draw Mode to visually track exactly where the physical printer nozzle travels across the bed with a glowing line trail. Also features dynamic floating Hologram HUD displays that track live temperatures.
- **Image-to-GCode Pen Plotting**: Built-in algorithmic generator that takes standard images, traces their edges using a continuous-path algorithm, and feeds direct vector GCode to the printer.
- **Live Terminal & Controls**: Jog the printer manually, send exact GCodes, monitor temperature readouts, auto-tune PID loops, and read serial logs natively.
- **Emergency Stop (E-STOP)**: A hardware-level M112 kill command that immediately breaks the Javascript buffer and halts the printer firmware for safety.

## Getting Started

1. Clone the repository.
2. Ensure you have Node.js installed.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open your browser to the local server address (e.g. `http://localhost:5173`).
6. Plug in your 3D Printer via USB, hit **Connect**, and select your printer's COM port!
*(Note: Requires a browser that supports the Web Serial API, such as Google Chrome or Microsoft Edge)*

## Technology Stack
- React
- Vite
- TailwindCSS
- Three.js / React Three Fiber / Drei
- Web Serial API
