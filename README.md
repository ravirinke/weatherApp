# Bekkværet

Værmelding for Oslo og Trondheim:

- nåværende vær (temperatur, forhold, føles som, vind, luftfuktighet)
- nedbør den neste timen (radarbasert, 5-minutters oppløsning)
- varsel for de neste 7 dagene (symbol, nedbør, vind, laveste/høyeste temperatur)
- bytte mellom Oslo og Trondheim (valget huskes, og kan lenkes til med `#oslo` / `#trondheim`)

## Kjøre

Krever Node.js 18 eller nyere. Ingen avhengigheter å installere.

```
npm start
```

Åpne deretter <http://localhost:4321>. Annen port: `PORT=8080 npm start`
(PowerShell: `$env:PORT=8080; npm start`). På Windows kan du også dobbeltklikke `start.cmd`.

## Teknisk

- `server/` – liten Node-server uten avhengigheter. Serverer `public/` og henter data fra
  Meteorologisk institutt med identifiserende User-Agent og caching etter `Expires`, slik
  [vilkårene](https://api.met.no/doc/TermsOfService) krever.
  - [Locationforecast 2.0](https://api.met.no/weatherapi/locationforecast/2.0/documentation) – nåvær og 7-dagersvarsel
  - [Nowcast 2.0](https://api.met.no/weatherapi/nowcast/2.0/documentation) – nedbør neste time. Hvis radardekning mangler, faller appen tilbake til timesprognosen.
- `shared/cities.js` – bylista, felles for server og nettleser. Nye byer legges til her.
- `public/` – ren HTML/CSS/JS med ES-moduler i `public/js/`. Egne SVG-værikoner tegnet fra METs symbolkoder. Oppdateres automatisk hvert 5. minutt og når fanen blir synlig igjen.

Værdata: © Meteorologisk institutt, lisensiert under CC BY 4.0.
