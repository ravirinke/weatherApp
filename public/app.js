// Bekkværet – frontend.
(function () {
  const TZ = 'Europe/Oslo';
  const REFRESH_MS = 5 * 60_000;
  const CITIES = ['oslo', 'trondheim'];
  const { icon, describe, theme, parse } = window.WxIcons;

  const $ = (id) => document.getElementById(id);
  const fmtKey = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const fmtHour = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' });
  const fmtClock = new Intl.DateTimeFormat('nb-NO', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const fmtWeekday = new Intl.DateTimeFormat('nb-NO', { timeZone: TZ, weekday: 'long' });
  const fmtDate = new Intl.DateTimeFormat('nb-NO', { timeZone: TZ, day: 'numeric', month: 'long' });
  const fmtNum = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });

  const dayKey = (d) => fmtKey.format(d);
  const localHour = (d) => Number(fmtHour.format(d));
  const round = (n) => Math.round(n);
  // Enheter og format: se .claude/skills/bekkvaer-enheter.
  const degC = (n) => `${round(n)} °C`;
  const mmNum = (n) => fmtNum.format(Math.round(n * 10) / 10);
  const mmHour = (n) => `${mmNum(n)} mm/t`;
  const mmDay = (n) => `${mmNum(n)} mm/døgn`;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  let city = initialCity();
  let requestId = 0;
  let timer = null;

  function initialCity() {
    const fromHash = location.hash.replace('#', '').toLowerCase();
    if (CITIES.includes(fromHash)) return fromHash;
    const saved = localStorage.getItem('bekkvaeret.city');
    return CITIES.includes(saved) ? saved : 'oslo';
  }

  // ---------- Byvelger ----------
  const switchEl = document.querySelector('.switch');
  const buttons = [...switchEl.querySelectorAll('button')];

  function setCity(next, { focus = false } = {}) {
    if (!CITIES.includes(next)) return;
    city = next;
    localStorage.setItem('bekkvaeret.city', city);
    if (location.hash !== `#${city}`) history.replaceState(null, '', `#${city}`);
    buttons.forEach((b) => {
      const on = b.dataset.city === city;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    switchEl.dataset.active = String(CITIES.indexOf(city));
    load();
  }

  buttons.forEach((b) => b.addEventListener('click', () => setCity(b.dataset.city)));
  switchEl.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    const i = (CITIES.indexOf(city) + dir + CITIES.length) % CITIES.length;
    setCity(CITIES[i], { focus: true });
  });
  window.addEventListener('hashchange', () => {
    const h = location.hash.replace('#', '').toLowerCase();
    if (CITIES.includes(h) && h !== city) setCity(h);
  });

  // ---------- Henting ----------
  async function load() {
    const id = ++requestId;
    document.body.classList.add('loading');
    clearTimeout(timer);
    try {
      const res = await fetch(`/api/weather?city=${city}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Feil ${res.status}`);
      if (id !== requestId) return; // brukeren har byttet by i mellomtiden
      render(data);
      $('error').hidden = true;
    } catch (err) {
      if (id !== requestId) return;
      $('error').textContent = `Klarte ikke å hente været akkurat nå (${err.message}). Prøver igjen snart.`;
      $('error').hidden = false;
    } finally {
      if (id === requestId) {
        document.body.classList.remove('loading');
        timer = setTimeout(load, REFRESH_MS);
      }
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') load();
  });

  // ---------- Visning ----------
  function render(data) {
    const series = data.forecast.properties.timeseries;
    const now = new Date();
    const nc = data.nowcast?.properties;
    const ncOk = nc && nc.meta?.radar_coverage === 'ok' && nc.timeseries?.length;

    $('city-name').textContent = data.city.name;
    document.title = `${data.city.name} – Bekkværet`;

    renderNow(series, ncOk ? nc : null, now);
    renderNowcast(series, ncOk ? nc : null, now);
    renderDays(series, now);
  }

  function currentEntry(series, now) {
    // Siste tidssteg som har startet, ellers det første.
    let pick = series[0];
    for (const e of series) {
      if (new Date(e.time) <= now) pick = e;
      else break;
    }
    return pick;
  }

  function renderNow(series, nc, now) {
    const fc = currentEntry(series, now);
    const fcInst = fc.data.instant.details;
    const ncFirst = nc?.timeseries[0]?.data;
    const ncInst = ncFirst?.instant?.details || {};

    const symbol = ncFirst?.next_1_hours?.summary?.symbol_code
      || fc.data.next_1_hours?.summary?.symbol_code
      || fc.data.next_6_hours?.summary?.symbol_code;
    const temp = ncInst.air_temperature ?? fcInst.air_temperature;
    const feels = ncInst.apparent_air_temperature;
    const wind = ncInst.wind_speed ?? fcInst.wind_speed;
    const gust = ncInst.wind_speed_of_gust;
    const dir = ncInst.wind_from_direction ?? fcInst.wind_from_direction;
    const hum = ncInst.relative_humidity ?? fcInst.relative_humidity;
    const precip = ncFirst?.next_1_hours?.details?.precipitation_amount
      ?? fc.data.next_1_hours?.details?.precipitation_amount;

    const cond = describe(symbol);
    $('now-icon').innerHTML = icon(symbol, cond);
    $('now-temp').textContent = round(temp);
    $('now-cond').textContent = cond;
    $('now-feels').textContent = degC(feels ?? temp);
    $('now-wind').innerHTML = wind != null
      ? `${round(wind)} m/s ${dir != null ? `<span class="wind-arrow" style="--deg:${dir}deg" title="Vind fra ${compass(dir)}">↓</span> ${compass(dir)}` : ''}` +
        (gust != null && gust - wind >= 3 ? `<span class="sub">kast ${round(gust)} m/s</span>` : '')
      : '–';
    $('now-humidity').textContent = hum != null ? `${round(hum)} %` : '–';
    $('now-precip').textContent = precip != null ? mmHour(precip) : '–';

    document.body.dataset.theme = theme(symbol);
    $('updated').textContent = `Oppdatert kl. ${fmtClock.format(now)}`;
  }

  function compass(deg) {
    const names = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'];
    return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
  }

  function level(rate) {
    if (rate < 0.1) return 0;
    if (rate < 1) return 1;
    if (rate < 4) return 2;
    return 3;
  }

  function renderNowcast(series, nc, now) {
    const chart = $('nowcast-chart');
    const summary = $('nowcast-summary');

    if (!nc) {
      const fc = currentEntry(series, now);
      const amount = fc.data.next_1_hours?.details?.precipitation_amount ?? 0;
      $('nowcast-source').textContent = 'Radar utilgjengelig – viser timesprognose';
      summary.textContent = amount > 0 ? `Ventet ${mmHour(amount)} nedbør den neste timen.` : 'Ingen nedbør ventet den neste timen.';
      chart.innerHTML = '';
      chart.classList.add('empty');
      return;
    }

    // Tidssteg på 5 minutter fra nå og 60 minutter frem.
    const start = now.getTime() - 5 * 60_000;
    const steps = nc.timeseries
      .filter((e) => new Date(e.time).getTime() > start)
      .slice(0, 12)
      .map((e) => ({ time: new Date(e.time), rate: e.data.instant.details.precipitation_rate ?? 0 }));

    const wet = steps.map((s) => s.rate >= 0.1);
    const total = steps.reduce((sum, s) => sum + (s.rate * 5) / 60, 0);
    const sym = parse(nc.timeseries[0].data.next_1_hours?.summary?.symbol_code);
    const word = { rain: 'regn', sleet: 'sludd', snow: 'snø' }[sym.precip] || 'nedbør';

    let text;
    const firstWet = wet.indexOf(true);
    const firstDry = wet.indexOf(false);
    if (firstWet === -1) {
      text = 'Opphold den neste timen.';
    } else if (firstDry === -1) {
      text = `${cap(word)} hele den neste timen, i snitt ca. ${mmHour(total)}.`;
    } else if (wet[0]) {
      const again = wet.indexOf(true, firstDry) !== -1;
      text = `${cap(word)} nå, opphold om ca. ${firstDry * 5} min${again ? ', men mer kommer senere' : ''}.`;
    } else {
      text = `${cap(word)} om ca. ${firstWet * 5} min, i snitt ca. ${mmHour(total)} den neste timen.`;
    }
    summary.textContent = text;
    $('nowcast-source').textContent = 'Radarvarsel, 5-minutters oppløsning';

    const maxLog = Math.log1p(8);
    chart.classList.remove('empty');
    chart.innerHTML = steps.map((s) => {
      const lv = level(s.rate);
      const h = lv === 0 ? 0 : 10 + 90 * Math.min(1, Math.log1p(s.rate) / maxLog);
      const label = `kl. ${fmtClock.format(s.time)}: ${lv === 0 ? 'opphold' : mmHour(s.rate)}`;
      return `<div class="bar lv${lv}" title="${label}"><span style="height:${h.toFixed(1)}%"></span></div>`;
    }).join('');
    chart.setAttribute('aria-label', `Nedbør de neste 60 minuttene. ${text}`);
  }

  function buildDays(series, now) {
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

    return [...days.values()].slice(0, 7).map((d) => {
      // Representativt symbol: 6-timersblokken nærmest midt på dagen.
      const pool = d.candidates.filter((c) => c.six).length ? d.candidates.filter((c) => c.six) : d.candidates;
      pool.sort((a, b) => Math.abs(a.hour - 12) - Math.abs(b.hour - 12));
      return { ...d, symbol: pool[0]?.sym || 'cloudy' };
    });
  }

  // «I dag» / «torsdag 22. oktober», «Lørdag» / «24. oktober».
  function dayLabel(key, i) {
    const d = new Date(`${key}T12:00:00Z`);
    const weekday = fmtWeekday.format(d);
    if (i <= 1) return { name: i === 0 ? 'I dag' : 'I morgen', date: `${weekday} ${fmtDate.format(d)}` };
    return { name: cap(weekday), date: fmtDate.format(d) };
  }

  function renderDays(series, now) {
    const days = buildDays(series, now).filter((d) => Number.isFinite(d.min));
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

  setCity(city);
})();
