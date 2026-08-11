#!/usr/bin/env node

import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const OFR_DATA_URL =
  "https://www.financialresearch.gov/financial-stress-index/data/fsi.csv";

export const OFR_SOURCE = Object.freeze({
  id: "ofr",
  name: "Office of Financial Research",
  url: "https://www.financialresearch.gov/financial-stress-index/",
  dataUrl: OFR_DATA_URL,
  rights: {
    status: "us-federal-government-work-credit-requested",
    publicDisplayAllowed: true,
    rightsUrl: "https://www.financialresearch.gov/legal-notices/",
    attribution:
      'Office of Financial Research, "OFR Financial Stress Index," https://www.financialresearch.gov/financial-stress-index/.',
    note:
      "OFR requests credit for federal-employee works and cautions that third-party materials can have separate restrictions. This dataset contains only OFR-published aggregate and category contributions.",
  },
});

export const SERIES_CONFIG = Object.freeze({
  OFRFSI: {
    column: "OFR FSI",
    name: "OFR Financial Stress Index",
    ticker: "OFR FSI",
    unit: "index points",
    valueType: "published daily index level",
  },
  OFRVOL: {
    column: "Volatility",
    name: "OFR Financial Stress Index: Volatility contribution",
    ticker: "OFR VOL",
    unit: "stress contribution",
    valueType: "published daily category contribution",
  },
  OFREQUITY: {
    column: "Equity valuation",
    name: "OFR Financial Stress Index: Equity valuation contribution",
    ticker: "OFR EQUITY",
    unit: "stress contribution",
    valueType: "published daily category contribution",
  },
  OFRCREDIT: {
    column: "Credit",
    name: "OFR Financial Stress Index: Credit contribution",
    ticker: "OFR CREDIT",
    unit: "stress contribution",
    valueType: "published daily category contribution",
  },
  OFRFUNDING: {
    column: "Funding",
    name: "OFR Financial Stress Index: Funding contribution",
    ticker: "OFR FUNDING",
    unit: "stress contribution",
    valueType: "published daily category contribution",
  },
});

const PERCENTILE_METHOD =
  "Midrank: 100 × (observations below the latest value + 0.5 × observations equal to it) / N";

function parseCsvRow(line) {
  const values = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error(`Unclosed quote in CSV row: ${line}`);
  values.push(value.trim());
  return values;
}

function normalizeHeader(value) {
  return value.replace(/^\uFEFF/, "").trim();
}

