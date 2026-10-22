// Alt som skriver til siden.
import { icon, describe } from './icons.js';
import { clock, dayLabel, dayOfMonth, degC, mmHour, round } from './format.js';
import {
  buildDays, currentConditions, currentEntry, level, nowcastSteps, nowcastSummary, nowcastTotal, usableNowcast,
} from './forecast.js';

const $ = (id) => document.getElementById(id);

export function render(data) {
  const series = data.forecast.properties.timeseries;
  const nc = usableNowcast(data.nowcast);
  const now = new Date();

  $('city-name').textContent = data.city.name;
  document.title = `${data.city.name} – Bekkværet`;

  renderNow(series, nc, now);
  renderNowcast(series, nc, now);
  renderDays(series, now);
  $('updated').textContent = `Oppdatert kl. ${clock(now)}, oppdateres hvert 5. minutt.`;
}

export function renderError(message) {
  $('error').textContent = message ?? '';
  $('error').hidden = message == null;
}

function renderNow(series, nc, now) {
  const c = currentConditions(series, nc, now);
  const cond = describe(c.symbol);

  $('now-icon').innerHTML = icon(c.symbol, cond);
  $('now-temp').textContent = round(c.temp);
  $('now-cond').textContent = cond;
}

function renderNowcast(series, nc, now) {
  const card = $('nowcast-chart').closest('.nowcast');
  const fc = currentEntry(series, now).data.next_1_hours;

  if (!nc) {
    const amount = fc?.details?.precipitation_amount ?? 0;
    $('nowcast-title').textContent = amount > 0 ? 'Nedbør den neste timen' : 'Opphold den neste timen';
    $('nowcast-total').textContent = `Totalt ${mmHour(amount)} · radar utilgjengelig`;
    $('nowcast-icon').innerHTML = icon(fc?.summary?.symbol_code, describe(fc?.summary?.symbol_code));
    showChart(card, null);
    return;
  }

  const symbol = nc.timeseries[0].data.next_1_hours?.summary?.symbol_code;
  const steps = nowcastSteps(nc, now);
  const text = nowcastSummary(steps, symbol);
  const total = nowcastTotal(steps);
  const peak = Math.max(...steps.map((s) => s.rate));
  const wet = steps.some((s) => level(s.rate) > 0);
  const nb = (t) => t.replace(' ', ' '); // tall og enhet på samme linje

  $('nowcast-title').textContent = text;
  $('nowcast-total').textContent = wet ? `Totalt ${nb(mmHour(total))} · opptil ${nb(mmHour(peak))}` : `Totalt ${mmHour(0)}`;
  $('nowcast-icon').innerHTML = icon(symbol, describe(symbol));
  showChart(card, wet ? steps : null, `Nedbør de neste 60 minuttene: ${text}, opptil ${mmHour(peak)}.`);
}

// Grafen vises bare når det kommer nedbør den neste timen.
function showChart(card, steps, label) {
  card.classList.toggle('dry', !steps);
  $('nowcast-chart').innerHTML = steps ? areaChart(steps) : '';
  if (label) $('nowcast-chart').setAttribute('aria-label', label);
}

// Myk flatekurve over intensiteten (lineær skala mot timens kraftigste nedbør),
// med stiplede referanselinjer i mm/t så mengden kan leses av.
function areaChart(steps) {
  const W = 780, H = 150;
  const top = Math.max(1, Math.max(...steps.map((s) => s.rate)) * 1.15);
  const clampY = (y) => Math.min(H, Math.max(0, y));
  const pts = steps.map((s, i) => {
    const f = level(s.rate) === 0 ? 0.02 : Math.max(0.04, s.rate / top);
    return [(i / Math.max(1, steps.length - 1)) * W, H * (1 - f)];
  });
  // Catmull-Rom → kubiske Bézier-kurver (kontrollpunktene holdes innenfor grafen).
  let d = `M0 ${H} L${pts[0][0]} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, clampY(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, clampY(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1.map((n) => n.toFixed(1))} ${c2.map((n) => n.toFixed(1))} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  d += ` L${W} ${H} Z`;

  const grid = ticks(top).map((t) =>
    `<div class="gridline" style="bottom:${((t / top) * 100).toFixed(1)}%"><span>${mmHour(t)}</span></div>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>` +
    `<div class="grid" aria-hidden="true">${grid}</div>`;
}

// «Pene» referanseverdier, høyst tre linjer, og ingen helt i toppen av grafen.
function ticks(top) {
  const step = [0.2, 0.5, 1, 2, 5, 10, 20, 50].find((s) => top / s <= 3) ?? 50;
  const out = [];
  for (let t = step; t < top * 0.92; t += step) out.push(Math.round(t * 10) / 10);
  return out;
}

function renderDays(series, now) {
  const days = buildDays(series, now);

  $('days').innerHTML = days.map((d, i) => {
    const { name, date } = dayLabel(d.key, i);
    const cond = describe(d.symbol);
    const full = i <= 1 ? `${name}, ${date}` : `${name} ${date}`;
    return `<li class="day" aria-label="${full}: ${cond}, høyeste ${degC(d.max)}, laveste ${degC(d.min)}">
      <span class="day-date" title="${full}" aria-hidden="true">${dayOfMonth(d.key)}</span>
      <span class="day-icon" title="${cond}" aria-hidden="true">${icon(d.symbol, cond)}</span>
      <span class="day-temp" aria-hidden="true">${degC(d.max)}</span>
    </li>`;
  }).join('');
}
