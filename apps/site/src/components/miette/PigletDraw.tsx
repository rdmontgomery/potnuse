import { useEffect, useRef, useState } from 'react';

type Tool = 'brush' | 'stamp' | 'sparkle';
type Stamp = 'heart' | 'star' | 'circle' | 'square';

interface SparkleEl {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  rotate: number;
  drift: number;
}

const COLORS = [
  '#e91e63',
  '#ff5722',
  '#ff9800',
  '#ffeb3b',
  '#8bc34a',
  '#00bcd4',
  '#3f51b5',
  '#9c27b0',
  '#ffffff',
  '#333333',
];
const RAINBOW = 'RAINBOW';
const STAMPS: Stamp[] = ['heart', 'star', 'circle', 'square'];

const PIGLET_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='110' height='110' viewBox='0 0 110 110'>" +
  "<path d='M30 38 L36 22 L46 38 Z' fill='%23f48ba0'/>" +
  "<path d='M80 38 L74 22 L64 38 Z' fill='%23f48ba0'/>" +
  "<circle cx='55' cy='58' r='30' fill='%23f8b8c8'/>" +
  "<path d='M34 40 L38 30 L44 40 Z' fill='%23fbd0db'/>" +
  "<path d='M76 40 L72 30 L66 40 Z' fill='%23fbd0db'/>" +
  "<ellipse cx='55' cy='68' rx='14' ry='10' fill='%23f59cb0'/>" +
  "<ellipse cx='49' cy='68' rx='2.5' ry='3.5' fill='%235c2a3a'/>" +
  "<ellipse cx='61' cy='68' rx='2.5' ry='3.5' fill='%235c2a3a'/>" +
  "<circle cx='44' cy='52' r='3' fill='%233a2030'/>" +
  "<circle cx='66' cy='52' r='3' fill='%233a2030'/>" +
  "<circle cx='45' cy='51' r='1' fill='%23ffffff'/>" +
  "<circle cx='67' cy='51' r='1' fill='%23ffffff'/>" +
  '</svg>';

const PIGLET_BG = `url("data:image/svg+xml;utf8,${PIGLET_SVG}")`;

