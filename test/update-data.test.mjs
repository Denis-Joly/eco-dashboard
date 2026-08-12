import assert from "node:assert/strict";
import test from "node:test";

import {
  BLS_SOURCE,
  CFTC_DATA_URL,
  CFTC_E_MINI_SP500_CONTRACT_CODE,
  CFTC_E_MINI_SP500_FIRST_REPORT_DATE,
  CFTC_E_MINI_SP500_MINIMUM_HISTORY,
  CFTC_SOURCE,
  FED_SOURCE,
  FED_H10_DATA_URL,
  FED_H15_DATA_URL,
  OFR_SOURCE,
  SERIES_CONFIG,
  blsYearChunks,
  buildTreasurySeries,
  buildDashboardData,
  deriveCurveSpread,
  deriveInflationCompensation10Y,
  deriveLeveragedSp500Net,
  deriveRateVolatility20,
  deriveYearOverYear,
  mergeObservationSeries,
  midrankPercentile,
  parseBlsResponse,
  parseCftcTffFuturesOnly,
  parseFedSdmxXml,
  parseOfrCsv,
  serializeDashboardData,
  sourceFor,
  summarizeDistribution,
} from "../scripts/update-data.mjs";

const OFR_IDS = [
  "OFRFSI",
  "OFRVOL",
  "OFREQUITY",
  "OFRSAFE",
  "OFRCREDIT",
  "OFRFUNDING",
];
const PUBLIC_IDS = [
  ...OFR_IDS,
  "DGS2",
  "DGS10",
  "CURVE2S10S",
  "REAL10Y",
  "RATEVOL20",
  "INFLATIONCOMP10Y",
  "CPIYOY",
  "EMPDIFF1M",
  "DTWEXBGS",
  "LEVSPNET",
];

test("uses the durable Federal Reserve statistical-release archives", () => {
  assert.equal(
    FED_H15_DATA_URL,
    "https://www.federalreserve.gov/releases/h15/data/FRB_h15_xml.zip",
  );
  assert.equal(
    FED_H10_DATA_URL,
    "https://www.federalreserve.gov/releases/h10/data/FRB_h10_xml.zip",
  );
  assert.doesNotMatch(`${FED_H15_DATA_URL}${FED_H10_DATA_URL}`, /datadownload|fred/i);
});

function fixtureCsv() {
  return [
    "Date,OFR FSI,Credit,Equity valuation,Safe assets,Funding,Volatility,United States,Other advanced economies,Emerging markets",
    "2024-01-04,0.4,0.1,-0.2,0.0,0.3,0.2,0.1,0.1,0.2",
    "2024-01-02,-0.1,-0.2,-0.3,0.0,0.1,0.3,-0.1,0.0,0.0",
    "2024-01-03,0.2,0.0,-0.1,0.1,0.2,0.4,0.0,0.1,0.1",
  ].join("\r\n");
}

function fixturePublicSeries() {
  return {
    ...parseOfrCsv(fixtureCsv()),
    DGS2: [
      { date: "2023-12-29", value: 4.14 },
      { date: "2024-01-03", value: 4.11 },
      { date: "2024-01-05", value: 4.08 },
    ],
    DGS10: [
      { date: "2023-12-29", value: 3.72 },
      { date: "2024-01-03", value: 3.76 },
      { date: "2024-01-05", value: 3.8 },
    ],
    CURVE2S10S: [
      { date: "2023-12-29", value: -42 },
      { date: "2024-01-03", value: -35 },
      { date: "2024-01-05", value: -28 },
    ],
    REAL10Y: [
      { date: "2023-12-29", value: 1.72 },
      { date: "2024-01-03", value: 1.76 },
      { date: "2024-01-05", value: 1.8 },
    ],
    RATEVOL20: [
      { date: "2023-12-29", value: 6.1 },
      { date: "2024-01-03", value: 6.2 },
      { date: "2024-01-05", value: 6.3 },
    ],
    INFLATIONCOMP10Y: [
      { date: "2023-12-29", value: 2 },
      { date: "2024-01-03", value: 2 },
      { date: "2024-01-05", value: 2 },
    ],
    CPIYOY: [
      { date: "2023-10-01", value: 3.2 },
      { date: "2023-11-01", value: 3.1 },
      { date: "2023-12-01", value: 3.4 },
    ],
    EMPDIFF1M: [
      { date: "2023-10-01", value: 54.2 },
      { date: "2023-11-01", value: 55.1 },
      { date: "2023-12-01", value: 53.9 },
    ],
    DTWEXBGS: [
      { date: "2024-01-02", value: 120 },
      { date: "2024-01-03", value: 121 },
      { date: "2024-01-05", value: 122.21 },
    ],
    LEVSPNET: [
      { date: "2023-12-19", value: -10 },
      { date: "2023-12-26", value: -8 },
      { date: "2024-01-02", value: -6 },
    ],
  };
}

