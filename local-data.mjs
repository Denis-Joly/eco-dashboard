const SUPPORTED_SYMBOLS = Object.freeze(["VIXEQ", "COR1M", "DSPX", "VIX"]);
const MAX_ROWS = 20_000;

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

  if (quoted) throw new Error("The CSV contains an unclosed quote.");
  values.push(value.trim());
  return values;
}

function normaliseHeader(value) {
  return value.replace(/^\uFEFF/, "").trim().toUpperCase();
}

function toIsoDate(value) {
  const trimmed = value.trim();
  let year;
  let month;
  let day;
  let match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    [, year, month, day] = match.map(Number);
  } else {
    match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    [, month, day, year] = match.map(Number);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function detectSymbol(headers, fileName) {
  const headerMatch = SUPPORTED_SYMBOLS.find((symbol) => headers.includes(symbol));
  if (headerMatch) return headerMatch;

  const upperName = String(fileName || "").toUpperCase();
  return SUPPORTED_SYMBOLS.find((symbol) => {
    const pattern = new RegExp(`(^|[^A-Z0-9])${symbol}([^A-Z0-9]|$)`);
    return pattern.test(upperName);
  }) || null;
}

function round(value, digits = 4) {
  const rounded = Number(value.toFixed(digits));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function quantile(sorted, probability) {
  if (!sorted.length) return Number.NaN;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const fraction = position - lower;
  return sorted[lower + 1] === undefined
    ? sorted[lower]
    : sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
}

export function midrankPercentile(values, target) {
  if (!values.length) throw new Error("A percentile needs at least one observation.");
  let below = 0;
  let equal = 0;
  for (const value of values) {
    if (value < target) below += 1;
    else if (value === target) equal += 1;
  }
  return round((100 * (below + 0.5 * equal)) / values.length, 2);
}

export function parseLocalCsv(csv, fileName = "") {
  const lines = String(csv)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) throw new Error("The selected CSV needs a header and at least two observations.");
  if (lines.length - 1 > MAX_ROWS) throw new Error(`The selected CSV exceeds the ${MAX_ROWS.toLocaleString("en")} row limit.`);

  const headers = parseCsvRow(lines[0]).map(normaliseHeader);
  const dateIndex = headers.indexOf("DATE");
  const symbol = detectSymbol(headers, fileName);
  if (dateIndex === -1) throw new Error("The selected CSV does not contain a DATE column.");
  if (!symbol) throw new Error("The indicator could not be identified. Use a VIX, VIXEQ, DSPX or COR1M file with the ticker in its header or filename.");

  let valueIndex = headers.indexOf(symbol);
  if (valueIndex === -1) valueIndex = headers.indexOf("CLOSE");
  if (valueIndex === -1 && headers.length === 2) valueIndex = dateIndex === 0 ? 1 : 0;
  if (valueIndex === -1) throw new Error(`No value column was found for ${symbol}.`);

  const observations = new Map();
  let duplicateRows = 0;

  for (const line of lines.slice(1)) {
    const row = parseCsvRow(line);
    const date = toIsoDate(row[dateIndex] || "");
    const rawValue = (row[valueIndex] || "").trim();
    const value = rawValue === "" ? Number.NaN : Number(rawValue);
    if (!date || !Number.isFinite(value)) {
      throw new Error("The selected CSV contains an invalid data row.");
    }
    if (observations.has(date)) duplicateRows += 1;
    observations.set(date, value);
  }

  const history = [...observations]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => ({ date, value }));

  if (history.length < 2) throw new Error(`${symbol} needs at least two valid observations after validation.`);
  return { symbol, history, rejectedRows: 0, duplicateRows };
}

export function buildLocalIndexRecord(symbol, history, sourceUrl, comparisonWindow) {
  if (!SUPPORTED_SYMBOLS.includes(symbol)) throw new Error(`Unsupported local indicator: ${symbol}`);
  if (!Array.isArray(history) || history.length < 2) throw new Error(`${symbol} needs at least two observations.`);

  let sortedHistory = [...history].sort((left, right) => left.date.localeCompare(right.date));
  let comparisonStartDate;
  let comparisonEndDate;
  if (comparisonWindow !== undefined) {
    const startDate = toIsoDate(String(comparisonWindow?.startDate || ""));
    const endDate = toIsoDate(String(comparisonWindow?.endDate || ""));
    if (
      !startDate ||
      !endDate ||
      startDate !== comparisonWindow.startDate ||
      endDate !== comparisonWindow.endDate ||
      startDate > endDate
    ) {
      throw new Error("The comparison window must contain valid ISO start and end dates.");
    }
    sortedHistory = sortedHistory.filter(
      ({ date }) => date >= startDate && date <= endDate,
    );
    comparisonStartDate = startDate;
    comparisonEndDate = endDate;
    if (sortedHistory.length < 2) {
      throw new Error("The comparison window needs at least two observations.");
    }
  }

  const values = sortedHistory.map((point) => point.value);
  const sortedValues = [...values].sort((left, right) => left - right);
  const latest = sortedHistory.at(-1);
  const previous = sortedHistory.at(-2);
  const change = latest.value - previous.value;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    ticker: symbol,
    valueType: "User-selected local CSV",
    sourceUrl,
    dataOrigin: "local-session",
    latest: {
      date: latest.date,
      value: latest.value,
      previousDate: previous.date,
      previousValue: previous.value,
      change: round(change),
      changePercent: previous.value === 0 ? null : round((100 * change) / previous.value, 2),
    },
    percentile: {
      rank: midrankPercentile(values, latest.value),
      startDate: sortedHistory[0].date,
      endDate: latest.date,
      comparisonStartDate: comparisonStartDate || sortedHistory[0].date,
      comparisonEndDate: comparisonEndDate || latest.date,
      observations: values.length,
      method: "Midrank within the user-selected local history",
    },
    stats: {
      min: round(sortedValues[0]),
      max: round(sortedValues.at(-1)),
      median: round(quantile(sortedValues, 0.5)),
      p25: round(quantile(sortedValues, 0.25)),
      p75: round(quantile(sortedValues, 0.75)),
      mean: round(mean),
    },
    history: sortedHistory.map(({ date, value }) => [date, value]),
  };
}

export const LOCAL_DATA_LIMITS = Object.freeze({
  maxFiles: 4,
  maxBytesPerFile: 12_000_000,
  maxRows: MAX_ROWS,
});
