import React, { useState, useEffect, useRef } from 'react';
import { snaApi } from '../sna-api';
import type { SnaSearchResult, SnaPathResult } from '../sna-api';

interface PathFinderProps {
  onPersonClick: (id: string) => void;
}

const NodeSearch: React.FC<{
  label: string;
  value: SnaSearchResult | null;
  onChange: (n: SnaSearchResult | null) => void;
}> = ({ label, value, onChange }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SnaSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) { setQ(value.name); setOpen(false); return; }
  }, [value]);

  useEffect(() => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    if (value && q === value.name) return;
    const t = setTimeout(() => {
      snaApi.search(q).then(r => { setResults(r); setOpen(r.length > 0); });
    }, 200);
    return () => clearTimeout(t);
  }, [q, value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative flex-1">
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type="text"
        value={q}
        onChange={e => { setQ(e.target.value); if (value) onChange(null); }}
        placeholder="Search name..."
        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2 text-sm focus:border-blue-500 outline-none"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {results.map(r => (
            <button
              key={r.id}
              onMouseDown={() => { onChange(r); setQ(r.name); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-800 text-left"
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
              {r.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const PathFinder: React.FC<PathFinderProps> = ({ onPersonClick }) => {
  const [nodeA, setNodeA] = useState<SnaSearchResult | null>(null);
  const [nodeB, setNodeB] = useState<SnaSearchResult | null>(null);
  const [result, setResult] = useState<SnaPathResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const find = () => {
    if (!nodeA || !nodeB) return;
    setLoading(true);
    setError(null);
    setResult(null);
    snaApi.path(nodeA.id, nodeB.id)
      .then(setResult)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  return (
    <div className="p-6 overflow-y-auto h-full text-white max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Path Finder</h1>
      <p className="text-gray-400 text-sm mb-6">Find the shortest connection between two people in the network.</p>

      <div className="flex gap-3 items-end mb-4">
        <NodeSearch label="From" value={nodeA} onChange={setNodeA} />
        <span className="text-gray-500 pb-2">→</span>
        <NodeSearch label="To" value={nodeB} onChange={setNodeB} />
        <button
          onClick={find}
          disabled={!nodeA || !nodeB || loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
        >
          {loading ? '...' : 'Find'}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {result && !result.found && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-gray-400 text-sm">
          No path found between these two people.
        </div>
      )}

      {result?.found && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-3">
            Path length: {result.path.length - 1} hop{result.path.length !== 2 ? 's' : ''}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {result.path.map((node, i) => (
              <React.Fragment key={node.id}>
                <button
                  onClick={() => onPersonClick(node.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-600 hover:border-gray-400 bg-gray-900 hover:bg-gray-800 text-sm transition-colors"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: node.color }} />
                  {node.name}
                </button>
                {i < result.path.length - 1 && (
                  <div className="text-center">
                    <div className="text-gray-500 text-xs">
                      {result.edges[i]?.relationship_type
                        ? result.edges[i].relationship_type.split(';')[0].slice(0, 30)
                        : '——'}
                    </div>
                    <div className="text-gray-600 text-xs">→</div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PathFinder;
