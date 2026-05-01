import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { snaApi } from '../sna-api';
import type { SnaNode, SnaTimelinePoint } from '../sna-api';
import { fetchActorTimeline } from '../api';

interface PersonProfileProps {
  nodeId: string;
  onBack: () => void;
  onPersonClick: (id: string, name: string) => void;
  onCommunityClick: (id: number) => void;
  onMentionsClick: (actorName: string) => void;
}

interface TimelinePoint { year: number; value: number; }

const AreaChart: React.FC<{ data: TimelinePoint[]; label: string }> = ({ data, label }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;
    const W = svgRef.current.clientWidth || 600;
    const H = 200;
    const margin = { top: 10, right: 20, bottom: 30, left: 50 };
    const w = W - margin.left - margin.right;
    const h = H - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', W).attr('height', H);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain([d3.min(data, d => d.year) ?? 1990, d3.max(data, d => d.year) ?? 2020])
      .range([0, w]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) ?? 1])
      .nice()
      .range([h, 0]);

    // Grid lines
    g.append('g')
      .call(d3.axisLeft(y).tickSize(-w).tickFormat(() => ''))
      .selectAll('line').attr('stroke', '#1e293b').attr('stroke-dasharray', '2,4');
    g.select('.domain').remove();

    // Area fill
    const area = d3.area<TimelinePoint>()
      .x(d => x(d.year))
      .y0(h)
      .y1(d => y(d.value))
      .curve(d3.curveBasis);

    g.append('path')
      .datum(data)
      .attr('fill', '#3b82f6')
      .attr('fill-opacity', 0.25)
      .attr('d', area);

    // Line on top
    const line = d3.line<TimelinePoint>()
      .x(d => x(d.year))
      .y(d => y(d.value))
      .curve(d3.curveBasis);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('d', line);

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d => String(d)))
      .selectAll('text').attr('fill', '#64748b').attr('font-size', '11px');
    g.select('.domain').attr('stroke', '#1e293b');
    g.selectAll('.tick line').attr('stroke', '#1e293b');

    // Y axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickFormat(d => {
        const n = Number(d);
        return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);
      }))
      .selectAll('text').attr('fill', '#64748b').attr('font-size', '11px');
  }, [data]);

  if (data.length === 0) {
    return <p className="text-slate-600 text-sm italic py-4">No timeline data available.</p>;
  }

  return (
    <div>
      <p className="text-slate-500 text-xs mb-2">
        {data.reduce((s, d) => s + d.value, 0).toLocaleString()} {label} from {data[0]?.year} to {data[data.length - 1]?.year}
      </p>
      <svg ref={svgRef} className="w-full" style={{ height: 200 }} />
    </div>
  );
};

