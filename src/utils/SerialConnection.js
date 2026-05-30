class SerialConnection {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null; // We'll keep a single writer open for better performance
    this.keepReading = true;
    this.onDataCallback = null;
    this.onDisconnectCallback = null;
    this.readPromise = null;
    this.writeMutex = Promise.resolve();
    this.okPromiseResolve = null; // For ping-pong queue blocking
    this.listeners = [];
    this.isHalted = false;
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  notifyListeners(status) {
    this.listeners.forEach(cb => cb(status));
  }

  async requestPort() {
    if ('serial' in navigator) {
      try {
        this.port = await navigator.serial.requestPort();
        return true;
      } catch (err) {
        console.error('Error requesting port:', err);
        return false;
      }
    } else {
      alert('Web Serial API is not supported in this browser. Please use Chrome or Edge.');
      return false;
    }
  }

  async connect(baudRate = 115200) {
    if (!this.port) return false;
    try {
      await this.port.open({ baudRate });
      this.isHalted = false; // Reset halt state on new connection
      
      // Many 3D printer boards (especially Arduino-based) require DTR/RTS to communicate
      try {
        await this.port.setSignals({ dataTerminalReady: true, requestToSend: true });
        // Give the board a tiny moment to reset if it resets on DTR
        await new Promise(r => setTimeout(r, 100));
      } catch (e) {
        console.warn('Could not set DTR/RTS signals', e);
      }

      this.keepReading = true;
      
      // Keep a permanent writer open
      this.writer = this.port.writable.getWriter();
      
      this.readPromise = this.readLoop();
      
      // Request initial position and enable auto-temperature reporting
      setTimeout(() => {
        this.write('M114');
        this.write('M155 S2'); // Try hardware auto-report first
        this.write('M154 S2');
        this.startPolling();   // Fallback to internal software poller
      }, 1000);
      
      this.notifyListeners({ connected: true });
      return true;
    } catch (err) {
      console.error("Connection error:", err);
      this.notifyListeners({ connected: false });
      return false;
    }
  }

  startPolling() {
    this.stopPolling(); // ensure no duplicates
    this.pollingInterval = setInterval(() => {
      if (!this.port) return;
      // Software polling for Position and Temperature
      this.write('M105');
      this.write('M114');
    }, 2000);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  async disconnect() {
    this.stopPolling();
    this.keepReading = false;
    
    if (this.reader) {
      await this.reader.cancel();
      this.reader = null;
    }
    
    if (this.readPromise) {
      await this.readPromise;
      this.readPromise = null;
    }

    if (this.writer) {
      this.writer.releaseLock();
      this.writer = null;
    }
    
    if (this.port) {
      await this.port.close();
      this.port = null;
    }

    this.notifyListeners({ connected: false });

    if (this.onDisconnectCallback) {
      this.onDisconnectCallback();
    }
  }

  async write(data) {
    if (this.isHalted) {
      console.warn("Write blocked: Printer is halted.");
      return;
    }

    if (!this.port || !this.port.writable || !this.writer) {
      alert("Printer is not connected or port is not writable!");
      return;
    }

    // Queue writes to prevent overlapping and wait for 'ok' (Ping-Pong)
    const p = new Promise(resolveQueue => {
      this.writeMutex = this.writeMutex.then(async () => {
        try {
          const encoder = new TextEncoder();
          
          // Create the Promise that readLoop will resolve when 'ok' is received
          const waitForOk = new Promise(r => { this.okPromiseResolve = r; });
          
          // Marlin uses \n or \r\n
          await this.writer.write(encoder.encode(data + '\n'));
          
          // Wait for the 'ok' response or a 30 second timeout
          await Promise.race([
            waitForOk,
            new Promise(r => setTimeout(r, 30000))
          ]);
          
        } catch (err) {
          console.error("Error writing to serial port:", err);
        }
        resolveQueue();
      });
    });
    
    return p;
  }

  async emergencyStop() {
    console.warn("EMERGENCY STOP INITIATED");
    this.isHalted = true; // Block any further writes from the queue or UI
    
    // Break the current software queue chain
    this.writeMutex = Promise.resolve();
    
    // Unblock any pending queue waits
    if (this.okPromiseResolve) {
      this.okPromiseResolve();
      this.okPromiseResolve = null;
    }

    if (!this.port || !this.port.writable || !this.writer) {
      return;
    }
    
    try {
      // Write M112 directly, bypassing the queue
      const encoder = new TextEncoder();
      await this.writer.write(encoder.encode('M112\n'));
    } catch (err) {
      console.error("Emergency stop failed to write:", err);
    }
  }

  async readLoop() {
    let lineBuffer = '';
    while (this.port && this.port.readable && this.keepReading) {
      const decoder = new TextDecoderStream();
      const readableStreamClosed = this.port.readable.pipeTo(decoder.writable);
      this.reader = decoder.readable.getReader();
      
      try {
        while (true) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) {
            lineBuffer += value;
            let lines = lineBuffer.split('\n');
            lineBuffer = lines.pop(); // Keep the incomplete line for the next chunk
            
            for (let line of lines) {
              line = line.trim();
              if (!line) continue;
              
              if (this.onDataCallback) {
                this.onDataCallback(line);
              }

              // Detect 'ok' or error lines to unblock the write queue
              const lowerLine = line.toLowerCase();
              if (lowerLine.startsWith('ok') || lowerLine.startsWith('error') || lowerLine.includes('resend')) {
                if (this.okPromiseResolve) {
                  this.okPromiseResolve();
                  this.okPromiseResolve = null;
                }
              }

              // Parse Marlin M114 Position Response
              const posMatch = line.match(/X:\s*([0-9.-]+)\s+Y:\s*([0-9.-]+)\s+Z:\s*([0-9.-]+)/i);
              if (posMatch && this.onPositionUpdate) {
                this.onPositionUpdate({
                  x: parseFloat(posMatch[1]),
                  y: parseFloat(posMatch[2]),
                  z: parseFloat(posMatch[3])
                });
              }

              // Parse Marlin M105 Temperature Response: "ok T:200.0 /200.0 B:60.0 /60.0"
              const tempMatch = line.match(/T:\s*([0-9.-]+)\s*\/([0-9.-]+).*?B:\s*([0-9.-]+)\s*\/([0-9.-]+)/i);
              if (tempMatch && this.onTemperatureUpdate) {
                this.onTemperatureUpdate({
                  nozzle: parseFloat(tempMatch[1]),
                  nozzleTarget: parseFloat(tempMatch[2]),
                  bed: parseFloat(tempMatch[3]),
                  bedTarget: parseFloat(tempMatch[4])
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('Read loop error:', error);
      } finally {
        if (this.reader) {
          this.reader.releaseLock();
          this.reader = null;
        }
      }
    }
  }
}

export const serialConnection = new SerialConnection();
