# Bekkværet

Værmelding for Oslo og Trondheim: nåvær, nedbør neste time og 7-dagersvarsel.

## Stack
- Node.js ≥ 18, kun innebygde moduler (`http`, `fs`, global `fetch`). Ingen npm-avhengigheter.
- Frontend: ren HTML/CSS/JavaScript uten byggesteg eller rammeverk.
- Data: Meteorologisk institutt (api.met.no) – Locationforecast 2.0 (nåvær + 7 dager)
  og Nowcast 2.0 (nedbør neste time, radar). Lisens CC BY 4.0.

## Kjøre
- `npm start` → http://localhost:4321 (annen port: `PORT=8080`). Windows: `start.cmd`.
- Statiske filer leses per forespørsel; endringer i `public/` krever bare oppfrisking.
  Endringer i `server.js` krever omstart.

## Teste
Ingen automatiske tester. Verifiser manuelt:
- `node --check server.js public/app.js public/icons.js`
- `curl "http://localhost:4321/api/weather?city=oslo"` (og `trondheim`; ukjent by → 400)
- Se på siden i nettleser, både bred skjerm og ~375 px bredde, for begge byene.

## Struktur
- `server.js` – server: statiske filer + `/api/weather?city=`, MET-proxy med cache.
- `public/index.html` – markup.
- `public/app.js` – henting, byvalg, aggregering per dag, visning.
- `public/icons.js` – SVG-ikoner, norske beskrivelser og tema fra METs symbolkoder.
- `public/style.css` – alt av stil; temaer via `body[data-theme]`.

## Regler
- Ikke legg til npm-avhengigheter, rammeverk eller byggesteg uten å spørre først.
- Overhold METs vilkår: behold identifiserende `User-Agent`, respekter `Expires`-cache,
  og behold kildehenvisningen til Meteorologisk institutt i bunnteksten.
- All tekst brukeren ser skal være på norsk bokmål; tid vises i `Europe/Oslo`.
- Nye byer legges til i både `CITIES` i `server.js` og `CITIES` + knapp i frontend.
- Verifiser endringer i nettleser før du sier at noe er ferdig.
