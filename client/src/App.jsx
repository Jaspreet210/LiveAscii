import { useEffect, useRef, useState } from 'react';
import './App.css';

const ASCII_CHARS = " .'`^\",:;Iil!><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
// const ASCII_CHARS = " .'-=+|*#@";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const asciiRef = useRef(null);

  const [fontSizeUi,setFontSizeUi]=useState(4);
  const fontSizeRef=useRef(4);

  const handleSliderChange=(e)=>{
    const val=parseInt(e.target.value,10);
    setFontSizeUi(val);
    fontSizeRef.current=val;
  }

  useEffect(() => {
    const startWebcam=async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: false 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        console.log("Camera access granted and playing!");
      } catch (error) {
        console.error("Error accessing the webcam: ", error);
      }
    }
    startWebcam();


    //Paints a screenshot to the canvas:::
    const processFrame = () => 
    {
      const video=videoRef.current;
      const canvas=canvasRef.current;
      const asciiDisplay=asciiRef.current;
      if(video && canvas && video.readyState >=2)
      {
        const ctx= canvas.getContext('2d');
        const currentFont = fontSizeRef.current;
        const targetWidth = 640;
        const targetHeight = 480;
        canvas.width = Math.floor(targetWidth / (currentFont * 0.6));
        canvas.height = Math.floor(targetHeight / currentFont);
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        //Capturing pixels form canvas
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        let asciiFrame = "";
        for(let y=0;y<canvas.height;y++)
        {
          for(let x=0;x<canvas.width;x++)
          {
            const index = (y* canvas.width +x) *4 ; 

            const r=imageData[index];
            const g=imageData[index+1];
            const b=imageData[index+2];

            const bright=(r+g+b)/3;
            const charIndex= Math.floor((bright/255) * (ASCII_CHARS.length - 1));

            asciiFrame+= ASCII_CHARS[charIndex] ;
          }
          asciiFrame += "\n";

        }
        asciiDisplay.textContent = asciiFrame;

      }
      requestAnimationFrame(processFrame);
    }
    processFrame();
  }, []); 


  return (
    
    <div style={{ padding: '10px', textAlign: 'center', background: '#111' , minHeight:"100vh" ,minWidth:"100vw" }}>
      <h2 style={{ color: 'white' }}>LiveAscii</h2>

      <div style={{ marginBottom: '20px', color: 'white' }}>
        <label style={{ marginRight: '10px' }}>Resolution (Font Size: {fontSizeUi}px)</label>
        <input 
          type="range" 
          min="2" 
          max="16" 
          value={fontSizeUi} 
          onChange={handleSliderChange} 
        />
      </div>

      <div style={{
        display:"flex",
        flexDirection:"row",
        flexWrap:"nowrap",
        justifyContent:'center',
        alignItems:'flex-start',
        gap:"40px"
      }}>
    
      
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        width="640" 
        height="480"
        style={{ 
          border: '2px solid #555',
          transform: 'scaleX(-1)',
          maxWidth:"100%" 
        }}
      ></video>

      <pre
          ref={asciiRef}
          style={{ 
            transform: "scaleX(-1)", 
            fontFamily: 'monospace', 
            fontSize: `${fontSizeUi}px`, 
            lineHeight: `${fontSizeUi}px`, 
            color: "#fff", 
            margin: "0",
            textAlign: "left", 
            border:"2px solid #555",
            overflow: "hidden" 
          }}
        ></pre>
        </div>

      <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
      </div>
    );
}

export default App;