test("parses and derives CFTC leveraged-fund E-mini S&P 500 positioning", () => {
  const start = new Date(`${CFTC_E_MINI_SP500_FIRST_REPORT_DATE}T00:00:00Z`);
  const payload = Array.from(
    { length: CFTC_E_MINI_SP500_MINIMUM_HISTORY },
    (_, index) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + index * 7);
      return {
        report_date_as_yyyy_mm_dd: `${date.toISOString().slice(0, 10)}T00:00:00.000`,
        cftc_contract_market_code: CFTC_E_MINI_SP500_CONTRACT_CODE,
        open_interest_all: "1,000",
        lev_money_positions_long: "400",
        lev_money_positions_short: "300",
        lev_money_positions_spread: "250",
      };
    },
  );
  payload[1] = {
      ...payload[1],
      cftc_contract_market_code: CFTC_E_MINI_SP500_CONTRACT_CODE,
      open_interest_all: "2,000",
      lev_money_positions_long: "500",
      lev_money_positions_short: "700",
      lev_money_positions_spread: "150",
    };
  const rows = parseCftcTffFuturesOnly(payload);

  assert.equal(rows[0].date, CFTC_E_MINI_SP500_FIRST_REPORT_DATE);
  assert.equal(rows[0].leveragedSpread, 250);
  assert.deepEqual(deriveLeveragedSp500Net(rows).slice(0, 2), [
    { date: CFTC_E_MINI_SP500_FIRST_REPORT_DATE, value: 10 },
    { date: "2006-06-20", value: -10 },
  ]);
  assert.match(CFTC_DATA_URL, /gpe5-46if/);
  assert.match(CFTC_DATA_URL, /13874A/);
  const decodedUrl = decodeURIComponent(CFTC_DATA_URL);
  assert.match(decodedUrl, /^https:\/\/publicreporting\.cftc\.gov\/resource\/gpe5-46if\.json\?/);
  for (const field of [
    "report_date_as_yyyy_mm_dd",
    "open_interest_all",
    "lev_money_positions_long",
    "lev_money_positions_short",
    "lev_money_positions_spread",
  ]) assert.match(decodedUrl, new RegExp(`\\$select=[^&]*${field}`));
  assert.match(decodedUrl, /\$where=cftc_contract_market_code='13874A'/);
  assert.match(decodedUrl, /\$order=report_date_as_yyyy_mm_dd ASC/);
  assert.match(decodedUrl, /\$limit=50000/);
});

test("rejects malformed or mixed-contract CFTC positioning data", () => {
  const validRow = {
    report_date_as_yyyy_mm_dd: "2024-01-02T00:00:00.000",
    cftc_contract_market_code: CFTC_E_MINI_SP500_CONTRACT_CODE,
    open_interest_all: "1000",
    lev_money_positions_long: "400",
    lev_money_positions_short: "300",
    lev_money_positions_spread: "250",
  };
  assert.throws(
    () => parseCftcTffFuturesOnly([validRow, { ...validRow, report_date_as_yyyy_mm_dd: "2024-01-09", cftc_contract_market_code: "999999" }]),
    /contract other than 13874A/i,
  );
  assert.throws(
    () => parseCftcTffFuturesOnly([validRow, { ...validRow, report_date_as_yyyy_mm_dd: "2024-01-09", open_interest_all: "0" }]),
    /open_interest_all must be positive/i,
  );
  assert.throws(
    () => parseCftcTffFuturesOnly([validRow, { ...validRow, report_date_as_yyyy_mm_dd: "2024-01-09" }]),
    /fewer than 1000 observations/i,
  );
  assert.throws(
    () => parseCftcTffFuturesOnly([validRow, { ...validRow }]),
    /duplicate report date/i,
  );
});

