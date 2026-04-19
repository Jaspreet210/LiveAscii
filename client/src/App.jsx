import { useEffect, useRef } from 'react';
import './App.css';

const ASCII_CHARS = " .:-=+*#%@";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const asciiRef = useRef(null);

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
    <div style={{ padding: '30px', textAlign: 'center', background: '#111' }}>
      <h2 style={{ color: 'white' }}>Live Webcam Feed</h2>
      
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        width="640" 
        height="480"
        style={{ border: '2px solid #555', transform: 'scaleX(-1)' }}
      ></video>

      <pre
      ref={asciiRef}
      style={{transform:"scaleX(-1)"  ,fontFamily: 'monospace' , fontSize:"8px" , lineHeight:"8px" , color:"#fff" , margin:"0" }}
      >
      </pre>

      <canvas ref={canvasRef} width="100" height="60" style={{display:"none"}} > 
      </canvas>
    </div>
  );
}

export default App;