function drawStamp(
  ctx: CanvasRenderingContext2D,
  kind: Stamp,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  if (kind === 'circle') {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'square') {
    ctx.fillRect(x - size, y - size, size * 2, size * 2);
    ctx.strokeRect(x - size, y - size, size * 2, size * 2);
  } else if (kind === 'heart') {
    const s = size;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.55);
    ctx.bezierCurveTo(x - s * 1.2, y, x - s * 0.5, y - s * 0.9, x, y - s * 0.25);
    ctx.bezierCurveTo(x + s * 0.5, y - s * 0.9, x + s * 1.2, y, x, y + s * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? size : size / 2.3;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function randomColor() {
  return COLORS[Math.floor(Math.random() * (COLORS.length - 1))];
}

let sparkleIdCounter = 0;
const SPARKLE_LIFE_MS = 1200;

export default function PigletDraw() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState<string>(COLORS[0]);
  const [stamp, setStamp] = useState<Stamp>('heart');
  const [brushSize, setBrushSize] = useState<number>(18);
  const [sparkles, setSparkles] = useState<SparkleEl[]>([]);

  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const stampRef = useRef(stamp);
  const brushSizeRef = useRef(brushSize);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);
  useEffect(() => {
    stampRef.current = stamp;
  }, [stamp]);
  useEffect(() => {
    brushSizeRef.current = brushSize;
  }, [brushSize]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = window.devicePixelRatio || 1;

      const prev = document.createElement('canvas');
      prev.width = canvas.width;
      prev.height = canvas.height;
      if (canvas.width > 0 && canvas.height > 0) {
        prev.getContext('2d')!.drawImage(canvas, 0, 0);
      }

      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';

      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (prev.width > 0 && prev.height > 0) {
        ctx.drawImage(prev, 0, 0, rect.width, rect.height);
      }
    };

    resize();
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(resize)
        : null;
    ro?.observe(wrap);
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
    };
  }, []);


  const getPos = (clientX: number, clientY: number) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const drawDot = (pos: { x: number; y: number }) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const c = colorRef.current === RAINBOW ? randomColor() : colorRef.current;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSizeRef.current / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawLine = (
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const c = colorRef.current === RAINBOW ? randomColor() : colorRef.current;
    ctx.strokeStyle = c;
    ctx.lineWidth = brushSizeRef.current;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const placeStamp = (pos: { x: number; y: number }) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const c = colorRef.current === RAINBOW ? randomColor() : colorRef.current;
    drawStamp(ctx, stampRef.current, pos.x, pos.y, 36, c);
  };

  const emitSparkles = (pos: { x: number; y: number }, count = 4) => {
    const useRainbow = colorRef.current === RAINBOW;
    const next: SparkleEl[] = [];
    const ids: number[] = [];
    for (let i = 0; i < count; i++) {
      sparkleIdCounter += 1;
      ids.push(sparkleIdCounter);
      next.push({
        id: sparkleIdCounter,
        x: pos.x + (Math.random() - 0.5) * 24,
        y: pos.y + (Math.random() - 0.5) * 24,
        size: 18 + Math.random() * 18,
        color: useRainbow ? randomColor() : colorRef.current,
        rotate: Math.random() * 360,
        drift: (Math.random() - 0.5) * 40,
      });
    }
    setSparkles((prev) => {
      const trimmed = prev.length > 200 ? prev.slice(prev.length - 200) : prev;
      return [...trimmed, ...next];
    });
    setTimeout(() => {
      const drop = new Set(ids);
      setSparkles((prev) => prev.filter((s) => !drop.has(s.id)));
    }, SPARKLE_LIFE_MS + 80);
  };

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const down = (e: PointerEvent) => {
      if (e.cancelable) e.preventDefault();
      drawingRef.current = true;
      const pos = getPos(e.clientX, e.clientY);
      lastRef.current = pos;
      const t = toolRef.current;
      if (t === 'brush') drawDot(pos);
      else if (t === 'stamp') placeStamp(pos);
      else if (t === 'sparkle') emitSparkles(pos, 8);
    };

    const move = (e: PointerEvent) => {
      if (!drawingRef.current) return;
      if (e.cancelable) e.preventDefault();
      const pos = getPos(e.clientX, e.clientY);
      const t = toolRef.current;
      if (t === 'brush' && lastRef.current) {
        drawLine(lastRef.current, pos);
        lastRef.current = pos;
      } else if (t === 'sparkle') {
        emitSparkles(pos, 3);
      }
    };

    const up = () => {
      drawingRef.current = false;
      lastRef.current = null;
    };

    const touchFallback = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };

    wrap.addEventListener('pointerdown', down, { passive: false });
    wrap.addEventListener('pointermove', move, { passive: false });
    wrap.addEventListener('pointerup', up);
    wrap.addEventListener('pointercancel', up);
    wrap.addEventListener('pointerleave', up);
    wrap.addEventListener('touchstart', touchFallback, { passive: false });
    wrap.addEventListener('touchmove', touchFallback, { passive: false });
    window.addEventListener('pointerup', up);

    return () => {
      wrap.removeEventListener('pointerdown', down);
      wrap.removeEventListener('pointermove', move);
      wrap.removeEventListener('pointerup', up);
      wrap.removeEventListener('pointercancel', up);
      wrap.removeEventListener('pointerleave', up);
      wrap.removeEventListener('touchstart', touchFallback);
      wrap.removeEventListener('touchmove', touchFallback);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  const clearAll = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, c.width / dpr, c.height / dpr);
    setSparkles([]);
  };

  const toolBtn = (id: Tool, label: string) => {
    const active = tool === id;
    return (
      <button
        key={id}
        onClick={() => setTool(id)}
        style={{
          padding: '12px 18px',
          fontSize: 18,
          fontWeight: 700,
          borderRadius: 14,
          border: active ? '3px solid #d6336c' : '3px solid transparent',
          background: active ? '#fff0f5' : '#ffffff',
          color: '#3a2030',
          cursor: 'pointer',
          boxShadow: active ? '0 4px 0 #d6336c' : '0 4px 0 #c79bb0',
          transform: active ? 'translateY(2px)' : 'translateY(0)',
          minWidth: 110,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#fff5f8',
        display: 'flex',
        flexDirection: 'column',
        fontFamily:
          "'Crimson Pro', Georgia, system-ui, -apple-system, sans-serif",
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes mietteSparkle {
          0% { transform: translate(-50%, -50%) rotate(var(--r)) scale(0.4); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translate(calc(-50% + var(--dx)), calc(-50% - 60px)) rotate(calc(var(--r) + 180deg)) scale(1); opacity: 0; }
        }
        .miette-sparkle {
          position: absolute;
          pointer-events: none;
          animation: mietteSparkle ${SPARKLE_LIFE_MS}ms ease-out forwards;
          will-change: transform, opacity;
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          padding: '10px 14px',
          background: 'linear-gradient(180deg, #ffd8e4 0%, #ffc1d4 100%)',
          borderBottom: '3px solid #f48ba0',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          {toolBtn('brush', 'Paintbrush')}
          {toolBtn('stamp', 'Stamps')}
          {toolBtn('sparkle', 'Sparkles')}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            alignItems: 'center',
          }}
        >
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`color ${c}`}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: c,
                border:
                  color === c ? '3px solid #3a2030' : '2px solid #ffffff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
              }}
            />
          ))}
          <button
            onClick={() => setColor(RAINBOW)}
            aria-label="rainbow"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background:
                'conic-gradient(#e91e63,#ff9800,#ffeb3b,#8bc34a,#00bcd4,#3f51b5,#9c27b0,#e91e63)',
              border:
                color === RAINBOW
                  ? '3px solid #3a2030'
                  : '2px solid #ffffff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
            }}
          />
        </div>

        {tool === 'stamp' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {STAMPS.map((s) => (
              <button
                key={s}
                onClick={() => setStamp(s)}
                style={{
                  padding: '8px 12px',
                  fontSize: 15,
                  fontWeight: 700,
                  borderRadius: 10,
                  border:
                    stamp === s ? '3px solid #d6336c' : '2px solid #ffffff',
                  background: stamp === s ? '#fff0f5' : '#ffffff',
                  color: '#3a2030',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {tool === 'brush' && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#3a2030',
              fontWeight: 600,
            }}
          >
            Size
            <input
              type="range"
              min={2}
              max={50}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
            />
            <span style={{ minWidth: 24, textAlign: 'right' }}>
              {brushSize}
            </span>
          </label>
        )}

        <button
          onClick={clearAll}
          style={{
            marginLeft: 'auto',
            padding: '12px 18px',
            fontSize: 18,
            fontWeight: 700,
            borderRadius: 14,
            border: '3px solid transparent',
            background: '#fff',
            color: '#3a2030',
            cursor: 'pointer',
            boxShadow: '0 4px 0 #c79bb0',
          }}
        >
          Clear
        </button>
      </div>

      <div
        ref={wrapRef}
        style={{
          flex: 1,
          position: 'relative',
          backgroundImage: PIGLET_BG,
          backgroundRepeat: 'repeat',
          backgroundSize: '110px 110px',
          backgroundColor: '#fff8fa',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          cursor: 'crosshair',
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'block',
            pointerEvents: 'none',
          }}
        />
        {sparkles.map((s) => (
          <span
            key={s.id}
            className="miette-sparkle"
            style={
              {
                left: s.x,
                top: s.y,
                width: s.size,
                height: s.size,
                ['--r' as never]: `${s.rotate}deg`,
                ['--dx' as never]: `${s.drift}px`,
              } as React.CSSProperties
            }
          >
            <svg viewBox="-10 -10 20 20" width="100%" height="100%">
              <polygon
                points="0,-10 2.5,-2.5 10,0 2.5,2.5 0,10 -2.5,2.5 -10,0 -2.5,-2.5"
                fill={s.color}
                stroke="#ffffffaa"
                strokeWidth="0.6"
              />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}
