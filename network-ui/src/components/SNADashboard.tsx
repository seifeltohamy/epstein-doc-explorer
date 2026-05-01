import React, { useEffect, useState } from 'react';
import { snaApi } from '../sna-api';
import type { SnaStats, SnaCentralityItem, SnaCommunity } from '../sna-api';

interface SNADashboardProps {
  onPersonClick: (id: string) => void;
  onCommunityClick: (id: number) => void;
}

const StatCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col gap-1">
    <span className="text-gray-400 text-xs uppercase tracking-wide">{label}</span>
    <span className="text-white text-2xl font-bold">{value}</span>
  </div>
);

const SNADashboard: React.FC<SNADashboardProps> = ({ onPersonClick, onCommunityClick }) => {
  const [stats, setStats]       = useState<SnaStats | null>(null);
  const [top15, setTop15]       = useState<SnaCentralityItem[]>([]);
  const [communities, setCommunities] = useState<SnaCommunity[]>([]);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      snaApi.stats(),
      snaApi.centrality('pagerank', 15),
      snaApi.communities(),
    ])
      .then(([s, t, c]) => { setStats(s); setTop15(t); setCommunities(c); })
      .catch(e => setError(e.message));
  }, []);

  if (error) return (
    <div className="flex items-center justify-center h-full text-red-400 p-8">
      Failed to load SNA data: {error}
      <br />Make sure the FastAPI server is running on port 8001.
    </div>
  );

  if (!stats) return (
    <div className="flex items-center justify-center h-full text-gray-400">
      Loading SNA data...
    </div>
  );

  return (
    <div className="p-6 overflow-y-auto h-full text-white">
      <h1 className="text-2xl font-bold mb-6">Epstein Network — SNA Dashboard</h1>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Nodes" value={stats.nodes} />
        <StatCard label="Edges" value={stats.edges} />
        <StatCard label="Communities" value={stats.communities} />
        <StatCard label="Avg Clustering" value={stats.avg_clustering.toFixed(3)} />
      </div>

      {/* Top Figures */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-200">Top Figures by PageRank</h2>
        <div className="flex flex-wrap gap-2">
          {top15.map(n => (
            <button
              key={n.id}
              onClick={() => onPersonClick(n.id)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border border-gray-700 hover:border-gray-500 hover:bg-gray-800 transition-colors"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: n.color }}
              />
              {n.name}
            </button>
          ))}
        </div>
      </section>

      {/* Communities */}
      <section>
        <h2 className="text-lg font-semibold mb-3 text-gray-200">Communities (Louvain)</h2>
        <div className="flex flex-wrap gap-3">
          {communities.map(c => (
            <button
              key={c.id}
              onClick={() => onCommunityClick(c.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-500 hover:bg-gray-800 transition-colors"
            >
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ background: c.color }}
              />
              <span className="text-sm font-medium">{c.label}</span>
              <span className="text-xs text-gray-400">({c.size} members)</span>
            </button>
          ))}
        </div>
      </section>

      {/* Network stats */}
      <section className="mt-8 bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3 text-gray-300 uppercase tracking-wide">Network Properties</h2>
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div><dt className="text-gray-400">Density</dt><dd className="text-white font-mono">{stats.density.toFixed(4)}</dd></div>
          <div><dt className="text-gray-400">Diameter</dt><dd className="text-white font-mono">{stats.diameter}</dd></div>
          <div><dt className="text-gray-400">Avg Clustering</dt><dd className="text-white font-mono">{stats.avg_clustering.toFixed(4)}</dd></div>
          <div><dt className="text-gray-400">Nodes</dt><dd className="text-white font-mono">{stats.nodes}</dd></div>
        </dl>
      </section>
    </div>
  );
};

export default SNADashboard;
