# Market Surface

[![Deploy GitHub Pages](https://github.com/Denis-Joly/eco-dashboard/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/Denis-Joly/eco-dashboard/actions/workflows/deploy-pages.yml)
[![Update public economic data](https://github.com/Denis-Joly/eco-dashboard/actions/workflows/update-data.yml/badge.svg)](https://github.com/Denis-Joly/eco-dashboard/actions/workflows/update-data.yml)

Market Surface is a static, expandable dashboard for reading financial and economic regimes as connected systems. It combines current observations, historical curves, percentile positions and explicit relationship-based interpretations.

The public site has two deliberately separate data layers.

## Public layer

The hosted dataset combines official, openly reusable government outputs from four public institutions:

- [Office of Financial Research](https://www.financialresearch.gov/financial-stress-index/): the aggregate OFR Financial Stress Index and its complete five-category decomposition
- [Federal Reserve H.15](https://www.federalreserve.gov/releases/h15/): 2-year and 10-year nominal Treasury yields, the calculated 10Y minus 2Y curve, the 10-year real yield, a nominal-real inflation-compensation proxy, and 20-observation realized 10-year yield volatility
- [Federal Reserve H.10](https://www.federalreserve.gov/releases/h10/): the Nominal Broad U.S. Dollar Index
- [U.S. Bureau of Labor Statistics](https://www.bls.gov/): headline CPI, used to calculate its 12-month change, and the one-month private-employment diffusion index
- [U.S. Commodity Futures Trading Commission](https://www.cftc.gov/MarketReports/CommitmentsofTraders/): leveraged funds' net E-mini S&P 500 futures positioning as a percentage of total open interest

The OFR categories are presented as signed contributions to one aggregate indicator, not as five independent headline signals. Positive contributions add stress and negative contributions offset it.

The public network connects systemic stress, Treasury yields, curve shape, rate volatility, inflation, equity positioning, employment breadth and the dollar. These families answer different questions and should be interpreted together. For example, rising OFR stress with elevated rate volatility tells a different story from net-short leveraged positioning with broad employment growth and subdued financial stress.

Sources and reuse notes: Office of Financial Research, "OFR Financial Stress Index," under the [OFR legal notice](https://www.financialresearch.gov/legal-notices/); Board of Governors of the Federal Reserve System, H.15 and H.10 statistical releases, under the [Board disclaimer](https://www.federalreserve.gov/disclaimer.htm); U.S. Bureau of Labor Statistics, under the [BLS copyright policy](https://www.bls.gov/opub/copyright-information.htm); and U.S. Commodity Futures Trading Commission, under the [CFTC web policy](https://www.cftc.gov/WebPolicy/index.htm). The hosted file contains only published outputs and documented dashboard calculations, not OFR's 33 proprietary underlying inputs or proprietary stock-index levels. The access date is retained in the generated payload. As required by the BLS API terms: "BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov."

## Display-only market context

The site includes a sandboxed, provider-hosted TradingView widget for S&P 500 futures, Nasdaq 100 futures, 10-year Treasury note futures and a continuous front VIX futures series. It gives current or delayed market context according to the provider's entitlements.

This display is deliberately separate from the analytical dataset. Market Surface cannot read, store or export the widget values, so they do not drive histories, percentiles, network evidence or regime classifications. Loading the panel connects the visitor to TradingView under TradingView's own policies and attribution.

## Private local layer

VIX, VIXEQ, DSPX and COR1M are available only through explicit local CSV selection:

1. The visitor obtains a CSV for their own permitted use.
2. The visitor selects the file with the page's native file control.
3. The browser validates the file and calculates its chart, percentile and statistics locally.
4. The data remain in memory for the current tab and are cleared on reload.

The site does not fetch, host, upload, persist or include those Cboe histories in URLs. The analytical application has no analytics, advertising or remote fonts. The optional market display is isolated in a sandboxed frame and does not have access to locally opened files. The public application is an independent educational tool and is not affiliated with or endorsed by Cboe.

## Why Cboe indicators are local-only

The dashboard references four Cboe-published volatility, dispersion and correlation indicators: VIX, VIXEQ, DSPX and COR1M. Their official values and histories are not downloaded, stored or redistributed automatically by this public repository.

This is a deliberate licensing choice. Cboe's [Use of Cboe Content](https://www.cboe.com/use-of-content/) page says that using data or other content contained in its websites requires advance approval. Submitting a request does not itself grant permission. If Cboe chooses to approve a request, Cboe states that authorization is contingent on a license agreement signed by both the applicant and Cboe. Its [website terms](https://www.cboe.com/terms/) also distinguish personal, non-commercial use from broader storage, display, publication and distribution.

Cboe therefore provides a route through which public display may be authorized, but approval is not automatic or guaranteed. The permitted data, display method, audience, duration and any applicable fees would depend on Cboe's decision and the signed agreement. Cboe also publishes a separate [index-data licensing process](https://www.cboe.com/data/global-indices-feed/) for streaming, end-of-day and historical index data.

Until written authorization covering this website is obtained, VIX, VIXEQ, DSPX and COR1M remain private, session-only inputs. A visitor may select locally held CSV files, which are parsed inside that visitor's browser. The files and values are not uploaded to the site, committed to this repository or retained after the page is reloaded.

Yahoo Finance is not used as a workaround. Yahoo does not publish an official Finance market-data API in its [developer API catalog](https://developer.yahoo.com/api/), and its [market-data help page](https://help.yahoo.com/kb/exchanges-data-providers-yahoo-finance-sln2310.html) says that information displayed on or provided by Yahoo Finance must not be redistributed. Fetching a Cboe value from an undocumented Yahoo endpoint would also not remove Cboe's underlying rights. Technical access is not treated as publication permission.

This project is independent and is not affiliated with, endorsed by or sponsored by Cboe Global Markets. References to index names and tickers are provided for identification and educational context. This explanation documents the project's conservative publishing choice and is not legal advice.

## Dashboard structure

Indicators are organised into six families:

1. Volatility and market internals
2. Equities, breadth and leadership
3. Credit and liquidity
4. Rates, bonds and inflation
5. Growth and the economic cycle
6. Cross-asset confirmation

The catalog contains a rights-aware roadmap for additional volatility, breadth, credit, rates and real-economy signals. Planned sources are not promoted to hosted status until their delivery and public-display conditions are resolved.

## What the dashboard shows

- Latest published observation and source date
- Historical curve over selectable periods
- Empirical percentile within the selected history
- Conservative individual interpretation
- Expandable indicator guide with definitions and reading guidance
- Combined regime based on explicit deterministic rules
- Interactive network of methodological and contextual relationships
- Overview, equities, bonds and volatility network views
- Public, local and planned status for each signal family

## Run locally

The project has no build step and no browser-side credentials. Serve the folder with a static web server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Opening `index.html` directly with a `file:` URL is not supported because browsers restrict module and JSON loading from local files.

## Automatic public-data refresh

The [Update public economic data workflow](https://github.com/Denis-Joly/eco-dashboard/actions/workflows/update-data.yml) runs at 22:30 UTC from Monday to Friday. That is 00:30 the next day in Zurich during summer time and 23:30 during winter time. This timing is after the Federal Reserve's 4:15 p.m. Eastern statistical releases in both seasons and after the usual Friday CFTC release. The workflow validates source publication status, refreshes every official input, runs the complete test suite and commits only when the generated payload changes.

This is a weekday check, not a promise that every displayed source date advances daily. OFR has a two-business-day lag, H.10 updates weekly, and BLS indicators update monthly. GitHub also notes that [scheduled workflows can be delayed during periods of high load](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). Each card shows its own observation date.

The same updater can be run manually:

```sh
node scripts/update-data.mjs
```

The updater downloads the official OFR CSV, Federal Reserve H.15 and H.10 release archives, keyless BLS API results and the CFTC Traders in Financial Futures dataset for E-mini S&P 500 contract 13874A. It validates the required series, calculates only documented transformations, creates deterministic compact JSON and writes it atomically. A local manual run needs the standard `unzip` command, which is already available on GitHub's Ubuntu runner.

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

The headline percentile uses each hosted indicator's configured compatible history. CPI inflation and employment breadth begin in January 1991. The CPI baseline is deliberately limited to the modern inflation-policy era. CFTC equity positioning begins in June 2006. CFTC's [TFF explanatory notes](https://www.cftc.gov/idc/groups/public/%40commitmentsoftraders/documents/file/tfmexplanatorynotes.pdf) explain that its earlier history was backcast using later trader classifications and becomes less accurate farther back. The chart controls recalculate the rank for the selected one-year, five-year or full-history view. A percentile is a historical rank, not a forecast probability.

Locally opened Cboe files accept `YYYY-MM-DD` or `MM/DD/YYYY` dates and reject the complete file if any data row is invalid. With one local indicator, its percentile uses the full validated file history. With several local indicators, every local value, statistic and percentile is recalculated over their shared overlapping date window. The dashboard never combines a newer external quote with an older local percentile history.

## Publication safeguards

- Hosted live indicators must reference a catalog source marked as approved for public display.
- Automated tests require every hosted series to come from the explicit OFR, Federal Reserve, BLS or CFTC allowlist.
- Cboe indicators must remain catalog status `local` and absent from the hosted JSON.
- FRED graph downloads and third-party market series are excluded from the hosted payload.
- The Pages workflow assembles an explicit artifact containing only the files needed by the website.
- The public branch should start from a clean root commit so restricted prototype data are not exposed through Git history.

Public availability of a file is not treated as a republication licence. The rights metadata is an engineering safeguard, not legal advice.

## Deployment

The GitHub Pages workflow runs the publication gate and all tests, assembles the static artifact and deploys it with GitHub's official Pages actions. The scheduled data workflow checks every public source on weekdays and commits only when the generated payload changes.

## Project structure

```text
index.html                              Page structure, local-data controls and copy
market-tape.html                       Sandboxed provider-hosted futures display
styles.css                             Responsive visual design
app.js                                 Cards, network, regimes and canvas charts
local-data.mjs                         Browser-only CSV validation and statistics
data/catalog.json                      Indicator metadata, relationships and roadmap
data/indices.json                      Generated public economic dataset
scripts/update-data.mjs                Multi-source ingestion and deterministic serialization
scripts/check-publication-readiness.mjs Public-source rights gate
test/local-data.test.mjs               Synthetic local-import tests
test/update-data.test.mjs              Public pipeline tests
test/catalog.test.mjs                  Catalog and publication-boundary tests
.github/workflows/update-data.yml      Scheduled public-data refresh
.github/workflows/deploy-pages.yml     Tested GitHub Pages deployment
```

Educational information only. No investment advice.

## Development

Market Surface was designed and coded by Denis Joly with assistance from Codex, OpenAI's coding agent. Codex helped with the software architecture, data pipeline, automated tests, interface implementation and deployment review. The project maintainer remains responsible for the product decisions and published content.
