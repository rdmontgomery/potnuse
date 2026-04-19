import { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { DOMAIN_CONFIG, type DomainKey } from './domains';
import { EDGE_STYLES, type EdgeType } from './edges';
import { DEFAULT_NODES, DEFAULT_EDGES, type Node, type Edge } from './data';

const STORAGE_KEY = 'necromantic-circle';

const PALETTE = {
  bg: '#1a1207',
  bgCard: '#261d0f',
  bgInput: '#1f1608',
  border: '#3d2e1a',
  accent: '#e8a838',
  accentDim: '#b87a1e',
  text: '#f0e6d2',
  textDim: '#9e8e72',
  textMuted: '#6b5d48',
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
};

export default function Graph() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<d3.Simulation<any, any> | null>(null);
  const [nodes, setNodes] = useState<Node[]>(DEFAULT_NODES);
  const [edges, setEdges] = useState<Edge[]>(DEFAULT_EDGES);
  const [selected, setSelected] = useState<Node | null>(null);
  const [hovered, setHovered] = useState<Node | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [newNode, setNewNode] = useState<{ name: string; domain: DomainKey; notes: string }>({
    name: '',
    domain: 'philosophy',
    notes: '',
  });
  const [newEdge, setNewEdge] = useState<{ source: string; target: string; type: EdgeType }>({
    source: '',
    target: '',
    type: 'bridges',
  });
  const [showEdgePanel, setShowEdgePanel] = useState(false);
  const [filterDomain, setFilterDomain] = useState<DomainKey | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.nodes?.length) setNodes(data.nodes);
        if (data.edges?.length) setEdges(data.edges);
      }
    } catch {
      /* defaults */
    }
    setLoaded(true);
  }, []);

  const saveData = useCallback((n: Node[], e: Edge[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes: n, edges: e }));
    } catch (err) {
      console.error('Storage:', err);
    }
  }, []);

  useEffect(() => {
    if (!loaded || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const width = svgRef.current.clientWidth || 900;
    const height = svgRef.current.clientHeight || 700;
    const g = svg.append('g');
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 5])
      .on('zoom', (e) => g.attr('transform', e.transform.toString()));
    svg.call(zoom as any);
    svg.call(zoom.transform as any, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8));

    const simNodes: any[] = nodes.map((d) => ({ ...d }));
    const simEdges: any[] = edges
      .filter(
        (e) =>
          simNodes.find((n) => n.id === e.source) && simNodes.find((n) => n.id === e.target),
      )
      .map((d) => ({ ...d }));
    const hullG = g.append('g');
    const linkG = g.append('g');
    const nodeG = g.append('g');

    const link = linkG
      .selectAll('line')
      .data(simEdges)
      .join('line')
      .attr('stroke', (d: any) => EDGE_STYLES[d.type as EdgeType]?.stroke || PALETTE.textDim)
      .attr('stroke-width', (d: any) => EDGE_STYLES[d.type as EdgeType]?.width || 1)
      .attr('stroke-dasharray', (d: any) => {
        const s = EDGE_STYLES[d.type as EdgeType];
        return s?.dash === 'none' ? null : s?.dash ?? null;
      })
      .attr('opacity', 0.35);

    const node = nodeG
      .selectAll('g')
      .data(simNodes)
      .join('g')
      .attr('cursor', 'grab')
      .call(
        d3
          .drag<SVGGElement, any>()
          .on('start', (ev, d) => {
            if (!ev.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (ev, d) => {
            d.fx = ev.x;
            d.fy = ev.y;
          })
          .on('end', (ev, d) => {
            if (!ev.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as any,
      );

    node
      .append('circle')
      .attr('r', 7)
      .attr('fill', (d: any) => DOMAIN_CONFIG[d.domain as DomainKey]?.color || PALETTE.textDim)
      .attr('stroke', PALETTE.bg)
      .attr('stroke-width', 1.5)
      .attr('opacity', (d: any) => (filterDomain && d.domain !== filterDomain ? 0.12 : 0.9));

    node
      .append('text')
      .text((d: any) => d.name)
      .attr('dx', 11)
      .attr('dy', 4)
      .attr('fill', (d: any) =>
        filterDomain && d.domain !== filterDomain ? PALETTE.textMuted : PALETTE.text,
      )
      .attr('font-size', '10.5px')
      .attr('font-family', PALETTE.mono)
      .attr('font-weight', 500);

    node.on('click', (ev, d: any) => {
      ev.stopPropagation();
      setSelected((prev) => (prev?.id === d.id ? null : (d as Node)));
    });

    node.on('mouseenter', (_ev, d: any) => {
      setHovered(d as Node);
      const conn = new Set<string>([d.id]);
      simEdges.forEach((e) => {
        const s = typeof e.source === 'object' ? e.source.id : e.source;
        const t = typeof e.target === 'object' ? e.target.id : e.target;
        if (s === d.id) conn.add(t);
        if (t === d.id) conn.add(s);
      });
      node.select('circle').attr('opacity', (n: any) => (conn.has(n.id) ? 1 : 0.08));
      node.select('text').attr('opacity', (n: any) => (conn.has(n.id) ? 1 : 0.1));
      link
        .attr('opacity', (e: any) => {
          const s = typeof e.source === 'object' ? e.source.id : e.source;
          const t = typeof e.target === 'object' ? e.target.id : e.target;
          return s === d.id || t === d.id ? 0.85 : 0.03;
        })
        .attr('stroke-width', (e: any) => {
          const s = typeof e.source === 'object' ? e.source.id : e.source;
          const t = typeof e.target === 'object' ? e.target.id : e.target;
          const base = EDGE_STYLES[e.type as EdgeType]?.width || 1;
          return s === d.id || t === d.id ? base * 2 : base;
        });
    });

    node.on('mouseleave', () => {
      setHovered(null);
      node
        .select('circle')
        .attr('opacity', (d: any) => (filterDomain && d.domain !== filterDomain ? 0.12 : 0.9));
      node
        .select('text')
        .attr('opacity', 1)
        .attr('fill', (d: any) =>
          filterDomain && d.domain !== filterDomain ? PALETTE.textMuted : PALETTE.text,
        );
      link
        .attr('opacity', 0.35)
        .attr('stroke-width', (d: any) => EDGE_STYLES[d.type as EdgeType]?.width || 1);
    });

    svg.on('click', () => setSelected(null));

    const sim = d3
      .forceSimulation(simNodes)
      .force(
        'link',
        d3
          .forceLink(simEdges)
          .id((d: any) => d.id)
          .distance(85)
          .strength(0.35),
      )
      .force('charge', d3.forceManyBody().strength(-160))
      .force('collision', d3.forceCollide().radius(22))
      .force(
        'x',
        d3.forceX((d: any) => DOMAIN_CONFIG[d.domain as DomainKey]?.gx || 0).strength(0.07),
      )
      .force(
        'y',
        d3.forceY((d: any) => DOMAIN_CONFIG[d.domain as DomainKey]?.gy || 0).strength(0.07),
      );

    sim.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
      hullG.selectAll('path').remove();
      [...new Set(simNodes.map((n) => n.domain))].forEach((domain) => {
        const pts = simNodes
          .filter((n) => n.domain === domain)
          .map((n) => [n.x, n.y] as [number, number]);
        if (pts.length >= 3) {
          const hull = d3.polygonHull(pts);
          if (hull) {
            const cx = d3.mean(hull, (p) => p[0]) || 0;
            const cy = d3.mean(hull, (p) => p[1]) || 0;
            const padded = hull.map(([x, y]) => {
              const dx = x - cx;
              const dy = y - cy;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              return [cx + (dx * (dist + 45)) / dist, cy + (dy * (dist + 45)) / dist] as [
                number,
                number,
              ];
            });
            hullG
              .append('path')
              .attr('d', `M${padded.join('L')}Z`)
              .attr('fill', DOMAIN_CONFIG[domain as DomainKey]?.color || PALETTE.textDim)
              .attr('opacity', filterDomain === domain ? 0.12 : 0.035)
              .attr('stroke', DOMAIN_CONFIG[domain as DomainKey]?.color || PALETTE.textDim)
              .attr('stroke-opacity', 0.12)
              .attr('stroke-width', 1);
          }
        }
      });
    });
    simRef.current = sim;
    return () => {
      sim.stop();
    };
  }, [nodes, edges, loaded, filterDomain]);

  const addNode = () => {
    if (!newNode.name.trim()) return;
    const id = newNode.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (nodes.find((n) => n.id === id)) return;
    const updated = [...nodes, { id, ...newNode }];
    setNodes(updated);
    saveData(updated, edges);
    setNewNode({ name: '', domain: 'philosophy', notes: '' });
    setShowPanel(false);
  };

  const addEdge = () => {
    if (!newEdge.source || !newEdge.target || newEdge.source === newEdge.target) return;
    if (edges.find((e) => e.source === newEdge.source && e.target === newEdge.target)) return;
    const updated = [...edges, { ...newEdge }];
    setEdges(updated);
    saveData(nodes, updated);
    setNewEdge({ source: '', target: '', type: 'bridges' });
    setShowEdgePanel(false);
  };

  const removeNode = (id: string) => {
    const un = nodes.filter((n) => n.id !== id);
    const ue = edges.filter((e) => e.source !== id && e.target !== id);
    setNodes(un);
    setEdges(ue);
    setSelected(null);
    saveData(un, ue);
  };

  const resetData = () => {
    setNodes(DEFAULT_NODES);
    setEdges(DEFAULT_EDGES);
    setSelected(null);
    saveData(DEFAULT_NODES, DEFAULT_EDGES);
  };

  const getConnections = (nid: string) =>
    edges
      .filter((e) => e.source === nid || e.target === nid)
      .map((e) => ({
        ...e,
        other: nodes.find((n) => n.id === (e.source === nid ? e.target : e.source)),
      }))
      .filter((e) => e.other);

  const inp: React.CSSProperties = {
    background: PALETTE.bgInput,
    border: `1px solid ${PALETTE.border}`,
    color: PALETTE.text,
    padding: '5px 8px',
    borderRadius: '3px',
    fontSize: '11px',
    fontFamily: PALETTE.mono,
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
  };
  const sel: React.CSSProperties = { ...inp, appearance: 'none', cursor: 'pointer' };
  const btn: React.CSSProperties = {
    background: PALETTE.accent,
    color: PALETTE.bg,
    border: 'none',
    padding: '5px 12px',
    borderRadius: '3px',
    fontSize: '11px',
    fontFamily: PALETTE.mono,
    cursor: 'pointer',
    fontWeight: 600,
  };
  const btn2: React.CSSProperties = { ...btn, background: PALETTE.bgCard, color: PALETTE.textDim };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: PALETTE.bg,
        fontFamily: PALETTE.mono,
        color: PALETTE.text,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '10px 14px',
          background: `linear-gradient(180deg, ${PALETTE.bg}f7, ${PALETTE.bg}00)`,
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '1px',
              color: PALETTE.accent,
            }}
          >
            THE NECROMANTIC CIRCLE
          </div>
          <div style={{ fontSize: '9px', color: PALETTE.textMuted, marginTop: 2 }}>
            {nodes.length} muses · {edges.length} connections · hover → trace · click → inspect ·
            drag → rearrange
          </div>
        </div>
        <div style={{ display: 'flex', gap: '5px', pointerEvents: 'auto' }}>
          <button
            onClick={() => {
              setShowPanel(!showPanel);
              setShowEdgePanel(false);
            }}
            style={btn}
          >
            + summon
          </button>
          <button
            onClick={() => {
              setShowEdgePanel(!showEdgePanel);
              setShowPanel(false);
            }}
            style={btn2}
          >
            + connect
          </button>
          <button onClick={resetData} style={{ ...btn2, fontSize: '9px' }}>
            reset
          </button>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          display: 'flex',
          gap: '3px',
          flexWrap: 'wrap',
          zIndex: 10,
          maxWidth: '55%',
        }}
      >
        <button
          onClick={() => setFilterDomain(null)}
          style={{
            ...btn2,
            fontSize: '8px',
            padding: '2px 7px',
            background: !filterDomain ? PALETTE.border : PALETTE.bgCard,
          }}
        >
          ALL
        </button>
        {(Object.entries(DOMAIN_CONFIG) as Array<[DomainKey, (typeof DOMAIN_CONFIG)[DomainKey]]>).map(
          ([k, v]) => (
            <button
              key={k}
              onClick={() => setFilterDomain(filterDomain === k ? null : k)}
              style={{
                ...btn2,
                fontSize: '8px',
                padding: '2px 7px',
                color: v.color,
                border: `1px solid ${filterDomain === k ? v.color : PALETTE.border}`,
                background: filterDomain === k ? v.color + '18' : PALETTE.bgCard,
              }}
            >
              {v.label}
            </button>
          ),
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 10,
          right: 10,
          display: 'flex',
          gap: '7px',
          zIndex: 10,
          fontSize: '8px',
          color: PALETTE.textMuted,
        }}
      >
        {(Object.entries(EDGE_STYLES) as Array<[EdgeType, (typeof EDGE_STYLES)[EdgeType]]>).map(
          ([k, v]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <svg width="14" height="3">
                <line
                  x1="0"
                  y1="1.5"
                  x2="14"
                  y2="1.5"
                  stroke={v.stroke}
                  strokeWidth={v.width}
                  strokeDasharray={v.dash === 'none' ? '' : v.dash}
                />
              </svg>
              {k}
            </span>
          ),
        )}
      </div>

      {showPanel && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            right: 10,
            background: PALETTE.bgCard,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: '5px',
            padding: '12px',
            width: '220px',
            zIndex: 20,
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 600,
              marginBottom: 8,
              color: PALETTE.accent,
              letterSpacing: '0.5px',
            }}
          >
            SUMMON
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              placeholder="Name"
              value={newNode.name}
              onChange={(e) => setNewNode({ ...newNode, name: e.target.value })}
              style={inp}
            />
            <select
              value={newNode.domain}
              onChange={(e) => setNewNode({ ...newNode, domain: e.target.value as DomainKey })}
              style={sel}
            >
              {(Object.entries(DOMAIN_CONFIG) as Array<[DomainKey, (typeof DOMAIN_CONFIG)[DomainKey]]>).map(
                ([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ),
              )}
            </select>
            <input
              placeholder="Notes"
              value={newNode.notes}
              onChange={(e) => setNewNode({ ...newNode, notes: e.target.value })}
              style={inp}
            />
            <button onClick={addNode} style={btn}>
              Add to circle
            </button>
          </div>
        </div>
      )}

      {showEdgePanel && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            right: 10,
            background: PALETTE.bgCard,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: '5px',
            padding: '12px',
            width: '220px',
            zIndex: 20,
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 600,
              marginBottom: 8,
              color: PALETTE.accent,
              letterSpacing: '0.5px',
            }}
          >
            CONNECT
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <select
              value={newEdge.source}
              onChange={(e) => setNewEdge({ ...newEdge, source: e.target.value })}
              style={sel}
            >
              <option value="">From...</option>
              {[...nodes]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
            </select>
            <select
              value={newEdge.target}
              onChange={(e) => setNewEdge({ ...newEdge, target: e.target.value })}
              style={sel}
            >
              <option value="">To...</option>
              {[...nodes]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
            </select>
            <select
              value={newEdge.type}
              onChange={(e) => setNewEdge({ ...newEdge, type: e.target.value as EdgeType })}
              style={sel}
            >
              {Object.keys(EDGE_STYLES).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <button onClick={addEdge} style={btn}>
              Connect
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            left: 10,
            background: PALETTE.bgCard,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: '5px',
            padding: '12px',
            width: '240px',
            zIndex: 20,
            maxHeight: '55vh',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: DOMAIN_CONFIG[selected.domain]?.color,
                }}
              />
              <span style={{ fontSize: '13px', fontWeight: 700 }}>{selected.name}</span>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{ ...btn2, fontSize: '9px', padding: '1px 5px' }}
            >
              ×
            </button>
          </div>
          <div
            style={{
              fontSize: '8px',
              color: DOMAIN_CONFIG[selected.domain]?.color,
              marginTop: 3,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {DOMAIN_CONFIG[selected.domain]?.label}
          </div>
          <div style={{ fontSize: '10.5px', color: PALETTE.textDim, marginTop: 6, lineHeight: 1.5 }}>
            {selected.notes}
          </div>
          {getConnections(selected.id).length > 0 && (
            <div
              style={{
                marginTop: 10,
                borderTop: `1px solid ${PALETTE.border}`,
                paddingTop: 6,
              }}
            >
              <div
                style={{
                  fontSize: '8px',
                  color: PALETTE.textMuted,
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Connections
              </div>
              {getConnections(selected.id).map((c, i) => (
                <div
                  key={i}
                  onClick={() => c.other && setSelected(c.other)}
                  style={{
                    fontSize: '9.5px',
                    color: PALETTE.textDim,
                    padding: '2px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: c.other ? DOMAIN_CONFIG[c.other.domain]?.color : PALETTE.textDim,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ color: PALETTE.text }}>{c.other?.name}</span>
                  <span style={{ color: EDGE_STYLES[c.type]?.stroke, fontSize: '8px' }}>
                    ({c.type})
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => removeNode(selected.id)}
            style={{
              ...btn2,
              marginTop: 8,
              fontSize: '8px',
              color: PALETTE.accent,
              width: '100%',
              borderColor: PALETTE.accentDim,
            }}
          >
            banish
          </button>
        </div>
      )}

      {hovered && !selected && (
        <div
          style={{
            position: 'absolute',
            bottom: 36,
            left: '50%',
            transform: 'translateX(-50%)',
            background: PALETTE.bgCard,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: '3px',
            padding: '4px 10px',
            zIndex: 15,
            fontSize: '10px',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: DOMAIN_CONFIG[hovered.domain]?.color,
            }}
          />
          <span style={{ fontWeight: 600 }}>{hovered.name}</span>
          <span style={{ color: PALETTE.textMuted, fontSize: '9px' }}>{hovered.notes}</span>
        </div>
      )}

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ position: 'absolute', top: 0, left: 0 }}
      />
    </div>
  );
}
