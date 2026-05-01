const SNA_BASE = (import.meta.env.VITE_SNA_API_URL as string | undefined) ?? "http://localhost:8001";

async function snaFetch<T>(path: string): Promise<T> {
  const r = await fetch(SNA_BASE + path);
  if (!r.ok) throw new Error(`SNA API ${r.status}: ${path}`);
  return r.json() as Promise<T>;
}

export interface SnaStats {
  nodes: number;
  edges: number;
  density: number;
  diameter: number;
  avg_clustering: number;
  communities: number;
}

export interface SnaCentralityItem {
  rank: number;
  id: string;
  name: string;
  color: string;
  score: number;
  pagerank: number;
  document_mentions: number;
}

export interface SnaCommunity {
  id: number;
  label: string;
  size: number;
  color: string;
}

export interface SnaNode {
  id: string;
  name: string;
  community_id: number;
  community_label: string;
  community_color: string;
  degree: number;
  betweenness: number;
  closeness: number;
  eigenvector: number;
  pagerank: number;
  document_mentions: number;
  connections: { id: string; name: string; weight: number; color: string }[];
}

export interface SnaTimelinePoint {
  year: number;
  pagerank: number;
  betweenness: number;
}

export interface SnaPathResult {
  found: boolean;
  path: { id: string; name: string; color: string }[];
  edges: { source: string; target: string; relationship_type: string; weight: number }[];
}

export interface SnaBubbleNode {
  id: string;
  name: string;
  color: string;
  pagerank: number;
  document_mentions: number;
  value: number;
}

export interface SnaSearchResult {
  id: string;
  name: string;
  color: string;
  pagerank: number;
}

export const snaApi = {
  stats:            () => snaFetch<SnaStats>("/api/stats"),
  centrality:       (metric: string, limit = 20) =>
    snaFetch<SnaCentralityItem[]>(`/api/centrality/${metric}?limit=${limit}`),
  communities:      () => snaFetch<SnaCommunity[]>("/api/communities"),
  communityMembers: (id: number) => snaFetch<SnaNode[]>(`/api/community/${id}/members`),
  search:           (q: string) =>
    snaFetch<SnaSearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`),
  node:             (id: string) => snaFetch<SnaNode>(`/api/node/${id}`),
  timeline:         (id: string) => snaFetch<SnaTimelinePoint[]>(`/api/node/${id}/timeline`),
  path:             (a: string, b: string) => snaFetch<SnaPathResult>(`/api/path/${a}/${b}`),
  bubble:           (metric: string, limit = 100) =>
    snaFetch<SnaBubbleNode[]>(`/api/nodes/bubble?metric=${metric}&limit=${limit}`),
};
