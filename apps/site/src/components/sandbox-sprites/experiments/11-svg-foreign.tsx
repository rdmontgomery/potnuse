import { useEffect, useRef, useState } from 'react';
import {
  Mailbox,
  PROSE_LINES,
  SPRITE_GLYPHS,
  Stage,
  useDelivery,
  useWalkingSprites,
} from '../shared';

const LETTERS = ['cid', 'terra'];

// Single SVG coordinate space: prose lives in <foreignObject>,
// sprites are <text> nodes. Drag uses the SVG's clientX/Y converted
// via getScreenCTM so coords stay accurate at any zoom.

export default function Exp12SvgForeign() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { sprites, setSprites } = useWalkingSprites(stageRef, {
    spritePad: 40,
  });
  const { opened, open, reset, count } = useDelivery(LETTERS);
  const [size, setSize] = useState({ w: 600, h: 280 });

  useEffect(() => {
    function measure() {
      const stage = stageRef.current;
      if (!stage) return;
      setSize({ w: stage.clientWidth, h: stage.clientHeight });
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);

  function svgPoint(ev: React.PointerEvent) {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const inv = ctm.inverse();
    const local = pt.matrixTransform(inv);
    return { x: local.x, y: local.y };
  }

  function onPointerDown(id: number, ev: React.PointerEvent) {
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
    setSprites((s) =>
      s.map((sp) => (sp.id === id ? { ...sp, state: 'held' } : sp)),
    );
    ev.preventDefault();
  }
  function onPointerMove(id: number, ev: React.PointerEvent) {
    const p = svgPoint(ev);
    if (!p) return;
    setSprites((s) =>
      s.map((sp) =>
        sp.id === id && sp.state === 'held'
          ? { ...sp, x: p.x - 30, y: p.y - 12 }
          : sp,
      ),
    );
  }
  function onPointerUp(id: number, ev: React.PointerEvent) {
    const stage = stageRef.current;
    if (!stage) return;
    // Hit-test mailboxes against client coords (mailboxes are in
    // foreignObject so they have real DOM rects).
    const mailboxes = stage.querySelectorAll<HTMLElement>('[data-mailbox-letter-id]');
    for (const mb of mailboxes) {
      const r = mb.getBoundingClientRect();
      if (
        ev.clientX >= r.left &&
        ev.clientX <= r.right &&
        ev.clientY >= r.top &&
        ev.clientY <= r.bottom
      ) {
        open(mb.dataset.mailboxLetterId!);
        setSprites((s) => s.filter((sp) => sp.id !== id));
        return;
      }
    }
    setSprites((s) =>
      s.map((sp) => (sp.id === id ? { ...sp, state: 'walking' } : sp)),
    );
  }

  return (
    <Stage
      index={11}
      title="svg foreignObject"
      blurb="One SVG. Prose in <foreignObject>, sprites as <text>. Coordinates share a space."
      delivered={count}
      onReset={() => {
        reset();
        setSprites([]);
      }}
      stageRef={stageRef}
    >
      <svg
        ref={svgRef}
        className="sbs-svg-stage"
        viewBox={`0 0 ${size.w} ${size.h}`}
        preserveAspectRatio="none"
        style={{ touchAction: 'none' }}
      >
        <foreignObject x={0} y={0} width={size.w} height={size.h}>
          <div className="sbs-prose">
            {PROSE_LINES.map((line, i) => (
              <div key={i}>
                <p>{line}</p>
                {i === 1 && (
                  <div className="sbs-mb-row">
                    <Mailbox letterId="cid" opened={opened.has('cid')} />
                  </div>
                )}
                {i === 3 && (
                  <div className="sbs-mb-row">
                    <Mailbox letterId="terra" opened={opened.has('terra')} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </foreignObject>
        {sprites.map((s) => (
          <g
            key={s.id}
            transform={`translate(${s.x}, ${s.y + 14})`}
            onPointerDown={(e) => onPointerDown(s.id, e)}
            onPointerMove={(e) => onPointerMove(s.id, e)}
            onPointerUp={(e) => onPointerUp(s.id, e)}
            onPointerCancel={(e) => onPointerUp(s.id, e)}
            style={{ cursor: s.state === 'held' ? 'grabbing' : 'grab' }}
          >
            <text
              fontFamily="ui-monospace, JetBrains Mono, monospace"
              fontSize="14"
              fill={`var(--sbs-${s.kind})`}
              opacity={s.state === 'held' ? 1 : 0.86}
            >
              {SPRITE_GLYPHS[s.kind]}
            </text>
          </g>
        ))}
      </svg>
    </Stage>
  );
}
