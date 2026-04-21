import { useEffect, useRef, useState } from 'react';
import './App.css';

const ASCII_CHARS = " .'-=+|*#@";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const asciiRef = useRef(null);

  const [fontSizeUi, setFontSizeUi] = useState(9);
  const fontSizeRef = useRef(9);

  const handleSliderChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setFontSizeUi(val);
    fontSizeRef.current = val;
  }

  useEffect(() => {
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
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
        
        // 1. RESTORED GEOMETRY: The * 0.6 guarantees we generate enough characters to reach the edge!
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

            let bright = (r + g + b) / 3.0;
            bright*=0.9;
            
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

  // 2. SCALER MATH: Synced with the 0.6 aspect ratio
  const cols = Math.ceil(640 / (fontSizeUi * 0.6));
  const rows = Math.ceil(480 / fontSizeUi);
  
  // Courier New at 10px height is exactly 6px wide.
  const safeTextWidth = cols * 6;  
  const safeTextHeight = rows * 10;
  
  const scaleX = 640 / safeTextWidth;
  const scaleY = 480 / safeTextHeight;

  return (
    <div style={{ padding: '10px', textAlign: 'center', background: '#111', minHeight: "100vh" }}>
      <h2 style={{ color: 'white' }}>LiveAscii</h2>

      <div style={{ marginBottom: '20px', color: 'white' }}>
        <label style={{ marginRight: '10px' }}>Resolution Slider</label>
        <input
          type="range"
          min="2"
          max="16"
          value={fontSizeUi}
          onChange={handleSliderChange}
        />
      </div>

      <div style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: "40px"
      }}>

        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            width: "640px",
            height: "480px",
            minWidth: "640px",
            minHeight: "480px",
            border: '2px solid #555',
            transform: 'scaleX(-1)',
            backgroundColor: '#000',
            objectFit: 'cover',
            flexShrink: 0
          }}
        ></video>

        <div style={{
          width: "640px",
          height: "480px",
          minWidth: "640px",
          minHeight: "480px",
          transform: "scaleX(-1)", 
          border: '2px solid #555',
          backgroundColor: '#000',
          overflow: "hidden",
          flexShrink: 0
        }}>
          <pre
            ref={asciiRef}
            style={{
              // FORCING Courier New locks the browser to the exact 0.6 math we used above
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "10px",     
              lineHeight: "10px",   
              color: "#fff",
              margin: "0",
              padding: "0",
              textAlign: "left",
              transformOrigin: "top left", 
              transform: `scale(${scaleX}, ${scaleY})`, 
              width: `${safeTextWidth}px`, 
              height: `${safeTextHeight}px`,
            }}
          ></pre>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
    </div>
  );
}

export default App;