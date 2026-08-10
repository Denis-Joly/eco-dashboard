import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDashboardData,
  midrankPercentile,
  parseOfrCsv,
  serializeDashboardData,
  summarizeDistribution,
} from "../scripts/update-data.mjs";

const PUBLIC_IDS = ["OFRFSI", "OFRVOL", "OFREQUITY", "OFRCREDIT", "OFRFUNDING"];

function fixtureCsv() {
  return [
    "Date,OFR FSI,Credit,Equity valuation,Safe assets,Funding,Volatility,United States,Other advanced economies,Emerging markets",
    "2024-01-04,0.4,0.1,-0.2,0.0,0.3,0.2,0.1,0.1,0.2",
    "2024-01-02,-0.1,-0.2,-0.3,0.0,0.1,0.3,-0.1,0.0,0.0",
    "2024-01-03,0.2,0.0,-0.1,0.1,0.2,0.4,0.0,0.1,0.1",
  ].join("\r\n");
}

test("parses every required OFR aggregate and category column", () => {
  const parsed = parseOfrCsv(fixtureCsv());

  assert.deepEqual(Object.keys(parsed), PUBLIC_IDS);
  assert.deepEqual(parsed.OFRFSI, [
    { date: "2024-01-02", value: -0.1 },
    { date: "2024-01-03", value: 0.2 },
    { date: "2024-01-04", value: 0.4 },
  ]);
  assert.equal(parsed.OFREQUITY[0].value, -0.3);
  assert.equal(parsed.OFRFUNDING.at(-1).value, 0.3);
});

test("rejects an incomplete or malformed OFR publication", () => {
  const missingColumn = [
    "Date,OFR FSI,Credit,Equity valuation,Funding",
    "2024-01-02,0.1,0.2,0.3,0.4",
    "2024-01-03,0.2,0.3,0.4,0.5",
  ].join("\n");
  assert.throws(() => parseOfrCsv(missingColumn), /missing columns.*Volatility/i);

  const blankValue = [
    "Date,OFR FSI,Credit,Equity valuation,Funding,Volatility",
    "2024-01-02,0.1,0.2,0.3,0.4,0.5",
    "2024-01-03,0.2,0.3,,0.5,0.6",
  ].join("\n");
  assert.throws(() => parseOfrCsv(blankValue), /OFREQUITY.*invalid observation/i);
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

test("builds the normalized public schema and retains compact daily histories", () => {
  const data = buildDashboardData(parseOfrCsv(fixtureCsv()));

  assert.deepEqual(Object.keys(data.indices), PUBLIC_IDS);
  assert.equal(data.schemaVersion, 1);
  assert.equal(data.rights.publicDisplayAllowed, true);
  assert.equal(data.source.id, "ofr");
  assert.equal(data.source.rights.publicDisplayAllowed, true);
  assert.equal(data.indices.OFRFSI.sourceRef, "ofr");
  assert.deepEqual(data.indices.OFRFSI.history[0], ["2024-01-02", -0.1]);
  assert.equal(data.indices.OFRFSI.latest.change, 0.2);
  assert.equal(data.indices.OFRFSI.latest.changePercent, null);
  assert.equal(data.commonWindow.startDate, "2024-01-02");
  assert.equal(data.commonWindow.endDate, "2024-01-04");
  assert.equal(data.commonWindow.sharedDateObservations, 3);
  assert.equal(data.commonWindow.latestAligned, true);
  assert.equal(data.indices.OFRFSI.percentile.observations, 3);
  assert.match(data.indices.OFRFSI.percentile.method, /Midrank.*0\.5/i);
});

test("serializes deterministic compact JSON with no Cboe or FRED market data", () => {
  const data = buildDashboardData(parseOfrCsv(fixtureCsv()));
  const first = serializeDashboardData(data);
  const second = serializeDashboardData(data);

  assert.equal(first, second);
  assert.equal(first.endsWith("\n"), true);
  assert.equal(first.slice(0, -1).includes("\n"), false);
  assert.deepEqual(JSON.parse(first), data);
  assert.doesNotMatch(
    first,
    /cdn\.cboe\.com|fredgraph\.csv|"(?:VIX|VIXEQ|DSPX|COR1M|DGS2|DGS10|DTWEXBGS)"\s*:/i,
  );
});
