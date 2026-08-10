# Market Surface

Market Surface is a static, expandable dashboard for reading financial and economic regimes as connected systems. It combines current observations, historical curves, percentile positions and explicit relationship-based interpretations.

The public site has two deliberately separate data layers.

## Public layer

The hosted dataset contains only published outputs from the [Office of Financial Research Financial Stress Index](https://www.financialresearch.gov/financial-stress-index/):

- OFR Financial Stress Index
- Volatility contribution
- Equity valuation contribution
- Credit contribution
- Funding contribution

These are daily market-based stress measures with a two-business-day publication lag. The category contributions help distinguish a market-specific disturbance from stress that is spreading through credit or funding channels.

Source: Office of Financial Research, "OFR Financial Stress Index," refreshed daily. See the [OFR legal notice](https://www.financialresearch.gov/legal-notices/). The hosted file contains OFR's aggregate and category outputs, not the 33 proprietary underlying inputs.

## Private local layer

VIX, VIXEQ, DSPX and COR1M are available only through explicit local CSV selection:

1. The visitor obtains a CSV for their own permitted use.
2. The visitor selects the file with the page's native file control.
3. The browser validates the file and calculates its chart, percentile and statistics locally.
4. The data remain in memory for the current tab and are cleared on reload.

The site does not fetch, host, upload, persist or include those Cboe histories in URLs. It also has no analytics, advertising, remote fonts or third-party scripts. The public application is an independent educational tool and is not affiliated with or endorsed by Cboe.

## Dashboard structure

Indicators are organised into six families:

1. Volatility and market internals
2. Breadth and leadership
3. Credit and liquidity
4. Rates and inflation
5. Growth and the economic cycle
6. Cross-asset confirmation

The catalog already contains a rights-aware roadmap for direct Federal Reserve inputs, calculated yield-curve and rate-volatility measures, the Dallas Fed Weekly Economic Index and other future signals. Planned sources are not promoted to hosted status until their delivery and public-display conditions are resolved.

## What the dashboard shows

- Latest published observation and source date
- Historical curve over selectable periods
- Empirical percentile within the selected history
- Conservative individual interpretation
- Combined regime based on explicit deterministic rules
- Interactive network of methodological and contextual relationships
- Public, local and planned status for each signal family

## Run locally

The project has no build step and no browser-side credentials. Serve the folder with a static web server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Opening `index.html` directly with a `file:` URL is not supported because browsers restrict module and JSON loading from local files.

## Refresh public data

```sh
node scripts/update-data.mjs
```

The updater downloads only the official OFR aggregate and category CSV, validates every required column, creates deterministic compact JSON and writes it atomically.

Run all checks with:

```sh
node scripts/check-publication-readiness.mjs
node --test test/*.test.mjs
git diff --check
```

## Percentile methodology

The dashboard uses midrank:

```text
100 × (observations below the latest value + 0.5 × equal observations) / N
```

The headline percentile uses each hosted indicator's compatible full history. The chart controls recalculate the rank for the selected one-year, five-year or full-history view. A percentile is a historical rank, not a forecast probability.

Locally opened Cboe files accept `YYYY-MM-DD` or `MM/DD/YYYY` dates and reject the complete file if any data row is invalid. With one local indicator, its percentile uses the full validated file history. With several local indicators, every local value, statistic and percentile is recalculated over their shared overlapping date window. The dashboard never combines a newer external quote with an older local percentile history.

## Publication safeguards

- Hosted live indicators must reference a catalog source marked as approved for public display.
- Automated tests require the hosted JSON to contain only the five OFR series.
- Cboe indicators must remain catalog status `local` and absent from the hosted JSON.
- Federal Reserve and derived indicators remain `planned` until an approved ingestion route is implemented.
- The Pages workflow assembles an explicit artifact containing only the files needed by the website.
- The public branch should start from a clean root commit so restricted prototype data are not exposed through Git history.

Public availability of a file is not treated as a republication licence. The rights metadata is an engineering safeguard, not legal advice.

## Deployment

The GitHub Pages workflow runs the publication gate and all tests, assembles the static artifact and deploys it with GitHub's official Pages actions. The scheduled data workflow refreshes OFR data on US business days and commits only when the generated payload changes.

## Project structure

```text
index.html                              Page structure, local-data controls and copy
styles.css                             Responsive visual design
app.js                                 Cards, network, regimes and canvas charts
local-data.mjs                         Browser-only CSV validation and statistics
data/catalog.json                      Indicator metadata, relationships and roadmap
data/indices.json                      Generated public OFR dataset
scripts/update-data.mjs                OFR ingestion and deterministic serialization
scripts/check-publication-readiness.mjs Public-source rights gate
test/local-data.test.mjs               Synthetic local-import tests
test/update-data.test.mjs              Public pipeline tests
test/catalog.test.mjs                  Catalog and publication-boundary tests
.github/workflows/update-data.yml      Scheduled OFR refresh
.github/workflows/deploy-pages.yml     Tested GitHub Pages deployment
```

Educational information only. No investment advice.
