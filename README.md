# Market Surface

[![Deploy GitHub Pages](https://github.com/Denis-Joly/eco-dashboard/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/Denis-Joly/eco-dashboard/actions/workflows/deploy-pages.yml)
[![Update public economic data](https://github.com/Denis-Joly/eco-dashboard/actions/workflows/update-data.yml/badge.svg)](https://github.com/Denis-Joly/eco-dashboard/actions/workflows/update-data.yml)

Market Surface is a static, expandable dashboard for reading financial and economic regimes as connected systems. It combines current observations, historical curves, percentile positions and explicit relationship-based interpretations.

The public site has two deliberately separate data layers.

## Built with Codex

Market Surface was designed and coded by Denis Joly with assistance from Codex, OpenAI's coding agent. Codex helped with the software architecture, data pipeline, automated tests, interface implementation and deployment review. The project maintainer remains responsible for the product decisions and published content.

## Public layer

The hosted dataset contains only published outputs from the [Office of Financial Research Financial Stress Index](https://www.financialresearch.gov/financial-stress-index/):

- OFR Financial Stress Index
- Volatility contribution
- Equity valuation contribution
- Credit contribution
- Funding contribution

These are daily market-based stress measures with a two-business-day publication lag. The category contributions help distinguish a market-specific disturbance from stress that is spreading through credit or funding channels.

Source: Office of Financial Research, "OFR Financial Stress Index." See the [OFR legal notice](https://www.financialresearch.gov/legal-notices/). The hosted file contains OFR's aggregate and category outputs, not the 33 proprietary underlying inputs.

## Private local layer

VIX, VIXEQ, DSPX and COR1M are available only through explicit local CSV selection:

1. The visitor obtains a CSV for their own permitted use.
2. The visitor selects the file with the page's native file control.
3. The browser validates the file and calculates its chart, percentile and statistics locally.
4. The data remain in memory for the current tab and are cleared on reload.

The site does not fetch, host, upload, persist or include those Cboe histories in URLs. It also has no analytics, advertising, remote fonts or third-party scripts. The public application is an independent educational tool and is not affiliated with or endorsed by Cboe.

## Why Cboe indicators are local-only

The dashboard references four Cboe-published volatility, dispersion and correlation indicators: VIX, VIXEQ, DSPX and COR1M. Their official values and histories are not downloaded, stored or redistributed automatically by this public repository.

This is a deliberate licensing choice. Cboe's [Use of Cboe Content](https://www.cboe.com/use-of-content/) page says that using data or other content contained in its websites requires advance approval. Submitting a request does not itself grant permission. If Cboe chooses to approve a request, Cboe states that authorization is contingent on a license agreement signed by both the applicant and Cboe. Its [website terms](https://www.cboe.com/terms/) also distinguish personal, non-commercial use from broader storage, display, publication and distribution.

Cboe therefore provides a route through which public display may be authorized, but approval is not automatic or guaranteed. The permitted data, display method, audience, duration and any applicable fees would depend on Cboe's decision and the signed agreement. Cboe also publishes a separate [index-data licensing process](https://www.cboe.com/data/global-indices-feed/) for streaming, end-of-day and historical index data.

Until written authorization covering this website is obtained, VIX, VIXEQ, DSPX and COR1M remain private, session-only inputs. A visitor may select locally held CSV files, which are parsed inside that visitor's browser. The files and values are not uploaded to the site, committed to this repository or retained after the page is reloaded.

This project is independent and is not affiliated with, endorsed by or sponsored by Cboe Global Markets. References to index names and tickers are provided for identification and educational context. This explanation documents the project's conservative publishing choice and is not legal advice.

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
- Expandable indicator guide with definitions and reading guidance
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

## Automatic public-data refresh

The [Update public economic data workflow](https://github.com/Denis-Joly/eco-dashboard/actions/workflows/update-data.yml) runs at 16:30 UTC from Monday to Friday. That is 18:30 in Zurich during summer time and 17:30 during winter time. It validates the hosted-source publication status, refreshes the official OFR file, runs the complete test suite and commits only when the generated payload changes.

This is a weekday refresh, not a promise that the displayed source date advances every calendar day. OFR publishes the Financial Stress Index with a two-business-day lag. GitHub also notes that [scheduled workflows can be delayed during periods of high load](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). The badges at the top of this README show the latest workflow results.

The same updater can be run manually:

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

The GitHub Pages workflow runs the publication gate and all tests, assembles the static artifact and deploys it with GitHub's official Pages actions. The scheduled data workflow checks for new OFR data on weekdays and commits only when the generated payload changes.

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
