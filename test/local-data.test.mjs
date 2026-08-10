import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLocalIndexRecord,
  LOCAL_DATA_LIMITS,
  midrankPercentile,
  parseLocalCsv,
} from "../local-data.mjs";

test("parses a synthetic two-column local series", () => {
  const parsed = parseLocalCsv([
    "DATE,VIXEQ",
    "01/02/2024,10",
    "01/03/2024,20",
  ].join("\n"), "synthetic.csv");

  assert.equal(parsed.symbol, "VIXEQ");
  assert.deepEqual(parsed.history, [
    { date: "2024-01-02", value: 10 },
    { date: "2024-01-03", value: 20 },
  ]);
});

test("uses the filename to map a synthetic OHLC file", () => {
  const parsed = parseLocalCsv([
    "DATE,OPEN,HIGH,LOW,CLOSE",
    "2024-01-02,8,12,7,10",
    "2024-01-03,18,22,17,20",
  ].join("\n"), "VIX_history.csv");

  assert.equal(parsed.symbol, "VIX");
  assert.equal(parsed.history.at(-1).value, 20);
});

test("rejects an invalid row instead of computing a partial series", () => {
  assert.throws(() => parseLocalCsv([
    "DATE,DSPX",
    "2024-01-02,10",
    "2024-01-03,",
    "2024-01-04,20",
  ].join("\n"), "synthetic.csv"), /invalid data row/i);
});

test("does not expose invalid values or filenames in validation errors", () => {
  const privateFileName = "private-account-VIX.csv";
  const privateValue = "confidential-value";
  const csv = [
    "DATE,VIX",
    "2024-01-02,10",
    `2024-01-03,${privateValue}`,
    "2024-01-04,20",
  ].join("\n");

  assert.throws(
    () => parseLocalCsv(csv, privateFileName),
    (error) => {
      assert.match(error.message, /invalid data row/i);
      assert.doesNotMatch(error.message, /confidential|private-account/i);
      return true;
    },
  );
});

test("rejects European day-first dates instead of guessing their format", () => {
  const csv = [
    "DATE,COR1M",
    "31/01/2024,10",
    "01/02/2024,20",
  ].join("\n");

  assert.throws(() => parseLocalCsv(csv, "local.csv"), /invalid data row/i);
});

test("accepts only strict ISO and two-digit US date shapes", () => {
  for (const invalidDate of ["2024-1-02", "1/02/2024", "2024/01/02", "02-01-2024"]) {
    const csv = [
      "DATE,VIXEQ",
      `${invalidDate},10`,
      "2024-01-03,20",
    ].join("\n");
    assert.throws(() => parseLocalCsv(csv, "local.csv"), /invalid data row/i);
  }
});

test("enforces the daily-history row cap before parsing data rows", () => {
  assert.equal(LOCAL_DATA_LIMITS.maxRows, 20_000);
  const rows = Array.from(
    { length: LOCAL_DATA_LIMITS.maxRows + 1 },
    () => "2024-01-02,10",
  );
  const csv = ["DATE,VIX", ...rows].join("\n");

  assert.throws(() => parseLocalCsv(csv, "local.csv"), /20,000 row limit/i);
});

test("keeps the last duplicate and reports the replacement", () => {
  const parsed = parseLocalCsv([
    "DATE,DSPX",
    "2024-01-02,10",
    "2024-01-02,11",
    "2024-01-04,20",
  ].join("\n"), "synthetic.csv");

  assert.equal(parsed.rejectedRows, 0);
  assert.equal(parsed.duplicateRows, 1);
  assert.deepEqual(parsed.history, [
    { date: "2024-01-02", value: 11 },
    { date: "2024-01-04", value: 20 },
  ]);
});

test("does not silently map a generic close file without a ticker", () => {
  const csv = [
    "DATE,CLOSE",
    "2024-01-02,10",
    "2024-01-03,20",
  ].join("\n");
  assert.throws(() => parseLocalCsv(csv, "history.csv"), /could not be identified/i);
});

test("builds the dashboard record entirely from local history", () => {
  const record = buildLocalIndexRecord("COR1M", [
    { date: "2024-01-02", value: 10 },
    { date: "2024-01-03", value: 20 },
    { date: "2024-01-04", value: 20 },
  ], "https://example.test/official-source");

  assert.equal(record.dataOrigin, "local-session");
  assert.equal(record.latest.value, 20);
  assert.equal(record.percentile.rank, midrankPercentile([10, 20, 20], 20));
  assert.equal(record.percentile.comparisonStartDate, "2024-01-02");
  assert.equal(record.percentile.comparisonEndDate, "2024-01-04");
  assert.deepEqual(record.history.at(-1), ["2024-01-04", 20]);
});

test("builds latest values and distributions inside an inclusive comparison window", () => {
  const record = buildLocalIndexRecord("VIX", [
    { date: "2023-12-31", value: 80 },
    { date: "2024-01-02", value: 10 },
    { date: "2024-01-03", value: 20 },
    { date: "2024-01-05", value: 90 },
  ], "https://example.test/official-source", {
    startDate: "2024-01-01",
    endDate: "2024-01-04",
  });

  assert.equal(record.latest.date, "2024-01-03");
  assert.equal(record.latest.value, 20);
  assert.equal(record.percentile.rank, midrankPercentile([10, 20], 20));
  assert.equal(record.percentile.observations, 2);
  assert.equal(record.percentile.startDate, "2024-01-02");
  assert.equal(record.percentile.endDate, "2024-01-03");
  assert.equal(record.percentile.comparisonStartDate, "2024-01-01");
  assert.equal(record.percentile.comparisonEndDate, "2024-01-04");
  assert.deepEqual(record.stats, {
    min: 10,
    max: 20,
    median: 15,
    p25: 12.5,
    p75: 17.5,
    mean: 15,
  });
  assert.deepEqual(record.history, [
    ["2024-01-02", 10],
    ["2024-01-03", 20],
  ]);
});
