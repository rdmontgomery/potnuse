import { useEffect, useRef, useState } from 'react';

type Tool = 'brush' | 'stamp' | 'sparkle';
type Stamp = 'heart' | 'star' | 'circle' | 'square';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
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
  "<g transform='translate(0,0)'>" +
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
  "</g></svg>";

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

function drawSparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const r = i % 2 === 0 ? size : size / 3;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function randomColor() {
  return COLORS[Math.floor(Math.random() * (COLORS.length - 1))];
}

export default function PigletDraw() {
  const drawRef = useRef<HTMLCanvasElement>(null);
  const sparkleRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState<string>(COLORS[0]);
  const [stamp, setStamp] = useState<Stamp>('heart');
  const [brushSize, setBrushSize] = useState<number>(10);

  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const particlesRef = useRef<Particle[]>([]);
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
    const resize = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      [drawRef, sparkleRef].forEach((ref) => {
        const c = ref.current;
        if (!c) return;
        const prev = document.createElement('canvas');
        prev.width = c.width;
        prev.height = c.height;
        const pctx = prev.getContext('2d');
        if (pctx && c.width > 0) pctx.drawImage(c, 0, 0);

        c.width = Math.floor(rect.width * dpr);
        c.height = Math.floor(rect.height * dpr);
        c.style.width = rect.width + 'px';
        c.style.height = rect.height + 'px';
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          if (prev.width > 0 && ref === drawRef) {
            ctx.drawImage(prev, 0, 0, rect.width, rect.height);
          }
        }
      });
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const c = sparkleRef.current;
      if (c) {
        const ctx = c.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          ctx.clearRect(0, 0, c.width / dpr, c.height / dpr);
          const alive: Particle[] = [];
          for (const p of particlesRef.current) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.08;
            p.life -= 0.018;
            if (p.life > 0) {
              ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
              ctx.fillStyle = p.color;
              drawSparkle(ctx, p.x, p.y, p.size * Math.max(0.3, p.life));
              alive.push(p);
            }
          }
          ctx.globalAlpha = 1;
          particlesRef.current = alive;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const emitSparkles = (x: number, y: number) => {
    const count = 6;
    const useRainbow = colorRef.current === RAINBOW;
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3 - 1,
        life: 0.9 + Math.random() * 0.4,
        size: 6 + Math.random() * 7,
        color: useRainbow ? randomColor() : colorRef.current,
      });
    }
  };

  const getPos = (e: React.PointerEvent) => {
    const c = drawRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    const pos = getPos(e);
    const t = toolRef.current;
    if (t === 'brush') {
      lastPosRef.current = pos;
      const ctx = drawRef.current!.getContext('2d')!;
      const c =
        colorRef.current === RAINBOW ? randomColor() : colorRef.current;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, brushSizeRef.current / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (t === 'stamp') {
      const ctx = drawRef.current!.getContext('2d')!;
      const c =
        colorRef.current === RAINBOW ? randomColor() : colorRef.current;
      drawStamp(ctx, stampRef.current, pos.x, pos.y, 32, c);
    } else if (t === 'sparkle') {
      emitSparkles(pos.x, pos.y);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const pos = getPos(e);
    const t = toolRef.current;
    if (t === 'brush' && lastPosRef.current) {
      const ctx = drawRef.current!.getContext('2d')!;
      const c =
        colorRef.current === RAINBOW ? randomColor() : colorRef.current;
      ctx.strokeStyle = c;
      ctx.lineWidth = brushSizeRef.current;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPosRef.current = pos;
    } else if (t === 'sparkle') {
      emitSparkles(pos.x, pos.y);
    }
  };

  const onPointerUp = () => {
    drawingRef.current = false;
    lastPosRef.current = null;
  };

  const clearAll = () => {
    const c = drawRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, c.width / dpr, c.height / dpr);
    particlesRef.current = [];
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
          boxShadow: active
            ? '0 4px 0 #d6336c'
            : '0 4px 0 #c79bb0',
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
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          padding: '10px 14px',
          background:
            'linear-gradient(180deg, #ffd8e4 0%, #ffc1d4 100%)',
          borderBottom: '3px solid #f48ba0',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          {toolBtn('brush', 'Paintbrush')}
          {toolBtn('stamp', 'Stamps')}
          {toolBtn('sparkle', 'Sparkles')}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`color ${c}`}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: c,
                border:
                  color === c
                    ? '4px solid #3a2030'
                    : '2px solid #ffffff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
          <button
            onClick={() => setColor(RAINBOW)}
            aria-label="rainbow"
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background:
                'conic-gradient(#e91e63,#ff9800,#ffeb3b,#8bc34a,#00bcd4,#3f51b5,#9c27b0,#e91e63)',
              border:
                color === RAINBOW
                  ? '4px solid #3a2030'
                  : '2px solid #ffffff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              cursor: 'pointer',
              padding: 0,
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
                    stamp === s
                      ? '3px solid #d6336c'
                      : '2px solid #ffffff',
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
              max={40}
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
        }}
      >
        <canvas
          ref={drawRef}
          style={{
            position: 'absolute',
            inset: 0,
            touchAction: 'none',
          }}
        />
        <canvas
          ref={sparkleRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{
            position: 'absolute',
            inset: 0,
            touchAction: 'none',
            cursor: 'crosshair',
          }}
        />
      </div>
    </div>
  );
}
