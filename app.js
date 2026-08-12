import {
  buildLocalIndexRecord,
  LOCAL_DATA_LIMITS,
  parseLocalCsv,
} from "./local-data.mjs";

const CORE_INDICATORS = [
  "OFRFSI",
  "OFRVOL",
  "OFREQUITY",
  "OFRSAFE",
  "OFRCREDIT",
  "OFRFUNDING",
  "DGS2",
  "DGS10",
  "CURVE2S10S",
  "RATEVOL20",
  "REAL10Y",
  "INFLATIONCOMP10Y",
  "CPIYOY",
  "EMPDIFF1M",
  "DTWEXBGS",
  "LEVSPNET",
];
const LOCAL_INDICATORS = new Set(["VIX", "VIXEQ", "DSPX", "COR1M"]);

const FALLBACK_META = {
  OFRFSI: {
    ticker: "OFR FSI",
    name: "OFR Financial Stress Index",
    cardName: "Overall financial stress",
    role: "System-wide stress",
    color: "#90f0c4",
    unitLabel: "Stress index points",
    showChangePercent: false,
    definition: "A daily market-based snapshot of stress across global financial markets",
  },
  OFRVOL: {
    ticker: "VOL",
    name: "OFR Volatility contribution",
    cardName: "Volatility contribution",
    role: "Volatility stress",
    color: "#77bdfb",
    unitLabel: "Contribution points",
    showChangePercent: false,
    definition: "The volatility category's contribution to the OFR Financial Stress Index",
  },
  OFREQUITY: {
    ticker: "EQUITY",
    name: "OFR Equity valuation contribution",
    cardName: "Equity valuation contribution",
    role: "Equity stress",
    color: "#d9ef72",
    unitLabel: "Contribution points",
    showChangePercent: false,
    definition: "The equity valuation category's contribution to the OFR Financial Stress Index",
  },
  OFRSAFE: {
    ticker: "SAFE",
    name: "OFR Safe assets contribution",
    cardName: "Safe assets contribution",
    role: "Safe-haven stress",
    color: "#65d6d0",
    unitLabel: "Contribution points",
    showChangePercent: false,
    definition: "The safe-assets category's contribution to the OFR Financial Stress Index",
  },
  OFRCREDIT: {
    ticker: "CREDIT",
    name: "OFR Credit contribution",
    cardName: "Credit contribution",
    role: "Credit stress",
    color: "#f4c66c",
    unitLabel: "Contribution points",
    showChangePercent: false,
    definition: "The credit category's contribution to the OFR Financial Stress Index",
  },
  OFRFUNDING: {
    ticker: "FUNDING",
    name: "OFR Funding contribution",
    cardName: "Funding contribution",
    role: "Funding stress",
    color: "#ff8e72",
    unitLabel: "Contribution points",
    showChangePercent: false,
    definition: "The funding category's contribution to the OFR Financial Stress Index",
  },
  CURVE2S10S: {
    ticker: "10Y-2Y",
    name: "10-Year minus 2-Year Treasury spread",
    cardName: "Yield-curve slope",
    role: "Cycle context",
    color: "#c9a9ff",
    unitLabel: "Basis points",
    showChangePercent: false,
    definition: "The same-date difference between 10-year and 2-year Treasury yields",
  },
  DGS2: {
    ticker: "2Y",
    name: "2-Year Treasury Constant Maturity Rate",
    cardName: "Two-year Treasury yield",
    role: "Policy-sensitive yield",
    color: "#c9a9ff",
    unitLabel: "Percent",
    showChangePercent: false,
    definition: "The Federal Reserve's daily two-year Treasury constant-maturity yield",
  },
  DGS10: {
    ticker: "10Y",
    name: "10-Year Treasury Constant Maturity Rate",
    cardName: "Ten-year Treasury yield",
    role: "Long nominal yield",
    color: "#c9a9ff",
    unitLabel: "Percent",
    showChangePercent: false,
    definition: "The Federal Reserve's daily ten-year Treasury constant-maturity yield",
  },
  RATEVOL20: {
    ticker: "RATE VOL 20",
    name: "20-Observation Realized 10-Year Treasury Yield Volatility",
    cardName: "Treasury rate volatility",
    role: "Realized bond-market instability",
    color: "#c9a9ff",
    unitLabel: "Basis points per day",
    showChangePercent: false,
    definition: "The sample volatility of the latest 20 daily changes in the 10-year Treasury yield",
  },
  REAL10Y: {
    ticker: "REAL 10Y",
    name: "10-Year Treasury inflation-indexed yield",
    cardName: "Ten-year real yield",
    role: "Real discount rate",
    color: "#c9a9ff",
    unitLabel: "Percent",
    showChangePercent: false,
    definition: "The market's inflation-adjusted 10-year Treasury yield",
  },
  CPIYOY: {
    ticker: "CPI YoY",
    name: "Consumer Price Index 12-month change",
    cardName: "Headline inflation",
    role: "Inflation pressure",
    color: "#c9a9ff",
    unitLabel: "Percent",
    showChangePercent: false,
    definition: "The 12-month percentage change in the headline Consumer Price Index",
  },
  INFLATIONCOMP10Y: {
    ticker: "10Y INFL COMP",
    name: "10-Year nominal-real yield gap",
    cardName: "Ten-year inflation compensation",
    role: "Bond-market inflation compensation",
    color: "#c9a9ff",
    unitLabel: "Percentage points",
    showChangePercent: false,
    definition: "The same-date gap between nominal and real ten-year Treasury yields",
  },
  EMPDIFF1M: {
    ticker: "JOBS BREADTH",
    name: "Private employment diffusion index",
    cardName: "Private-sector job breadth",
    role: "Labour breadth",
    color: "#ff9f87",
    unitLabel: "Diffusion index",
    showChangePercent: false,
    definition: "How widely monthly employment gains or losses are spread across private industries",
  },
  DTWEXBGS: {
    ticker: "BROAD USD",
    name: "Nominal Broad U.S. Dollar Index",
    cardName: "Broad dollar",
    role: "Global tightening context",
    color: "#65d6d0",
    unitLabel: "Index points",
    showChangePercent: false,
    definition: "The trade-weighted value of the U.S. dollar against a broad group of currencies",
  },
  LEVSPNET: {
    ticker: "LEV S&P NET",
    name: "Leveraged funds net E-mini S&P 500 positioning",
    cardName: "Leveraged equity positioning",
    role: "Equity futures positioning",
    color: "#77bdfb",
    unitLabel: "Percent of open interest",
    showChangePercent: false,
    definition: "Leveraged funds' directional net E-mini S&P 500 futures position as a share of total open interest",
  },
  VIX: {
    ticker: "VIX",
    name: "Cboe Volatility Index",
    cardName: "S&P 500 index volatility",
    role: "Index volatility",
    color: "#90f0c4",
    unitLabel: "Volatility points",
    showChangePercent: false,
    definition: "Expected 30-day volatility of the S&P 500 index",
  },
  VIXEQ: {
    ticker: "VIXEQ",
    name: "Cboe S&P 500 Constituent Volatility Index",
    cardName: "S&P 500 constituent volatility",
    role: "Stock-level volatility",
    color: "#77bdfb",
    unitLabel: "Volatility points",
    showChangePercent: false,
    definition: "Weighted 30-day implied volatility inside the S&P 500",
  },
  DSPX: {
    ticker: "DSPX",
    name: "Cboe S&P 500 Dispersion Index",
    cardName: "S&P 500 implied dispersion",
    role: "Dispersion",
    color: "#d9ef72",
    unitLabel: "Dispersion points",
    showChangePercent: false,
    definition: "Expected idiosyncratic movement among S&P 500 constituents",
  },
  COR1M: {
    ticker: "COR1M",
    name: "Cboe 1-Month Implied Correlation Index",
    cardName: "1-month implied correlation",
    role: "Correlation",
    color: "#ffb185",
    unitLabel: "Implied correlation %",
    showChangePercent: false,
    definition: "Expected co-movement among the largest S&P 500 constituents",
  },
};

const state = {
  data: null,
  localSymbols: new Set(),
  localHistories: new Map(),
  localComparisonWindow: null,
  catalog: null,
  symbol: "OFRFSI",
  range: "5Y",
  visibleHistory: [],
  lineChartModel: null,
  inspectedIndex: null,
  activeRegime: null,
  networkView: "overview",
  networkSymbol: "OFRFSI",
};

