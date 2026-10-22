// Ren logikk over METs data: nåvær, nedbør neste time og dagssammendrag.
// Ingen DOM her, så modulen kan også brukes fra Node.
import { parse } from './icons.js';
import { cap, dayKey, localHour } from './format.js';

// Siste tidssteg som har startet, ellers det første.
export function currentEntry(series, now) {
  let pick = series[0];
  for (const e of series) {
    if (new Date(e.time) <= now) pick = e;
    else break;
  }
  return pick;
}

// Radarvarselet brukes bare når det faktisk dekker stedet.
export function usableNowcast(nowcast) {
  const nc = nowcast?.properties;
  return nc && nc.meta?.radar_coverage === 'ok' && nc.timeseries?.length ? nc : null;
}

// Nåvær: radarvarselet foretrekkes, prognosen fyller hullene.
export function currentConditions(series, nc, now) {
  const fc = currentEntry(series, now);
  const fcInst = fc.data.instant.details;
  const ncFirst = nc?.timeseries[0]?.data;
  const ncInst = ncFirst?.instant?.details || {};

  return {
    symbol: ncFirst?.next_1_hours?.summary?.symbol_code
      || fc.data.next_1_hours?.summary?.symbol_code
      || fc.data.next_6_hours?.summary?.symbol_code,
    temp: ncInst.air_temperature ?? fcInst.air_temperature,
    feels: ncInst.apparent_air_temperature,
    wind: ncInst.wind_speed ?? fcInst.wind_speed,
    gust: ncInst.wind_speed_of_gust,
    dir: ncInst.wind_from_direction ?? fcInst.wind_from_direction,
    humidity: ncInst.relative_humidity ?? fcInst.relative_humidity,
    precip: ncFirst?.next_1_hours?.details?.precipitation_amount
      ?? fc.data.next_1_hours?.details?.precipitation_amount,
  };
}

// Intensitetsnivå for stolpene: 0 opphold, 1 lett, 2 moderat, 3 kraftig (mm/t).
export function level(rate) {
  if (rate < 0.1) return 0;
  if (rate < 1) return 1;
  if (rate < 4) return 2;
  return 3;
}

// Tidssteg på 5 minutter fra nå og 60 minutter frem.
export function nowcastSteps(nc, now) {
  const start = now.getTime() - 5 * 60_000;
  return nc.timeseries
    .filter((e) => new Date(e.time).getTime() > start)
    .slice(0, 12)
    .map((e) => ({ time: new Date(e.time), rate: e.data.instant.details.precipitation_rate ?? 0 }));
}

// Kort setning om nedbøren den neste timen. Mengden vises for seg (se nowcastTotal).
export function nowcastSummary(steps, symbol) {
  const wet = steps.map((s) => s.rate >= 0.1);
  const word = { rain: 'regn', sleet: 'sludd', snow: 'snø' }[parse(symbol).precip] || 'nedbør';

  const firstWet = wet.indexOf(true);
  const firstDry = wet.indexOf(false);
  if (firstWet === -1) return 'Opphold den neste timen';
  if (firstDry === -1) return `${cap(word)} den neste timen`;
  if (wet[0]) {
    const again = wet.indexOf(true, firstDry) !== -1;
    return `${cap(word)} nå, opphold om ca. ${firstDry * 5} min${again ? ', så mer' : ''}`;
  }
  return `${cap(word)} om ca. ${firstWet * 5} min`;
}

// Samlet nedbør (mm) de neste 60 minuttene.
export const nowcastTotal = (steps) => steps.reduce((sum, s) => sum + (s.rate * 5) / 60, 0);

// Sammendrag per lokal dag (Oslo-tid), fra i dag og 7 dager frem.
export function buildDays(series, now) {
  const days = new Map();
  const today = dayKey(now);

  for (const e of series) {
    const t = new Date(e.time);
    const key = dayKey(t);
    if (key < today) continue;
    if (!days.has(key)) days.set(key, { key, min: Infinity, max: -Infinity, precip: 0, wind: 0, candidates: [] });
    const d = days.get(key);
    const inst = e.data.instant.details;
    if (inst.air_temperature != null) {
      d.min = Math.min(d.min, inst.air_temperature);
      d.max = Math.max(d.max, inst.air_temperature);
    }
    if (inst.wind_speed != null) d.wind = Math.max(d.wind, inst.wind_speed);

    // Timesdata når det finnes, ellers 6-timersblokker (unngår dobbelttelling).
    if (e.data.next_1_hours) d.precip += e.data.next_1_hours.details?.precipitation_amount ?? 0;
    else if (e.data.next_6_hours) d.precip += e.data.next_6_hours.details?.precipitation_amount ?? 0;

    const sym = e.data.next_6_hours?.summary?.symbol_code || e.data.next_1_hours?.summary?.symbol_code;
    if (sym) d.candidates.push({ hour: localHour(t), sym, six: !!e.data.next_6_hours });
  }

  return [...days.values()]
    .slice(0, 7)
    .filter((d) => Number.isFinite(d.min))
    .map(({ candidates, ...d }) => {
      // Representativt symbol: 6-timersblokken nærmest midt på dagen.
      const six = candidates.filter((c) => c.six);
      const pool = six.length ? six : candidates;
      pool.sort((a, b) => Math.abs(a.hour - 12) - Math.abs(b.hour - 12));
      return { ...d, symbol: pool[0]?.sym || 'cloudy' };
    });
}