const PersonProfile: React.FC<PersonProfileProps> = ({ nodeId, onBack, onPersonClick, onCommunityClick, onMentionsClick }) => {
  const [node, setNode]         = useState<SnaNode | null>(null);
  const [docTimeline, setDocTimeline] = useState<TimelinePoint[]>([]);
  const [prTimeline, setPrTimeline]   = useState<SnaTimelinePoint[]>([]);
  const [timelineMode, setTimelineMode] = useState<'documents' | 'pagerank'>('documents');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    setNode(null);
    setDocTimeline([]);
    setPrTimeline([]);

    snaApi.node(nodeId).then(async n => {
      setNode(n);
      // Fetch document timeline from port 3001 using actor name
      const [docTl, prTl] = await Promise.all([
        fetchActorTimeline(n.name).catch(() => []),
        snaApi.timeline(nodeId).catch(() => []),
      ]);
      setDocTimeline(docTl.map(d => ({ year: d.year, value: d.count })));
      setPrTimeline(prTl);
    }).finally(() => setLoading(false));
  }, [nodeId]);

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ background: '#0a0e1a' }}>
      <div className="text-slate-400 text-sm">Loading profile...</div>
    </div>
  );
  if (!node) return (
    <div className="flex items-center justify-center h-full" style={{ background: '#0a0e1a' }}>
      <div className="text-red-400 text-sm">Node not found.</div>
    </div>
  );

  const prTimelinePoints: TimelinePoint[] = prTimeline.map(p => ({ year: p.year, value: p.pagerank }));
  const activeTimeline = timelineMode === 'documents' ? docTimeline : prTimelinePoints;
  const activeLabel    = timelineMode === 'documents' ? 'relationships with timestamps' : 'yearly PageRank snapshots';

  return (
    <div className="h-full px-6 py-8 overflow-y-auto max-w-3xl mx-auto" style={{ background: '#0a0e1a' }}>

      {/* Back */}
      <button
        onClick={onBack}
        className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-1 transition-colors"
      >
        ← Back
      </button>

      {/* Name */}
      <h1 className="text-4xl font-bold text-white mb-4">{node.name}</h1>

      {/* Stats chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => onMentionsClick(node.name)}
          className="px-3 py-1 rounded text-sm font-mono transition-colors hover:opacity-80"
          style={{ background: '#1e293b', color: '#5eead4', cursor: 'pointer', border: '1px solid #134e4a' }}
          title="View in Graph Explorer"
        >
          {node.document_mentions.toLocaleString()} mentions ↗
        </button>
        <span className="px-3 py-1 rounded text-sm font-mono"
              style={{ background: '#1e293b', color: '#94a3b8' }}>
          {node.connections.length} connections
        </span>
        <button
          onClick={() => onCommunityClick(node.community_id)}
          className="px-3 py-1 rounded text-sm font-medium transition-colors hover:opacity-80"
          style={{ background: node.community_color + '22', color: node.community_color, border: `1px solid ${node.community_color}55` }}
        >
          {node.community_label}
        </button>
        <span className="px-3 py-1 rounded text-sm font-mono"
              style={{ background: '#1e293b', color: '#94a3b8' }}>
          PR {node.pagerank.toExponential(2)}
        </span>
        <span className="px-3 py-1 rounded text-sm font-mono"
              style={{ background: '#1e293b', color: '#94a3b8' }}>
          Btw {node.betweenness.toExponential(2)}
        </span>
      </div>

      {/* Bio placeholder */}
      <p className="text-slate-400 text-sm mb-8 leading-relaxed">
        Known associate in the Epstein connection network, identified through document analysis of
        court records, emails, and flight logs.
      </p>

      {/* Top Connections */}
      <section className="mb-8">
        <h2 className="text-white font-semibold text-lg mb-3">Top Connections</h2>
        <div className="flex flex-wrap gap-2">
          {node.connections.map(c => (
            <button
              key={c.id}
              onClick={() => onPersonClick(c.id, c.name)}
              className="px-3 py-1.5 rounded-full text-sm transition-colors"
              style={{ border: '1px solid #334155', color: '#cbd5e1', background: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#64748b'; e.currentTarget.style.color = 'white'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#cbd5e1'; }}
            >
              {c.name}
              <span className="ml-1.5 text-slate-500 text-xs">({c.weight.toFixed(3)})</span>
            </button>
          ))}
        </div>
      </section>

      {/* Document Timeline */}
      <section className="rounded-xl p-5" style={{ background: '#111827', border: '1px solid #1e293b' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold text-lg">Document Timeline</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setTimelineMode('documents')}
              className="px-3 py-1 rounded text-xs font-medium transition-colors"
              style={{
                background: timelineMode === 'documents' ? '#2563eb' : '#1e293b',
                color: timelineMode === 'documents' ? 'white' : '#94a3b8',
              }}
            >
              Relationships
            </button>
            <button
              onClick={() => setTimelineMode('pagerank')}
              className="px-3 py-1 rounded text-xs font-medium transition-colors"
              style={{
                background: timelineMode === 'pagerank' ? '#2563eb' : '#1e293b',
                color: timelineMode === 'pagerank' ? 'white' : '#94a3b8',
              }}
            >
              PageRank
            </button>
          </div>
        </div>
        <AreaChart data={activeTimeline} label={activeLabel} />
      </section>
    </div>
  );
};

export default PersonProfile;
