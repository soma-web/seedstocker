# Used Services
- webshare.io for proxy if the scraper gets 429 returned
- OpenAI for ai generation, usage can be found here: https://platform.openai.com/usage

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.


## Tools

### Preise für einen bestimmten Shop aktualisieren (z.B. Gas Station LU)
node server/src/run-url-price-scraper.js --shop="Gas Station Lu"
### Nur Angebote aktualisieren, die älter als 24 Stunden sind
node server/src/run-url-price-scraper.js --max-age-hours=24
### Testlauf ohne Datenbankänderungen (Dry Run)
node server/src/run-url-price-scraper.js --shop="Zamnesia" --dry-run --limit=10  --strain-id "STRAINID"

### Preis-Varianz-Report exportieren (speichert in server/logs/price_history_variance.txt)
node server/src/export-price-variance-report.js