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
export const CFTC_TFF_FUTURES_ONLY_DATASET_ID = "gpe5-46if";
export const CFTC_E_MINI_SP500_CONTRACT_CODE = "13874A";
export const CFTC_E_MINI_SP500_FIRST_REPORT_DATE = "2006-06-13";
export const CFTC_E_MINI_SP500_MINIMUM_HISTORY = 1000;
export const CFTC_API_URL =
  `https://publicreporting.cftc.gov/resource/${CFTC_TFF_FUTURES_ONLY_DATASET_ID}.json`;
const CFTC_SELECT_FIELDS = [
  "report_date_as_yyyy_mm_dd",
  "cftc_contract_market_code",
  "market_and_exchange_names",
  "contract_units",
  "open_interest_all",
  "lev_money_positions_long",
  "lev_money_positions_short",
  "lev_money_positions_spread",
].join(",");
export const CFTC_DATA_URL =
  `${CFTC_API_URL}?$select=${CFTC_SELECT_FIELDS}` +
  `&$where=cftc_contract_market_code%3D%27${CFTC_E_MINI_SP500_CONTRACT_CODE}%27` +
  "&$order=report_date_as_yyyy_mm_dd%20ASC&$limit=50000";

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

export const CFTC_SOURCE = Object.freeze({
  id: "cftc",
  name: "U.S. Commodity Futures Trading Commission",
  url: `https://publicreportinghub.cftc.gov/Commitments-of-Traders/TFF-Futures-Only/${CFTC_TFF_FUTURES_ONLY_DATASET_ID}`,
  dataUrl: CFTC_DATA_URL,
  datasetId: CFTC_TFF_FUTURES_ONLY_DATASET_ID,
  contractCode: CFTC_E_MINI_SP500_CONTRACT_CODE,
  rights: {
    status: "us-federal-government-public-domain-credit-requested",
    publicDisplayAllowed: true,
    rightsUrl: "https://www.cftc.gov/WebPolicy/index.htm",
    attribution:
      "Source: U.S. Commodity Futures Trading Commission, Commitments of Traders, Traders in Financial Futures, Futures Only, contract 13874A. Derived calculation by Market Surface.",
    note:
      "The CFTC states that government information on its website is in the public domain and requests appropriate acknowledgement. The hosted series contains CFTC-published futures positions and a documented dashboard calculation. It does not contain S&P 500 index levels or exchange-provided market-price data.",
  },
});

const OFR_SERIES_CONFIG = Object.freeze({
  OFRFSI: {
    column: "OFR FSI",
    name: "OFR Financial Stress Index",
    ticker: "OFR FSI",
    unit: "index points",
    valueType: "published daily index level",
    sourceRef: OFR_SOURCE.id,
  },
  OFRVOL: {
    column: "Volatility",
    name: "OFR Financial Stress Index: Volatility contribution",
    ticker: "OFR VOL",
    unit: "stress contribution",
    valueType: "published daily category contribution",
    sourceRef: OFR_SOURCE.id,
  },
  OFREQUITY: {
    column: "Equity valuation",
    name: "OFR Financial Stress Index: Equity valuation contribution",
    ticker: "OFR EQUITY",
    unit: "stress contribution",
    valueType: "published daily category contribution",
    sourceRef: OFR_SOURCE.id,
  },
  OFRSAFE: {
    column: "Safe assets",
    name: "OFR Financial Stress Index: Safe assets contribution",
    ticker: "OFR SAFE",
    unit: "stress contribution",
    valueType: "published daily category contribution",
    sourceRef: OFR_SOURCE.id,
  },
  OFRCREDIT: {
    column: "Credit",
    name: "OFR Financial Stress Index: Credit contribution",
    ticker: "OFR CREDIT",
    unit: "stress contribution",
    valueType: "published daily category contribution",
    sourceRef: OFR_SOURCE.id,
  },
  OFRFUNDING: {
    column: "Funding",
    name: "OFR Financial Stress Index: Funding contribution",
    ticker: "OFR FUNDING",
    unit: "stress contribution",
    valueType: "published daily category contribution",
    sourceRef: OFR_SOURCE.id,
  },
});

