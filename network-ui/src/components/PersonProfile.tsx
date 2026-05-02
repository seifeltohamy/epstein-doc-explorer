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

const NODE_BIOS: Record<string, string> = {
  "Jeffrey Epstein": "American financier and convicted sex offender. At the center of an international trafficking network involving dozens of wealthy and powerful figures. Arrested in July 2019 and died in federal custody in August 2019.",
  "Donald Trump": "American businessman and 45th/47th U.S. President. Knew Epstein socially for years in New York and Palm Beach circles. Mentioned in flight logs and witness depositions.",
  "Ehud Barak": "Former Israeli Prime Minister and Defense Minister. Invested in Epstein-linked tech ventures and visited Epstein's properties multiple times after his 2008 conviction.",
  "Edward Snowden": "NSA whistleblower and former intelligence contractor who leaked classified surveillance documents in 2013. Appears in the Epstein corpus in the context of surveillance and intelligence discussions.",
  "Alan M. Dershowitz": "Harvard Law professor and high-profile defense attorney who represented Epstein during the 2008 plea deal negotiations. Subject of abuse allegations by Virginia Roberts Giuffre, which he has denied.",
  "Steve Bannon": "Political strategist and former White House Chief Strategist to Donald Trump. Referenced in Epstein documents in the context of political networks and influence.",
  "Bill Clinton": "42nd U.S. President. Flew on Epstein's private jet multiple times according to flight logs. Clinton denies visiting Epstein's private island.",
  "Jeffrey E.": "Abbreviated reference to Jeffrey Epstein appearing across multiple documents and correspondence.",
  "Ghislaine Maxwell": "British socialite and Epstein's longtime associate and alleged co-conspirator. Convicted in 2021 on federal sex trafficking charges and sentenced to 20 years in prison.",
  "Kathy Ruemmler": "Former White House Counsel under President Obama. Represented Epstein in post-conviction legal matters and attended meetings on his behalf.",
  "Michael Wolff": "Journalist and author known for 'Fire and Fury.' Mentioned in Epstein's contact network and correspondence files.",
  "Virginia Roberts Giuffre": "Epstein trafficking survivor and activist. Filed civil suits alleging she was trafficked to powerful figures including Prince Andrew and Alan Dershowitz. Her legal filings are central to the public record.",
  "Reid Weingarten": "High-profile Washington defense attorney who represented Epstein during federal investigations.",
  "Lawrence M. Krauss": "Theoretical physicist and science communicator. Received funding from Epstein and maintained a relationship with him after his 2008 conviction, drawing significant criticism.",
  "Paul Krassner": "American satirist, journalist, and counterculture figure. Appears in Epstein's correspondence and social network.",
  "Landon Thomas Jr.": "New York Times financial journalist who wrote extensively about Epstein, including early profiles before the full scope of his crimes was known.",
  "Barack Obama": "44th U.S. President. Referenced in Epstein documents primarily in the context of political figures connected to Epstein's social network and fundraising circles.",
  "United States": "The U.S. federal government as a party in criminal and civil proceedings against Epstein and associates, including the Department of Justice prosecution.",
  "court": "References to court proceedings, judicial filings, and legal proceedings across the Epstein civil and criminal cases.",
  "Lawrence Summers": "Former U.S. Treasury Secretary and Harvard president. Received a donation from Epstein to Harvard and was connected through academic and financial networks.",
  "Palm Beach Police Department": "Local law enforcement agency that first investigated Epstein for sexual abuse of minors in 2005, leading to the controversial 2008 non-prosecution agreement.",
  "Bank of America Merrill Lynch": "Financial institution referenced in Epstein financial records and asset management documents.",
  "the author": "Narrative reference to a first-person narrator in documents and memoirs within the Epstein corpus.",
  "Bradley James Edwards": "Florida attorney who represented multiple Epstein victims in civil suits and was a key figure in challenging the secret non-prosecution agreement.",
  "Prince Andrew, Duke of York": "British royal and son of Queen Elizabeth II. Accused by Virginia Roberts Giuffre of sexual abuse. Reached a civil settlement with Giuffre in 2022 and was stripped of royal patronages and military titles.",
  "narrator": "First-person narrative voice appearing in documents and testimonies within the corpus.",
  "Robert Lawrence Kuhn": "American businessman, author, and China expert. Appears in Epstein's intellectual and social network correspondence.",
  "FBI": "The U.S. Federal Bureau of Investigation, which investigated Epstein in multiple jurisdictions and was involved in his 2019 arrest.",
  "Iran": "Referenced in the Epstein corpus in the context of geopolitical discussions and intelligence-related documents.",
  "Richard Kahn": "Associate referenced in Epstein financial and operational documents.",
  "Peggy Siegal": "New York film publicist and socialite who organized events where Epstein met high-profile individuals, including a dinner held for Epstein shortly after his 2008 release from prison.",
  "Israel": "Referenced throughout the corpus in the context of Epstein's relationships with Israeli political figures, intelligence discussions, and financial dealings.",
  "communication": "Generic reference to communications and correspondence appearing across documents in the corpus.",
  "Boris Nikolic": "Biotech entrepreneur and former science advisor to Bill Gates. Named as an alternate executor in Epstein's will, which was filed the day before his death.",
  "Hillary Rodham Clinton": "Former U.S. Secretary of State and 2016 presidential candidate. Referenced in Epstein documents through political network connections.",
  "Benjamin Netanyahu": "Israeli Prime Minister. Connected through Epstein's relationships with Israeli political leadership, particularly via Ehud Barak.",
  "Mr. Leopold": "Individual referenced in Epstein legal and correspondence documents.",
  "research report": "References to academic and financial research reports circulated within Epstein's network.",
  "Federal prosecutors": "U.S. federal prosecution teams handling Epstein criminal cases, primarily in the Southern District of New York.",
  "Nicholas Ribis": "American businessman and casino executive. Appears in Epstein's financial and social network documents.",
  "jeevacation@gmail.com": "Email address appearing in Epstein communications and contact records.",
  "Darren K. Indyke": "New York attorney who served as one of Epstein's primary lawyers and was a co-executor of his estate.",
  "Yitzhak Rabin": "Former Israeli Prime Minister and Nobel Peace Prize laureate. Referenced in Epstein's historical and political network documents.",
  "Martin G. Weinberg": "Boston-based defense attorney who represented Epstein during federal legal proceedings.",
  "Jared Kushner": "Real estate developer and son-in-law of Donald Trump. Referenced in Epstein documents through overlapping New York social and financial networks.",
  "Glenn Greenwald": "Journalist and co-founder of The Intercept. Referenced in Epstein documents in the context of surveillance and intelligence journalism.",
  "Mr. Tein": "Individual referenced in Epstein legal proceedings and correspondence.",
  "Elisa New": "Harvard professor and poet. Appears in correspondence related to Epstein's Harvard connections and academic network.",
  "Melanie Spinella": "Individual appearing in Epstein operational and correspondence documents.",
  "China": "Referenced in the Epstein corpus in the context of international business dealings and geopolitical discussions.",
};

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

      {/* Bio */}
      <p className="text-slate-400 text-sm mb-8 leading-relaxed">
        {NODE_BIOS[node.name] ?? `Appears in ${node.document_mentions.toLocaleString()} documents in the Epstein corpus.`}
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
