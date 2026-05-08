import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as handpose from '@tensorflow-models/handpose';
import './App.css';

const ASCII_CHARS = " .'-=+|*#@";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const asciiRef = useRef(null);

  // --- STATE ENGINES ---
  const [fontSizeUi, setFontSizeUi] = useState(7);
  const fontSizeRef = useRef(7);

  const [brightnessUi, setBrightnessUi] = useState(0.7);
  const brightnessRef = useRef(0.7);

  const [contrastUi, setContrastUi] = useState(1.0);
  const contrastRef = useRef(1.0);

  const [isModelReady, setIsModelReady] = useState(false);
  const frameBoxRef = useRef(null);

  // NEW: Render Mode State
  const [isAsciiMode, setIsAsciiMode] = useState(true);
  const isAsciiModeRef = useRef(true); // Ref needed for the 60fps loop

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

  const toggleRenderMode = () => {
    setIsAsciiMode(!isAsciiMode);
    isAsciiModeRef.current = !isAsciiMode;
  }

  useEffect(() => {
    let model = null;

    const startWebcamAndAI = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, aspectRatio: 4/3 },
          audio: false
        });
        if (videoRef.current) videoRef.current.srcObject = stream;

        console.log("Loading AI Model...");
        await tf.setBackend('webgl'); 
        model = await handpose.load();
        console.log("AI Model Loaded!");
        setIsModelReady(true);

        detectHands();
      } catch (error) {
        console.error("Error initializing: ", error);
      }
    }

    const detectHands = async () => {
      if (model && videoRef.current && videoRef.current.readyState >= 2) {
        const hands = await model.estimateHands(videoRef.current);
        
        if (hands.length > 0) {
          const indexTip = hands[0].annotations.indexFinger[3]; 
          const thumbTip = hands[0].annotations.thumb[3];

          const padding = 20; 
          const minX = Math.min(indexTip[0], thumbTip[0]) - padding;
          const maxX = Math.max(indexTip[0], thumbTip[0]) + padding;
          const minY = Math.min(indexTip[1], thumbTip[1]) - padding;
          const maxY = Math.max(indexTip[1], thumbTip[1]) + padding;

          frameBoxRef.current = {
            x: minX, y: minY,
            w: maxX - minX, h: maxY - minY
          };
        } else {
          frameBoxRef.current = null; 
        }
      }
      setTimeout(detectHands, 100); 
    };

    startWebcamAndAI();

    // THE 60 FPS DUAL-RENDER LOOP
    const processFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const asciiDisplay = asciiRef.current;
      const box = frameBoxRef.current;
      const isAscii = isAsciiModeRef.current;
      
      if (video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        // ---- MODE 1: ASCII RENDER ----
        if (isAscii) {
          const currentFont = fontSizeRef.current;
          canvas.width = Math.ceil(640 / (currentFont * 0.6));
          canvas.height = Math.ceil(480 / currentFont);

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

          const scaleX = canvas.width / 640;
          const scaleY = canvas.height / 480;
          
          let boxStartX = -1, boxStartY = -1, boxEndX = -1, boxEndY = -1;
          if (box) {
            boxStartX = box.x * scaleX;
            boxStartY = box.y * scaleY;
            boxEndX = (box.x + box.w) * scaleX;
            boxEndY = (box.y + box.h) * scaleY;
          }

          let asciiFrame = "";
          for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
              
              let sourceX = x;
              let sourceY = y;
              let isGlass = false;

              if (box && x >= boxStartX && x <= boxEndX && y >= boxStartY && y <= boxEndY) {
                isGlass = true;
                const rippleFreq = 0.5; 
                const rippleIntensity = 3; 
                
                sourceX = Math.max(0, Math.min(canvas.width - 1, Math.floor(x + Math.sin(y * rippleFreq) * rippleIntensity)));
                sourceY = Math.max(0, Math.min(canvas.height - 1, Math.floor(y + Math.cos(x * rippleFreq) * rippleIntensity)));
              }

              const index = (sourceY * canvas.width + sourceX) * 4;
              let bright = (imageData[index] + imageData[index + 1] + imageData[index + 2]) / 3;
              
              bright = (bright - 128) * contrastRef.current + 128;
              bright = bright * brightnessRef.current; 
              if (isGlass) bright = bright * 1.5; 
              bright = Math.min(255, Math.max(0, bright));

              asciiFrame += ASCII_CHARS[Math.floor((bright / 255) * (ASCII_CHARS.length - 1))];
            }
            asciiFrame += "\n";
          }
          asciiDisplay.textContent = asciiFrame;
        } 
        
        // ---- MODE 2: REAL VIDEO HD GLASS RENDER ----
        else {
          canvas.width = 640;
          canvas.height = 480;
          
          // 1. Draw the raw camera feed perfectly
          ctx.drawImage(video, 0, 0, 640, 480);
          
          // 2. If the AI found a box, we ONLY warp that specific rectangle
          if (box) {
            const boxStartX = Math.max(0, Math.floor(box.x));
            const boxStartY = Math.max(0, Math.floor(box.y));
            const boxWidth = Math.min(640 - boxStartX, Math.ceil(box.w));
            const boxHeight = Math.min(480 - boxStartY, Math.ceil(box.h));

            if (boxWidth > 0 && boxHeight > 0) {
              // Extract just the tiny box, not the whole screen!
              const glassData = ctx.getImageData(boxStartX, boxStartY, boxWidth, boxHeight);
              const pixels = glassData.data;
              const sourcePixels = new Uint8ClampedArray(pixels); // Clean copy to read from

              // For HD video, we need bigger waves than we used for the tiny ASCII canvas
              const rippleFreq = 0.05; 
              const rippleIntensity = 15;

              for (let y = 0; y < boxHeight; y++) {
                for (let x = 0; x < boxWidth; x++) {
                  let sourceX = Math.floor(x + Math.sin(y * rippleFreq) * rippleIntensity);
                  let sourceY = Math.floor(y + Math.cos(x * rippleFreq) * rippleIntensity);
                  
                  sourceX = Math.max(0, Math.min(boxWidth - 1, sourceX));
                  sourceY = Math.max(0, Math.min(boxHeight - 1, sourceY));

                  const readIndex = (sourceY * boxWidth + sourceX) * 4;
                  const writeIndex = (y * boxWidth + x) * 4;

                  // Add brightness (1.2) and the blue/green tint for physical glass color
                  pixels[writeIndex] = Math.min(255, sourcePixels[readIndex] * 1.2);
                  pixels[writeIndex + 1] = Math.min(255, sourcePixels[readIndex + 1] * 1.2 + 5);
                  pixels[writeIndex + 2] = Math.min(255, sourcePixels[readIndex + 2] * 1.2 + 15);
                  pixels[writeIndex + 3] = 255; 
                }
              }
              // Paint the glass block back on top of the original video!
              ctx.putImageData(glassData, boxStartX, boxStartY);
            }
          }
        }
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
      <h2 style={{ color: 'white', margin: '0 0 5px 0' }}>LiveAscii Engine</h2>
      <p style={{ color: isModelReady ? '#00ff00' : '#ff9900', margin: '0 0 20px 0', fontSize: '14px', fontFamily: 'monospace' }}>
        {isModelReady ? "AI Tracking Active: Make an 'L' shape with your hand!" : "Loading Neural Network..."}
      </p>

      <div style={{ 
        display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap',
        background: '#222', padding: '15px 30px', borderRadius: '8px', marginBottom: '30px', 
        border: '1px solid #444', color: 'white', display: 'inline-flex', alignItems: 'center'
      }}>
        
        {/* THE MODE TOGGLE BUTTON */}
        <button 
          onClick={toggleRenderMode}
          style={{
            padding: '10px 20px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
            backgroundColor: isAsciiMode ? '#00ff00' : '#aa3bff', 
            color: '#000', border: 'none', borderRadius: '4px',
            boxShadow: '0px 4px 10px rgba(0,0,0,0.5)'
          }}
        >
          {isAsciiMode ? "MODE: ASCII Matrix" : "MODE: AR Glass Video"}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: isAsciiMode ? 1 : 0.4 }}>
          <label style={{ marginBottom: '8px', fontSize: '14px' }}>Resolution: {fontSizeUi}px</label>
          <input type="range" min="2" max="16" value={fontSizeUi} onChange={handleResolutionChange} disabled={!isAsciiMode} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: isAsciiMode ? 1 : 0.4 }}>
          <label style={{ marginBottom: '8px', fontSize: '14px' }}>Brightness: {brightnessUi}</label>
          <input type="range" min="0.1" max="3.0" step="0.1" value={brightnessUi} onChange={handleBrightnessChange} disabled={!isAsciiMode} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: isAsciiMode ? 1 : 0.4 }}>
          <label style={{ marginBottom: '8px', fontSize: '14px' }}>Contrast: {contrastUi}</label>
          <input type="range" min="0.0" max="3.0" step="0.1" value={contrastUi} onChange={handleContrastChange} disabled={!isAsciiMode} />
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
          
          {/* ASCII VIEW */}
          <pre
            ref={asciiRef}
            style={{
              display: isAsciiMode ? 'block' : 'none',
              position: "absolute", top: 0, left: 0,
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "10px", lineHeight: "10px",
              color: "#00ff00", 
              margin: "0", padding: "0", textAlign: "left", transformOrigin: "top left", 
              transform: `scale(${scaleX}, ${scaleY})`, 
              width: `${safeTextWidth}px`, height: `${safeTextHeight}px`,
            }}
          ></pre>

          {/* REAL VIDEO AR VIEW */}
          {/* I brought the canvas out of hiding and put it inside the visual wrapper! */}
          <canvas 
            ref={canvasRef} 
            style={{ 
              display: isAsciiMode ? 'none' : 'block',
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%', objectFit: 'fill'
            }}
          ></canvas>

        </div>
      </div>
    </div>
  );
}

export default App;