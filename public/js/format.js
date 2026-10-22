// Enheter, tall og datoer. Følger reglene i .claude/skills/bekkvaer-enheter.
// Ingen DOM her, så modulen kan også brukes fra Node.
export const TZ = 'Europe/Oslo';

const fmtKey = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHour = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' });
const fmtClock = new Intl.DateTimeFormat('nb-NO', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const fmtWeekday = new Intl.DateTimeFormat('nb-NO', { timeZone: TZ, weekday: 'long' });
const fmtDate = new Intl.DateTimeFormat('nb-NO', { timeZone: TZ, day: 'numeric', month: 'long' });
const fmtNum = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });

// Lokal dato i Oslo som "YYYY-MM-DD" – brukes som nøkkel for dager.
export const dayKey = (d) => fmtKey.format(d);
export const localHour = (d) => Number(fmtHour.format(d));
export const clock = (d) => fmtClock.format(d);

export const round = (n) => Math.round(n);
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const degC = (n) => `${round(n)} °C`;
const mmNum = (n) => fmtNum.format(Math.round(n * 10) / 10);
export const mmHour = (n) => `${mmNum(n)} mm/t`;
export const mmDay = (n) => `${mmNum(n)} mm/døgn`;

export function compass(deg) {
  const names = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'];
  return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

// «I dag» / «torsdag 22. oktober», «Lørdag» / «24. oktober».
export function dayLabel(key, i) {
  const d = new Date(`${key}T12:00:00Z`);
  const weekday = fmtWeekday.format(d);
  if (i <= 1) return { name: i === 0 ? 'I dag' : 'I morgen', date: `${weekday} ${fmtDate.format(d)}` };
  return { name: cap(weekday), date: fmtDate.format(d) };
}
