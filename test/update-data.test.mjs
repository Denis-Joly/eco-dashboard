import assert from "node:assert/strict";
import test from "node:test";

import {
  FED_H10_DATA_URL,
  FED_H15_DATA_URL,
  blsYearChunks,
  buildDashboardData,
  deriveCurveSpread,
  deriveYearOverYear,
  mergeObservationSeries,
  midrankPercentile,
  parseBlsResponse,
  parseFedSdmxXml,
  parseOfrCsv,
  serializeDashboardData,
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
  "CURVE2S10S",
  "REAL10Y",
  "CPIYOY",
  "EMPDIFF1M",
  "DTWEXBGS",
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
  };
}

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
  assert.deepEqual(Object.keys(data.sources), ["ofr", "federal-reserve", "bls"]);
  assert.equal(data.sources.bls.rights.publicDisplayAllowed, true);
  assert.equal(data.indices.CURVE2S10S.sourceRef, "federal-reserve");
  assert.equal(data.indices.CPIYOY.sourceRef, "bls");
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
  assert.doesNotMatch(first, /"(?:VIX|VIXEQ|DSPX|COR1M|DGS2|DGS10)"\s*:/i);
  assert.match(first, /"DTWEXBGS"\s*:/);
});
