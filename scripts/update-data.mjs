#!/usr/bin/env node

import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

export const OFR_DATA_URL =
  "https://www.financialresearch.gov/financial-stress-index/data/fsi.csv";
export const FED_H15_DATA_URL =
  "https://www.federalreserve.gov/releases/h15/data/FRB_h15_xml.zip";
export const FED_H10_DATA_URL =
  "https://www.federalreserve.gov/releases/h10/data/FRB_h10_xml.zip";
export const BLS_API_URL =
  "https://api.bls.gov/publicAPI/v1/timeseries/data/";

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
      "OFR requests credit for federal-employee works and cautions that third-party materials can have separate restrictions. The hosted dataset contains only OFR-published aggregate and category contributions.",
  },
});

export const FED_SOURCE = Object.freeze({
  id: "federal-reserve",
  name: "Board of Governors of the Federal Reserve System",
  url: "https://www.federalreserve.gov/data.htm",
  dataUrls: [FED_H15_DATA_URL, FED_H10_DATA_URL],
  rights: {
    status: "us-federal-government-public-domain",
    publicDisplayAllowed: true,
    rightsUrl: "https://www.federalreserve.gov/disclaimer.htm",
    attribution:
      "Source: Board of Governors of the Federal Reserve System, H.15 and H.10 statistical releases.",
    note:
      "The Board states that information on its website is in the public domain unless otherwise indicated. These series are read directly from the Board's published statistical-release files.",
  },
});

export const BLS_SOURCE = Object.freeze({
  id: "bls",
  name: "U.S. Bureau of Labor Statistics",
  url: "https://www.bls.gov/data/",
  dataUrl: BLS_API_URL,
  rights: {
    status: "us-federal-government-public-domain",
    publicDisplayAllowed: true,
    rightsUrl: "https://www.bls.gov/opub/copyright-information.htm",
    attribution: "Source: U.S. Bureau of Labor Statistics.",
    note:
      "BLS materials are in the public domain except where a separate restriction is stated. The hosted dataset contains BLS observations and dashboard calculations from them. BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov.",
  },
});

