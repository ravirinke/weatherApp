// Alt som skriver til siden.
import { icon, describe, theme } from './icons.js';
import { clock, compass, dayLabel, degC, mmDay, mmHour, round } from './format.js';
import {
  buildDays, currentConditions, currentEntry, level, nowcastSteps, nowcastSummary, usableNowcast,
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
  $('now-feels').textContent = degC(c.feels ?? c.temp);
  $('now-wind').innerHTML = c.wind != null
    ? `${round(c.wind)} m/s ${c.dir != null ? `<span class="wind-arrow" style="--deg:${c.dir}deg" title="Vind fra ${compass(c.dir)}">↓</span> ${compass(c.dir)}` : ''}` +
      (c.gust != null && c.gust - c.wind >= 3 ? `<span class="sub">kast ${round(c.gust)} m/s</span>` : '')
    : '–';
  $('now-humidity').textContent = c.humidity != null ? `${round(c.humidity)} %` : '–';
  $('now-precip').textContent = c.precip != null ? mmHour(c.precip) : '–';

  document.body.dataset.theme = theme(c.symbol);
  $('updated').textContent = `Oppdatert kl. ${clock(now)}`;
}

function renderNowcast(series, nc, now) {
  const chart = $('nowcast-chart');
  const summary = $('nowcast-summary');

  if (!nc) {
    const amount = currentEntry(series, now).data.next_1_hours?.details?.precipitation_amount ?? 0;
    $('nowcast-source').textContent = 'Radar utilgjengelig – viser timesprognose';
    summary.textContent = amount > 0 ? `Ventet ${mmHour(amount)} nedbør den neste timen.` : 'Ingen nedbør ventet den neste timen.';
    chart.innerHTML = '';
    chart.classList.add('empty');
    return;
  }

  const steps = nowcastSteps(nc, now);
  const text = nowcastSummary(steps, nc.timeseries[0].data.next_1_hours?.summary?.symbol_code);
  summary.textContent = text;
  $('nowcast-source').textContent = 'Radarvarsel, 5-minutters oppløsning';

  const maxLog = Math.log1p(8);
  chart.classList.remove('empty');
  chart.innerHTML = steps.map((s) => {
    const lv = level(s.rate);
    const h = lv === 0 ? 0 : 10 + 90 * Math.min(1, Math.log1p(s.rate) / maxLog);
    const label = `kl. ${clock(s.time)}: ${lv === 0 ? 'opphold' : mmHour(s.rate)}`;
    return `<div class="bar lv${lv}" title="${label}"><span style="height:${h.toFixed(1)}%"></span></div>`;
  }).join('');
  chart.setAttribute('aria-label', `Nedbør de neste 60 minuttene. ${text}`);
}

function renderDays(series, now) {
  const days = buildDays(series, now);
  const wMin = Math.min(...days.map((d) => d.min));
  const wMax = Math.max(...days.map((d) => d.max));
  const span = Math.max(1, wMax - wMin);

  $('days').innerHTML = days.map((d, i) => {
    const { name, date } = dayLabel(d.key, i);
    const cond = describe(d.symbol);
    const left = ((d.min - wMin) / span) * 100;
    const width = Math.max(4, ((d.max - d.min) / span) * 100);
    const p = Math.round(d.precip * 10) / 10;
    return `<li class="day">
      <div class="day-name"><strong>${name}</strong><span>${date}</span></div>
      <div class="day-icon" title="${cond}">${icon(d.symbol, cond)}</div>
      <div class="day-precip ${p > 0 ? 'wet' : ''}">${p > 0 ? mmDay(p) : '–'}</div>
      <div class="day-wind">${round(d.wind)} m/s</div>
      <div class="day-temps" aria-label="Laveste ${round(d.min)} grader, høyeste ${round(d.max)} grader">
        <span class="t-min">${degC(d.min)}</span>
        <span class="range"><i style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%"></i></span>
        <span class="t-max ${d.max < 0 ? 'cold' : ''}">${degC(d.max)}</span>
      </div>
    </li>`;
  }).join('');
}
