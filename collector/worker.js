// Cloudflare Worker: receives events, stores them in D1, serves a protected export.
const EVENTS = new Set(['pageview', 'module_open', 'faq_open', 'builder_used', 'cta_click', 'section_view', 'interaction']);
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (url.pathname === '/collect' && req.method === 'POST') {
      let p;
      try { p = JSON.parse(await req.text()); } catch { return new Response('bad json', { status: 400, headers: cors }); }
      if (!p || !EVENTS.has(p.event) || !p.sid) return new Response('rejected', { status: 400, headers: cors });
      const w = Number(p.w) || 0;
      const device = w === 0 ? '' : w < 600 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
      await env.DB.prepare(
        'INSERT INTO events (ts, sid, event, detail, path, ref, device, country) VALUES (?,?,?,?,?,?,?,?)'
      ).bind(
        Math.floor(Date.now() / 1000), clip(p.sid, 64), p.event, clip(p.detail, 100),
        clip(p.path, 200), clip(p.ref, 100), device, clip(req.cf && req.cf.country, 2)
      ).run();
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/score' && req.method === 'POST') {
      let p;
      try { p = JSON.parse(await req.text()); } catch { return new Response('bad json', { status: 400, headers: cors }); }
      const name = String((p && p.name) || '').replace(/[^A-Za-z0-9_ ]/g, '').trim().slice(0, 16);
      const score = Math.floor(Number(p && p.score));
      if (name.length < 2 || !(score >= 0 && score <= 150)) return new Response('rejected', { status: 400, headers: cors });
      await env.DB.prepare(
        'INSERT INTO scores (name, score, ts) VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET score = MAX(score, excluded.score), ts = excluded.ts'
      ).bind(name, score, Math.floor(Date.now() / 1000)).run();
      const r = await env.DB.prepare(
        'SELECT COUNT(*) + 1 AS rank FROM scores WHERE score > (SELECT score FROM scores WHERE name = ?)'
      ).bind(name).first();
      return new Response(JSON.stringify({ rank: r.rank }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/leaderboard' && req.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT name, score FROM scores ORDER BY score DESC, ts ASC LIMIT 10').all();
      return new Response(JSON.stringify(results), { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=20' } });
    }

    if (url.pathname === '/export' && req.method === 'GET') {
      if (!env.EXPORT_TOKEN || req.headers.get('Authorization') !== 'Bearer ' + env.EXPORT_TOKEN) {
        return new Response('unauthorized', { status: 401, headers: cors });
      }
      const since = Number(url.searchParams.get('since')) || 0;
      const { results } = await env.DB.prepare(
        'SELECT ts, sid, event, detail, path, ref, device, country FROM events WHERE ts >= ? ORDER BY ts LIMIT 100000'
      ).bind(since).all();
      return new Response(JSON.stringify(results), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    return new Response('not found', { status: 404, headers: cors });
  },
};
