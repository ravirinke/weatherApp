// Klient for Meteorologisk institutt (api.met.no).
// MET krever en identifiserende User-Agent: https://api.met.no/doc/TermsOfService
const USER_AGENT = 'Bekkvaeret/1.0 (lokal vaertjeneste; github.com/bekkvaeret)';

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

// Henter prognose og radarvarsel for en by. Radarvarselet er valgfritt.
export async function weatherFor(key, city) {
  const q = `lat=${city.lat}&lon=${city.lon}`;
  const [forecast, nowcast] = await Promise.allSettled([
    fetchMet(`https://api.met.no/weatherapi/locationforecast/2.0/compact?${q}`),
    fetchMet(`https://api.met.no/weatherapi/nowcast/2.0/complete?${q}`),
  ]);
  if (forecast.status === 'rejected') throw forecast.reason;
  return {
    city: { key, ...city },
    forecast: forecast.value,
    nowcast: nowcast.status === 'fulfilled' ? nowcast.value : null,
    fetchedAt: new Date().toISOString(),
  };
}