test("parses the OFR aggregate and all five category columns", () => {
  const parsed = parseOfrCsv(fixtureCsv());

  assert.deepEqual(Object.keys(parsed), OFR_IDS);
  assert.deepEqual(parsed.OFRFSI, [
    { date: "2024-01-02", value: -0.1 },
    { date: "2024-01-03", value: 0.2 },
    { date: "2024-01-04", value: 0.4 },
  ]);
  assert.equal(parsed.OFREQUITY[0].value, -0.3);
  assert.equal(parsed.OFRSAFE[1].value, 0.1);
  assert.equal(parsed.OFRFUNDING.at(-1).value, 0.3);
});

test("rejects an incomplete or malformed OFR publication", () => {
  const missingColumn = [
    "Date,OFR FSI,Credit,Equity valuation,Funding,Volatility",
    "2024-01-02,0.1,0.2,0.3,0.4,0.5",
    "2024-01-03,0.2,0.3,0.4,0.5,0.6",
  ].join("\n");
  assert.throws(() => parseOfrCsv(missingColumn), /missing columns.*Safe assets/i);

  const blankValue = [
    "Date,OFR FSI,Credit,Equity valuation,Safe assets,Funding,Volatility",
    "2024-01-02,0.1,0.2,0.3,0.0,0.4,0.5",
    "2024-01-03,0.2,0.3,,0.1,0.5,0.6",
  ].join("\n");
  assert.throws(() => parseOfrCsv(blankValue), /OFREQUITY.*invalid observation/i);
});

test("parses only exact requested Board SDMX series and skips missing values", () => {
  const xml = `<?xml version="1.0"?>
    <frb:DataSet xmlns:kf="urn:test" xmlns:frb="urn:frb">
      <kf:Series SERIES_NAME="RIFLGFCY02_N.B">
        <frb:Obs OBS_STATUS="A" OBS_VALUE="4.20" TIME_PERIOD="2024-01-03" />
        <frb:Obs OBS_STATUS="ND" OBS_VALUE="-9999" TIME_PERIOD="2024-01-04" />
        <frb:Obs OBS_STATUS="A" OBS_VALUE="4.30" TIME_PERIOD="2024-01-02" />
      </kf:Series>
      <kf:Series SERIES_NAME="RIFLGFCY10_N.B">
        <frb:Obs OBS_STATUS="A" OBS_VALUE="4.00" TIME_PERIOD="2024-01-02" />
        <frb:Obs OBS_STATUS="A" OBS_VALUE="4.10" TIME_PERIOD="2024-01-03" />
      </kf:Series>
      <kf:Series SERIES_NAME="RIFLGFCY10_XII_N.B">
        <frb:Obs OBS_STATUS="A" OBS_VALUE="1.70" TIME_PERIOD="2024-01-02" />
        <frb:Obs OBS_STATUS="A" OBS_VALUE="1.75" TIME_PERIOD="2024-01-03" />
      </kf:Series>
      <kf:Series SERIES_NAME="JRXWTFB_N.B">
        <frb:Obs OBS_STATUS="A" OBS_VALUE="121.2" TIME_PERIOD="2024-01-02" />
        <frb:Obs OBS_STATUS="A" OBS_VALUE="122.3" TIME_PERIOD="2024-01-03" />
      </kf:Series>
      <kf:Series SERIES_NAME="V0.JRXWTFB_N.B">
        <frb:Obs OBS_STATUS="A" OBS_VALUE="999" TIME_PERIOD="2024-01-02" />
        <frb:Obs OBS_STATUS="A" OBS_VALUE="999" TIME_PERIOD="2024-01-03" />
      </kf:Series>
    </frb:DataSet>`;
  const ids = [
    "RIFLGFCY02_N.B",
    "RIFLGFCY10_N.B",
    "RIFLGFCY10_XII_N.B",
    "JRXWTFB_N.B",
  ];
  const parsed = parseFedSdmxXml(xml, ids);

  assert.deepEqual(Object.keys(parsed), ids);
  assert.deepEqual(parsed["RIFLGFCY02_N.B"], [
    { date: "2024-01-02", value: 4.3 },
    { date: "2024-01-03", value: 4.2 },
  ]);
  assert.equal(parsed["JRXWTFB_N.B"].at(-1).value, 122.3);
});

