import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { publicationBlockers } from "../scripts/check-publication-readiness.mjs";

const projectUrl = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, projectUrl), "utf8"));
}

test("catalog references valid sections and sources", async () => {
  const catalog = await readJson("data/catalog.json");
  const sectionIds = catalog.sections.map((section) => section.id);
  const sourceIds = new Set(Object.keys(catalog.sources));

  assert.equal(new Set(sectionIds).size, sectionIds.length, "section ids must be unique");
  for (const [id, source] of Object.entries(catalog.sources)) {
    assert.ok([true, false, null].includes(source.publicDisplayAllowed), `${id} needs an explicit public-display state`);
  }
  for (const [id, indicator] of Object.entries(catalog.indicators)) {
    assert.ok(sectionIds.includes(indicator.sectionId), `${id} has an unknown section`);
    assert.ok(sourceIds.has(indicator.sourceRef), `${id} has an unknown source`);
  }
});

test("every current indicator has complete guide copy", async () => {
  const [catalog, html] = await Promise.all([
    readJson("data/catalog.json"),
    readFile(new URL("index.html", projectUrl), "utf8"),
  ]);
  const currentIndicators = Object.entries(catalog.indicators)
    .filter(([, indicator]) =>
      ["live", "local"].includes(indicator.status) && indicator.presentation?.guide !== false,
    );

  assert.equal(currentIndicators.length, 10, "the guide should cover six public headlines and four optional local indicators");
  for (const [id, indicator] of currentIndicators) {
    assert.match(indicator.description || "", /\S/, `${id} needs a plain-language definition`);
    assert.match(indicator.howToRead || "", /\S/, `${id} needs interpretation guidance`);
    assert.match(indicator.sourceUrl || "", /^https:\/\//, `${id} needs an official information link`);
  }
  assert.match(html, /id="indicator-guide"/, "the page needs a dedicated indicator guide");
  assert.match(html, /id="history-definition"/, "the history panel needs the selected definition");
});

test("OFR components form one complete hidden breakdown under the aggregate", async () => {
  const catalog = await readJson("data/catalog.json");
  const componentIds = ["OFRVOL", "OFREQUITY", "OFRCREDIT", "OFRFUNDING", "OFRSAFE"];
  const aggregate = catalog.indicators.OFRFSI;

  assert.deepEqual(aggregate.componentIds, componentIds);
  assert.equal(aggregate.pinned, true);
  for (const id of componentIds) {
    const component = catalog.indicators[id];
    assert.equal(component.status, "live", `${id} should remain available for the aggregate breakdown`);
    assert.equal(component.pinned, false, `${id} should not occupy a headline card`);
    assert.equal(component.parentIndicatorId, "OFRFSI", `${id} needs the aggregate parent`);
    assert.equal(component.presentation?.guide, false, `${id} should be explained inside the OFR breakdown`);
    assert.equal(component.presentation?.picker, false, `${id} should be omitted from the main picker`);
    assert.equal(component.network?.visible, false, `${id} should not crowd the headline network`);
    assert.match(component.description || "", /\S/, `${id} needs a definition for its breakdown row`);
    assert.match(component.howToRead || "", /\S/, `${id} needs interpretation guidance`);
  }
  for (const regime of catalog.regimes) {
    assert.equal(
      regime.requiredIndicators.some((id) => componentIds.includes(id)),
      false,
      `${regime.id} should use OFRFSI without requiring contribution rows`,
    );
  }
});

test("Federal Reserve and BLS sources have explicit public reuse metadata", async () => {
  const catalog = await readJson("data/catalog.json");
  for (const sourceId of ["federal-reserve", "bls"]) {
    const source = catalog.sources[sourceId];
    assert.equal(source.publicDisplayAllowed, true, `${sourceId} should be approved for public display`);
    assert.match(source.rightsUrl || "", /^https:\/\//, `${sourceId} needs an official rights page`);
    assert.match(source.attribution || "", /\S/, `${sourceId} needs attribution copy`);
  }
});

test("catalog relationships and regimes reference known indicators", async () => {
  const catalog = await readJson("data/catalog.json");
  const indicatorIds = new Set(Object.keys(catalog.indicators));
  const relationshipIds = catalog.relationships.map((relationship) => relationship.id);
  const regimeIds = catalog.regimes.map((regime) => regime.id);

  assert.equal(new Set(relationshipIds).size, relationshipIds.length, "relationship ids must be unique");
  assert.equal(new Set(regimeIds).size, regimeIds.length, "regime ids must be unique");
  for (const relationship of catalog.relationships) {
    assert.ok(indicatorIds.has(relationship.source), `${relationship.id} has an unknown source indicator`);
    assert.ok(indicatorIds.has(relationship.target), `${relationship.id} has an unknown target indicator`);
    assert.notEqual(relationship.source, relationship.target, `${relationship.id} cannot connect an indicator to itself`);
  }

  for (const regime of catalog.regimes) {
    assert.ok(["same-date", "max-gap", "latest-available"].includes(regime.alignment?.policy || "same-date"), `${regime.id} has an invalid alignment policy`);
    if (regime.alignment?.policy === "max-gap") {
      assert.ok(Number.isInteger(regime.alignment.maxGapDays) && regime.alignment.maxGapDays > 0, `${regime.id} needs a positive maximum date gap`);
    }
    for (const id of regime.requiredIndicators) {
      assert.ok(indicatorIds.has(id), `${regime.id} requires an unknown indicator`);
    }
    for (const condition of regime.conditions) {
      assert.ok(indicatorIds.has(condition.indicatorId), `${regime.id} tests an unknown indicator`);
      assert.ok(regime.requiredIndicators.includes(condition.indicatorId), `${regime.id} tests an undeclared input`);
      assert.ok(["percentile", "value", "change", "changePercent"].includes(condition.metric), `${regime.id} uses an unknown metric`);
      assert.ok(["lt", "lte", "gt", "gte", "eq"].includes(condition.operator), `${regime.id} uses an unsafe operator`);
      assert.ok(Number.isFinite(condition.value), `${regime.id} needs a finite threshold`);
    }
    for (const relationshipId of regime.evidenceRelationships || []) {
      assert.ok(relationshipIds.includes(relationshipId), `${regime.id} cites an unknown evidence relationship`);
    }
  }
  assert.equal(catalog.regimes.filter((regime) => regime.conditions.length === 0).length, 1, "catalog needs exactly one fallback regime");
});

test("headline interaction network is positioned, connected and explicit", async () => {
  const catalog = await readJson("data/catalog.json");
  const expectedNodes = [
    "OFRFSI",
    "CURVE2S10S",
    "REAL10Y",
    "CPIYOY",
    "EMPDIFF1M",
    "DTWEXBGS",
    "VIX",
    "VIXEQ",
    "DSPX",
    "COR1M",
  ];
  const visibleNodes = Object.entries(catalog.indicators)
    .filter(([, indicator]) => ["live", "local"].includes(indicator.status) && indicator.network?.visible)
    .map(([id]) => id)
    .sort();
  assert.deepEqual(visibleNodes, [...expectedNodes].sort());

  for (const id of expectedNodes) {
    const { x, y } = catalog.indicators[id].network;
    assert.ok(Number.isFinite(x) && x >= 0 && x <= 100, `${id} needs a valid network x position`);
    assert.ok(Number.isFinite(y) && y >= 0 && y <= 100, `${id} needs a valid network y position`);
  }
  for (let left = 0; left < expectedNodes.length; left += 1) {
    for (let right = left + 1; right < expectedNodes.length; right += 1) {
      const leftPosition = catalog.indicators[expectedNodes[left]].network;
      const rightPosition = catalog.indicators[expectedNodes[right]].network;
      const distance = Math.hypot(leftPosition.x - rightPosition.x, leftPosition.y - rightPosition.y);
      assert.ok(distance >= 18, `${expectedNodes[left]} and ${expectedNodes[right]} overlap in the network`);
    }
  }

  const explicitRelationshipIds = [
    "yield-curve-to-employment-breadth",
    "employment-breadth-to-fsi",
    "real-yield-to-fsi",
    "cpi-to-real-yield",
    "broad-dollar-to-fsi",
    "vix-to-fsi",
  ];
  const relationshipIds = new Set(catalog.relationships.map(({ id }) => id));
  for (const id of explicitRelationshipIds) assert.ok(relationshipIds.has(id), `${id} is missing`);

  const visibleSet = new Set(expectedNodes);
  const neighbors = Object.fromEntries(expectedNodes.map((id) => [id, new Set()]));
  for (const relationship of catalog.relationships) {
    if (!visibleSet.has(relationship.source) || !visibleSet.has(relationship.target)) continue;
    neighbors[relationship.source].add(relationship.target);
    neighbors[relationship.target].add(relationship.source);
  }
  const reached = new Set([expectedNodes[0]]);
  const queue = [expectedNodes[0]];
  while (queue.length) {
    const current = queue.shift();
    for (const neighbor of neighbors[current]) {
      if (reached.has(neighbor)) continue;
      reached.add(neighbor);
      queue.push(neighbor);
    }
  }
  assert.equal(reached.size, expectedNodes.length, "all headline and local nodes should belong to one connected graph");
});

test("combined public regimes use conservative thresholds and monthly-safe alignment", async () => {
  const catalog = await readJson("data/catalog.json");
  const regimeIds = [
    "public-tightening-with-stress",
    "curve-and-employment-warning",
    "inflation-and-real-rate-pressure",
    "contained-stress-with-positive-breadth",
  ];
  for (const id of regimeIds) {
    const regime = catalog.regimes.find((candidate) => candidate.id === id);
    assert.ok(regime, `${id} is missing`);
    const expectedGap = id === "inflation-and-real-rate-pressure" ? 75 : 45;
    assert.deepEqual(regime.alignment, { policy: "max-gap", maxGapDays: expectedGap });
    assert.ok(regime.conditions.length >= 2, `${id} should require confirmation from multiple indicators`);
    for (const indicatorId of regime.requiredIndicators) {
      const indicator = catalog.indicators[indicatorId];
      assert.equal(indicator.status, "live", `${id} should use live public data`);
      assert.equal(catalog.sources[indicator.sourceRef].publicDisplayAllowed, true, `${id} should use rights-safe sources`);
    }
    for (const condition of regime.conditions) {
      if (condition.metric === "value") {
        assert.equal(condition.indicatorId, "EMPDIFF1M", `${id} should only use an absolute threshold for employment breadth`);
        assert.equal(condition.operator, "gte", `${id} should require positive employment breadth`);
        assert.equal(condition.value, 50, `${id} should use the BLS diffusion index neutral point`);
      } else {
        assert.equal(condition.metric, "percentile", `${id} should use comparable historical positions`);
        assert.ok([25, 75].includes(condition.value), `${id} should use outer-quartile thresholds`);
      }
    }
  }
});

test("roadmap states and first-wave metadata are promotion-ready", async () => {
  const catalog = await readJson("data/catalog.json");
  const statusValues = new Set(["live", "planned", "later", "local"]);
  const sectionOrders = new Map();

  for (const [id, indicator] of Object.entries(catalog.indicators)) {
    assert.ok(statusValues.has(indicator.status), `${id} has an unknown status`);
    if (["planned", "later"].includes(indicator.status)) assert.ok(Number.isInteger(indicator.wave) && indicator.wave > 0, `${id} needs a positive wave`);
    if (indicator.status === "planned") assert.ok(indicator.wave <= 2, `${id} should use later status for wave 3 or beyond`);
    if (indicator.status === "later") assert.ok(indicator.wave >= 3, `${id} should not be marked later before wave 3`);

    const key = `${indicator.sectionId}:${indicator.displayOrder}`;
    assert.ok(!sectionOrders.has(key), `${id} duplicates ${sectionOrders.get(key)} display order within its section`);
    sectionOrders.set(key, id);

    if (["live", "local"].includes(indicator.status) || indicator.wave === 1) {
      assert.match(indicator.sourceUrl, /^https:\/\//, `${id} needs an official source link`);
      assert.ok(typeof indicator.frequency === "string", `${id} needs a frequency`);
      assert.ok(typeof indicator.calendar === "string", `${id} needs a calendar`);
      assert.ok(typeof indicator.timezone === "string", `${id} needs a timezone`);
      assert.ok(typeof indicator.observationSemantics === "string", `${id} needs observation semantics`);
      assert.ok(typeof indicator.observationLabel === "string", `${id} needs an observation label`);
      assert.ok(Number.isInteger(indicator.staleAfterDays) && indicator.staleAfterDays > 0, `${id} needs a stale threshold`);
      assert.ok(indicator.unit && Number.isInteger(indicator.unit.decimals), `${id} needs units`);
      assert.ok(typeof indicator.interpretation?.polarity === "string", `${id} needs interpretation polarity`);
    }
  }
});

test("every live catalog indicator has valid generated data", async () => {
  const [catalog, data] = await Promise.all([
    readJson("data/catalog.json"),
    readJson("data/indices.json"),
  ]);
  const expectedLiveIds = [
    "CPIYOY",
    "CURVE2S10S",
    "DTWEXBGS",
    "EMPDIFF1M",
    "OFRCREDIT",
    "OFREQUITY",
    "OFRFSI",
    "OFRFUNDING",
    "OFRSAFE",
    "OFRVOL",
    "REAL10Y",
  ];

  for (const [id, indicator] of Object.entries(catalog.indicators)) {
    if (indicator.status !== "live") continue;
    const series = data.indices[id];
    assert.ok(series, `${id} is live but missing from data/indices.json`);
    assert.ok(Array.isArray(series.history) && series.history.length > 0, `${id} has no history`);
    assert.ok(Number.isFinite(series.latest.value), `${id} has no latest value`);
    assert.match(indicator.sourceUrl, /^https:\/\//, `${id} needs an official source link`);
    assert.equal(catalog.sources[indicator.sourceRef].publicDisplayAllowed, true, `${id} needs public-display approval before publication`);
    assert.equal(series.sourceRef, indicator.sourceRef, `${id} should identify its official source`);
  }

  assert.deepEqual(
    Object.entries(catalog.indicators)
      .filter(([, indicator]) => indicator.status === "live")
      .map(([id]) => id)
      .sort(),
    expectedLiveIds,
  );
  assert.deepEqual(Object.keys(data.indices).sort(), expectedLiveIds);
  assert.equal(data.rights?.publicDisplayAllowed, true);
  for (const sourceId of ["ofr", "federal-reserve", "bls"]) {
    assert.ok(data.sources?.[sourceId], `${sourceId} should be listed in the generated source manifest`);
    assert.equal(data.rights?.sources?.[sourceId]?.publicDisplayAllowed, true, `${sourceId} needs generated public-display approval`);
    assert.match(data.rights?.sources?.[sourceId]?.rightsUrl || "", /^https:\/\//, `${sourceId} needs generated rights metadata`);
  }
  assert.doesNotMatch(JSON.stringify(data), /cdn\.cboe\.com|fredgraph\.csv|api\.stlouisfed\.org|fred\.stlouisfed\.org\/graph/i);

  const componentIds = catalog.indicators.OFRFSI.componentIds;
  const componentDates = new Set(componentIds.map((id) => data.indices[id].latest.date));
  const componentTotal = componentIds.reduce(
    (total, id) => total + data.indices[id].latest.value,
    0,
  );
  assert.deepEqual([...componentDates], [data.indices.OFRFSI.latest.date]);
  assert.ok(
    Math.abs(componentTotal - data.indices.OFRFSI.latest.value) <= 0.005,
    "the latest OFR contributions should sum to the aggregate within source rounding",
  );
});

test("Cboe indicators are local-only and excluded from hosted publication", async () => {
  const [catalog, data] = await Promise.all([
    readJson("data/catalog.json"),
    readJson("data/indices.json"),
  ]);
  const localIds = ["VIX", "VIXEQ", "DSPX", "COR1M"];
  assert.deepEqual(
    Object.entries(catalog.indicators)
      .filter(([, indicator]) => indicator.status === "local")
      .map(([id]) => id),
    localIds,
  );
  for (const id of localIds) assert.equal(data.indices[id], undefined, `${id} must not be hosted`);
});

test("only promoted direct-source and derived indicators enter the hosted payload", async () => {
  const [catalog, data] = await Promise.all([
    readJson("data/catalog.json"),
    readJson("data/indices.json"),
  ]);
  for (const id of ["CURVE2S10S", "REAL10Y", "DTWEXBGS", "EMPDIFF1M", "CPIYOY"]) {
    assert.equal(catalog.indicators[id]?.status, "live", `${id} should be live`);
    assert.ok(data.indices[id], `${id} should be in the hosted payload`);
  }
  for (const id of ["DGS2", "DGS10", "RATEVOL20"]) {
    assert.equal(catalog.indicators[id]?.status, "planned", `${id} should remain planned`);
    assert.equal(data.indices[id], undefined, `${id} must not be in the hosted payload`);
  }
});

test("publication gate approves only the resolved hosted sources", async () => {
  const catalog = await readJson("data/catalog.json");
  assert.deepEqual(publicationBlockers(catalog), []);
});
