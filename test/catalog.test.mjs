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
    .filter(([, indicator]) => ["live", "local"].includes(indicator.status));

  assert.equal(currentIndicators.length, 9, "the guide should cover five public and four optional local indicators");
  for (const [id, indicator] of currentIndicators) {
    assert.match(indicator.description || "", /\S/, `${id} needs a plain-language definition`);
    assert.match(indicator.howToRead || "", /\S/, `${id} needs interpretation guidance`);
    assert.match(indicator.sourceUrl || "", /^https:\/\//, `${id} needs an official information link`);
  }
  assert.match(html, /id="indicator-guide"/, "the page needs a dedicated indicator guide");
  assert.match(html, /id="history-definition"/, "the history panel needs the selected definition");
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

  for (const [id, indicator] of Object.entries(catalog.indicators)) {
    if (indicator.status !== "live") continue;
    const series = data.indices[id];
    assert.ok(series, `${id} is live but missing from data/indices.json`);
    assert.ok(Array.isArray(series.history) && series.history.length > 0, `${id} has no history`);
    assert.ok(Number.isFinite(series.latest.value), `${id} has no latest value`);
    assert.match(indicator.sourceUrl, /^https:\/\//, `${id} needs an official source link`);
    assert.equal(catalog.sources[indicator.sourceRef].publicDisplayAllowed, true, `${id} needs public-display approval before publication`);
  }

  assert.deepEqual(
    Object.entries(catalog.indicators)
      .filter(([, indicator]) => indicator.status === "live")
      .map(([id]) => id)
      .sort(),
    ["OFRCREDIT", "OFREQUITY", "OFRFSI", "OFRFUNDING", "OFRVOL"],
  );
  assert.deepEqual(Object.keys(data.indices).sort(), ["OFRCREDIT", "OFREQUITY", "OFRFSI", "OFRFUNDING", "OFRVOL"]);
  assert.equal(data.rights?.publicDisplayAllowed, true);
  assert.match(data.source?.rights?.rightsUrl || "", /^https:\/\/www\.financialresearch\.gov\//);
  assert.doesNotMatch(JSON.stringify(data), /cdn\.cboe\.com|fredgraph\.csv/i);
});

test("Cboe indicators are local-only and excluded from hosted publication", async () => {
  const catalog = await readJson("data/catalog.json");
  assert.deepEqual(
    Object.entries(catalog.indicators)
      .filter(([, indicator]) => indicator.status === "local")
      .map(([id]) => id),
    ["VIX", "VIXEQ", "DSPX", "COR1M"],
  );
});

test("Federal Reserve and derived indicators remain planned without hosted values", async () => {
  const [catalog, data] = await Promise.all([
    readJson("data/catalog.json"),
    readJson("data/indices.json"),
  ]);
  for (const id of ["DGS2", "DGS10", "DTWEXBGS", "CURVE2S10S", "RATEVOL20"]) {
    assert.equal(catalog.indicators[id]?.status, "planned", `${id} should remain planned`);
    assert.equal(data.indices[id], undefined, `${id} must not be in the hosted payload`);
  }
});

test("publication gate approves only the resolved hosted sources", async () => {
  const catalog = await readJson("data/catalog.json");
  assert.deepEqual(publicationBlockers(catalog), []);
});