export const SERIES_CONFIG = Object.freeze({
  ...OFR_SERIES_CONFIG,
  DGS2: {
    name: "2-Year Treasury Constant Maturity Rate",
    ticker: "DGS2",
    unit: "percent",
    valueType: "published daily nominal yield",
    sourceRef: FED_SOURCE.id,
    provenance: {
      release: "H.15 Selected Interest Rates",
      sourceSeries: ["RIFLGFCY02_N.B"],
      transformation: "identity",
    },
  },
  DGS10: {
    name: "10-Year Treasury Constant Maturity Rate",
    ticker: "DGS10",
    unit: "percent",
    valueType: "published daily nominal yield",
    sourceRef: FED_SOURCE.id,
    provenance: {
      release: "H.15 Selected Interest Rates",
      sourceSeries: ["RIFLGFCY10_N.B"],
      transformation: "identity",
    },
  },
  CURVE2S10S: {
    name: "10-Year minus 2-Year Treasury spread",
    ticker: "10Y-2Y",
    unit: "basis points",
    valueType: "dashboard-calculated daily spread",
    sourceRef: FED_SOURCE.id,
    calculation: {
      formula: "100 x (10-year Treasury yield - 2-year Treasury yield)",
      inputs: ["DGS10", "DGS2"],
    },
    provenance: {
      release: "H.15 Selected Interest Rates",
      sourceSeries: ["RIFLGFCY10_N.B", "RIFLGFCY02_N.B"],
      transformation: "same-date spread",
    },
  },
  REAL10Y: {
    name: "10-Year Treasury inflation-indexed yield",
    ticker: "REAL 10Y",
    unit: "percent",
    valueType: "published daily real yield",
    sourceRef: FED_SOURCE.id,
    provenance: {
      release: "H.15 Selected Interest Rates",
      sourceSeries: ["RIFLGFCY10_XII_N.B"],
      transformation: "identity",
    },
  },
  RATEVOL20: {
    name: "20-Observation Realized 10-Year Treasury Yield Volatility",
    ticker: "RATE VOL 20",
    unit: "basis points per day",
    valueType: "dashboard-calculated daily realized rate volatility",
    sourceRef: FED_SOURCE.id,
    calculation: {
      formula:
        "Non-annualized sample standard deviation of the latest 20 valid daily DGS10 changes, measured in basis points",
      inputs: ["DGS10"],
      windowObservations: 20,
      annualized: false,
    },
    provenance: {
      release: "H.15 Selected Interest Rates",
      sourceSeries: ["RIFLGFCY10_N.B"],
      transformation: "rolling sample standard deviation",
    },
  },
  INFLATIONCOMP10Y: {
    name: "10-Year nominal-real yield gap",
    ticker: "10Y INFL COMP",
    unit: "percentage points",
    valueType: "dashboard-calculated daily inflation-compensation proxy",
    sourceRef: FED_SOURCE.id,
    calculation: {
      formula: "DGS10 - REAL10Y on matching dates",
      inputs: ["DGS10", "REAL10Y"],
      note:
        "This is an inflation-compensation proxy, not a pure inflation forecast; it can also reflect inflation-risk and liquidity premia.",
    },
    provenance: {
      release: "H.15 Selected Interest Rates",
      sourceSeries: ["RIFLGFCY10_N.B", "RIFLGFCY10_XII_N.B"],
      transformation: "same-date nominal-real yield difference",
    },
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
  LEVSPNET: {
    name: "Leveraged Funds Net E-mini S&P 500 Positioning",
    ticker: "LEV S&P NET",
    unit: "percent of open interest",
    valueType: "dashboard-calculated weekly net futures positioning",
    sourceRef: CFTC_SOURCE.id,
    calculation: {
      formula:
        "100 x (leveraged funds long positions - leveraged funds short positions) / total open interest",
      inputs: [
        "lev_money_positions_long",
        "lev_money_positions_short",
        "open_interest_all",
      ],
      note:
        "Spreading positions are excluded from the directional numerator. A net short value is a positioning measure, not a standalone equity-market forecast. CFTC notes that pre-publication history was backcast using later trader classifications and becomes less accurate farther back.",
    },
    provenance: {
      report: "Traders in Financial Futures, Futures Only",
      datasetId: CFTC_TFF_FUTURES_ONLY_DATASET_ID,
      contractCode: CFTC_E_MINI_SP500_CONTRACT_CODE,
      observationTiming:
        "CFTC report date, normally Tuesday and sometimes holiday-adjusted",
      usualPublicationTiming: "Friday at 3:30 p.m. Eastern time",
      transformation: "directional leveraged-funds net divided by total open interest",
      retrievalMode: "complete-history-refetch",
    },
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

function normalizeObservations(observations, id, minimumObservations = 2) {
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
  if (normalized.length < minimumObservations) {
    if (minimumObservations === 2) {
      throw new Error(`${id} has fewer than two observations`);
    }
    throw new Error(
      `${id} has fewer than ${minimumObservations} observation${minimumObservations === 1 ? "" : "s"}`,
    );
  }
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

function parseCftcNumericField(row, fieldName) {
  const rawValue = row?.[fieldName];
  if (typeof rawValue !== "string" && typeof rawValue !== "number") {
    throw new Error(`CFTC ${fieldName} is missing or is not numeric`);
  }
  const normalized = String(rawValue).trim().replaceAll(",", "");
  if (!normalized) throw new Error(`CFTC ${fieldName} is blank`);
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error(`CFTC ${fieldName} is not a finite number`);
  }
  return value;
}

export function parseCftcTffFuturesOnly(payload) {
  if (!Array.isArray(payload)) {
    throw new Error("CFTC TFF Futures Only response must be an array");
  }

  const rowsByDate = new Map();
  for (const row of payload) {
    if (
      row?.cftc_contract_market_code !== CFTC_E_MINI_SP500_CONTRACT_CODE
    ) {
      throw new Error(
        `CFTC response contains a contract other than ${CFTC_E_MINI_SP500_CONTRACT_CODE}`,
      );
    }

    const rawDate =
      typeof row.report_date_as_yyyy_mm_dd === "string"
        ? row.report_date_as_yyyy_mm_dd.trim()
        : "";
    const date = toIsoDate(rawDate.slice(0, 10));
    if (!date) throw new Error("CFTC response contains an invalid report date");

    const openInterest = parseCftcNumericField(row, "open_interest_all");
    const leveragedLong = parseCftcNumericField(
      row,
      "lev_money_positions_long",
    );
    const leveragedShort = parseCftcNumericField(
      row,
      "lev_money_positions_short",
    );
    const leveragedSpread = parseCftcNumericField(
      row,
      "lev_money_positions_spread",
    );
    if (openInterest <= 0) {
      throw new Error("CFTC open_interest_all must be positive");
    }
    if (leveragedLong < 0 || leveragedShort < 0 || leveragedSpread < 0) {
      throw new Error("CFTC position fields must be non-negative");
    }

    if (rowsByDate.has(date)) {
      throw new Error(`CFTC response contains a duplicate report date: ${date}`);
    }
    rowsByDate.set(date, {
      date,
      contractCode: CFTC_E_MINI_SP500_CONTRACT_CODE,
      openInterest,
      leveragedLong,
      leveragedShort,
      leveragedSpread,
    });
  }

  const rows = [...rowsByDate.values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  if (rows.length < CFTC_E_MINI_SP500_MINIMUM_HISTORY) {
    throw new Error(
      `CFTC TFF Futures Only response has fewer than ${CFTC_E_MINI_SP500_MINIMUM_HISTORY} observations`,
    );
  }
  if (rows[0].date !== CFTC_E_MINI_SP500_FIRST_REPORT_DATE) {
    throw new Error(
      `CFTC TFF Futures Only history must begin on ${CFTC_E_MINI_SP500_FIRST_REPORT_DATE}`,
    );
  }
  return rows;
}

export function deriveLeveragedSp500Net(cftcRows) {
  const observations = (cftcRows || []).map((row) => {
    if (row?.contractCode !== CFTC_E_MINI_SP500_CONTRACT_CODE) {
      throw new Error(
        `LEVSPNET requires CFTC contract ${CFTC_E_MINI_SP500_CONTRACT_CODE}`,
      );
    }
    const { date, openInterest, leveragedLong, leveragedShort } = row;
    if (
      !Number.isFinite(openInterest) ||
      openInterest <= 0 ||
      !Number.isFinite(leveragedLong) ||
      !Number.isFinite(leveragedShort)
    ) {
      throw new Error("LEVSPNET contains invalid CFTC position inputs");
    }
    return {
      date,
      value: round((100 * (leveragedLong - leveragedShort)) / openInterest),
    };
  });
  return normalizeObservations(observations, "LEVSPNET");
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

export function deriveRateVolatility20(tenYear) {
  const windowChanges = 20;
  const yields = normalizeObservations(tenYear, "DGS10");
  if (yields.length < windowChanges + 1) {
    throw new Error(
      `RATEVOL20 requires at least ${windowChanges + 1} valid DGS10 yield observations`,
    );
  }

  const dailyChanges = yields.slice(1).map(({ date, value }, index) => ({
    date,
    value: 100 * (value - yields[index].value),
  }));
  const volatility = [];
  for (let end = windowChanges; end <= dailyChanges.length; end += 1) {
    const changes = dailyChanges.slice(end - windowChanges, end);
    const mean = changes.reduce((sum, observation) => sum + observation.value, 0) /
      windowChanges;
    const squaredDeviations = changes.reduce(
      (sum, observation) => sum + (observation.value - mean) ** 2,
      0,
    );
    volatility.push({
      date: changes.at(-1).date,
      value: round(Math.sqrt(squaredDeviations / (windowChanges - 1))),
    });
  }

  return normalizeObservations(volatility, "RATEVOL20", 1);
}

export function deriveInflationCompensation10Y(tenYear, realTenYear) {
  const realYieldByDate = new Map(
    realTenYear.map(({ date, value }) => [date, value]),
  );
  const compensation = tenYear.flatMap(({ date, value }) => {
    const realYield = realYieldByDate.get(date);
    return Number.isFinite(realYield)
      ? [{ date, value: round(value - realYield) }]
      : [];
  });
  return normalizeObservations(compensation, "INFLATIONCOMP10Y");
}

export function buildTreasurySeries(h15Series) {
  const twoYear = normalizeObservations(
    h15Series?.["RIFLGFCY02_N.B"],
    "DGS2",
  );
  const tenYear = normalizeObservations(
    h15Series?.["RIFLGFCY10_N.B"],
    "DGS10",
  );
  const realTenYear = normalizeObservations(
    h15Series?.["RIFLGFCY10_XII_N.B"],
    "REAL10Y",
  );
  return {
    DGS2: twoYear,
    DGS10: tenYear,
    CURVE2S10S: deriveCurveSpread(twoYear, tenYear),
    REAL10Y: realTenYear,
    RATEVOL20: deriveRateVolatility20(tenYear),
    INFLATIONCOMP10Y: deriveInflationCompensation10Y(tenYear, realTenYear),
  };
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

const SOURCE_REGISTRY = Object.freeze({
  [OFR_SOURCE.id]: OFR_SOURCE,
  [FED_SOURCE.id]: FED_SOURCE,
  [BLS_SOURCE.id]: BLS_SOURCE,
  [CFTC_SOURCE.id]: CFTC_SOURCE,
});

export function sourceFor(config) {
  const source = SOURCE_REGISTRY[config?.sourceRef];
  if (!source) {
    throw new Error(`Unknown source reference: ${config?.sourceRef ?? "(missing)"}`);
  }
  return source;
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
      ...(config.provenance
        ? { provenance: { sourceRef: source.id, ...config.provenance } }
        : {}),
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

  const sources = SOURCE_REGISTRY;
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
        "Hosted data contains only public OFR, Federal Reserve Board, BLS, and CFTC observations, plus documented dashboard calculations from those observations.",
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

async function fetchJson(url) {
  const response = await fetchWithRetry(url, {
    headers: { accept: "application/json" },
  });
  return response.json();
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
    const [ofrCsv, h15Zip, h10Zip, blsInputs, cftcPayload] = await Promise.all([
      fetchText(OFR_DATA_URL),
      fetchBuffer(FED_H15_DATA_URL),
      fetchBuffer(FED_H10_DATA_URL),
      fetchBlsHistory(currentYear),
      fetchJson(CFTC_DATA_URL),
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
      ...buildTreasurySeries(h15),
      CPIYOY: deriveYearOverYear(blsInputs.CUUR0000SA0),
      EMPDIFF1M: blsInputs.CES0500000021.filter(
        ({ date }) => date >= PUBLIC_HISTORY_START,
      ),
      DTWEXBGS: h10["JRXWTFB_N.B"],
      LEVSPNET: deriveLeveragedSp500Net(
        parseCftcTffFuturesOnly(cftcPayload),
      ),
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