const ui = {
  updateChip: document.querySelector("#update-chip"),
  updateLabel: document.querySelector("#update-label"),
  comparisonWindow: document.querySelector("#comparison-window"),
  sourceRetrievalDate: document.querySelector("#source-retrieval-date"),
  metricGrid: document.querySelector("#metric-grid"),
  metricGridStatus: document.querySelector("#metric-grid-status"),
  ofrBreakdown: document.querySelector("#ofr-breakdown"),
  ofrBreakdownList: document.querySelector("#ofr-breakdown-list"),
  ofrBreakdownDate: document.querySelector("#ofr-breakdown-date"),
  treasuryBreakdown: document.querySelector("#treasury-breakdown"),
  treasuryBreakdownList: document.querySelector("#treasury-breakdown-list"),
  treasuryBreakdownDate: document.querySelector("#treasury-breakdown-date"),
  regimeTitle: document.querySelector("#regime-title"),
  regimeCopy: document.querySelector("#regime-copy"),
  regimeAsOf: document.querySelector("#regime-as-of"),
  signalList: document.querySelector("#signal-list"),
  indexPicker: document.querySelector("#index-picker"),
  rangePicker: document.querySelector("#range-picker"),
  historyTitle: document.querySelector("#history-title"),
  historyFrequencyLabel: document.querySelector("#history-frequency-label"),
  lineChart: document.querySelector("#line-chart"),
  lineWrap: document.querySelector("#line-chart-wrap"),
  lineTooltip: document.querySelector("#line-tooltip"),
  lineEmpty: document.querySelector("#line-empty"),
  scrubber: document.querySelector("#chart-scrubber"),
  pointReadout: document.querySelector("#chart-point-readout"),
  historyWindowLabel: document.querySelector("#history-window-label"),
  indexSourceLink: document.querySelector("#index-source-link"),
  historySummary: document.querySelector("#history-summary"),
  distributionChart: document.querySelector("#distribution-chart"),
  detailPercentile: document.querySelector("#detail-percentile"),
  detailBand: document.querySelector("#detail-band"),
  windowBadge: document.querySelector("#window-badge"),
  distributionExplanation: document.querySelector("#distribution-explanation"),
  statLow: document.querySelector("#stat-low"),
  statMedian: document.querySelector("#stat-median"),
  statHigh: document.querySelector("#stat-high"),
  statCount: document.querySelector("#stat-count"),
  familyGrid: document.querySelector("#family-grid"),
  indicatorGuideGroups: document.querySelector("#indicator-guide-groups"),
  historyDefinition: document.querySelector("#history-definition"),
  networkStage: document.querySelector("#network-stage"),
  networkCanvas: document.querySelector("#network-canvas"),
  networkViewPicker: document.querySelector("#network-view-picker"),
  networkViewDescription: document.querySelector("#network-view-description"),
  networkNodeLayer: document.querySelector("#network-node-layer"),
  networkDetailTicker: document.querySelector("#network-detail-ticker"),
  networkDetailBand: document.querySelector("#network-detail-band"),
  networkDetailTitle: document.querySelector("#network-detail-title"),
  networkDetailCopy: document.querySelector("#network-detail-copy"),
  networkDetailValue: document.querySelector("#network-detail-value"),
  networkDetailRank: document.querySelector("#network-detail-rank"),
  connectionList: document.querySelector("#connection-list"),
  networkOpenButton: document.querySelector("#network-open-button"),
  networkSelectionStatus: document.querySelector("#network-selection-status"),
  relationshipTextList: document.querySelector("#relationship-text-list"),
  localFileInput: document.querySelector("#local-file-input"),
  clearLocalData: document.querySelector("#clear-local-data"),
  localDataStatus: document.querySelector("#local-data-status"),
  localDataAlert: document.querySelector("#local-data-alert"),
  localDataSummary: document.querySelector("#local-data-summary"),
  localSummaryList: document.querySelector("#local-summary-list"),
  localDataHeading: document.querySelector("#local-data-heading"),
};

function availableIndicatorIds() {
  if (!state.catalog?.indicators) return CORE_INDICATORS.filter((id) => state.data?.indices[id]);
  const sectionOrder = new Map((state.catalog.sections || []).map((section) => [section.id, section.order || 999]));
  return Object.entries(state.catalog.indicators)
    .filter(([id, indicator]) =>
      state.data?.indices[id] && (indicator.status === "live" || indicator.status === "local"),
    )
    .sort(([leftId, left], [rightId, right]) =>
      (left.headlineOrder ?? 999) - (right.headlineOrder ?? 999) ||
      (sectionOrder.get(left.sectionId) || 999) - (sectionOrder.get(right.sectionId) || 999) ||
      (left.displayOrder || 999) - (right.displayOrder || 999),
    )
    .map(([id]) => id);
}

function liveIndicatorIds() {
  return availableIndicatorIds();
}

function hostedIndicatorIds() {
  if (!state.catalog?.indicators) return CORE_INDICATORS.filter((id) => state.data?.indices[id]);
  return Object.entries(state.catalog.indicators)
    .filter(([id, indicator]) => indicator.status === "live" && state.data?.indices[id])
    .map(([id]) => id);
}

function pinnedIndicatorIds() {
  const live = availableIndicatorIds();
  if (!state.catalog?.indicators) return live;
  return live.filter((id) => state.catalog.indicators[id]?.pinned);
}

function pickerIndicatorIds() {
  return availableIndicatorIds().filter((id) =>
    state.catalog?.indicators?.[id]?.presentation?.picker !== false,
  );
}

function guideIndicatorEntries() {
  return Object.entries(state.catalog?.indicators || {}).filter(([id, indicator]) =>
    ["live", "local"].includes(indicator.status) &&
    (indicator.status === "local" || state.data?.indices[id]) &&
    indicator.presentation?.guide !== false,
  );
}

function metaFor(symbol) {
  const catalogMeta = state.catalog?.indicators?.[symbol];
  const fallback = FALLBACK_META[symbol] || {};
  const section = state.catalog?.sections?.find((item) => item.id === catalogMeta?.sectionId);
  return {
    ...fallback,
    ...catalogMeta,
    ticker: catalogMeta?.ticker || fallback.ticker || symbol,
    name: catalogMeta?.name || fallback.name || symbol,
    cardName: catalogMeta?.shortName || fallback.cardName || catalogMeta?.name || symbol,
    role: catalogMeta?.role || fallback.role || catalogMeta?.shortName || "Indicator",
    color: section?.color || fallback.color || "#90f0c4",
    unitLabel: catalogMeta?.unit?.label || fallback.unitLabel || "Index level",
    unitSuffix: catalogMeta?.unit?.suffix || "",
    decimals: catalogMeta?.unit?.decimals ?? 2,
    changeLabel: catalogMeta?.unit?.changeLabel || "pts",
    showChangePercent: catalogMeta?.unit?.showChangePercent ?? fallback.showChangePercent ?? true,
    definition: catalogMeta?.description || fallback.definition || "",
    howToRead: catalogMeta?.howToRead || "Read the latest value together with its historical percentile and connected signals.",
    frequency: catalogMeta?.frequency || "daily",
    observationLabel: catalogMeta?.observationLabel || "observations",
  };
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value, options = {}) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return "Unavailable";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: options.short ? "short" : "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatIndexValue(value, symbol = state.symbol) {
  if (!Number.isFinite(value)) return "Unavailable";
  const meta = metaFor(symbol);
  const formatted = new Intl.NumberFormat("en", {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  }).format(value);
  return `${formatted}${meta.unitSuffix}`;
}

function formatCount(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat("en").format(value) : "Unavailable";
}