test("parses BLS monthly periods, ignores annual averages, and merges chunks", () => {
  const first = parseBlsResponse({
    status: "REQUEST_SUCCEEDED",
    Results: {
      series: [
        {
          seriesID: "CES0500000021",
          data: [
            { year: "1992", period: "M13", value: "60.0" },
            { year: "1992", period: "M02", value: "55.5" },
            { year: "1992", period: "M01", value: "54.0" },
          ],
        },
        {
          seriesID: "CUUR0000SA0",
          data: [
            { year: "1992", period: "M02", value: "139.4" },
            { year: "1992", period: "M01", value: "138.1" },
          ],
        },
      ],
    },
  });
  const second = parseBlsResponse({
    status: "REQUEST_SUCCEEDED",
    Results: {
      series: [
        {
          seriesID: "CES0500000021",
          data: [
            { year: "1992", period: "M03", value: "56.1" },
            { year: "1992", period: "M02", value: "55.6" },
          ],
        },
        {
          seriesID: "CUUR0000SA0",
          data: [{ year: "1992", period: "M03", value: "140.0" }],
        },
      ],
    },
  });
  const merged = mergeObservationSeries(
    [first, second],
    ["CES0500000021", "CUUR0000SA0"],
  );

  assert.deepEqual(merged.CES0500000021, [
    { date: "1992-01-01", value: 54 },
    { date: "1992-02-01", value: 55.6 },
    { date: "1992-03-01", value: 56.1 },
  ]);
  assert.equal(merged.CUUR0000SA0.at(-1).value, 140);
  assert.deepEqual(blsYearChunks(1990, 2026), [
    [1990, 1999],
    [2000, 2009],
    [2010, 2019],
    [2020, 2026],
  ]);
});

test("derives the same-date Treasury spread and CPI 12-month change", () => {
  assert.deepEqual(
    deriveCurveSpread(
      [
        { date: "2024-01-02", value: 4.3 },
        { date: "2024-01-03", value: 4.2 },
        { date: "2024-01-04", value: 4.1 },
      ],
      [
        { date: "2024-01-02", value: 4 },
        { date: "2024-01-03", value: 4.1 },
      ],
    ),
    [
      { date: "2024-01-02", value: -30 },
      { date: "2024-01-03", value: -10 },
    ],
  );

  const cpi = [
    { date: "2020-01-01", value: 100 },
    { date: "2020-02-01", value: 110 },
    { date: "2021-01-01", value: 105 },
    { date: "2021-02-01", value: 121 },
  ];
  assert.deepEqual(deriveYearOverYear(cpi, "2021-01-01"), [
    { date: "2021-01-01", value: 5 },
    { date: "2021-02-01", value: 10 },
  ]);
});

function yieldsFromBasisPointChanges(changes) {
  let value = 3;
  const observations = [{ date: "2024-01-01", value }];
  changes.forEach((change, index) => {
    value = Number((value + change / 100).toFixed(4));
    observations.push({
      date: `2024-01-${String(index + 2).padStart(2, "0")}`,
      value,
    });
  });
  return observations;
}

test("calculates non-annualized RATEVOL20 from a hand-checked 20-change window", () => {
  const changes = Array.from({ length: 20 }, (_, index) => index + 1);
  const yields = yieldsFromBasisPointChanges(changes);

  // For the integers 1 through 20, the sum of squared deviations is 665.
  // The sample variance is therefore 665 / 19 = 35, without annualization.
  assert.deepEqual(deriveRateVolatility20(yields), [
    { date: "2024-01-21", value: 5.9161 },
  ]);
  assert.throws(
    () => deriveRateVolatility20(yields.slice(0, 20)),
    /requires at least 21 valid DGS10 yield observations/i,
  );
});

test("rolls RATEVOL20 over the latest 20 changes and uses sample variance", () => {
  const changes = [
    ...Array.from({ length: 20 }, (_, index) => index + 1),
    40,
  ];
  const result = deriveRateVolatility20(yieldsFromBasisPointChanges(changes));

  assert.deepEqual(result, [
    { date: "2024-01-21", value: 5.9161 },
    // The second window contains 2 through 20 and 40: variance = 72.05.
    { date: "2024-01-22", value: 8.4882 },
  ]);
});

