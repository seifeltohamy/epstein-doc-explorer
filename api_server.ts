#!/usr/bin/env node

import dns from 'dns';
dns.setDefaultResultOrder('ipv4first'); // Railway doesn't support IPv6

import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;
const DATABASE_URL = process.env.DATABASE_URL;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.trim())
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'https://epsteinvisualizer.com', 'https://www.epsteinvisualizer.com'];

console.log('Allowed CORS origins:', ALLOWED_ORIGINS);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    if (origin.includes('.onrender.com') || origin.includes('.railway.app')) return callback(null, true);
    console.warn(`CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  maxAge: 86400
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const requestCounts = new Map<string, { count: number; resetTime: number }>();
app.use((req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const userData = requestCounts.get(ip);
  if (!userData || now > userData.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 });
    return next();
  }
  if (userData.count >= 1000) return res.status(429).json({ error: 'Too many requests' });
  userData.count++;
  next();
});

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set — DB queries will fail');
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query('SELECT 1').then(() => {
  console.log('✓ Database connected');
}).catch(err => {
  console.error('Failed to connect to database:', err.message);
});

let tagClusters: any[] = [];
try {
  tagClusters = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tag_clusters.json'), 'utf-8'));
  console.log(`✓ Loaded ${tagClusters.length} tag clusters`);
} catch {
  tagClusters = [];
}

function validateLimit(limit: any): number {
  const parsed = parseInt(limit);
  if (isNaN(parsed) || parsed < 1) return 500;
  return Math.min(20000, Math.max(1, parsed));
}

function validateClusterIds(clusters: any): number[] {
  if (!clusters) return [];
  return String(clusters).split(',').map(Number).filter(n => !isNaN(n) && n >= 0 && Number.isInteger(n)).slice(0, 50);
}

function validateCategories(categories: any): string[] {
  if (!categories) return [];
  return String(categories).split(',').map(c => c.trim()).filter(c => c.length > 0 && c.length < 100).slice(0, 50);
}

function validateYearRange(yearMin: any, yearMax: any): [number, number] | null {
  if (!yearMin && !yearMax) return null;
  const min = parseInt(yearMin), max = parseInt(yearMax);
  if (isNaN(min) || isNaN(max) || min < 1970 || max > 2025 || min > max) return null;
  return [min, max];
}

function validateKeywords(keywords: any): string[] {
  if (!keywords) return [];
  return String(keywords).split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 0 && k.length < 100).slice(0, 20);
}

function validateMaxHops(maxHops: any): number | null {
  if (!maxHops || maxHops === 'any') return null;
  const parsed = parseInt(maxHops);
  if (isNaN(parsed) || parsed < 1 || parsed > 10) return null;
  return parsed;
}

function calculateBM25Score(text: string, keywords: string[]): number {
  if (!text || keywords.length === 0) return 0;
  const words = text.toLowerCase().split(/\s+/);
  const k1 = 1.2, b = 0.75, avgDocLength = 100;
  let score = 0;
  keywords.forEach(keyword => {
    const tf = words.filter(w => w.includes(keyword)).length;
    if (tf === 0) return;
    const idf = Math.log(10);
    score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (words.length / avgDocLength)));
  });
  return score;
}

// Build a parameterized $N placeholder string starting at offset
function placeholders(count: number, offset = 0): string {
  return Array.from({ length: count }, (_, i) => `$${i + offset + 1}`).join(', ');
}

app.get('/api/actors', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT
        COALESCE(ea.canonical_name, rt.actor) as name,
        COUNT(*) as connection_count
      FROM rdf_triples rt
      LEFT JOIN entity_aliases ea ON rt.actor = ea.original_name
      GROUP BY COALESCE(ea.canonical_name, rt.actor)
      ORDER BY connection_count DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error in /api/actors:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

app.get('/api/relationships', async (req, res) => {
  try {
    const limit = validateLimit(req.query.limit);
    const clusterIds = validateClusterIds(req.query.clusters);
    const categories = validateCategories(req.query.categories);
    const yearRange = validateYearRange(req.query.yearMin, req.query.yearMax);
    const includeUndated = req.query.includeUndated !== 'false';
    const keywords = validateKeywords(req.query.keywords);
    const maxHops = validateMaxHops(req.query.maxHops);
    const EPSTEIN_NAME = 'Jeffrey Epstein';
    const selectedClusterIds = new Set<number>(clusterIds);
    const selectedCategories = new Set<string>(categories);

    const params: any[] = [];
    let whereClauses = [`(rt.timestamp IS NULL OR rt.timestamp >= '1970-01-01')`];

    if (selectedCategories.size > 0) {
      params.push(Array.from(selectedCategories));
      whereClauses.push(`d.category = ANY($${params.length}::text[])`);
    }

    if (yearRange) {
      const [minYear, maxYear] = yearRange;
      if (includeUndated) {
        params.push(minYear, maxYear);
        whereClauses.push(`(rt.timestamp IS NULL OR (LEFT(rt.timestamp,4)::int >= $${params.length-1} AND LEFT(rt.timestamp,4)::int <= $${params.length}))`);
      } else {
        params.push(minYear, maxYear);
        whereClauses.push(`(rt.timestamp IS NOT NULL AND LEFT(rt.timestamp,4)::int >= $${params.length-1} AND LEFT(rt.timestamp,4)::int <= $${params.length})`);
      }
    }

    let hopJoins = '';
    if (maxHops !== null) {
      params.push(maxHops, maxHops);
      hopJoins = `
        LEFT JOIN canonical_entities ce_actor ON COALESCE(ea_actor.canonical_name, rt.actor) = ce_actor.canonical_name
        LEFT JOIN canonical_entities ce_target ON COALESCE(ea_target.canonical_name, rt.target) = ce_target.canonical_name`;
      whereClauses.push(`ce_actor.hop_distance_from_principal <= $${params.length-1} AND ce_target.hop_distance_from_principal <= $${params.length}`);
    }

    params.push(100000);
    const sql = `
      SELECT rt.id, rt.doc_id, rt.timestamp,
        COALESCE(ea_actor.canonical_name, rt.actor) as actor,
        rt.action,
        COALESCE(ea_target.canonical_name, rt.target) as target,
        rt.location, rt.triple_tags, rt.top_cluster_ids
      FROM rdf_triples rt
      LEFT JOIN entity_aliases ea_actor ON rt.actor = ea_actor.original_name
      LEFT JOIN entity_aliases ea_target ON rt.target = ea_target.original_name
      ${hopJoins}
      LEFT JOIN documents d ON rt.doc_id = d.doc_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY rt.timestamp
      LIMIT $${params.length}
    `;

    const { rows: allRelationships } = await pool.query(sql, params);

    let filteredRelationships = allRelationships.filter(rel => {
      if (selectedClusterIds.size === 0) return true;
      try {
        const topClusters = rel.top_cluster_ids ? JSON.parse(rel.top_cluster_ids) : [];
        return topClusters.some((id: number) => selectedClusterIds.has(id));
      } catch { return false; }
    });

    if (keywords.length > 0) {
      filteredRelationships = filteredRelationships.filter(rel => {
        const score = calculateBM25Score(`${rel.actor} ${rel.action} ${rel.target} ${rel.location || ''}`, keywords);
        return score > 0;
      });
    }

    const adjacency = new Map<string, Set<string>>();
    filteredRelationships.forEach(rel => {
      if (!adjacency.has(rel.actor)) adjacency.set(rel.actor, new Set());
      if (!adjacency.has(rel.target)) adjacency.set(rel.target, new Set());
      adjacency.get(rel.actor)!.add(rel.target);
      adjacency.get(rel.target)!.add(rel.actor);
    });

    const distances = new Map<string, number>();
    if (adjacency.has(EPSTEIN_NAME)) {
      distances.set(EPSTEIN_NAME, 0);
      const queue = [EPSTEIN_NAME];
      while (queue.length > 0) {
        const current = queue.shift()!;
        const d = distances.get(current)!;
        adjacency.get(current)!.forEach(neighbor => {
          if (!distances.has(neighbor)) { distances.set(neighbor, d + 1); queue.push(neighbor); }
        });
      }
    }

    const edgeMap = new Map<string, any[]>();
    filteredRelationships.forEach(rel => {
      const key = `${rel.actor}|||${rel.target}`;
      if (!edgeMap.has(key)) edgeMap.set(key, []);
      edgeMap.get(key)!.push(rel);
    });

    const uniqueEdges = Array.from(edgeMap.entries()).map(([key, rels]) => ({ key, relationships: rels, representative: rels[0] }));
    const nodeDegrees = new Map<string, number>();
    uniqueEdges.forEach(e => {
      nodeDegrees.set(e.representative.actor, (nodeDegrees.get(e.representative.actor) || 0) + 1);
      nodeDegrees.set(e.representative.target, (nodeDegrees.get(e.representative.target) || 0) + 1);
    });

    const prunedEdges = uniqueEdges
      .map(e => ({ ...e, _density: (nodeDegrees.get(e.representative.actor) || 0) + (nodeDegrees.get(e.representative.target) || 0) }))
      .sort((a, b) => b._density - a._density)
      .slice(0, limit);

    const relationships = prunedEdges.flatMap(e => e.relationships).map(({ triple_tags, ...rel }) => ({
      ...rel, tags: triple_tags ? JSON.parse(triple_tags) : []
    }));

    res.json({ relationships, totalBeforeLimit: uniqueEdges.length, totalBeforeFilter: allRelationships.length });
  } catch (error) {
    console.error('Error in /api/relationships:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

app.get('/api/actor/:name/relationships', async (req, res) => {
  try {
    const { name } = req.params;
    if (!name || name.length > 200) return res.status(400).json({ error: 'Invalid actor name' });

    const clusterIds = validateClusterIds(req.query.clusters);
    const categories = validateCategories(req.query.categories);
    const yearRange = validateYearRange(req.query.yearMin, req.query.yearMax);
    const includeUndated = req.query.includeUndated !== 'false';
    const keywords = validateKeywords(req.query.keywords);
    const maxHops = validateMaxHops(req.query.maxHops);
    const selectedClusterIds = new Set<number>(clusterIds);
    const selectedCategories = new Set<string>(categories);

    // Resolve all names (aliases + canonical)
    const { rows: aliasRows } = await pool.query(`
      SELECT original_name as name FROM entity_aliases WHERE canonical_name = $1
      UNION SELECT canonical_name FROM entity_aliases WHERE original_name = $1
      UNION SELECT $1 as name
    `, [name]);
    const allNames = aliasRows.map((r: any) => r.name).filter(Boolean);

    const { rows: countRows } = await pool.query(`
      SELECT COUNT(*) as count FROM rdf_triples rt
      WHERE (rt.actor = ANY($1::text[]) OR rt.target = ANY($1::text[]))
        AND (rt.timestamp IS NULL OR rt.timestamp >= '1970-01-01')
    `, [allNames]);
    const totalCount = parseInt(countRows[0].count);

    const params: any[] = [allNames];
    let whereClauses: string[] = [
      `(rt.actor = ANY($1::text[]) OR rt.target = ANY($1::text[]))`,
      `(rt.timestamp IS NULL OR rt.timestamp >= '1970-01-01')`
    ];

    if (selectedCategories.size > 0) {
      params.push(Array.from(selectedCategories));
      whereClauses.push(`d.category = ANY($${params.length}::text[])`);
    }

    if (yearRange) {
      const [minYear, maxYear] = yearRange;
      if (includeUndated) {
        params.push(minYear, maxYear);
        whereClauses.push(`(rt.timestamp IS NULL OR (LEFT(rt.timestamp,4)::int >= $${params.length-1} AND LEFT(rt.timestamp,4)::int <= $${params.length}))`);
      } else {
        params.push(minYear, maxYear);
        whereClauses.push(`(rt.timestamp IS NOT NULL AND LEFT(rt.timestamp,4)::int >= $${params.length-1} AND LEFT(rt.timestamp,4)::int <= $${params.length})`);
      }
    }

    let hopJoins = '';
    if (maxHops !== null) {
      params.push(maxHops, maxHops);
      hopJoins = `
        LEFT JOIN canonical_entities ce_actor ON COALESCE(ea_actor.canonical_name, rt.actor) = ce_actor.canonical_name
        LEFT JOIN canonical_entities ce_target ON COALESCE(ea_target.canonical_name, rt.target) = ce_target.canonical_name`;
      whereClauses.push(`ce_actor.hop_distance_from_principal <= $${params.length-1} AND ce_target.hop_distance_from_principal <= $${params.length}`);
    }

    const sql = `
      SELECT rt.id, rt.doc_id, rt.timestamp,
        COALESCE(ea_actor.canonical_name, rt.actor) as actor,
        rt.action,
        COALESCE(ea_target.canonical_name, rt.target) as target,
        rt.location, rt.triple_tags, rt.top_cluster_ids
      FROM rdf_triples rt
      LEFT JOIN entity_aliases ea_actor ON rt.actor = ea_actor.original_name
      LEFT JOIN entity_aliases ea_target ON rt.target = ea_target.original_name
      ${hopJoins}
      LEFT JOIN documents d ON rt.doc_id = d.doc_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY rt.timestamp
    `;

    const { rows: allRelationships } = await pool.query(sql, params);

    let filteredRelationships = allRelationships.filter(rel => {
      if (selectedClusterIds.size === 0) return true;
      try {
        const topClusters = rel.top_cluster_ids ? JSON.parse(rel.top_cluster_ids) : [];
        return topClusters.some((id: number) => selectedClusterIds.has(id));
      } catch { return false; }
    });

    if (keywords.length > 0) {
      filteredRelationships = filteredRelationships.filter(rel =>
        calculateBM25Score(`${rel.actor} ${rel.action} ${rel.target} ${rel.location || ''}`, keywords) > 0
      );
    }

    const relationships = filteredRelationships.map(({ triple_tags, top_cluster_ids, ...rel }) => ({
      ...rel, tags: triple_tags ? JSON.parse(triple_tags) : []
    }));

    res.json({ relationships, totalBeforeFilter: totalCount });
  } catch (error) {
    console.error('Error in /api/actor/:name/relationships:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const [docs, triples, actors, categories] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM documents'),
      pool.query('SELECT COUNT(*) as count FROM rdf_triples'),
      pool.query(`SELECT COUNT(DISTINCT COALESCE(ea.canonical_name, rt.actor)) as count
        FROM rdf_triples rt LEFT JOIN entity_aliases ea ON rt.actor = ea.original_name`),
      pool.query(`SELECT category, COUNT(*) as count FROM documents GROUP BY category ORDER BY count DESC`)
    ]);
    res.json({
      totalDocuments: { count: parseInt(docs.rows[0].count) },
      totalTriples: { count: parseInt(triples.rows[0].count) },
      totalActors: { count: parseInt(actors.rows[0].count) },
      categories: categories.rows
    });
  } catch (error) {
    console.error('Error in /api/stats:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) return res.json([]);
    const { rows } = await pool.query(`
      SELECT DISTINCT COALESCE(ea.canonical_name, rt.actor) as name, COUNT(*) as connection_count
      FROM rdf_triples rt
      LEFT JOIN entity_aliases ea ON rt.actor = ea.original_name
      WHERE COALESCE(ea.canonical_name, rt.actor) ILIKE $1
      GROUP BY COALESCE(ea.canonical_name, rt.actor)
      ORDER BY connection_count DESC
      LIMIT 20
    `, [`%${query}%`]);
    res.json(rows);
  } catch (error) {
    console.error('Error in /api/search:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

app.get('/api/actor-counts', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COALESCE(ea_actor.canonical_name, rt.actor) as actor,
        COALESCE(ea_target.canonical_name, rt.target) as target
      FROM rdf_triples rt
      LEFT JOIN entity_aliases ea_actor ON rt.actor = ea_actor.original_name
      LEFT JOIN entity_aliases ea_target ON rt.target = ea_target.original_name
      WHERE (rt.timestamp IS NULL OR rt.timestamp >= '1970-01-01')
    `);
    const limit = parseInt(req.query.limit as string) || 300;
    const actorCounts = new Map<string, number>();
    rows.forEach(rel => {
      actorCounts.set(rel.actor, (actorCounts.get(rel.actor) || 0) + 1);
      actorCounts.set(rel.target, (actorCounts.get(rel.target) || 0) + 1);
    });
    const topActors = Array.from(actorCounts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, limit)
      .reduce((acc, [name, count]) => { acc[name] = count; return acc; }, {} as Record<string, number>);
    res.json(topActors);
  } catch (error) {
    console.error('Error in /api/actor-counts:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

app.get('/api/actor/:name/count', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT COUNT(*) as count FROM rdf_triples rt
      LEFT JOIN entity_aliases ea_actor ON rt.actor = ea_actor.original_name
      LEFT JOIN entity_aliases ea_target ON rt.target = ea_target.original_name
      WHERE (COALESCE(ea_actor.canonical_name, rt.actor) = $1 OR COALESCE(ea_target.canonical_name, rt.target) = $1)
        AND (rt.timestamp IS NULL OR rt.timestamp >= '1970-01-01')
    `, [req.params.name]);
    res.json({ count: parseInt(rows[0].count) });
  } catch (error) {
    console.error('Error in /api/actor/:name/count:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

app.get('/api/document/:docId', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT doc_id, file_path, one_sentence_summary, paragraph_summary,
        category, date_range_earliest, date_range_latest
      FROM documents WHERE doc_id = $1
    `, [req.params.docId]);
    if (!rows[0]) return res.status(404).json({ error: 'Document not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error in /api/document/:docId:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

app.get('/api/document/:docId/text', async (req, res) => {
  try {
    const { docId } = req.params;
    if (!docId || docId.length > 100 || /[<>:"|?*]/.test(docId)) return res.status(400).json({ error: 'Invalid document ID' });
    const { rows } = await pool.query('SELECT full_text FROM documents WHERE doc_id = $1', [docId]);
    if (!rows[0]) return res.status(404).json({ error: 'Document not found' });
    if (!rows[0].full_text) return res.status(404).json({ error: 'Document text not available' });
    res.json({ text: rows[0].full_text });
  } catch (error) {
    console.error('Error in /api/document/:docId/text:', error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

app.get('/api/tag-clusters', (req, res) => {
  try {
    res.json(tagClusters.map((c: any) => ({ id: c.id, name: c.name, exemplars: c.exemplars, tagCount: c.tags.length })));
  } catch (error) {
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Serve frontend
const frontendPath = path.join(process.cwd(), 'network-ui', 'dist');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) return next();
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
  console.log(`✓ Serving frontend from ${frontendPath}`);
} else {
  console.log(`⚠ Frontend build not found at ${frontendPath}`);
}

const server = app.listen(PORT, () => {
  console.log(`\n🚀 API Server running at http://localhost:${PORT}`);
  console.log(`📊 Network UI will connect to this server\n`);
});

process.on('SIGTERM', () => server.close(() => { pool.end(); console.log('Server closed'); }));
process.on('SIGINT', () => server.close(() => { pool.end(); console.log('Server closed'); }));
