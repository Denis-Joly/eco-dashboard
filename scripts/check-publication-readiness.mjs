import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function publicationBlockers(catalog) {
  const blockers = new Map();
  for (const [id, indicator] of Object.entries(catalog.indicators || {})) {
    if (indicator.status !== "live") continue;
    const source = catalog.sources?.[indicator.sourceRef];
    if (source?.publicDisplayAllowed === true) continue;
    const sourceId = indicator.sourceRef || "unknown";
    if (!blockers.has(sourceId)) blockers.set(sourceId, []);
    blockers.get(sourceId).push(id);
  }
  return [...blockers.entries()].map(([sourceId, indicatorIds]) => ({ sourceId, indicatorIds }));
}

async function main() {
  const catalog = JSON.parse(await readFile(new URL("../data/catalog.json", import.meta.url), "utf8"));
  const blockers = publicationBlockers(catalog);
  if (!blockers.length) {
    console.log("All live indicator sources are approved for public display.");
    return;
  }

  for (const blocker of blockers) {
    console.error(`Public display is not approved for ${blocker.sourceId}: ${blocker.indicatorIds.join(", ")}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
