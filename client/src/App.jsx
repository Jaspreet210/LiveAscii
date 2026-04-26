import { useEffect, useRef, useState } from 'react';
import './App.css';

const ASCII_CHARS = " .'-=+|*#@";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const asciiRef = useRef(null);

  // --- STATE ENGINES ---
  const [fontSizeUi, setFontSizeUi] = useState(9);
  const fontSizeRef = useRef(9);

  const [brightnessUi, setBrightnessUi] = useState(1.0);
  const brightnessRef = useRef(1.0);

  const [contrastUi, setContrastUi] = useState(1.0);
  const contrastRef = useRef(1.0);

  // --- HANDLERS ---
  const handleResolutionChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setFontSizeUi(val);
    fontSizeRef.current = val;
  }

  const handleBrightnessChange = (e) => {
    const val = parseFloat(e.target.value);
    setBrightnessUi(val);
    brightnessRef.current = val;
  }

  const handleContrastChange = (e) => {
    const val = parseFloat(e.target.value);
    setContrastUi(val);
    contrastRef.current = val;
  }

  useEffect(() => {
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 },
            aspectRatio: 4/3
          },
          audio: false
        });
        
        if (videoRef.current) videoRef.current.srcObject = stream;
        
      } catch (error) {
        console.error("Error accessing the webcam: ", error);
      }
    }
    startWebcam();

    const processFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const asciiDisplay = asciiRef.current;
      
      if (video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        const currentFont = fontSizeRef.current;
        
        canvas.width = Math.ceil(640 / (currentFont * 0.6));
        canvas.height = Math.ceil(480 / currentFont);

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        let asciiFrame = "";
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const index = (y * canvas.width + x) * 4;
            const r = imageData[index];
            const g = imageData[index + 1];
            const b = imageData[index + 2];

            // 1. Calculate base brightness
            let bright = (r + g + b) / 3;
            
            // 2. Apply Contrast (Anchor around 128 medium-gray)
            bright = (bright - 128) * contrastRef.current + 128;

            // 3. Apply Brightness
            bright = bright * brightnessRef.current; 
            
            // 4. Safety Clamp
            bright = Math.min(255, Math.max(0, bright));

            const charIndex = Math.floor((bright / 255) * (ASCII_CHARS.length - 1));
            asciiFrame += ASCII_CHARS[charIndex];
          }
          asciiFrame += "\n";
        }
        asciiDisplay.textContent = asciiFrame;
      }
      requestAnimationFrame(processFrame);
    }
    processFrame();
  }, []);

  const cols = Math.ceil(640 / (fontSizeUi * 0.6));
  const rows = Math.ceil(480 / fontSizeUi);
  
  const safeTextWidth = cols * 6;  
  const safeTextHeight = rows * 10;
  
  const scaleX = 640 / safeTextWidth;
  const scaleY = 480 / safeTextHeight;

  return (
    <div style={{ padding: '20px', textAlign: 'center', background: '#111', minHeight: "100vh" }}>
      <h2 style={{ color: 'white', marginBottom: '20px' }}>LiveAscii Engine</h2>

      <div style={{ 
        display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap',
        background: '#222', padding: '15px 30px', borderRadius: '8px', marginBottom: '30px', 
        border: '1px solid #444', color: 'white', display: 'inline-flex'
      }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <label style={{ marginBottom: '8px', fontSize: '14px' }}>Resolution: {fontSizeUi}px</label>
          <input type="range" min="2" max="16" value={fontSizeUi} onChange={handleResolutionChange} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <label style={{ marginBottom: '8px', fontSize: '14px' }}>Brightness: {brightnessUi}</label>
          <input type="range" min="0.1" max="3.0" step="0.1" value={brightnessUi} onChange={handleBrightnessChange} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <label style={{ marginBottom: '8px', fontSize: '14px' }}>Contrast: {contrastUi}</label>
          <input type="range" min="0.0" max="3.0" step="0.1" value={contrastUi} onChange={handleContrastChange} />
        </div>

      </div>

      <div style={{ display: "flex", flexDirection: "row", flexWrap: "nowrap", justifyContent: 'center', alignItems: 'flex-start', gap: "40px" }}>

        <video
          ref={videoRef}
          autoPlay playsInline muted
          style={{ width: "640px", height: "480px", minWidth: "640px", minHeight: "480px", border: '2px solid #555', transform: 'scaleX(-1)', backgroundColor: '#000', objectFit: 'fill', flexShrink: 0 }}
        ></video>

        <div style={{
          position: "relative",
          width: "640px", height: "480px", minWidth: "640px", minHeight: "480px",
          transform: "scaleX(-1)", 
          border: '2px solid #555', backgroundColor: '#000', overflow: "hidden", flexShrink: 0
        }}>
          
          <pre
            ref={asciiRef}
            style={{
              position: "absolute", top: 0, left: 0,
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "10px", lineHeight: "10px",
              color: "#ddd", // Hardcoded back to Matrix Green!
              margin: "0", padding: "0", textAlign: "left", transformOrigin: "top left", 
              transform: `scale(${scaleX}, ${scaleY})`, 
              width: `${safeTextWidth}px`, height: `${safeTextHeight}px`,
            }}
          ></pre>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
    </div>
  );
}

export default App;