test("calculates the inflation-compensation proxy only on matching dates", () => {
  assert.deepEqual(
    deriveInflationCompensation10Y(
      [
        { date: "2024-01-02", value: 4.1 },
        { date: "2024-01-03", value: 4.2 },
        { date: "2024-01-04", value: 4.35 },
      ],
      [
        { date: "2024-01-02", value: 1.8 },
        { date: "2024-01-04", value: 1.95 },
        { date: "2024-01-05", value: 2 },
      ],
    ),
    [
      { date: "2024-01-02", value: 2.3 },
      { date: "2024-01-04", value: 2.4 },
    ],
  );
});

test("builds exact hosted Treasury identity and derived series from H.15 inputs", () => {
  const tenYear = yieldsFromBasisPointChanges([
    ...Array.from({ length: 20 }, (_, index) => index + 1),
    40,
  ]);
  const twoYear = tenYear.map(({ date, value }) => ({
    date,
    value: Number((value - 0.2).toFixed(4)),
  }));
  const realTenYear = tenYear.map(({ date, value }) => ({
    date,
    value: Number((value - 2.1).toFixed(4)),
  }));
  const result = buildTreasurySeries({
    "RIFLGFCY02_N.B": twoYear,
    "RIFLGFCY10_N.B": tenYear,
    "RIFLGFCY10_XII_N.B": realTenYear,
  });

  assert.deepEqual(Object.keys(result), [
    "DGS2",
    "DGS10",
    "CURVE2S10S",
    "REAL10Y",
    "RATEVOL20",
    "INFLATIONCOMP10Y",
  ]);
  assert.deepEqual(result.DGS2, twoYear);
  assert.deepEqual(result.DGS10, tenYear);
  assert.deepEqual(result.CURVE2S10S.slice(-2), [
    { date: "2024-01-21", value: 20 },
    { date: "2024-01-22", value: 20 },
  ]);
  assert.deepEqual(result.RATEVOL20, [
    { date: "2024-01-21", value: 5.9161 },
    { date: "2024-01-22", value: 8.4882 },
  ]);
  assert.deepEqual(result.INFLATIONCOMP10Y.slice(-2), [
    { date: "2024-01-21", value: 2.1 },
    { date: "2024-01-22", value: 2.1 },
  ]);
});

test("uses a midrank percentile so ties receive half weight", () => {
  assert.equal(midrankPercentile([10, 20, 20, 30], 20), 50);
  assert.equal(midrankPercentile([10, 20, 30, 40], 40), 87.5);
});

test("computes interpolated quartiles and summary statistics", () => {
  assert.deepEqual(summarizeDistribution([4, 1, 3, 2]), {
    min: 1,
    max: 4,
    median: 2.5,
    p25: 1.75,
    p75: 3.25,
    mean: 2.5,
  });
});

