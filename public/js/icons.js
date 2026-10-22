// Værikoner og norske beskrivelser for METs symbolkoder (f.eks. "lightrainshowers_day").
const C = {
  sun: '#f6c453',
  moon: '#e3e9f3',
  cloud: '#f2f6f9',
  cloudBack: '#b9c7d2',
  cloudDark: '#8d9eae',
  rain: '#62b6e8',
  snow: '#ffffff',
  bolt: '#f6c453',
  fog: '#c9d4dc',
};

const CLOUD = 'M16 48h32a10 10 0 0 0 1.5-19.9a15 15 0 0 0-28.6-3.6A11.5 11.5 0 0 0 16 48z';

function sun(cx, cy, r) {
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const x1 = cx + Math.cos(a) * (r + 4), y1 = cy + Math.sin(a) * (r + 4);
    const x2 = cx + Math.cos(a) * (r + 8), y2 = cy + Math.sin(a) * (r + 8);
    rays += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }
  return `<g class="i-sun"><g stroke="${C.sun}" stroke-width="3" stroke-linecap="round">${rays}</g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.sun}"/></g>`;
}

function moon(cx, cy, r) {
  // Månesigd: sirkel minus forskjøvet sirkel.
  const id = 'm' + Math.random().toString(36).slice(2, 8);
  return `<g class="i-moon"><mask id="${id}"><rect width="64" height="64" fill="#fff"/><circle cx="${cx + r * 0.55}" cy="${cy - r * 0.45}" r="${r * 0.85}" fill="#000"/></mask>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.moon}" mask="url(#${id})"/></g>`;
}

function cloud(tx, ty, s, fill) {
  return `<path d="${CLOUD}" fill="${fill}" transform="translate(${tx} ${ty}) scale(${s})"/>`;
}

function drops(n, y) {
  const xs = { 1: [32], 2: [26, 38], 3: [22, 32, 42], 4: [18, 27, 36, 45] }[n];
  return xs.map((x, i) => {
    const yy = y + (i % 2) * 4;
    return `<line x1="${x + 2}" y1="${yy}" x2="${x - 2}" y2="${yy + 8}" stroke="${C.rain}" stroke-width="3" stroke-linecap="round"/>`;
  }).join('');
}

function flake(x, y) {
  const r = 3.6;
  let s = '';
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 2;
    const dx = (Math.cos(a) * r).toFixed(1), dy = (Math.sin(a) * r).toFixed(1);
    s += `<line x1="${x - dx}" y1="${y - dy}" x2="${x + +dx}" y2="${y + +dy}"/>`;
  }
  return `<g stroke="${C.snow}" stroke-width="2" stroke-linecap="round">${s}</g>`;
}

function flakes(n, y) {
  const xs = { 1: [32], 2: [26, 38], 3: [22, 32, 42], 4: [18, 27, 36, 45] }[n];
  return xs.map((x, i) => flake(x, y + 4 + (i % 2) * 5)).join('');
}

function sleet(n, y) {
  const xs = { 1: [32], 2: [26, 38], 3: [22, 32, 42], 4: [18, 27, 36, 45] }[n];
  return xs.map((x, i) => (i % 2
    ? flake(x, y + 8)
    : `<line x1="${x + 2}" y1="${y}" x2="${x - 2}" y2="${y + 8}" stroke="${C.rain}" stroke-width="3" stroke-linecap="round"/>`)).join('');
}

const bolt = `<path d="M34 40l-7 11h6l-3 10 9-13h-6l4-8z" fill="${C.bolt}"/>`;

export function parse(symbol) {
  const [base = 'cloudy', variant = 'day'] = String(symbol || '').split('_');
  const thunder = base.includes('andthunder');
  const core = base.replace('andthunder', '');
  const intensity = core.startsWith('light') ? 'light' : core.startsWith('heavy') ? 'heavy' : 'normal';
  const kind = core.replace(/^(light|heavy)/, '');
  const showers = kind.endsWith('showers');
  const precip = kind.replace('showers', ''); // rain | sleet | snow | annet
  return { base, variant, thunder, intensity, kind, showers, precip };
}

export function icon(symbol, label) {
  const p = parse(symbol);
  const night = p.variant === 'night';
  const celestial = (cx, cy, r) => (night ? moon(cx, cy, r) : sun(cx, cy, r));
  let g = '';

  if (p.base === 'clearsky') {
    g = celestial(32, 32, 12);
  } else if (p.base === 'fair') {
    g = celestial(26, 25, 10) + cloud(14, 16, 0.72, C.cloud);
  } else if (p.base === 'partlycloudy') {
    g = celestial(22, 22, 10) + cloud(4, 6, 0.9, C.cloud);
  } else if (p.base === 'cloudy') {
    g = cloud(10, -6, 0.85, C.cloudBack) + cloud(-2, 4, 0.95, C.cloud);
  } else if (p.base === 'fog') {
    g = cloud(0, -8, 1, C.cloudBack) +
      `<g stroke="${C.fog}" stroke-width="3" stroke-linecap="round"><line x1="12" y1="47" x2="52" y2="47"/><line x1="16" y1="54" x2="48" y2="54"/></g>`;
  } else if (['rain', 'sleet', 'snow'].includes(p.precip)) {
    const n = p.intensity === 'light' ? 2 : p.intensity === 'heavy' ? 4 : 3;
    const top = p.showers ? celestial(20, 17, 8.5) : '';
    const fill = p.intensity === 'heavy' || p.thunder ? C.cloudDark : p.showers ? C.cloud : C.cloudBack;
    const fall = p.precip === 'rain' ? drops(n, 46) : p.precip === 'snow' ? flakes(n, 46) : sleet(n, 46);
    g = top + cloud(0, -10, 1, fill) + fall + (p.thunder ? bolt : '');
  } else {
    g = cloud(0, 0, 1, C.cloud);
  }

  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="wx-icon" viewBox="0 0 64 64" ${a11y}>${g}</svg>`;
}

const WORDS = {
  clearsky: 'Klarvær',
  fair: 'Lettskyet',
  partlycloudy: 'Delvis skyet',
  cloudy: 'Skyet',
  fog: 'Tåke',
  rain: 'Regn',
  sleet: 'Sludd',
  snow: 'Snø',
  rainshowers: 'Regnbyger',
  sleetshowers: 'Sluddbyger',
  snowshowers: 'Snøbyger',
};

export function describe(symbol) {
  const p = parse(symbol);
  let text = WORDS[p.kind] || WORDS[p.base] || 'Ukjent';
  if (p.intensity === 'light') text = 'Lett' + (p.showers ? 'e ' : ' ') + text.toLowerCase();
  if (p.intensity === 'heavy') text = 'Kraftig' + (p.showers ? 'e ' : ' ') + text.toLowerCase();
  if (p.thunder) text += ' og torden';
  return text;
}
