// Bekkværet – liten server uten avhengigheter.
// Serverer frontend fra ./public og henter data fra Meteorologisk institutt (api.met.no).
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 4321;
const PUBLIC_DIR = path.join(__dirname, 'public');
// MET krever en identifiserende User-Agent: https://api.met.no/doc/TermsOfService
const USER_AGENT = 'Bekkvaeret/1.0 (lokal vaertjeneste; github.com/bekkvaeret)';

const CITIES = {
  oslo: { name: 'Oslo', lat: 59.9139, lon: 10.7522 },
  trondheim: { name: 'Trondheim', lat: 63.4305, lon: 10.3951 },
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

// Enkel cache som respekterer Expires/Last-Modified fra MET, slik vilkårene ber om.
const cache = new Map();

async function fetchMet(url) {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.body;

  const headers = { 'User-Agent': USER_AGENT };
  if (hit?.lastModified) headers['If-Modified-Since'] = hit.lastModified;

  const res = await fetch(url, { headers });
  if (res.status === 304 && hit) {
    hit.expires = expiryFrom(res);
    return hit.body;
  }
  if (!res.ok) throw new Error(`MET svarte ${res.status} for ${url}`);

  const body = await res.json();
  cache.set(url, { body, expires: expiryFrom(res), lastModified: res.headers.get('last-modified') });
  return body;
}

function expiryFrom(res) {
  const expires = Date.parse(res.headers.get('expires') || '');
  // Minst 60 sekunder, maks 30 minutter.
  const fallback = Date.now() + 5 * 60_000;
  const t = Number.isNaN(expires) ? fallback : expires;
  return Math.min(Math.max(t, Date.now() + 60_000), Date.now() + 30 * 60_000);
}

async function weatherFor(cityKey) {
  const city = CITIES[cityKey];
  const q = `lat=${city.lat}&lon=${city.lon}`;
  const [forecast, nowcast] = await Promise.allSettled([
    fetchMet(`https://api.met.no/weatherapi/locationforecast/2.0/compact?${q}`),
    fetchMet(`https://api.met.no/weatherapi/nowcast/2.0/complete?${q}`),
  ]);
  if (forecast.status === 'rejected') throw forecast.reason;
  return {
    city: { key: cityKey, ...city },
    forecast: forecast.value,
    nowcast: nowcast.status === 'fulfilled' ? nowcast.value : null,
    fetchedAt: new Date().toISOString(),
  };
}

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/weather') {
    const key = (url.searchParams.get('city') || 'oslo').toLowerCase();
    if (!CITIES[key]) return send(res, 400, JSON.stringify({ error: 'Ukjent by' }), MIME['.json']);
    try {
      return send(res, 200, JSON.stringify(await weatherFor(key)), MIME['.json']);
    } catch (err) {
      console.error(err);
      return send(res, 502, JSON.stringify({ error: 'Klarte ikke å hente værdata fra MET' }), MIME['.json']);
    }
  }

  // Statiske filer
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbudt', 'text/plain');
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