const OFR_SERIES_CONFIG = Object.freeze({
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
  OFRSAFE: {
    column: "Safe assets",
    name: "OFR Financial Stress Index: Safe assets contribution",
    ticker: "OFR SAFE",
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

export const SERIES_CONFIG = Object.freeze({
  ...OFR_SERIES_CONFIG,
  CURVE2S10S: {
    name: "10-Year minus 2-Year Treasury spread",
    ticker: "10Y-2Y",
    unit: "basis points",
    valueType: "dashboard-calculated daily spread",
    sourceRef: FED_SOURCE.id,
    calculation: {
      formula: "100 x (10-year Treasury yield - 2-year Treasury yield)",
      inputs: ["RIFLGFCY10_N.B", "RIFLGFCY02_N.B"],
    },
  },
  REAL10Y: {
    name: "10-Year Treasury inflation-indexed yield",
    ticker: "REAL 10Y",
    unit: "percent",
    valueType: "published daily real yield",
    sourceRef: FED_SOURCE.id,
  },
  CPIYOY: {
    name: "Consumer Price Index 12-month change",
    ticker: "CPI YoY",
    unit: "percent",
    valueType: "dashboard-calculated monthly inflation rate",
    sourceRef: BLS_SOURCE.id,
    calculation: {
      formula: "100 x (CPI / CPI 12 months earlier - 1)",
      inputs: ["CUUR0000SA0"],
    },
  },
  EMPDIFF1M: {
    name: "Private employment diffusion index, 1-month span",
    ticker: "JOBS BREADTH",
    unit: "diffusion index",
    valueType: "published monthly diffusion index",
    sourceRef: BLS_SOURCE.id,
  },
  DTWEXBGS: {
    name: "Nominal Broad U.S. Dollar Index",
    ticker: "BROAD USD",
    unit: "index points",
    valueType: "published daily index level",
    sourceRef: FED_SOURCE.id,
  },
});

const FED_H15_SERIES = Object.freeze([
  "RIFLGFCY02_N.B",
  "RIFLGFCY10_N.B",
  "RIFLGFCY10_XII_N.B",
]);
const FED_H10_SERIES = Object.freeze(["JRXWTFB_N.B"]);
const BLS_INPUT_SERIES = Object.freeze(["CES0500000021", "CUUR0000SA0"]);
const PUBLIC_HISTORY_START = "1991-01-01";
const PERCENTILE_METHOD =
  "Midrank: 100 x (observations below the latest value + 0.5 x observations equal to it) / N";

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
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
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

function round(value, digits = 4) {
  const rounded = Number(value.toFixed(digits));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function normalizeObservations(observations, id) {
  const observationsByDate = new Map();
  for (const observation of observations || []) {
    const date = toIsoDate(observation?.date);
    const value = Number(observation?.value);
    if (!date || !Number.isFinite(value)) {
      throw new Error(`${id} contains an invalid observation`);
    }
    observationsByDate.set(date, round(value));
  }
  const normalized = [...observationsByDate]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => ({ date, value }));
  if (normalized.length < 2) throw new Error(`${id} has fewer than two observations`);
  return normalized;
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
    Object.entries(OFR_SERIES_CONFIG).map(([id, config]) => [
      id,
      headers.indexOf(config.column),
    ]),
  );
  const missingColumns = [
    ...(dateIndex === -1 ? ["Date"] : []),
    ...Object.entries(columnIndexes)
      .filter(([, index]) => index === -1)
      .map(([id]) => OFR_SERIES_CONFIG[id].column),
  ];
  if (missingColumns.length) {
    throw new Error(`OFR FSI CSV is missing columns: ${missingColumns.join(", ")}`);
  }

  const observationsById = Object.fromEntries(
    Object.keys(OFR_SERIES_CONFIG).map((id) => [id, []]),
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
      observationsById[id].push({ date, value });
    }
  }

  return Object.fromEntries(
    Object.entries(observationsById).map(([id, observations]) => [
      id,
      normalizeObservations(observations, id),
    ]),
  );
}

function xmlAttribute(attributes, name) {
  const match = attributes.match(
    new RegExp(`(?:^|\\s)${name}=(?:"([^"]*)"|'([^']*)')`),
  );
  return match ? match[1] ?? match[2] : null;
}

export function parseFedSdmxXml(xml, requestedSeriesNames) {
  const requested = new Set(requestedSeriesNames);
  const observationsByName = Object.fromEntries(
    requestedSeriesNames.map((name) => [name, []]),
  );
  const seriesPattern =
    /<(?:[\w.-]+:)?Series\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?Series>/g;
  let seriesMatch;
  while ((seriesMatch = seriesPattern.exec(xml)) !== null) {
    const seriesName = xmlAttribute(seriesMatch[1], "SERIES_NAME");
    if (!requested.has(seriesName)) continue;

    const observationPattern = /<(?:[\w.-]+:)?Obs\b([^>]*)\/?\s*>/g;
    let observationMatch;
    while ((observationMatch = observationPattern.exec(seriesMatch[2])) !== null) {
      const attributes = observationMatch[1];
      const status = xmlAttribute(attributes, "OBS_STATUS");
      if (status !== "A") continue;
      const date = toIsoDate(xmlAttribute(attributes, "TIME_PERIOD") ?? "");
      const value = Number(xmlAttribute(attributes, "OBS_VALUE"));
      if (!date || !Number.isFinite(value)) continue;
      observationsByName[seriesName].push({ date, value });
    }
  }

  return Object.fromEntries(
    requestedSeriesNames.map((name) => {
      if (!observationsByName[name].length) {
        throw new Error(`Federal Reserve SDMX file is missing series ${name}`);
      }
      return [name, normalizeObservations(observationsByName[name], name)];
    }),
  );
}

export function parseBlsResponse(payload, requestedSeriesIds = BLS_INPUT_SERIES) {
  if (!payload || payload.status !== "REQUEST_SUCCEEDED") {
    const messages = Array.isArray(payload?.message) ? payload.message.join("; ") : "";
    throw new Error(`BLS API request failed${messages ? `: ${messages}` : ""}`);
  }
  const requested = new Set(requestedSeriesIds);
  const observationsById = Object.fromEntries(
    requestedSeriesIds.map((id) => [id, []]),
  );
  for (const series of payload.Results?.series || []) {
    const id = series.seriesID;
    if (!requested.has(id)) continue;
    for (const observation of series.data || []) {
      const periodMatch = String(observation.period).match(/^M(0[1-9]|1[0-2])$/);
      if (!periodMatch || !/^\d{4}$/.test(String(observation.year))) continue;
      const value = Number(String(observation.value).replaceAll(",", ""));
      if (!Number.isFinite(value)) continue;
      observationsById[id].push({
        date: `${observation.year}-${periodMatch[1]}-01`,
        value,
      });
    }
  }
  return observationsById;
}

export function mergeObservationSeries(parts, ids) {
  return Object.fromEntries(
    ids.map((id) => {
      const merged = parts.flatMap((part) => part[id] || []);
      return [id, normalizeObservations(merged, id)];
    }),
  );
}

export function blsYearChunks(startYear, endYear, maximumYears = 10) {
  if (
    !Number.isInteger(startYear) ||
    !Number.isInteger(endYear) ||
    !Number.isInteger(maximumYears) ||
    maximumYears < 1 ||
    endYear < startYear
  ) {
    throw new Error("Invalid BLS year range");
  }
  const chunks = [];
  for (let first = startYear; first <= endYear; first += maximumYears) {
    chunks.push([first, Math.min(endYear, first + maximumYears - 1)]);
  }
  return chunks;
}

export function deriveCurveSpread(twoYear, tenYear) {
  const tenYearByDate = new Map(tenYear.map(({ date, value }) => [date, value]));
  const spread = twoYear.flatMap(({ date, value }) => {
    const longYield = tenYearByDate.get(date);
    return Number.isFinite(longYield)
      ? [{ date, value: round(100 * (longYield - value)) }]
      : [];
  });
  return normalizeObservations(spread, "CURVE2S10S");
}

export function deriveYearOverYear(monthlyIndex, startDate = PUBLIC_HISTORY_START) {
  const valueByDate = new Map(monthlyIndex.map(({ date, value }) => [date, value]));
  const changes = monthlyIndex.flatMap(({ date, value }) => {
    if (date < startDate) return [];
    const year = Number(date.slice(0, 4));
    const comparisonDate = `${year - 1}${date.slice(4)}`;
    const comparisonValue = valueByDate.get(comparisonDate);
    return Number.isFinite(comparisonValue) && comparisonValue !== 0
      ? [{ date, value: round(100 * (value / comparisonValue - 1)) }]
      : [];
  });
  return normalizeObservations(changes, "CPIYOY");
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

function sourceFor(config) {
  if (config.sourceRef === FED_SOURCE.id) return FED_SOURCE;
  if (config.sourceRef === BLS_SOURCE.id) return BLS_SOURCE;
  return OFR_SOURCE;
}

export function buildDashboardData(seriesById, metadata = {}) {
  const ids = Object.keys(SERIES_CONFIG);
  const normalizedById = {};
  for (const id of ids) {
    if (!seriesById[id]?.length) throw new Error(`Missing observations for ${id}`);
    normalizedById[id] = normalizeObservations(seriesById[id], id);
  }

  const firstDates = Object.fromEntries(
    ids.map((id) => [id, normalizedById[id][0].date]),
  );
  const latestDates = Object.fromEntries(
    ids.map((id) => [id, normalizedById[id].at(-1).date]),
  );
  const allLatestDates = Object.values(latestDates).sort();
  const indices = {};

  for (const id of ids) {
    const config = SERIES_CONFIG[id];
    const source = sourceFor(config);
    const history = normalizedById[id];
    const latest = history.at(-1);
    const previous = history.at(-2);
    const values = history.map(({ value }) => value);
    const change = round(latest.value - previous.value);
    const changePercent =
      id === "DTWEXBGS" && previous.value !== 0
        ? round((100 * change) / previous.value, 2)
        : null;

    indices[id] = {
      name: config.name,
      ticker: config.ticker,
      unit: config.unit,
      valueType: config.valueType,
      sourceRef: source.id,
      sourceUrl: source.url,
      ...(config.calculation ? { calculation: config.calculation } : {}),
      latest: {
        date: latest.date,
        value: latest.value,
        previousDate: previous.date,
        previousValue: previous.value,
        change,
        changePercent,
      },
      percentile: {
        rank: midrankPercentile(values, latest.value),
        startDate: history[0].date,
        endDate: latest.date,
        observations: values.length,
        method: PERCENTILE_METHOD,
      },
      stats: summarizeDistribution(values),
      history: history.map(({ date, value }) => [date, value]),
    };
  }

  const sources = {
    [OFR_SOURCE.id]: OFR_SOURCE,
    [FED_SOURCE.id]: FED_SOURCE,
    [BLS_SOURCE.id]: BLS_SOURCE,
  };
  return {
    schemaVersion: 1,
    generatedAt: `${allLatestDates.at(-1)}T00:00:00.000Z`,
    retrievedAt: metadata.retrievedAt || allLatestDates.at(-1),
    source: OFR_SOURCE,
    sources,
    rights: {
      publicDisplayAllowed: Object.values(sources).every(
        (source) => source.rights.publicDisplayAllowed,
      ),
      policy:
        "Hosted data contains only public OFR, Federal Reserve Board, and BLS observations, plus documented dashboard calculations from those observations.",
      sources: Object.fromEntries(
        Object.entries(sources).map(([id, source]) => [id, source.rights]),
      ),
    },
    commonWindow: {
      alignmentMode: "per-series",
      startDate: null,
      endDate: null,
      sharedDateObservations: null,
      firstDates,
      latestDates,
      latestAligned: allLatestDates.every((date) => date === allLatestDates[0]),
      comparisonBasis:
        "Each hosted series uses its own configured compatible history. Percentile dates and observation counts are stored on each indicator.",
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

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "user-agent": "eco-dashboard-public-data-updater/2.0",
          ...options.headers,
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(500 * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Failed to download ${url}: ${lastError.message}`);
}

async function fetchText(url) {
  const response = await fetchWithRetry(url);
  return response.text();
}

async function fetchBuffer(url) {
  const response = await fetchWithRetry(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 4 || buffer.subarray(0, 2).toString("ascii") !== "PK") {
    throw new Error(`Downloaded file is not a ZIP archive: ${url}`);
  }
  return buffer;
}

async function fetchBlsChunk(seriesIds, startYear, endYear) {
  const response = await fetchWithRetry(BLS_API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      seriesid: seriesIds,
      startyear: String(startYear),
      endyear: String(endYear),
    }),
  });
  return parseBlsResponse(await response.json(), seriesIds);
}

async function fetchBlsHistory(endYear) {
  const parts = [];
  for (const [startYear, chunkEndYear] of blsYearChunks(1990, endYear)) {
    parts.push(await fetchBlsChunk(BLS_INPUT_SERIES, startYear, chunkEndYear));
  }
  return mergeObservationSeries(parts, BLS_INPUT_SERIES);
}

async function unzipXml(zipBuffer, entryName, zipPath) {
  await writeFile(zipPath, zipBuffer);
  const { stdout } = await execFileAsync("unzip", ["-p", zipPath, entryName], {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  if (!stdout.includes("<")) throw new Error(`${entryName} is empty or invalid`);
  return stdout;
}

export async function updateData(outputPath = path.resolve("data/indices.json")) {
  const currentYear = new Date().getUTCFullYear();
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "eco-dashboard-public-data-"),
  );
  try {
    const [ofrCsv, h15Zip, h10Zip, blsInputs] = await Promise.all([
      fetchText(OFR_DATA_URL),
      fetchBuffer(FED_H15_DATA_URL),
      fetchBuffer(FED_H10_DATA_URL),
      fetchBlsHistory(currentYear),
    ]);
    const h15Xml = await unzipXml(
      h15Zip,
      "H15_data.xml",
      path.join(temporaryDirectory, "h15.zip"),
    );
    const h10Xml = await unzipXml(
      h10Zip,
      "H10_data.xml",
      path.join(temporaryDirectory, "h10.zip"),
    );
    const h15 = parseFedSdmxXml(h15Xml, FED_H15_SERIES);
    const h10 = parseFedSdmxXml(h10Xml, FED_H10_SERIES);
    const ofr = parseOfrCsv(ofrCsv);
    const seriesById = {
      ...ofr,
      CURVE2S10S: deriveCurveSpread(
        h15["RIFLGFCY02_N.B"],
        h15["RIFLGFCY10_N.B"],
      ),
      REAL10Y: h15["RIFLGFCY10_XII_N.B"],
      CPIYOY: deriveYearOverYear(blsInputs.CUUR0000SA0),
      EMPDIFF1M: blsInputs.CES0500000021.filter(
        ({ date }) => date >= PUBLIC_HISTORY_START,
      ),
      DTWEXBGS: h10["JRXWTFB_N.B"],
    };
    const dashboardData = buildDashboardData(seriesById, {
      retrievedAt: new Date().toISOString().slice(0, 10),
    });
    const temporaryPath = `${outputPath}.tmp`;
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(temporaryPath, serializeDashboardData(dashboardData), "utf8");
    await rename(temporaryPath, outputPath);
    return dashboardData;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
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
      console.log(`Updated public economic data: ${JSON.stringify(latest)}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
