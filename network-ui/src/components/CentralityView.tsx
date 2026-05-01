import React, { useEffect, useState } from 'react';
import { snaApi } from '../sna-api';
import type { SnaCentralityItem } from '../sna-api';

interface CentralityViewProps {
  onPersonClick: (id: string) => void;
}

const METRICS = [
  { value: 'pagerank',    label: 'PageRank' },
  { value: 'degree',      label: 'Degree' },
  { value: 'betweenness', label: 'Betweenness' },
  { value: 'closeness',   label: 'Closeness' },
  { value: 'eigenvector', label: 'Eigenvector' },
];

const CentralityView: React.FC<CentralityViewProps> = ({ onPersonClick }) => {
  const [metric, setMetric]   = useState('pagerank');
  const [items, setItems]     = useState<SnaCentralityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    snaApi.centrality(metric, 50)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [metric]);

  const maxScore = items[0]?.score ?? 1;

  return (
    <div className="p-6 overflow-y-auto h-full text-white">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Centrality Leaderboard</h1>
        <select
          value={metric}
          onChange={e => setMetric(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded px-3 py-1.5 text-sm"
        >
          {METRICS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : (
        <div className="flex flex-col gap-2 max-w-2xl">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => onPersonClick(item.id)}
              className="flex items-center gap-3 p-3 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-500 hover:bg-gray-750 transition-colors text-left"
            >
              <span className="text-gray-500 text-sm w-6 text-right shrink-0">
                {item.rank}
              </span>
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: item.color }}
              />
              <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
              <div className="w-32 shrink-0">
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(item.score / maxScore) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-gray-400 text-xs font-mono w-20 text-right shrink-0">
                {item.score.toExponential(2)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CentralityView;
