// Bekkværet – liten server uten avhengigheter.
// Serverer frontend fra ./public (og felles moduler fra ./shared) og værdata via /api/weather.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CITIES, DEFAULT_CITY } from '../shared/cities.js';
import { weatherFor } from './met.js';

const PORT = Number(process.env.PORT) || 4321;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SHARED_DIR = path.join(ROOT, 'shared');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

// /shared/* hentes fra ./shared, alt annet fra ./public. Hindrer at man går ut av mappene.
function staticFile(pathname) {
  const [root, rel] = pathname.startsWith('/shared/')
    ? [SHARED_DIR, pathname.slice('/shared/'.length)]
    : [PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')];
  let decoded;
  try {
    decoded = decodeURIComponent(rel);
  } catch {
    return null; // ugyldig %-koding
  }
  const file = path.normalize(path.join(root, decoded));
  return file.startsWith(root + path.sep) ? file : null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/weather') {
    const key = (url.searchParams.get('city') || DEFAULT_CITY).toLowerCase();
    if (!Object.hasOwn(CITIES, key)) return send(res, 400, JSON.stringify({ error: 'Ukjent by' }), MIME['.json']);
    try {
      return send(res, 200, JSON.stringify(await weatherFor(key, CITIES[key])), MIME['.json']);
    } catch (err) {
      console.error(err);
      return send(res, 502, JSON.stringify({ error: 'Klarte ikke å hente værdata fra MET' }), MIME['.json']);
    }
  }

  const file = staticFile(url.pathname);
  if (!file) return send(res, 403, 'Forbudt', 'text/plain; charset=utf-8');
  try {
    const data = await fs.readFile(file);
    send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream');
  } catch {
    send(res, 404, 'Fant ikke siden', 'text/plain; charset=utf-8');
  }
});

server.listen(PORT, () => {
  console.log(`Bekkværet kjører på http://localhost:${PORT}`);
});
