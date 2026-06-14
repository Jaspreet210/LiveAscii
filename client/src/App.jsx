import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import './App.css';

const ASCII_CHARS = " .,:;|+*%#@";

const isPointInPoly = (x, y, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
};

const MODES = ['GLASS', 'ASCII', 'GLITCH'];

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const asciiRef = useRef(null);
  const detectorRef = useRef(null);
  const frameBoxRef = useRef({ count: 0, rawPoints: [] });
  const stoppedRef = useRef(false);
  const timeRef = useRef(0);

  const [fontSizeUi, setFontSizeUi] = useState(8);
  const fontSizeRef = useRef(8);
  const brightnessRef = useRef(0.85);
  const contrastRef = useRef(1.1);

  const [isModelReady, setIsModelReady] = useState(false);
  const [handCount, setHandCount] = useState(0);
  const handCountRef = useRef(0);

  const [modeIdx, setModeIdx] = useState(0);
  const modeIdxRef = useRef(0);

  const [glitchIntensity, setGlitchIntensity] = useState(0.5);
  const glitchRef = useRef(0.5);

  const [rippleIntensity, setRippleIntensity] = useState(15);
  const rippleRef = useRef(15);

  const setMode = (i) => {
    setModeIdx(i);
    modeIdxRef.current = i;
  };

  useEffect(() => {
    stoppedRef.current = false;

    const detectLoop = async () => {
      if (stoppedRef.current) return;
      const video = videoRef.current;
      const detector = detectorRef.current;

      if (detector && video && video.readyState >= 2) {
        try {
          const hands = await detector.estimateHands(video);
          const tw = video.videoWidth || 640;
          const th = video.videoHeight || 480;
          const sx = 640 / tw;
          const sy = 480 / th;

          const pts = [];
          (hands || []).forEach(hand => {
            if (hand.keypoints?.length > 8) {
              pts.push({ x: 640 - hand.keypoints[8].x * sx, y: hand.keypoints[8].y * sy });
              pts.push({ x: 640 - hand.keypoints[4].x * sx, y: hand.keypoints[4].y * sy });
            }
          });

          const count = hands?.length ?? 0;
          frameBoxRef.current = { count, rawPoints: pts };

          if (count !== handCountRef.current) {
            handCountRef.current = count;
            setHandCount(count);
          }
        } catch (e) {}
      }
      if (!stoppedRef.current) setTimeout(detectLoop, 50);
    };

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
        await tf.setBackend('webgl');
        detectorRef.current = await handPoseDetection.createDetector(
          handPoseDetection.SupportedModels.MediaPipeHands,
          { runtime: 'tfjs', modelType: 'lite', maxHands: 2 }
        );
        setIsModelReady(true);
        detectLoop();
      } catch (err) {
        console.error('Init error:', err);
      }
    };

    const renderLoop = (ts) => {
      if (stoppedRef.current) return;
      timeRef.current = ts * 0.001;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ascii = asciiRef.current;
      if (!video || !canvas || video.readyState < 2) {
        requestAnimationFrame(renderLoop);
        return;
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const { count, rawPoints } = frameBoxRef.current;
      const mode = MODES[modeIdxRef.current];
      const t = timeRef.current;

      if (mode === 'ASCII') {
        const fs = fontSizeRef.current;
        canvas.width = Math.ceil(640 / (fs * 0.6));
        canvas.height = Math.ceil(480 / fs);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let out = '';
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            let b = (data[i] + data[i + 1] + data[i + 2]) / 3;
            b = (b - 128) * contrastRef.current + 128;
            b = Math.min(255, Math.max(0, b * brightnessRef.current));
            out += ASCII_CHARS[Math.floor((b / 255) * (ASCII_CHARS.length - 1))];
          }
          out += '\n';
        }
        if (ascii) ascii.textContent = out;

      } else if (mode === 'GLITCH') {
        canvas.width = 640;
        canvas.height = 480;
        ctx.drawImage(video, 0, 0, 640, 480);

        const intensity = glitchRef.current;
        const imageData = ctx.getImageData(0, 0, 640, 480);
        const px = imageData.data;

        // RGB channel split
        const shiftAmt = Math.floor(intensity * 12);
        for (let y = 0; y < 480; y++) {
          const rowShift = (Math.sin(y * 0.3 + t * 8) > 0.92) ? Math.floor(intensity * 40) : 0;
          for (let x = 0; x < 640; x++) {
            const i = (y * 640 + x) * 4;
            const rx = Math.min(639, x + shiftAmt + rowShift);
            const bx = Math.max(0, x - shiftAmt);
            const ri = (y * 640 + rx) * 4;
            const bi = (y * 640 + bx) * 4;
            px[i] = px[ri];
            px[i + 2] = px[bi + 2];
          }
        }

        // scanlines
        for (let y = 0; y < 480; y += 3) {
          for (let x = 0; x < 640; x++) {
            const i = (y * 640 + x) * 4;
            px[i] = px[i] * 0.7;
            px[i + 1] = px[i + 1] * 0.7;
            px[i + 2] = px[i + 2] * 0.7;
          }
        }

        ctx.putImageData(imageData, 0, 0);

        // hand dots in glitch mode
        if (rawPoints.length > 0) {
          rawPoints.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,0,80,0.9)`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255,0,80,0.4)`;
            ctx.lineWidth = 2;
            ctx.stroke();
          });
        }

      } else {
        // GLASS MODE
        canvas.width = 640;
        canvas.height = 480;
        ctx.drawImage(video, 0, 0, 640, 480);

        if (count >= 2 && rawPoints.length >= 4) {
          const pts4 = rawPoints.slice(0, 4);
          const cx = pts4.reduce((s, p) => s + p.x, 0) / 4;
          const cy = pts4.reduce((s, p) => s + p.y, 0) / 4;
          const poly = [...pts4].sort((a, b) =>
            Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx)
          );

          const minX = Math.max(0, Math.floor(Math.min(...poly.map(p => p.x))));
          const maxX = Math.min(640, Math.ceil(Math.max(...poly.map(p => p.x))));
          const minY = Math.max(0, Math.floor(Math.min(...poly.map(p => p.y))));
          const maxY = Math.min(480, Math.ceil(Math.max(...poly.map(p => p.y))));
          const bw = maxX - minX;
          const bh = maxY - minY;

          if (bw > 10 && bh > 10) {
            const glassData = ctx.getImageData(minX, minY, bw, bh);
            const pxd = glassData.data;
            const src = new Uint8ClampedArray(pxd);
            const rip = rippleRef.current;

            for (let y = 0; y < bh; y++) {
              for (let x = 0; x < bw; x++) {
                if (isPointInPoly(minX + x, minY + y, poly)) {
                  let sx = Math.round(x + Math.sin((minY + y) * 0.05 + t) * rip);
                  let sy = Math.round(y + Math.cos((minX + x) * 0.05 + t * 0.7) * rip);
                  sx = Math.max(0, Math.min(bw - 1, sx));
                  sy = Math.max(0, Math.min(bh - 1, sy));
                  const ri = (sy * bw + sx) * 4;
                  const wi = (y * bw + x) * 4;
                  pxd[wi]     = Math.min(255, src[ri]     * 1.15);
                  pxd[wi + 1] = Math.min(255, src[ri + 1] * 1.15 + 8);
                  pxd[wi + 2] = Math.min(255, src[ri + 2] * 1.3 + 20);
                  pxd[wi + 3] = 230;
                }
              }
            }
            ctx.putImageData(glassData, minX, minY);

            // animated dashed frame
            const dashOffset = (t * 40) % 46;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(poly[0].x, poly[0].y);
            poly.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
            ctx.closePath();
            ctx.strokeStyle = 'rgba(0,255,200,0.9)';
            ctx.lineWidth = 2;
            ctx.setLineDash([18, 10]);
            ctx.lineDashOffset = -dashOffset;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            // corner ticks
            poly.forEach(p => {
              ctx.beginPath();
              ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(0,255,200,1)';
              ctx.fill();
            });
          }
        }

        // dots
        rawPoints.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 60, 100, 0.95)';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,60,100,0.35)';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      }

      requestAnimationFrame(renderLoop);
    };

    init();
    requestAnimationFrame(renderLoop);
    return () => { stoppedRef.current = true; };
  }, []);

  const cols = Math.ceil(640 / (fontSizeUi * 0.6));
  const rows = Math.ceil(480 / fontSizeUi);
  const safeW = cols * 6;
  const safeH = rows * 10;
  const mode = MODES[modeIdx];

  const statusColor = !isModelReady ? '#ff9900'
    : handCount === 0 ? '#555'
    : handCount === 1 ? '#ffcc00'
    : '#00ffb2';

  const statusMsg = !isModelReady ? 'LOADING NEURAL NETWORK...'
    : handCount === 0 ? 'NO HANDS DETECTED'
    : handCount === 1 ? '1 HAND — SHOW BOTH TO ACTIVATE GLASS'
    : '2 HANDS — GLASS ACTIVE';

  return (
    <div className="app-root">

      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <span className="logo-mark">◈</span>
          <span className="logo-text">FRAME<span className="logo-accent">AR</span></span>
        </div>
        <div className="header-center">
          <span className="status-dot" style={{ background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
          <span className="status-text" style={{ color: statusColor }}>{statusMsg}</span>
        </div>
        <div className="header-right">
          <span className="version-tag">v2.0</span>
        </div>
      </header>

      {/* Mode tabs */}
      <div className="mode-bar">
        {MODES.map((m, i) => (
          <button
            key={m}
            className={`mode-btn ${modeIdx === i ? 'active' : ''}`}
            onClick={() => setMode(i)}
            data-mode={m}
          >
            <span className="mode-icon">
              {m === 'GLASS' ? '⬡' : m === 'ASCII' ? '▤' : '⚡'}
            </span>
            {m}
          </button>
        ))}
      </div>

      {/* Main stage */}
      <main className="stage">

        {/* Source feed */}
        <div className="feed-container">
          <div className="feed-label">SOURCE</div>
          <video
            ref={videoRef}
            autoPlay playsInline muted
            className="feed-video"
          />
          <div className="corner-tl" /><div className="corner-tr" />
          <div className="corner-bl" /><div className="corner-br" />
        </div>

        {/* Divider */}
        <div className="stage-divider">
          <div className="divider-line" />
          <span className="divider-icon">⟶</span>
          <div className="divider-line" />
        </div>

        {/* Output */}
        <div className={`feed-container output-container ${handCount === 2 && mode === 'GLASS' ? 'active-glow' : ''}`}>
          <div className="feed-label">OUTPUT <span className="mode-badge" data-mode={mode}>{mode}</span></div>
          <div className="canvas-wrapper" style={{ transform: 'scaleX(-1)' }}>
            <pre
              ref={asciiRef}
              className="ascii-display"
              style={{
                display: mode === 'ASCII' ? 'block' : 'none',
                transformOrigin: 'top left',
                transform: `scale(${640 / safeW}, ${480 / safeH})`,
                width: safeW,
                height: safeH,
              }}
            />
            <canvas
              ref={canvasRef}
              className="output-canvas"
              style={{ display: mode === 'ASCII' ? 'none' : 'block' }}
            />
          </div>
          <div className="corner-tl" /><div className="corner-tr" />
          <div className="corner-bl" /><div className="corner-br" />
        </div>
      </main>

      {/* Controls panel */}
      <aside className="controls-panel">
        {mode === 'ASCII' && (
          <div className="control-group">
            <label className="ctrl-label">DENSITY <span className="ctrl-val">{fontSizeUi}px</span></label>
            <input
              type="range" min="2" max="16" value={fontSizeUi}
              className="ctrl-slider"
              onChange={e => {
                const v = parseInt(e.target.value);
                setFontSizeUi(v);
                fontSizeRef.current = v;
              }}
            />
          </div>
        )}
        {mode === 'GLASS' && (
          <div className="control-group">
            <label className="ctrl-label">RIPPLE <span className="ctrl-val">{rippleIntensity}px</span></label>
            <input
              type="range" min="0" max="40" value={rippleIntensity}
              className="ctrl-slider"
              onChange={e => {
                const v = parseInt(e.target.value);
                setRippleIntensity(v);
                rippleRef.current = v;
              }}
            />
          </div>
        )}
        {mode === 'GLITCH' && (
          <div className="control-group">
            <label className="ctrl-label">INTENSITY <span className="ctrl-val">{Math.round(glitchIntensity * 100)}%</span></label>
            <input
              type="range" min="0" max="100" value={Math.round(glitchIntensity * 100)}
              className="ctrl-slider"
              onChange={e => {
                const v = parseInt(e.target.value) / 100;
                setGlitchIntensity(v);
                glitchRef.current = v;
              }}
            />
          </div>
        )}

        <div className="hand-indicator">
          {[0, 1].map(i => (
            <div key={i} className={`hand-pip ${i < handCount ? 'active' : ''}`}>
              <span className="hand-pip-icon">✋</span>
              <span className="hand-pip-label">HAND {i + 1}</span>
            </div>
          ))}
        </div>

        <div className="hint-text">
          {mode === 'GLASS' && 'Point index fingers + thumbs of both hands to define the glass frame'}
          {mode === 'ASCII' && 'Adjust density slider to change character resolution'}
          {mode === 'GLITCH' && 'Drag intensity to push the RGB channel separation'}
        </div>
      </aside>

    </div>
  );
}

export default App;