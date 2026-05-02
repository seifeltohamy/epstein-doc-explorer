import React, { useEffect, useRef, useState } from 'react';
import { snaApi } from '../sna-api';
import type { SnaStats, SnaCentralityItem } from '../sna-api';
import { fetchStats } from '../api';
import type { Stats } from '../types';

interface LandingPageProps {
  onPersonClick: (id: string) => void;
  onExplorerClick: () => void;
  onDocTypeClick: (keyword: string) => void;
  onSeeAllClick: () => void;
}

const DOC_CHIPS = [
  'Flight Logs', 'Emails', 'Legal Filings', 'Financial Records', 'Reports', 'Other',
];

const DOC_KEYWORDS: Record<string, string> = {
  'Flight Logs':        'flight',
  'Emails':             'email',
  'Legal Filings':      'legal',
  'Financial Records':  'financial',
  'Reports':            'report',
  'Other':              '',
};

const LandingPage: React.FC<LandingPageProps> = ({ onPersonClick, onExplorerClick, onDocTypeClick, onSeeAllClick }) => {
  const [snaStats, setSnaStats]     = useState<SnaStats | null>(null);
  const [docStats, setDocStats]     = useState<Stats | null>(null);
  const [topFigures, setTopFigures] = useState<SnaCentralityItem[]>([]);
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<{ id: string; name: string; color: string }[]>([]);
  const [showDrop, setShowDrop]     = useState(false);
  const searchRef                   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      snaApi.stats(),
      fetchStats(),
      snaApi.centrality('pagerank', 15),
    ]).then(([s, d, t]) => {
      setSnaStats(s);
      setDocStats(d);
      setTopFigures(t);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setShowDrop(false); return; }
    const t = setTimeout(() => {
      snaApi.search(query).then(r => { setResults(r); setShowDrop(r.length > 0); });
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const snaLine = snaStats
    ? `${snaStats.nodes.toLocaleString()} network nodes · ${snaStats.edges.toLocaleString()} edges · ${snaStats.communities} communities`
    : null;
  const docLine = docStats
    ? `${docStats.totalDocuments?.count?.toLocaleString() ?? '25,232'} documents · ${docStats.totalTriples?.count?.toLocaleString() ?? '107,030'} extracted triples`
    : null;

  return (
    <div className="w-full min-h-full flex flex-col items-center justify-start pt-16 pb-16 px-4"
         style={{ background: '#0a0e1a' }}>

      {/* Hero */}
      <div className="flex flex-col items-center text-center mb-10">
        <img src="/logo.png" alt="Epstein Graph" className="w-24 h-24 mb-5 opacity-90" />
        <h1 className="text-5xl font-bold tracking-widest mb-3" style={{ color: '#5eead4', letterSpacing: '0.15em' }}>
          EPSTEIN GRAPH
        </h1>
        <p className="text-slate-400 text-base mb-2 max-w-lg">
          A Social Network Analysis of the Epstein Connection Network — built for researchers and the public record.
        </p>
        {snaLine && (
          <p className="text-slate-500 text-sm">
            <span className="text-slate-600 text-xs uppercase tracking-wide mr-1">SNA</span>
            {snaLine}
          </p>
        )}
        {docLine && (
          <p className="text-slate-500 text-sm mt-0.5">
            <span className="text-slate-600 text-xs uppercase tracking-wide mr-1">Corpus</span>
            {docLine}
          </p>
        )}
      </div>

      {/* Search */}
      <div ref={searchRef} className="relative w-full max-w-2xl mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowDrop(true)}
            placeholder="Search people, connections..."
            className="flex-1 px-5 py-3 rounded-lg text-white text-sm outline-none transition-colors"
            style={{ background: '#111827', border: '1px solid #1e3a5f' }}
            onKeyDown={e => {
              if (e.key === 'Enter' && results[0]) {
                onPersonClick(results[0].id);
                setShowDrop(false);
              }
            }}
          />
          <button
            onClick={() => results[0] && onPersonClick(results[0].id)}
            className="px-6 py-3 rounded-lg font-medium text-sm transition-colors"
            style={{ background: '#2563eb', color: 'white' }}
          >
            Search
          </button>
        </div>
        {showDrop && (
          <div className="absolute z-50 mt-1 w-full rounded-lg shadow-xl overflow-hidden"
               style={{ background: '#111827', border: '1px solid #1e293b' }}>
            {results.map(r => (
              <button
                key={r.id}
                onMouseDown={() => { onPersonClick(r.id); setShowDrop(false); setQuery(''); }}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left transition-colors hover:bg-slate-800"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                <span className="text-white">{r.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Doc type chips */}
      <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-2xl">
        <span className="text-slate-500 text-sm self-center mr-1">Document Types</span>
        {DOC_CHIPS.map(chip => (
          <button
            key={chip}
            onClick={() => onDocTypeClick(DOC_KEYWORDS[chip] ?? '')}
            className="px-4 py-1.5 rounded-full text-sm transition-colors"
            style={{ border: '1px solid #334155', color: '#94a3b8', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#64748b')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#334155')}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Featured card */}
      <div className="w-full max-w-2xl mb-10">
        <button
          onClick={() => onDocTypeClick('')}
          className="w-full flex items-center justify-between px-6 py-4 rounded-xl text-left transition-colors group"
          style={{ background: '#111827', border: '1px solid #1e293b' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#334155')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e293b')}
        >
          <div>
            <div className="text-white font-semibold text-base mb-0.5">Epstein Document Network</div>
            <div className="text-slate-400 text-sm">
              Explore 107,030 relationships from 25,232 documents — flights, emails, legal filings
            </div>
          </div>
          <span className="text-slate-400 group-hover:text-white text-xl ml-4 transition-colors">→</span>
        </button>
      </div>

      {/* Prominent Figures */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-300 text-sm font-medium">Prominent Figures</span>
          <button
            onClick={onSeeAllClick}
            className="text-xs transition-colors"
            style={{ color: '#5eead4' }}
          >
            See all →
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {topFigures.map(f => (
            <button
              key={f.id}
              onClick={() => onPersonClick(f.id)}
              className="px-4 py-1.5 rounded-full text-sm text-slate-300 transition-colors"
              style={{ border: '1px solid #334155', background: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#64748b'; e.currentTarget.style.color = 'white'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#cbd5e1'; }}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
