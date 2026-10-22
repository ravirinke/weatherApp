// Bekkværet – oppstart, byvelger, henting og automatisk oppdatering.
import { CITIES, DEFAULT_CITY } from '/shared/cities.js';
import { render, renderError } from './render.js';

const REFRESH_MS = 5 * 60_000;
const KEYS = Object.keys(CITIES);
const STORAGE_KEY = 'bekkvaeret.city';

let city = initialCity();
let requestId = 0;
let timer = null;

function initialCity() {
  const fromHash = location.hash.replace('#', '').toLowerCase();
  if (KEYS.includes(fromHash)) return fromHash;
  const saved = localStorage.getItem(STORAGE_KEY);
  return KEYS.includes(saved) ? saved : DEFAULT_CITY;
}

// ---------- Byvelger (bygges fra shared/cities.js) ----------
const switchEl = document.querySelector('.switch');
switchEl.insertAdjacentHTML('afterbegin', KEYS.map((key) =>
  `<button type="button" role="radio" data-city="${key}" aria-checked="false">${CITIES[key].label ?? CITIES[key].name}</button>`).join(''));
const buttons = [...switchEl.querySelectorAll('button')];

function setCity(next, { focus = false } = {}) {
  if (!KEYS.includes(next)) return;
  city = next;
  localStorage.setItem(STORAGE_KEY, city);
  if (location.hash !== `#${city}`) history.replaceState(null, '', `#${city}`);
  buttons.forEach((b) => {
    const on = b.dataset.city === city;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  });
  load();
}

buttons.forEach((b) => b.addEventListener('click', () => setCity(b.dataset.city)));
switchEl.addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault();
  const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
  const i = (KEYS.indexOf(city) + dir + KEYS.length) % KEYS.length;
  setCity(KEYS[i], { focus: true });
});
window.addEventListener('hashchange', () => {
  const h = location.hash.replace('#', '').toLowerCase();
  if (KEYS.includes(h) && h !== city) setCity(h);
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
    renderError(null);
  } catch (err) {
    if (id !== requestId) return;
    renderError(`Klarte ikke å hente været akkurat nå (${err.message}). Prøver igjen snart.`);
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

setCity(city);
