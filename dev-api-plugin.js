import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Dev-only Vite plugin: serves the Vercel-style serverless functions in
// ./api during `vite dev`, so the app works locally without `vercel dev`.
// Loads env from vercel.json and adapts Node's req/res to the Vercel shape
// the handlers expect (req.query, req.body, res.status(), res.json()).

function loadVercelEnv(root) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
    for (const [k, v] of Object.entries(cfg.env || {})) {
      if (process.env[k] === undefined) process.env[k] = String(v);
    }
  } catch {
    /* no vercel.json — nothing to load */
  }
}

async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function shimRes(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
    return res;
  };
}

export function devApi() {
  return {
    name: 'dev-api',
    configureServer(server) {
      const root = server.config.root || process.cwd();
      loadVercelEnv(root);

      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();

        const u = new URL(req.url, 'http://localhost');
        const name = u.pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
        const file = path.join(root, 'api', `${name}.js`);

        if (!name || !fs.existsSync(file)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: `No API route /api/${name}` }));
        }

        try {
          // Cache-bust on file change so edits to api/*.js hot-reload in dev
          const version = fs.statSync(file).mtimeMs;
          const mod = await import(`${pathToFileURL(file).href}?v=${version}`);
          const handler = mod.default;
          req.query = Object.fromEntries(u.searchParams.entries());
          req.body = await readBody(req);
          shimRes(res);
          await handler(req, res);
        } catch (err) {
          console.error(`[dev-api] /api/${name} failed:`, err);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        }
      });
    },
  };
}