function toIsoDate(value) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${yearText}-${monthText}-${dayText}`;
}

export function parseOfrCsv(csv) {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 3) throw new Error("OFR FSI CSV contains too few observations");

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  const dateIndex = headers.indexOf("Date");
  const columnIndexes = Object.fromEntries(
    Object.entries(SERIES_CONFIG).map(([id, config]) => [
      id,
      headers.indexOf(config.column),
    ]),
  );

  const missingColumns = [
    ...(dateIndex === -1 ? ["Date"] : []),
    ...Object.entries(columnIndexes)
      .filter(([, index]) => index === -1)
      .map(([id]) => SERIES_CONFIG[id].column),
  ];
  if (missingColumns.length) {
    throw new Error(`OFR FSI CSV is missing columns: ${missingColumns.join(", ")}`);
  }

  const observationsById = Object.fromEntries(
    Object.keys(SERIES_CONFIG).map((id) => [id, new Map()]),
  );

  for (const line of lines.slice(1)) {
    const row = parseCsvRow(line);
    const date = toIsoDate(row[dateIndex] ?? "");
    if (!date) throw new Error(`OFR FSI CSV has an invalid date row: ${line}`);

    for (const [id, columnIndex] of Object.entries(columnIndexes)) {
      const rawValue = (row[columnIndex] ?? "").trim();
      const value = rawValue === "" ? Number.NaN : Number(rawValue);
      if (!Number.isFinite(value)) {
        throw new Error(`${id} has an invalid observation row: ${line}`);
      }
      observationsById[id].set(date, value);
    }
  }

  return Object.fromEntries(
    Object.entries(observationsById).map(([id, observationsByDate]) => {
      const observations = [...observationsByDate]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, value]) => ({ date, value }));
      if (observations.length < 2) throw new Error(`${id} has fewer than two observations`);
      return [id, observations];
    }),
  );
}

function round(value, digits = 4) {
  const rounded = Number(value.toFixed(digits));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function quantile(sortedValues, probability) {
  if (sortedValues.length === 1) return sortedValues[0];
  const position = (sortedValues.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const weight = position - lowerIndex;
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

export function summarizeDistribution(values) {
  if (!values.length) throw new Error("Cannot summarize an empty distribution");
  const sortedValues = [...values].sort((left, right) => left - right);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    min: round(sortedValues[0]),
    max: round(sortedValues.at(-1)),
    median: round(quantile(sortedValues, 0.5)),
    p25: round(quantile(sortedValues, 0.25)),
    p75: round(quantile(sortedValues, 0.75)),
    mean: round(mean),
  };
}

export function midrankPercentile(values, target) {
  if (!values.length) throw new Error("Cannot rank against an empty distribution");
  let below = 0;
  let equal = 0;
  for (const value of values) {
    if (value < target) below += 1;
    else if (value === target) equal += 1;
  }
  return round((100 * (below + 0.5 * equal)) / values.length, 2);
}

function sharedDates(seriesById, ids, startDate, endDate) {
  let shared;
  for (const id of ids) {
    const dates = new Set(
      seriesById[id]
        .filter(({ date }) => date >= startDate && date <= endDate)
        .map(({ date }) => date),
    );
    shared = shared
      ? new Set([...shared].filter((date) => dates.has(date)))
      : dates;
  }
  return [...(shared || [])].sort();
}

export function buildDashboardData(seriesById) {
  const ids = Object.keys(SERIES_CONFIG);
  for (const id of ids) {
    if (!seriesById[id]?.length) throw new Error(`Missing observations for ${id}`);
  }

  const firstDates = Object.fromEntries(ids.map((id) => [id, seriesById[id][0].date]));
  const latestDates = Object.fromEntries(
    ids.map((id) => [id, seriesById[id].at(-1).date]),
  );
  const startDate = Object.values(firstDates).sort().at(-1);
  const endDate = Object.values(latestDates).sort()[0];
  const latestAligned = Object.values(latestDates).every((date) => date === endDate);

  if (!startDate || !endDate || endDate < startDate) {
    throw new Error("OFR histories do not share a usable comparison window");
  }

  const indices = {};
  for (const id of ids) {
    const config = SERIES_CONFIG[id];
    const history = seriesById[id];
    const latest = history.at(-1);
    const previous = history.at(-2);
    const reference = history.filter(({ date }) => date >= startDate && date <= endDate);
    const values = reference.map(({ value }) => value);
    const change = latest.value - previous.value;

    indices[id] = {
      name: config.name,
      ticker: config.ticker,
      unit: config.unit,
      valueType: config.valueType,
      sourceRef: OFR_SOURCE.id,
      sourceUrl: OFR_SOURCE.url,
      latest: {
        date: latest.date,
        value: latest.value,
        previousDate: previous.date,
        previousValue: previous.value,
        change: round(change),
        // Percentage changes are misleading for zero-centered stress series.
        changePercent: null,
      },
      percentile: {
        rank: midrankPercentile(values, latest.value),
        startDate,
        endDate,
        observations: values.length,
        method: PERCENTILE_METHOD,
      },
      stats: summarizeDistribution(values),
      history: history.map(({ date, value }) => [date, value]),
    };
  }

  const commonDates = sharedDates(seriesById, ids, startDate, endDate);
  return {
    schemaVersion: 1,
    generatedAt: `${Object.values(latestDates).sort().at(-1)}T00:00:00.000Z`,
    source: OFR_SOURCE,
    sources: { [OFR_SOURCE.id]: OFR_SOURCE },
    rights: {
      publicDisplayAllowed: true,
      policy:
        "Hosted data contains only OFR-published aggregate and category values marked for public display.",
      sources: { [OFR_SOURCE.id]: OFR_SOURCE.rights },
    },
    commonWindow: {
      startDate,
      endDate,
      sharedDateObservations: commonDates.length,
      firstDates,
      latestDates,
      latestAligned,
      comparisonBasis:
        "Each hosted OFR series uses all published daily observations within these inclusive common date bounds.",
      percentileMethod: PERCENTILE_METHOD,
    },
    indices,
  };
}

export function serializeDashboardData(dashboardData) {
  return `${JSON.stringify(dashboardData)}\n`;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchText(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "eco-dashboard-public-data-updater/1.0" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(500 * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Failed to download ${url}: ${lastError.message}`);
}

export async function updateData(outputPath = path.resolve("data/indices.json")) {
  const csv = await fetchText(OFR_DATA_URL);
  const dashboardData = buildDashboardData(parseOfrCsv(csv));
  const temporaryPath = `${outputPath}.tmp`;
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(temporaryPath, serializeDashboardData(dashboardData), "utf8");
  await rename(temporaryPath, outputPath);
  return dashboardData;
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  updateData()
    .then((data) => {
      const latest = Object.fromEntries(
        Object.entries(data.indices).map(([id, series]) => [
          id,
          `${series.latest.value} (${series.latest.date})`,
        ]),
      );
      console.log(`Updated public OFR data: ${JSON.stringify(latest)}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