test("builds the normalized public schema with per-series percentile windows", () => {
  const data = buildDashboardData(fixturePublicSeries(), {
    retrievedAt: "2024-01-06",
  });

  assert.deepEqual(Object.keys(data.indices), PUBLIC_IDS);
  assert.equal(data.schemaVersion, 1);
  assert.equal(data.generatedAt, "2024-01-05T00:00:00.000Z");
  assert.equal(data.retrievedAt, "2024-01-06");
  assert.equal(data.rights.publicDisplayAllowed, true);
  assert.deepEqual(Object.keys(data.sources), ["ofr", "federal-reserve", "bls", "cftc"]);
  assert.equal(data.sources.bls.rights.publicDisplayAllowed, true);
  assert.equal(data.sources.ofr.rights.publicDisplayAllowed, true);
  assert.equal(data.sources["federal-reserve"].rights.publicDisplayAllowed, true);
  assert.equal(data.sources.cftc.rights.publicDisplayAllowed, true);
  assert.equal(data.indices.DGS2.sourceRef, "federal-reserve");
  assert.equal(data.indices.DGS10.sourceRef, "federal-reserve");
  assert.equal(data.indices.CURVE2S10S.sourceRef, "federal-reserve");
  assert.equal(data.indices.RATEVOL20.sourceRef, "federal-reserve");
  assert.equal(data.indices.INFLATIONCOMP10Y.sourceRef, "federal-reserve");
  assert.equal(data.indices.CPIYOY.sourceRef, "bls");
  assert.equal(data.indices.LEVSPNET.sourceRef, "cftc");
  assert.equal(data.indices.LEVSPNET.calculation.inputs.includes("open_interest_all"), true);
  assert.deepEqual(data.indices.DGS2.provenance, {
    sourceRef: "federal-reserve",
    release: "H.15 Selected Interest Rates",
    sourceSeries: ["RIFLGFCY02_N.B"],
    transformation: "identity",
  });
  assert.deepEqual(data.indices.DGS10.provenance.sourceSeries, [
    "RIFLGFCY10_N.B",
  ]);
  assert.deepEqual(data.indices.RATEVOL20.calculation.inputs, ["DGS10"]);
  assert.equal(data.indices.RATEVOL20.calculation.windowObservations, 20);
  assert.equal(data.indices.RATEVOL20.calculation.annualized, false);
  assert.match(
    data.indices.INFLATIONCOMP10Y.valueType,
    /dashboard-calculated.*inflation-compensation proxy/i,
  );
  assert.deepEqual(data.indices.INFLATIONCOMP10Y.calculation.inputs, [
    "DGS10",
    "REAL10Y",
  ]);
  assert.deepEqual(data.indices.OFRFSI.history[0], ["2024-01-02", -0.1]);
  assert.equal(data.indices.OFRFSI.latest.change, 0.2);
  assert.equal(data.indices.OFRFSI.latest.changePercent, null);
  assert.equal(data.indices.DTWEXBGS.latest.changePercent, 1);
  assert.equal(data.commonWindow.alignmentMode, "per-series");
  assert.equal(data.commonWindow.startDate, null);
  assert.equal(data.commonWindow.endDate, null);
  assert.equal(data.commonWindow.sharedDateObservations, null);
  assert.equal(data.commonWindow.latestAligned, false);
  assert.equal(data.indices.OFRFSI.percentile.startDate, "2024-01-02");
  assert.equal(data.indices.CPIYOY.percentile.startDate, "2023-10-01");
  assert.equal(data.indices.CURVE2S10S.percentile.endDate, "2024-01-05");
  assert.equal(data.indices.OFRFSI.percentile.observations, 3);
  assert.match(data.indices.OFRFSI.percentile.method, /Midrank.*0\.5/i);
});

test("resolves only registered public sources and rejects unknown references", () => {
  assert.equal(sourceFor(SERIES_CONFIG.OFRFSI), OFR_SOURCE);
  assert.equal(sourceFor(SERIES_CONFIG.DGS10), FED_SOURCE);
  assert.equal(sourceFor(SERIES_CONFIG.CPIYOY), BLS_SOURCE);
  assert.equal(sourceFor(SERIES_CONFIG.LEVSPNET), CFTC_SOURCE);
  assert.throws(
    () => sourceFor({ sourceRef: "unregistered-provider" }),
    /unknown source reference: unregistered-provider/i,
  );
  assert.throws(() => sourceFor({}), /unknown source reference: \(missing\)/i);
  assert.equal(
    Object.values(SERIES_CONFIG).every(
      (config) => sourceFor(config).rights.publicDisplayAllowed,
    ),
    true,
  );
});

test("serializes deterministic compact JSON without Cboe or FRED payloads", () => {
  const data = buildDashboardData(fixturePublicSeries(), {
    retrievedAt: "2024-01-06",
  });
  const first = serializeDashboardData(data);
  const second = serializeDashboardData(data);

  assert.equal(first, second);
  assert.equal(first.endsWith("\n"), true);
  assert.equal(first.slice(0, -1).includes("\n"), false);
  assert.deepEqual(JSON.parse(first), data);
  assert.doesNotMatch(first, /cdn\.cboe\.com|fredgraph\.csv|fred\.stlouisfed\.org/i);
  assert.doesNotMatch(first, /"(?:VIX|VIXEQ|DSPX|COR1M)"\s*:/i);
  assert.match(first, /"DGS2"\s*:/);
  assert.match(first, /"DGS10"\s*:/);
  assert.match(first, /"RATEVOL20"\s*:/);
  assert.match(first, /"INFLATIONCOMP10Y"\s*:/);
  assert.match(first, /"DTWEXBGS"\s*:/);
  assert.match(first, /"LEVSPNET"\s*:/);
});