function formatSigned(value, digits = 2) {
  if (!Number.isFinite(value)) return "Unavailable";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

function ordinal(number) {
  if (!Number.isFinite(number)) return "Unavailable";
  if (number > 0 && number < 1) return "<1st";
  if (number > 99 && number < 100) return ">99th";
  const rounded = Math.max(0, Math.min(100, Math.round(number)));
  const mod100 = rounded % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rounded}th`;
  if (rounded % 10 === 1) return `${rounded}st`;
  if (rounded % 10 === 2) return `${rounded}nd`;
  if (rounded % 10 === 3) return `${rounded}rd`;
  return `${rounded}th`;
}

function bandFor(rank) {
  if (!Number.isFinite(rank)) return "Unavailable";
  if (rank < 10) return "Unusually low";
  if (rank < 25) return "Low";
  if (rank <= 75) return "Typical range";
  if (rank <= 90) return "High";
  return "Unusually high";
}

function normaliseHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .map((point) => {
      if (Array.isArray(point)) return { date: point[0], value: Number(point[1]) };
      return { date: point.date, value: Number(point.value ?? point.close) };
    })
    .filter((point) => parseDate(point.date) && Number.isFinite(point.value))
    .sort((a, b) => pointTime(a) - pointTime(b));
}

function normaliseData(raw) {
  if (!raw || typeof raw !== "object" || !raw.indices) throw new Error("The data file has an invalid shape.");
  const indices = {};

  for (const [symbol, source] of Object.entries(raw.indices)) {
    if (!source) continue;
    const history = normaliseHistory(source.history);
    const last = history.at(-1);
    const previous = history.at(-2);
    const latestSource = source.latest || source.current || {};
    const value = Number(latestSource.value ?? latestSource.close ?? last?.value);
    const previousValue = Number(latestSource.previousValue ?? latestSource.previous ?? previous?.value);
    const change = Number(latestSource.change ?? (value - previousValue));
    const changePercent = Number(
      latestSource.changePercent ?? latestSource.changePct ?? (previousValue ? (change / previousValue) * 100 : NaN),
    );
    const percentile = source.percentile || {};

    indices[symbol] = {
      ...source,
      history,
      latest: {
        date: latestSource.date || last?.date,
        value,
        previousValue,
        change,
        changePercent,
      },
      percentile: {
        ...percentile,
        rank: Number(percentile.rank ?? percentile.value),
        observations: Number(percentile.observations ?? percentile.count),
      },
    };
  }

  return { ...raw, indices };
}

function pointTime(point) {
  return parseDate(point.date)?.getTime() ?? 0;
}

function quantile(sorted, probability) {
  if (!sorted.length) return NaN;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const fraction = position - lower;
  return sorted[lower + 1] === undefined
    ? sorted[lower]
    : sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
}

function calculateDistribution(history) {
  const values = history.map((point) => point.value).filter(Number.isFinite);
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const current = history.at(-1).value;
  let below = 0;
  let equal = 0;
  for (const value of sorted) {
    if (value < current) below += 1;
    else if (value === current) equal += 1;
  }
  return {
    current,
    rank: (100 * (below + 0.5 * equal)) / sorted.length,
    min: sorted[0],
    p25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    max: sorted.at(-1),
    count: sorted.length,
    values,
  };
}

function historyForRange(history, range) {
  if (!history.length || range === "MAX") return history;
  const latest = parseDate(history.at(-1).date);
  const years = range === "1Y" ? 1 : 5;
  const cutoff = new Date(latest);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  return history.filter((point) => parseDate(point.date) >= cutoff);
}

function daysBetween(a, b) {
  const first = a instanceof Date ? a : parseDate(a);
  const second = b instanceof Date ? b : parseDate(b);
  if (!first || !second) return Infinity;
  return Math.abs(second.getTime() - first.getTime()) / 86_400_000;
}

function renderFreshness() {
  const liveIds = hostedIndicatorIds().filter((id) =>
    !state.catalog?.indicators?.[id]?.parentIndicatorId,
  );
  const latestDates = liveIds.map((symbol) => state.data.indices[symbol]?.latest.date).filter(Boolean).sort();
  const newestLatest = latestDates.at(-1);
  const aligned = latestDates.length === liveIds.length && latestDates.every((date) => date === latestDates[0]);
  const overdue = liveIds.filter((symbol) => {
    const date = state.data.indices[symbol]?.latest.date;
    const staleAfterDays = state.catalog?.indicators?.[symbol]?.staleAfterDays ?? 7;
    return !date || daysBetween(date, new Date()) > staleAfterDays;
  });
  ui.updateChip.classList.remove("fresh", "stale", "error");

  if (latestDates.length !== liveIds.length || !newestLatest) {
    ui.updateChip.classList.add("error");
    ui.updateLabel.textContent = "Some latest observations are unavailable";
  } else if (overdue.length) {
    ui.updateChip.classList.add("stale");
    ui.updateLabel.textContent = `${overdue.length} observation${overdue.length === 1 ? "" : "s"} may be delayed`;
  } else {
    ui.updateChip.classList.add("fresh");
    const allDaily = liveIds.every((symbol) => metaFor(symbol).frequency === "daily");
    ui.updateLabel.textContent = aligned && allDaily
      ? `Latest public data · ${formatDate(newestLatest, { short: true })}`
      : `Public observations through ${formatDate(newestLatest, { short: true })}`;
  }
  if (ui.sourceRetrievalDate) {
    const retrievalDate = String(state.data.retrievedAt || "").slice(0, 10);
    ui.sourceRetrievalDate.textContent = parseDate(retrievalDate)
      ? ` Official source data retrieved ${formatDate(retrievalDate, { short: true })}.`
      : "";
  }
}

function renderComparisonWindow() {
  const window = state.data.commonWindow || state.data.comparisonWindow;
  const firstIndex = state.data.indices[liveIndicatorIds().find((symbol) => state.data.indices[symbol])];
  const start = window?.startDate || firstIndex?.percentile.startDate;
  const end = window?.endDate || firstIndex?.percentile.endDate;
  const pinnedIds = pinnedIndicatorIds();
  const coveredByCommonWindow = pinnedIds.length > 1 && pinnedIds.every((id) =>
    window?.latestDates?.[id] && state.data.indices[id]?.percentile.startDate === start && state.data.indices[id]?.percentile.endDate === end,
  );
  if (start && end && coveredByCommonWindow) {
    ui.comparisonWindow.textContent = `Headline percentiles compare observations from ${formatDate(start, { short: true })} to ${formatDate(end, { short: true })}.`;
  } else {
    ui.comparisonWindow.textContent = "Each headline percentile uses its indicator’s stated compatible history.";
  }
}

function createMetricCard(symbol, item) {
  const meta = metaFor(symbol);
  const rank = item.percentile.rank;
  const change = item.latest.change;
  const changePercent = item.latest.changePercent;
  const changeText = Number.isFinite(change)
    ? `${formatSigned(change, meta.decimals)} ${meta.changeLabel}${meta.showChangePercent && Number.isFinite(changePercent) ? ` · ${formatSigned(changePercent, 1)}%` : ""}`
    : "Change unavailable";
  const button = document.createElement("button");
  button.type = "button";
  button.className = `metric-card${state.symbol === symbol ? " selected" : ""}`;
  button.dataset.symbol = symbol;
  button.setAttribute("aria-pressed", state.symbol === symbol ? "true" : "false");
  button.setAttribute(
    "aria-label",
    `${meta.name}: ${formatIndexValue(item.latest.value, symbol)}, ${ordinal(rank)} percentile. Show details.`,
  );
  button.innerHTML = `
    <span class="metric-top">
      <span class="ticker">${meta.ticker}</span>
      <span class="daily-change">${changeText}</span>
    </span>
    <span class="metric-name">${meta.name}</span>
    <strong class="metric-value">${formatIndexValue(item.latest.value, symbol)}</strong>
    <span class="metric-date">${item.dataOrigin === "local-session" ? "Local session" : meta.unitLabel} · observed ${formatDate(item.latest.date, { short: true })}</span>
    <span class="percentile-strip">
      <span class="percentile-meta">
        <span>${bandFor(rank)}</span>
        <strong>${Number.isFinite(rank) ? ordinal(rank) : "Unavailable"}</strong>
      </span>
      <span class="percentile-track" style="--rank: ${Math.max(1, Math.min(99, rank || 0))}%"></span>
    </span>
  `;
  button.addEventListener("click", () => selectIndex(symbol, true));
  return button;
}

function renderCards() {
  ui.metricGrid.replaceChildren();
  const pinnedIds = pinnedIndicatorIds();
  const sections = [...(state.catalog?.sections || [])].sort(
    (left, right) => (left.order || 999) - (right.order || 999),
  );
  for (const section of sections) {
    const sectionIds = pinnedIds.filter(
      (symbol) => state.catalog.indicators[symbol]?.sectionId === section.id,
    );
    if (!sectionIds.length) continue;
    const group = document.createElement("section");
    group.className = "metric-family-group";
    group.setAttribute("aria-labelledby", `snapshot-family-${section.id}`);
    const heading = document.createElement("header");
    heading.className = "metric-family-heading";
    heading.innerHTML = `
      <span class="metric-family-dot" style="--family-color:${section.color}" aria-hidden="true"></span>
      <div>
        <h3 id="snapshot-family-${section.id}">${section.title}</h3>
        <p>${section.description}</p>
      </div>`;
    const cards = document.createElement("div");
    cards.className = "metric-family-cards";
    for (const symbol of sectionIds) {
      const item = state.data.indices[symbol];
      if (item) cards.append(createMetricCard(symbol, item));
    }
    group.append(heading, cards);
    ui.metricGrid.append(group);
  }
  ui.metricGridStatus.textContent = `${pinnedIds.length} pinned indicators shown.`;
}

function renderOfrBreakdown() {
  if (!ui.ofrBreakdown || !ui.ofrBreakdownList) return;
  const aggregateMeta = state.catalog?.indicators?.OFRFSI;
  const componentIds = aggregateMeta?.componentIds || [];
  const components = componentIds
    .map((id) => [id, state.data.indices[id]])
    .filter(([, item]) => item && Number.isFinite(item.latest.value));

  ui.ofrBreakdown.hidden = components.length === 0;
  if (!components.length) return;

  const maximum = components.reduce(
    (largest, [, item]) => Math.max(largest, Math.abs(item.latest.value)),
    0,
  ) || 1;
  const dates = components.map(([, item]) => item.latest.date).filter(Boolean).sort();
  ui.ofrBreakdownDate.textContent = dates.length && dates.every((date) => date === dates[0])
    ? `Observed ${formatDate(dates[0], { short: true })}`
    : "Latest available contribution from each category";
  ui.ofrBreakdownList.replaceChildren();

  for (const [symbol, item] of components) {
    const meta = metaFor(symbol);
    const value = item.latest.value;
    const direction = value > 0 ? "Adds stress" : value < 0 ? "Offsets stress" : "Neutral";
    const row = document.createElement("div");
    row.className = `ofr-contribution${state.symbol === symbol ? " selected" : ""}`;
    row.innerHTML = `
      <div class="ofr-contribution-label">
        <strong>${meta.cardName}</strong>
        <span>${direction}</span>
      </div>
      <div class="ofr-contribution-scale" aria-hidden="true">
        <span class="ofr-contribution-zero"></span>
        <span class="ofr-contribution-bar ${value < 0 ? "negative" : "positive"}"
          style="--magnitude:${Math.min(50, (Math.abs(value) / maximum) * 50)}%"></span>
      </div>
      <strong class="ofr-contribution-value">${formatSigned(value, meta.decimals)}</strong>
      <button type="button" data-symbol="${symbol}" aria-label="Open ${meta.name} history">View history</button>`;
    row.querySelector("button").addEventListener("click", () => selectIndex(symbol, true));
    ui.ofrBreakdownList.append(row);
  }
}

function renderTreasuryBreakdown() {
  if (!ui.treasuryBreakdown || !ui.treasuryBreakdownList) return;
  const inputIds = state.catalog?.indicators?.CURVE2S10S?.componentIds || [];
  const inputs = inputIds
    .map((id) => [id, state.data.indices[id]])
    .filter(([, item]) => item && Number.isFinite(item.latest.value));

  ui.treasuryBreakdown.hidden = inputs.length !== 2;
  if (inputs.length !== 2) return;

  const dates = inputs.map(([, item]) => item.latest.date).sort();
  ui.treasuryBreakdownDate.textContent = dates[0] === dates[1]
    ? `Observed ${formatDate(dates[0], { short: true })}`
    : "Latest available yield for each maturity";
  ui.treasuryBreakdownList.replaceChildren();

  for (const [symbol, item] of inputs) {
    const meta = metaFor(symbol);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `treasury-input${state.symbol === symbol ? " selected" : ""}`;
    button.dataset.symbol = symbol;
    button.setAttribute("aria-label", `Open ${meta.name} history`);
    button.innerHTML = `
      <span><strong>${meta.ticker}</strong><small>${meta.cardName}</small></span>
      <strong>${formatIndexValue(item.latest.value, symbol)}</strong>
      <span>${ordinal(item.percentile.rank)} percentile</span>`;
    button.addEventListener("click", () => selectIndex(symbol, true));
    ui.treasuryBreakdownList.append(button);
  }
}

function renderIndexPicker() {
  ui.indexPicker.replaceChildren();
  for (const symbol of pickerIndicatorIds()) {
    if (!state.data.indices[symbol]) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = metaFor(symbol).ticker;
    button.dataset.symbol = symbol;
    button.classList.toggle("active", symbol === state.symbol);
    button.setAttribute("aria-pressed", symbol === state.symbol ? "true" : "false");
    button.addEventListener("click", () => selectIndex(symbol));
    ui.indexPicker.append(button);
  }
}

function conditionMatches(condition) {
  const item = state.data.indices[condition.indicatorId];
  const metricReaders = {
    percentile: (record) => record?.percentile.rank,
    value: (record) => record?.latest.value,
    change: (record) => record?.latest.change,
    changePercent: (record) => record?.latest.changePercent,
  };
  const observed = metricReaders[condition.metric]?.(item);
  if (!Number.isFinite(observed)) return false;
  const operators = {
    lt: (left, right) => left < right,
    lte: (left, right) => left <= right,
    gt: (left, right) => left > right,
    gte: (left, right) => left >= right,
    eq: (left, right) => left === right,
  };
  return Boolean(operators[condition.operator]?.(observed, condition.value));
}

function regimeReadiness(regime) {
  const requiredIds = regime.requiredIndicators || [];
  const records = requiredIds.map((id) => state.data.indices[id]);
  if (!requiredIds.length || records.some((record) => !record)) {
    return { ready: false, reason: "missing", requiredIds, dates: [] };
  }

  const minObservations = regime.minObservations ?? 252;
  if (records.some((record) => (record.percentile.observations || 0) < minObservations)) {
    return { ready: false, reason: "history", requiredIds, dates: [] };
  }

  const localRecords = records.filter((record) => record.dataOrigin === "local-session");
  if (localRecords.length > 1) {
    const comparisonWindows = new Set(localRecords.map((record) => {
      const start = record.percentile.comparisonStartDate;
      const end = record.percentile.comparisonEndDate;
      return start && end ? `${start}:${end}` : "";
    }));
    if (comparisonWindows.has("") || comparisonWindows.size !== 1) {
      return { ready: false, reason: "window", requiredIds, dates: [] };
    }
  }

  const dates = records.map((record) => record.latest.date).filter(Boolean).sort();
  if (dates.length !== requiredIds.length) {
    return { ready: false, reason: "missing", requiredIds, dates };
  }

  const policy = regime.alignment?.policy || "same-date";
  const firstDate = dates[0];
  const lastDate = dates.at(-1);
  const dateTimes = dates.map((date) => parseDate(date)?.getTime()).filter(Number.isFinite);
  const dateSpanDays = dateTimes.length
    ? (Math.max(...dateTimes) - Math.min(...dateTimes)) / 86_400_000
    : Infinity;
  if (policy === "same-date" && dates.some((date) => date !== firstDate)) {
    return { ready: false, reason: "alignment", requiredIds, dates };
  }
  if (policy === "max-gap" && dateSpanDays > (regime.alignment?.maxGapDays ?? 0)) {
    return { ready: false, reason: "alignment", requiredIds, dates };
  }

  const stale = requiredIds.some((id) => {
    const staleAfterDays = state.catalog?.indicators?.[id]?.staleAfterDays ?? regime.staleAfterDays ?? 7;
    return daysBetween(state.data.indices[id].latest.date, new Date()) > staleAfterDays;
  });
  if (stale) return { ready: false, reason: "stale", requiredIds, dates };

  return { ready: true, reason: null, requiredIds, dates };
}

function renderRegime() {
  const regimeDefinitions = [...(state.catalog?.regimes || [])].sort((a, b) => b.priority - a.priority);
  const candidates = regimeDefinitions.map((regime) => ({ regime, readiness: regimeReadiness(regime) }));
  const selected = candidates.find(({ regime, readiness }) =>
    readiness.ready && (regime.conditions || []).every(conditionMatches),
  );

  if (!selected) {
    state.activeRegime = null;
    const stale = candidates.some(({ readiness }) => readiness.reason === "stale");
    const incompatibleWindow = candidates.some(({ readiness }) => readiness.reason === "window");
    ui.regimeAsOf.textContent = "Awaiting compatible inputs";
    ui.regimeTitle.textContent = stale
      ? "The latest picture may be stale"
      : incompatibleWindow
        ? "The local histories need a shared window"
        : "Waiting for a complete picture";
    ui.regimeCopy.textContent = stale
      ? "One or more required observations are older than expected. Individual readings remain visible, but the combined regime read is paused."
      : incompatibleWindow
        ? "Individual readings remain visible, but the combined interpretation is paused until the local percentiles use the same comparison window."
        : "The combined read needs enough valid history and a compatible observation date for every required indicator.";
  } else {
    state.activeRegime = selected.regime;
    const dates = selected.readiness.dates;
    ui.regimeAsOf.textContent = dates.every((date) => date === dates[0])
      ? `Through ${formatDate(dates[0], { short: true })}`
      : `Inputs from ${formatDate(dates[0], { short: true })} to ${formatDate(dates.at(-1), { short: true })}`;
    ui.regimeTitle.textContent = state.activeRegime.title;
    ui.regimeCopy.textContent = state.activeRegime.copy;
  }

  const rawEvidenceIds = state.activeRegime?.requiredIndicators || pinnedIndicatorIds();
  const evidenceIds = [...new Set(rawEvidenceIds.map((id) =>
    state.catalog?.indicators?.[id]?.parentIndicatorId || id,
  ))];
  ui.signalList.replaceChildren();
  for (const symbol of evidenceIds) {
    const rank = state.data.indices[symbol]?.percentile.rank;
    if (!Number.isFinite(rank)) continue;
    const pill = document.createElement("span");
    pill.className = "signal-pill";
    pill.textContent = `${metaFor(symbol).ticker} · ${ordinal(rank)}`;
    ui.signalList.append(pill);
  }
}

function renderFamilies() {
  if (!ui.familyGrid || !state.catalog?.sections) return;
  const indicators = Object.entries(state.catalog.indicators || {});
  const sections = [...state.catalog.sections].sort((a, b) => a.order - b.order);
  ui.familyGrid.replaceChildren();

  for (const section of sections) {
    const members = indicators
      .filter(([, indicator]) => indicator.sectionId === section.id)
      .sort(([, left], [, right]) => (left.displayOrder || 999) - (right.displayOrder || 999));
    const live = members.filter(([, indicator]) =>
      indicator.status === "live" && indicator.presentation?.family !== false && !indicator.parentIndicatorId,
    );
    const local = members.filter(([, indicator]) => indicator.status === "local");
    const activeLocal = local.filter(([id]) => state.data?.indices[id]);
    const next = members.filter(([, indicator]) => indicator.status === "planned" && indicator.wave === 1).slice(0, 3);
    const preview = local.length ? local.slice(0, 3) : next;
    const plannedCount = members.filter(([, indicator]) => ["planned", "later"].includes(indicator.status)).length;
    const hiddenCount = local.length
      ? Math.max(0, local.length - preview.length) + plannedCount
      : Math.max(0, plannedCount - preview.length);
    const countParts = [`${live.length} public`];
    if (local.length) countParts.push(`${activeLocal.length} of ${local.length} local`);
    countParts.push(`${plannedCount} planned`);
    const card = document.createElement("article");
    card.className = `family-card${live.length || activeLocal.length ? " has-live" : ""}`;
    card.style.setProperty("--family-color", section.color);
    const nextMarkup = preview.length
      ? preview.map(([id, indicator]) => `
          <li><span>${indicator.ticker || id}</span><small>${indicator.status === "local" ? (state.data?.indices[id] ? "Local CSV active" : "Optional local CSV") : indicator.shortName}</small></li>`).join("")
      : `<li class="family-empty"><small>Planned after the first expansion wave</small></li>`;
    card.innerHTML = `
      <div class="family-card-top">
        <span class="family-dot" aria-hidden="true"></span>
        <span class="family-count">${countParts.join(" · ")}</span>
      </div>
      <h3>${section.title}</h3>
      <p>${section.description}</p>
      <div class="family-next">
        <span class="family-next-label">${local.length ? "Private overlay" : "First additions"}</span>
        <ul>${nextMarkup}</ul>
        ${hiddenCount > 0 ? `<span class="family-more">+${hiddenCount} later</span>` : ""}
      </div>`;
    ui.familyGrid.append(card);
  }
}

function guideConnections(symbol, allowedIds) {
  const connections = new Map();
  for (const relationship of state.catalog?.relationships || []) {
    if (relationship.source !== symbol && relationship.target !== symbol) continue;
    const otherId = relationship.source === symbol ? relationship.target : relationship.source;
    if (!allowedIds.has(otherId) || connections.has(otherId)) continue;
    connections.set(otherId, relationship);
  }
  return [...connections.entries()].slice(0, 4);
}

function renderIndicatorGuide() {
  if (!ui.indicatorGuideGroups || !state.catalog?.indicators || !state.catalog?.sections) return;
  const guideEntries = guideIndicatorEntries();
  const allowedIds = new Set(guideEntries.map(([id]) => id));
  const sections = [...state.catalog.sections].sort((left, right) => left.order - right.order);
  ui.indicatorGuideGroups.replaceChildren();

  for (const section of sections) {
    const members = guideEntries
      .filter(([, indicator]) => indicator.sectionId === section.id)
      .sort(([, left], [, right]) => (left.displayOrder || 999) - (right.displayOrder || 999));
    if (!members.length) continue;

    const group = document.createElement("article");
    group.className = "indicator-guide-family";
    group.style.setProperty("--guide-color", section.color);
    const cards = members.map(([id, indicator]) => {
      const meta = metaFor(id);
      const localActive = indicator.status === "local" && Boolean(state.data?.indices[id]);
      const statusLabel = indicator.status === "live"
        ? "Public data"
        : localActive
          ? "Local CSV active"
          : "Optional local CSV";
      const statusClass = indicator.status === "live" ? "public" : localActive ? "active" : "local";
      const connections = guideConnections(id, allowedIds);
      const connectionMarkup = connections.length
        ? `<div class="indicator-guide-context">
            <span>Read with</span>
            <div>${connections.map(([otherId, relationship]) =>
              `<a href="#relationships"><strong>${metaFor(otherId).ticker}</strong>${relationship.label}</a>`).join("")}</div>
          </div>`
        : "";
      const sourceLabel = indicator.status === "live" ? "Official source" : "Product information";

      return `<details class="indicator-guide-card">
        <summary>
          <span class="indicator-guide-symbol">${meta.ticker}</span>
          <span class="indicator-guide-name"><strong>${meta.cardName}</strong><small>${meta.role}</small></span>
          <span class="indicator-guide-status ${statusClass}">${statusLabel}</span>
        </summary>
        <div class="indicator-guide-body">
          <div>
            <span>What it measures</span>
            <p>${meta.definition}</p>
          </div>
          <div>
            <span>How to read it</span>
            <p>${meta.howToRead}</p>
          </div>
          ${connectionMarkup}
          <a class="indicator-guide-source" href="${meta.sourceUrl}" target="_blank" rel="noopener noreferrer">${sourceLabel} ↗</a>
        </div>
      </details>`;
    }).join("");

    group.innerHTML = `
      <header>
        <span class="indicator-guide-dot" aria-hidden="true"></span>
        <div><h3>${section.title}</h3><p>${section.description}</p></div>
      </header>
      <div class="indicator-guide-cards">${cards}</div>`;
    ui.indicatorGuideGroups.append(group);
  }
}

function activeNetworkView() {
  return state.catalog?.networkViews?.find((view) => view.id === state.networkView);
}

function visibleNetworkIds() {
  const selectedView = activeNetworkView();
  const viewIds = selectedView?.indicatorIds || [];
  const configured = viewIds.filter((id) => state.data.indices[id]);
  return configured.length ? configured : pinnedIndicatorIds().filter((id) => state.data.indices[id]);
}

function visibleRelationships(ids = visibleNetworkIds()) {
  const visible = new Set(ids);
  return (state.catalog?.relationships || []).filter(
    (relationship) => visible.has(relationship.source) && visible.has(relationship.target),
  );
}

function activeRelationshipIds() {
  return new Set(state.activeRegime?.evidenceRelationships || []);
}

function networkPosition(id, index, count) {
  const viewPosition = activeNetworkView()?.positions?.[id];
  if (Number.isFinite(viewPosition?.x) && Number.isFinite(viewPosition?.y)) {
    return viewPosition;
  }
  const configured = state.catalog?.indicators?.[id]?.network;
  if (Number.isFinite(configured?.x) && Number.isFinite(configured?.y)) return configured;
  const angle = (Math.PI * 2 * index) / Math.max(1, count) - Math.PI / 2;
  return { x: 50 + Math.cos(angle) * 32, y: 50 + Math.sin(angle) * 32 };
}

function renderNetworkViewPicker() {
  if (!ui.networkViewPicker) return;
  const views = state.catalog?.networkViews || [];
  if (!views.some((view) => view.id === state.networkView)) state.networkView = views[0]?.id || "overview";
  ui.networkViewPicker.replaceChildren();
  for (const view of views) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = view.label;
    button.dataset.viewId = view.id;
    button.classList.toggle("active", view.id === state.networkView);
    button.setAttribute("aria-pressed", view.id === state.networkView ? "true" : "false");
    button.addEventListener("click", () => {
      state.networkView = view.id;
      renderNetwork();
      requestAnimationFrame(() => {
        [...ui.networkViewPicker.querySelectorAll("button")]
          .find((candidate) => candidate.dataset.viewId === view.id)
          ?.focus({ preventScroll: true });
      });
    });
    ui.networkViewPicker.append(button);
  }
  const selected = views.find((view) => view.id === state.networkView);
  if (ui.networkViewDescription) ui.networkViewDescription.textContent = selected?.description || "";
}

function drawNetwork() {
  if (!ui.networkCanvas || !state.data || !state.catalog) return;
  const ids = visibleNetworkIds();
  const { context, width, height } = setupCanvas(ui.networkCanvas);
  const positions = Object.fromEntries(ids.map((id, index) => [id, networkPosition(id, index, ids.length)]));
  const relationships = visibleRelationships(ids);
  const evidenceRelationships = activeRelationshipIds();
  context.clearRect(0, 0, width, height);

  relationships.forEach((relationship, index) => {
    const source = positions[relationship.source];
    const target = positions[relationship.target];
    if (!source || !target) return;
    const startX = (source.x / 100) * width;
    const startY = (source.y / 100) * height;
    const endX = (target.x / 100) * width;
    const endY = (target.y / 100) * height;
    const middleX = (startX + endX) / 2;
    const curve = (index % 2 === 0 ? -1 : 1) * Math.min(42, Math.abs(endX - startX) * 0.12 + 12);
    const middleY = (startY + endY) / 2 + curve;
    const active = evidenceRelationships.has(relationship.id);
    const selected = relationship.source === state.networkSymbol || relationship.target === state.networkSymbol;
    const dotted = relationship.type !== "methodological";
    context.setLineDash(dotted ? [5, 6] : []);
    context.lineWidth = active ? 2.6 : selected ? 1.8 : 1.2;
    context.strokeStyle = active
      ? "rgba(144,240,196,0.92)"
      : selected
        ? "rgba(214,230,214,0.36)"
        : "rgba(214,230,214,0.20)";
    context.beginPath();
    context.moveTo(startX, startY);
    context.quadraticCurveTo(middleX, middleY, endX, endY);
    context.stroke();
  });
  context.setLineDash([]);
}

function renderRelationshipTextList() {
  const relationships = visibleRelationships();
  const evidenceRelationships = activeRelationshipIds();
  ui.relationshipTextList.replaceChildren();
  for (const relationship of relationships) {
    const glyph = ["compares", "inverse"].includes(relationship.direction) ? "↔" : "→";
    const active = evidenceRelationships.has(relationship.id);
    const item = document.createElement("article");
    item.className = `relationship-text-item${active ? " active" : ""}`;
    item.innerHTML = `
      <span>${relationship.type}${active ? " · supports current read" : ""}</span>
      <strong>${metaFor(relationship.source).ticker} ${glyph} ${metaFor(relationship.target).ticker}</strong>
      <p>${relationship.label}. ${relationship.explanation}</p>`;
    ui.relationshipTextList.append(item);
  }
}

function renderNetworkDetail() {
  const symbol = state.networkSymbol;
  const item = state.data.indices[symbol];
  const meta = metaFor(symbol);
  const rank = item?.percentile.rank;
  ui.networkDetailTicker.textContent = meta.ticker;
  ui.networkDetailBand.textContent = bandFor(rank);
  ui.networkDetailTitle.textContent = meta.name;
  ui.networkDetailCopy.textContent = meta.definition;
  ui.networkDetailValue.textContent = formatIndexValue(item?.latest.value, symbol);
  ui.networkDetailRank.textContent = Number.isFinite(rank) ? ordinal(rank) : "Unavailable";
  ui.networkOpenButton.disabled = !item;
  ui.networkOpenButton.onclick = item ? () => selectIndex(symbol, true) : null;
  ui.connectionList.replaceChildren();

  const connections = visibleRelationships().filter(
    (relationship) => relationship.source === symbol || relationship.target === symbol,
  );
  for (const relationship of connections) {
    const otherId = relationship.source === symbol ? relationship.target : relationship.source;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "connection-button";
    button.innerHTML = `
      <span>${metaFor(otherId).ticker}</span>
      <strong>${relationship.label}</strong>
      <small>${relationship.type}</small>`;
    button.addEventListener("click", () => selectNetworkNode(otherId, "inspector"));
    ui.connectionList.append(button);
  }
}

function selectNetworkNode(symbol, focusTarget = null) {
  if (!state.data.indices[symbol]) return;
  state.networkSymbol = symbol;
  ui.networkNodeLayer.querySelectorAll("button[data-symbol]").forEach((button) => {
    const selected = button.dataset.symbol === symbol;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  renderNetworkDetail();
  drawNetwork();
  ui.networkSelectionStatus.textContent = `${metaFor(symbol).name} selected. ${visibleRelationships().filter((item) => item.source === symbol || item.target === symbol).length} direct connections.`;
  if (focusTarget === "inspector") ui.networkDetailTitle.focus();
  if (focusTarget === "node") ui.networkNodeLayer.querySelector(`[data-symbol="${symbol}"]`)?.focus();
}

function renderNetwork() {
  if (!ui.networkNodeLayer || !state.catalog) return;
  renderNetworkViewPicker();
  const ids = visibleNetworkIds();
  if (!ids.includes(state.networkSymbol)) state.networkSymbol = ids[0];
  const evidence = new Set(state.activeRegime?.requiredIndicators || []);
  ui.networkNodeLayer.replaceChildren();

  ids.forEach((symbol, index) => {
    const item = state.data.indices[symbol];
    const meta = metaFor(symbol);
    const position = networkPosition(symbol, index, ids.length);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `network-node${symbol === state.networkSymbol ? " selected" : ""}${evidence.has(symbol) ? " evidence" : ""}`;
    button.dataset.symbol = symbol;
    button.style.left = `${position.x}%`;
    button.style.top = `${position.y}%`;
    button.style.setProperty("--node-color", meta.color);
    button.setAttribute("aria-pressed", symbol === state.networkSymbol ? "true" : "false");
    button.setAttribute("aria-controls", "network-inspector");
    button.setAttribute(
      "aria-label",
      `${meta.name}, ${ordinal(item.percentile.rank)} percentile${evidence.has(symbol) ? ", evidence in the current read" : ""}. Inspect relationships.`,
    );
    button.innerHTML = `<strong>${meta.ticker}</strong><span>${ordinal(item.percentile.rank)}</span>`;
    button.addEventListener("click", () => selectNetworkNode(symbol));
    ui.networkNodeLayer.append(button);
  });

  renderNetworkDetail();
  renderRelationshipTextList();
  requestAnimationFrame(drawNetwork);
}

function selectIndex(symbol, scrollToDetail = false) {
  if (!state.data?.indices[symbol]) return;
  const focusTarget = scrollToDetail
    ? "picker"
    : document.activeElement?.closest("#metric-grid")
      ? "card"
      : document.activeElement?.closest("#index-picker")
        ? "picker"
        : null;
  state.symbol = symbol;
  state.inspectedIndex = null;
  renderCards();
  renderOfrBreakdown();
  renderTreasuryBreakdown();
  renderIndexPicker();
  renderDetail();
  if (ui.networkNodeLayer.querySelector(`[data-symbol="${symbol}"]`)) selectNetworkNode(symbol);
  if (focusTarget) {
    const container = focusTarget === "card" ? ui.metricGrid : ui.indexPicker;
    container.querySelector(`[data-symbol="${symbol}"]`)?.focus({ preventScroll: true });
  }
  if (scrollToDetail) {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const detailTitle = document.querySelector("#detail-title");
    detailTitle?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    detailTitle?.focus({ preventScroll: true });
  }
}

function windowLabel(range) {
  if (range === "1Y") return "1 year";
  if (range === "5Y") return "5 years";
  return "Full history";
}

function renderDetail() {
  const item = state.data.indices[state.symbol];
  const meta = metaFor(state.symbol);
  if (!item) return;
  state.visibleHistory = historyForRange(item.history, state.range);
  state.inspectedIndex = state.visibleHistory.length ? state.visibleHistory.length - 1 : null;
  const distribution = calculateDistribution(state.visibleHistory);

  ui.historyTitle.textContent = `${meta.ticker} · ${meta.name}`;
  ui.historyDefinition.textContent = `${meta.definition} ${meta.howToRead}`;
  ui.historyFrequencyLabel.textContent = `Historical ${meta.observationLabel}`;
  ui.indexSourceLink.href = meta.sourceUrl || item.sourceUrl || state.data.source?.url || "https://www.financialresearch.gov/financial-stress-index/";
  ui.indexSourceLink.textContent = item.dataOrigin === "local-session" ? "Product information ↗" : "Official source ↗";
  ui.windowBadge.textContent = windowLabel(state.range);
  ui.rangePicker.querySelectorAll("button").forEach((button) => {
    const active = button.dataset.range === state.range;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });

  if (!distribution) {
    ui.lineEmpty.hidden = false;
    ui.detailPercentile.textContent = "Unavailable";
    ui.detailBand.textContent = "Unavailable";
    ui.distributionExplanation.textContent = "No valid observations are available for this period.";
    return;
  }

  ui.lineEmpty.hidden = true;
  const rankLabel = ordinal(distribution.rank);
  const rankParts = rankLabel.match(/^([<>]?\d+)([a-z]+)$/i);
  ui.detailPercentile.textContent = rankParts?.[1] || Math.round(distribution.rank);
  const suffix = document.querySelector(".percentile-suffix");
  suffix.textContent = `${rankParts?.[2] || "th"} percentile`;
  ui.detailBand.textContent = bandFor(distribution.rank);
  const start = state.visibleHistory[0].date;
  const end = state.visibleHistory.at(-1).date;
  ui.historyWindowLabel.textContent = `${formatDate(start, { short: true })} to ${formatDate(end, { short: true })} · ${formatCount(distribution.count)} ${meta.observationLabel}`;
  ui.distributionExplanation.textContent =
    `${formatIndexValue(distribution.current)} has a midrank near the ${ordinal(distribution.rank)} percentile among ` +
    `${meta.observationLabel} from ${formatDate(start, { short: true })} to ${formatDate(end, { short: true })}. ` +
    "This is a historical position, not a forecast probability.";
  ui.statLow.textContent = formatIndexValue(distribution.min);
  ui.statMedian.textContent = formatIndexValue(distribution.median);
  ui.statHigh.textContent = formatIndexValue(distribution.max);
  ui.statCount.textContent = formatCount(distribution.count);
  ui.historySummary.textContent =
    `${meta.name}. Latest visible observation ${formatIndexValue(distribution.current)} on ${formatDate(end)}. ` +
    `Range ${formatIndexValue(distribution.min)} to ${formatIndexValue(distribution.max)}, median ${formatIndexValue(distribution.median)}, ` +
    `${ordinal(distribution.rank)} percentile among ${formatCount(distribution.count)} ${meta.observationLabel}.`;
  ui.lineChart.setAttribute("aria-label", ui.historySummary.textContent);
  ui.distributionChart.setAttribute(
    "aria-label",
    `${meta.name} distribution from ${formatDate(start)} to ${formatDate(end)}. Current value ${formatIndexValue(distribution.current)} at the ${ordinal(distribution.rank)} percentile.`,
  );

  ui.scrubber.min = "0";
  ui.scrubber.max = String(Math.max(0, state.visibleHistory.length - 1));
  ui.scrubber.value = ui.scrubber.max;
  ui.scrubber.disabled = state.visibleHistory.length < 2;
  updatePointReadout(state.inspectedIndex);

  requestAnimationFrame(() => {
    drawLineChart();
    drawDistributionChart(distribution);
  });
}

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width, height };
}

function chartCoordinates(history, width, height, padding) {
  const bounds = history.reduce((result, point) => {
    const time = pointTime(point);
    return {
      minTime: Math.min(result.minTime, time),
      maxTime: Math.max(result.maxTime, time),
      minValue: Math.min(result.minValue, point.value),
      maxValue: Math.max(result.maxValue, point.value),
    };
  }, { minTime: Infinity, maxTime: -Infinity, minValue: Infinity, maxValue: -Infinity });
  const { minTime, maxTime, minValue: rawMin, maxValue: rawMax } = bounds;
  const spread = rawMax - rawMin || Math.max(1, rawMax * 0.1);
  const minValue = rawMin - spread * 0.08;
  const maxValue = rawMax + spread * 0.08;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const x = (point) => padding.left + ((pointTime(point) - minTime) / (maxTime - minTime || 1)) * innerWidth;
  const y = (point) => padding.top + (1 - (point.value - minValue) / (maxValue - minValue || 1)) * innerHeight;
  return { x, y, minTime, maxTime, minValue, maxValue, innerWidth, innerHeight, left: padding.left };
}

function decimateHistoryByPixel(history, scales) {
  const bucketCount = Math.max(1, Math.floor(scales.innerWidth));
  if (history.length <= bucketCount * 2) return history;

  const buckets = Array.from({ length: bucketCount }, () => null);
  const timeRange = scales.maxTime - scales.minTime || 1;

  history.forEach((point, index) => {
    const ratio = (pointTime(point) - scales.minTime) / timeRange;
    const bucketIndex = Math.max(0, Math.min(bucketCount - 1, Math.floor(ratio * bucketCount)));
    const bucket = buckets[bucketIndex];
    if (!bucket) {
      buckets[bucketIndex] = {
        min: { point, index },
        max: { point, index },
      };
      return;
    }
    if (point.value < bucket.min.point.value) bucket.min = { point, index };
    if (point.value > bucket.max.point.value) bucket.max = { point, index };
  });

  const selected = [];
  const append = (entry) => {
    if (!entry || selected.at(-1)?.index === entry.index) return;
    selected.push(entry);
  };

  append({ point: history[0], index: 0 });
  for (const bucket of buckets) {
    if (!bucket) continue;
    const extremes = bucket.min.index <= bucket.max.index
      ? [bucket.min, bucket.max]
      : [bucket.max, bucket.min];
    extremes.forEach(append);
  }
  append({ point: history.at(-1), index: history.length - 1 });
  return selected.map(({ point }) => point);
}

function lineChartModel(width, height, padding) {
  const cached = state.lineChartModel;
  if (
    cached?.history === state.visibleHistory &&
    cached.width === width &&
    cached.height === height &&
    cached.paddingLeft === padding.left
  ) {
    return cached;
  }

  const scales = chartCoordinates(state.visibleHistory, width, height, padding);
  const model = {
    history: state.visibleHistory,
    width,
    height,
    paddingLeft: padding.left,
    scales,
    drawn: decimateHistoryByPixel(state.visibleHistory, scales),
  };
  state.lineChartModel = model;
  return model;
}

function drawLineChart() {
  if (!state.visibleHistory.length) return;
  const { context, width, height } = setupCanvas(ui.lineChart);
  const padding = { top: 14, right: 18, bottom: 32, left: width < 500 ? 39 : 47 };
  const { drawn, scales } = lineChartModel(width, height, padding);
  const color = metaFor(state.symbol).color;

  context.clearRect(0, 0, width, height);
  context.lineWidth = 1;
  context.strokeStyle = "rgba(214,230,214,0.10)";
  context.fillStyle = "rgba(174,187,178,0.68)";
  context.font = "10px Inter, system-ui, sans-serif";
  context.textBaseline = "middle";

  for (let index = 0; index <= 4; index += 1) {
    const ratio = index / 4;
    const y = padding.top + ratio * scales.innerHeight;
    const value = scales.maxValue - ratio * (scales.maxValue - scales.minValue);
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
    context.textAlign = "right";
    const axisLabel = `${value.toFixed(value >= 100 ? 0 : 1)}${metaFor(state.symbol).unitSuffix}`;
    context.fillText(axisLabel, padding.left - 8, y);
  }

  const dates = [state.visibleHistory[0], state.visibleHistory[Math.floor((state.visibleHistory.length - 1) / 2)], state.visibleHistory.at(-1)];
  context.textBaseline = "bottom";
  dates.forEach((point, index) => {
    context.textAlign = index === 0 ? "left" : index === 2 ? "right" : "center";
    context.fillText(formatDate(point.date, { short: true }), scales.x(point), height - 3);
  });

  const gradient = context.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  gradient.addColorStop(0, `${color}2e`);
  gradient.addColorStop(1, `${color}00`);
  context.beginPath();
  drawn.forEach((point, index) => {
    const x = scales.x(point);
    const y = scales.y(point);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.lineTo(scales.x(drawn.at(-1)), height - padding.bottom);
  context.lineTo(scales.x(drawn[0]), height - padding.bottom);
  context.closePath();
  context.fillStyle = gradient;
  context.fill();

  context.beginPath();
  drawn.forEach((point, index) => {
    const x = scales.x(point);
    const y = scales.y(point);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.lineWidth = 2;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = color;
  context.stroke();

  drawMarker(context, scales, state.visibleHistory.at(-1), color, 4);
  if (Number.isInteger(state.inspectedIndex) && state.inspectedIndex !== state.visibleHistory.length - 1) {
    drawMarker(context, scales, state.visibleHistory[state.inspectedIndex], "#f3f5e9", 3.5);
  }
  ui.lineChart._scales = scales;
}

function drawMarker(context, scales, point, color, radius) {
  context.beginPath();
  context.arc(scales.x(point), scales.y(point), radius + 3, 0, Math.PI * 2);
  context.fillStyle = "rgba(6,23,20,0.85)";
  context.fill();
  context.beginPath();
  context.arc(scales.x(point), scales.y(point), radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
}

function drawDistributionChart(distribution) {
  const { context, width, height } = setupCanvas(ui.distributionChart);
  const padding = { top: 24, right: 8, bottom: 25, left: 8 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const binCount = Math.max(12, Math.min(30, Math.round(Math.sqrt(distribution.count) / 2)));
  const range = distribution.max - distribution.min || 1;
  const counts = Array.from({ length: binCount }, () => 0);
  for (const value of distribution.values) {
    const index = Math.min(binCount - 1, Math.floor(((value - distribution.min) / range) * binCount));
    counts[index] += 1;
  }
  const maxCount = Math.max(...counts, 1);
  const gap = width < 360 ? 1 : 2;
  const barWidth = innerWidth / binCount;
  const color = metaFor(state.symbol).color;

  context.clearRect(0, 0, width, height);
  counts.forEach((count, index) => {
    const barHeight = (count / maxCount) * innerHeight;
    const x = padding.left + index * barWidth;
    const y = padding.top + innerHeight - barHeight;
    context.fillStyle = `${color}66`;
    context.beginPath();
    context.roundRect(x + gap / 2, y, Math.max(1, barWidth - gap), barHeight, 2);
    context.fill();
  });

  const markerX = padding.left + ((distribution.current - distribution.min) / range) * innerWidth;
  context.setLineDash([3, 3]);
  context.strokeStyle = "#f3f5e9";
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(markerX, padding.top - 7);
  context.lineTo(markerX, height - padding.bottom + 3);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = "#f3f5e9";
  context.font = "700 9px Inter, system-ui, sans-serif";
  context.textAlign = markerX > width - 52 ? "right" : markerX < 52 ? "left" : "center";
  context.fillText("LATEST", markerX, 9);

  context.fillStyle = "rgba(174,187,178,0.66)";
  context.font = "10px Inter, system-ui, sans-serif";
  context.textBaseline = "bottom";
  context.textAlign = "left";
  context.fillText(formatIndexValue(distribution.min), padding.left, height);
  context.textAlign = "right";
  context.fillText(formatIndexValue(distribution.max), width - padding.right, height);
}

function nearestIndexForX(clientX) {
  const scales = ui.lineChart._scales;
  if (!scales || !state.visibleHistory.length) return null;
  const rect = ui.lineChart.getBoundingClientRect();
  const localX = Math.max(0, Math.min(rect.width, clientX - rect.left));
  const ratio = Math.max(0, Math.min(1, (localX - scales.left) / Math.max(1, scales.innerWidth)));
  const targetTime = scales.minTime + ratio * (scales.maxTime - scales.minTime);
  let low = 0;
  let high = state.visibleHistory.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (pointTime(state.visibleHistory[middle]) < targetTime) low = middle + 1;
    else high = middle;
  }
  if (low > 0) {
    const previous = pointTime(state.visibleHistory[low - 1]);
    const current = pointTime(state.visibleHistory[low]);
    if (Math.abs(targetTime - previous) < Math.abs(current - targetTime)) return low - 1;
  }
  return low;
}

function updatePointReadout(index, showTooltip = false) {
  if (!Number.isInteger(index) || !state.visibleHistory[index]) return;
  state.inspectedIndex = index;
  const point = state.visibleHistory[index];
  ui.pointReadout.textContent = `${formatDate(point.date, { short: true })} · ${metaFor(state.symbol).ticker} ${formatIndexValue(point.value)}`;
  ui.scrubber.value = String(index);
  drawLineChart();

  if (showTooltip && ui.lineChart._scales) {
    const scales = ui.lineChart._scales;
    ui.lineTooltip.innerHTML = `<strong>${metaFor(state.symbol).ticker} ${formatIndexValue(point.value)}</strong><span>${formatDate(point.date, { short: true })}</span>`;
    const x = scales.x(point);
    const y = scales.y(point);
    ui.lineTooltip.hidden = false;
    const tooltipWidth = 120;
    ui.lineTooltip.style.left = `${Math.max(8, Math.min(ui.lineWrap.clientWidth - tooltipWidth, x - tooltipWidth / 2))}px`;
    ui.lineTooltip.style.top = `${Math.max(8, y - 55)}px`;
  }
}

function renderDashboard() {
  renderFreshness();
  renderComparisonWindow();
  renderRegime();
  renderCards();
  renderOfrBreakdown();
  renderTreasuryBreakdown();
  renderIndexPicker();
  renderFamilies();
  renderIndicatorGuide();
  renderNetwork();
  renderDetail();
}

function renderLocalSummary() {
  const symbols = [...state.localSymbols].filter((symbol) => state.data?.indices[symbol]);
  ui.localSummaryList.replaceChildren();

  for (const symbol of symbols) {
    const item = state.data.indices[symbol];
    const listItem = document.createElement("li");
    listItem.textContent = `${metaFor(symbol).ticker} · ${formatCount(item.percentile.observations)} observations · ${formatDate(item.percentile.startDate, { short: true })} to ${formatDate(item.percentile.endDate, { short: true })}`;
    ui.localSummaryList.append(listItem);
  }

  const active = symbols.length > 0;
  ui.localDataSummary.hidden = !active;
  ui.clearLocalData.hidden = !active;
  if (!active) {
    ui.localDataStatus.textContent = "No local files are active.";
  } else if (symbols.length === 1) {
    ui.localDataStatus.textContent = "1 local indicator is active. Its percentile uses the selected file's full validated history.";
  } else {
    const { startDate, endDate } = state.localComparisonWindow;
    ui.localDataStatus.textContent = `${symbols.length} local indicators are active. Their percentiles use the shared overlap from ${formatDate(startDate, { short: true })} to ${formatDate(endDate, { short: true })}.`;
  }
}

function buildCommonLocalRecords(histories) {
  const entries = [...histories.entries()];
  if (!entries.length) return { records: new Map(), comparisonWindow: null };

  const comparisonWindow = {
    startDate: entries.reduce((latest, [, history]) =>
      history[0].date > latest ? history[0].date : latest, entries[0][1][0].date),
    endDate: entries.reduce((earliest, [, history]) =>
      history.at(-1).date < earliest ? history.at(-1).date : earliest, entries[0][1].at(-1).date),
  };
  if (comparisonWindow.startDate > comparisonWindow.endDate) {
    throw new Error("The selected local histories do not share a comparison window.");
  }

  const records = new Map();
  for (const [symbol, history] of entries) {
    const sourceUrl = state.catalog?.indicators?.[symbol]?.sourceUrl || "https://www.cboe.com/us/indices/";
    const record = buildLocalIndexRecord(symbol, history, sourceUrl, comparisonWindow);
    records.set(symbol, { ...record, history: normaliseHistory(record.history) });
  }
  return { records, comparisonWindow };
}

async function handleLocalFiles(fileList) {
  const files = [...fileList];
  ui.localDataAlert.hidden = true;
  ui.localDataAlert.textContent = "";

  if (!files.length) return;
  if (files.length > LOCAL_DATA_LIMITS.maxFiles) {
    ui.localDataAlert.textContent = `Choose no more than ${LOCAL_DATA_LIMITS.maxFiles} CSV files at once.`;
    ui.localDataAlert.hidden = false;
    return;
  }

  ui.localDataStatus.textContent = `Validating ${files.length} local file${files.length === 1 ? "" : "s"}…`;

  try {
    const pendingHistories = new Map();
    let rejectedRows = 0;
    let duplicateRows = 0;

    for (const file of files) {
      if (file.size > LOCAL_DATA_LIMITS.maxBytesPerFile) {
        throw new Error(`One selected file is larger than ${Math.round(LOCAL_DATA_LIMITS.maxBytesPerFile / 1_000_000)} MB.`);
      }
      if (!file.name.toLowerCase().endsWith(".csv")) {
        throw new Error("Every selected file must use the .csv extension.");
      }

      const parsed = parseLocalCsv(await file.text(), file.name);
      if (pendingHistories.has(parsed.symbol)) {
        throw new Error(`${parsed.symbol} appears more than once in this selection.`);
      }
      pendingHistories.set(parsed.symbol, parsed.history);
      rejectedRows += parsed.rejectedRows;
      duplicateRows += parsed.duplicateRows;
    }

    const nextHistories = new Map(state.localHistories);
    for (const [symbol, history] of pendingHistories) nextHistories.set(symbol, history);
    const { records, comparisonWindow } = buildCommonLocalRecords(nextHistories);

    for (const symbol of state.localSymbols) delete state.data.indices[symbol];
    for (const [symbol, record] of records) {
      state.data.indices[symbol] = record;
    }
    state.localHistories = nextHistories;
    state.localSymbols = new Set(records.keys());
    state.localComparisonWindow = comparisonWindow;

    const firstImported = pendingHistories.keys().next().value;
    if (firstImported) {
      state.symbol = firstImported;
      state.networkSymbol = firstImported;
    }
    renderDashboard();
    renderLocalSummary();

    const warnings = [];
    if (rejectedRows) warnings.push(`${rejectedRows} invalid row${rejectedRows === 1 ? " was" : "s were"} ignored`);
    if (duplicateRows) warnings.push(`${duplicateRows} duplicate date${duplicateRows === 1 ? " was" : "s were"} replaced by the last row`);
    if (warnings.length) {
      ui.localDataAlert.textContent = `${warnings.join(". ")}.`;
      ui.localDataAlert.hidden = false;
    }
  } catch (error) {
    ui.localDataAlert.textContent = error instanceof Error ? error.message : "The selected files could not be validated.";
    ui.localDataAlert.hidden = false;
    renderLocalSummary();
  } finally {
    ui.localFileInput.value = "";
  }
}

function clearLocalData() {
  for (const symbol of state.localSymbols) delete state.data.indices[symbol];
  state.localSymbols.clear();
  state.localHistories.clear();
  state.localComparisonWindow = null;
  const publicFallback = pickerIndicatorIds()[0] || pinnedIndicatorIds()[0] || hostedIndicatorIds()[0];
  if (LOCAL_INDICATORS.has(state.symbol)) state.symbol = publicFallback;
  if (LOCAL_INDICATORS.has(state.networkSymbol)) state.networkSymbol = publicFallback;
  ui.localDataAlert.hidden = true;
  ui.localDataAlert.textContent = "";
  renderDashboard();
  renderLocalSummary();
  ui.localFileInput.focus();
}

function renderError(error) {
  console.error(error);
  ui.updateChip.classList.remove("fresh", "stale");
  ui.updateChip.classList.add("error");
  ui.updateLabel.textContent = "Daily data unavailable";
  ui.metricGrid.innerHTML = `
    <div class="panel" style="grid-column:1/-1;min-height:auto">
      <strong>We couldn’t load the latest observations.</strong>
      <p style="color:var(--ink-soft);margin:.5rem 0 0">Please try again shortly. No fallback values have been substituted.</p>
    </div>`;
  ui.regimeTitle.textContent = "The current read is unavailable";
  ui.regimeCopy.textContent = "A regime interpretation is only shown when all required source series are available.";
}

async function loadDashboard() {
  try {
    const [dataResponse, catalogResponse] = await Promise.all([
      fetch("data/indices.json", { cache: "no-store" }),
      fetch("data/catalog.json", { cache: "no-store" }),
    ]);
    if (!dataResponse.ok) throw new Error(`Data request failed with ${dataResponse.status}`);
    if (!catalogResponse.ok) throw new Error(`Catalog request failed with ${catalogResponse.status}`);
    state.catalog = await catalogResponse.json();
    state.data = normaliseData(await dataResponse.json());
    if (!pinnedIndicatorIds().some((symbol) => state.data.indices[symbol]?.history.length)) {
      throw new Error("No pinned indicator history is available.");
    }
    if (!state.data.indices[state.symbol]) state.symbol = liveIndicatorIds()[0];
    renderDashboard();
    renderLocalSummary();
  } catch (error) {
    renderError(error);
  }
}

ui.rangePicker.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-range]");
  if (!button) return;
  state.range = button.dataset.range;
  state.inspectedIndex = null;
  renderDetail();
});

ui.scrubber.addEventListener("input", () => updatePointReadout(Number(ui.scrubber.value)));

let pointerFrame = null;
let pendingPointerX = null;
ui.lineChart.addEventListener("pointermove", (event) => {
  pendingPointerX = event.clientX;
  if (pointerFrame !== null) return;
  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = null;
    const index = nearestIndexForX(pendingPointerX);
    if (index !== null) updatePointReadout(index, true);
  });
});

ui.lineChart.addEventListener("pointerleave", () => {
  if (pointerFrame !== null) cancelAnimationFrame(pointerFrame);
  pointerFrame = null;
  pendingPointerX = null;
  ui.lineTooltip.hidden = true;
});

ui.localFileInput.addEventListener("change", () => handleLocalFiles(ui.localFileInput.files));
ui.clearLocalData.addEventListener("click", clearLocalData);

const resizeObserver = new ResizeObserver(() => {
  if (!state.data) return;
  requestAnimationFrame(() => {
    drawLineChart();
    const distribution = calculateDistribution(state.visibleHistory);
    if (distribution) drawDistributionChart(distribution);
    drawNetwork();
  });
});
resizeObserver.observe(ui.lineWrap);
resizeObserver.observe(ui.distributionChart.parentElement);
resizeObserver.observe(ui.networkStage);

loadDashboard();
