# Bekkværet

Værmelding for Oslo og Trondheim: nåvær, nedbør neste time og 7-dagersvarsel.

## Stack
- Node.js ≥ 18, kun innebygde moduler (`http`, `fs`, global `fetch`). Ingen npm-avhengigheter.
- Frontend: ren HTML/CSS/JavaScript (ES-moduler) uten byggesteg eller rammeverk.
- Data: Meteorologisk institutt (api.met.no) – Locationforecast 2.0 (nåvær + 7 dager)
  og Nowcast 2.0 (nedbør neste time, radar). Lisens CC BY 4.0.

## Kjøre
- `npm start` → http://localhost:4321 (annen port: `PORT=8080`). Windows: `start.cmd`.
- Statiske filer leses per forespørsel; endringer i `public/` krever bare oppfrisking.
  Endringer i `server/` eller `shared/` krever omstart.

## Teste
Ingen automatiske tester. Verifiser manuelt:
- `node --check` på endrede filer. `forecast.js` og `format.js` kan importeres direkte i Node.
- `curl "http://localhost:4321/api/weather?city=oslo"` (og `trondheim`; ukjent by → 400)
- Se på siden i nettleser for begge byene. PC er viktigst; sjekk ~375 px bredde ved layoutendringer.

## Struktur
- `server/index.js` – oppstart, ruting, statiske filer (`public/` og `/shared/`), `/api/weather?city=`.
- `server/met.js` – MET-klient: User-Agent og `Expires`-cache.
- `shared/cities.js` – bylista, brukt av både server og nettleser.
- `public/js/main.js` – oppstart, byvelger, henting, automatisk oppdatering.
- `public/js/render.js` – alt som rører DOM.
- `public/js/forecast.js` – ren logikk: nåvær, nedbør neste time, dagssammendrag. Ingen DOM.
- `public/js/format.js` – enheter og datoer. Ingen DOM.
- `public/js/icons.js` – SVG-ikoner, norske beskrivelser og tema fra METs symbolkoder.
- `public/style.css` – alt av stil; temaer via `body[data-theme]`.

## Regler
- Ikke legg til npm-avhengigheter, rammeverk eller byggesteg uten å spørre først.
- Overhold METs vilkår: behold identifiserende `User-Agent`, respekter `Expires`-cache,
  og behold kildehenvisningen til Meteorologisk institutt i bunnteksten.
- All tekst brukeren ser skal være på norsk bokmål; tid vises i `Europe/Oslo`.
- Nye byer legges kun til i `shared/cities.js`.
- Enheter og formater går gjennom `public/js/format.js` og følger skillen `bekkvaer-enheter`.
- Hold `forecast.js` og `format.js` fri for DOM, så de kan brukes fra Node.
- Verifiser endringer i nettleser før du sier at noe er ferdig.
