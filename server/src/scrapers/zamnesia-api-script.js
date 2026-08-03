#!/usr/bin/env node

/**
 * Fetches all cannabis seed products from Zamnesia's Algolia index
 * and exports normalized results to JSON + CSV.
 *
 * Run:
 *   node zamnesia-api-script.js
 */

const fs = require("node:fs/promises");
const path = require("node:path");

const CONFIG = {
  appId: "Q6BVPE7LU5",
  apiKey: "655ab8fc4d9bb483cb6b6694c73a159f",
  indexName: "products_en",
  categoryFilter: "all_product_categories:35",
  hitsPerPage: 30,
  outputDir: path.resolve(process.cwd(), "output"),
};

function buildParams({ page, query = "" }) {
  const p = new URLSearchParams();
  p.set("query", query);
  p.set("hitsPerPage", String(CONFIG.hitsPerPage));
  p.set("page", String(page));
  p.set("filters", CONFIG.categoryFilter);
  return p.toString();
}

async function algoliaQueriesRequest(paramsString) {
  const url = `https://${CONFIG.appId}-dsn.algolia.net/1/indexes/*/queries`;

  const body = {
    requests: [
      {
        indexName: CONFIG.indexName,
        params: paramsString,
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-algolia-application-id": CONFIG.appId,
      "x-algolia-api-key": CONFIG.apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Algolia request failed: HTTP ${res.status} ${text}`);
  }

  const json = await res.json();
  if (!json.results || !json.results[0]) {
    throw new Error("Unexpected Algolia response format.");
  }

  return json.results[0];
}

function normalizeHit(hit) {
  return {
    strain: hit.name || null,
    breeder: hit.brand || null,
    price_eur: hit.price ?? null,
    old_price_eur: hit.price_without_reduction ?? null,
    product_id: hit.id_product || hit.objectID || null,
    variant_id: hit.id_product_attribute || null,
    product_url: hit.product_url || null,
    pack_field: hit.pack ?? null,
  };
}

function escapeCsvValue(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  const header = [
    "strain",
    "breeder",
    "price_eur",
    "old_price_eur",
    "product_id",
    "variant_id",
    "product_url",
    "pack_field",
  ];

  const lines = [header.join(",")];

  for (const row of rows) {
    const line = header.map((k) => escapeCsvValue(row[k])).join(",");
    lines.push(line);
  }

  return lines.join("\n");
}

async function fetchAll() {
  const first = await algoliaQueriesRequest(buildParams({ page: 0 }));

  const allHits = [...(first.hits || [])];
  const nbPages = first.nbPages || 0;
  const nbHits = first.nbHits || allHits.length;

  for (let page = 1; page < nbPages; page++) {
    const result = await algoliaQueriesRequest(buildParams({ page }));
    if (Array.isArray(result.hits)) {
      allHits.push(...result.hits);
    }

    if (page % 10 === 0) {
      console.log(`Fetched page ${page + 1}/${nbPages}...`);
    }
  }

  return { nbHits, nbPages, hits: allHits };
}

async function main() {
  console.log("Fetching Zamnesia seed products via Algolia API...");

  const data = await fetchAll();
  const normalized = data.hits.map(normalizeHit);

  await fs.mkdir(CONFIG.outputDir, { recursive: true });

  const jsonPath = path.join(CONFIG.outputDir, "zamnesia-seeds.json");
  const csvPath = path.join(CONFIG.outputDir, "zamnesia-seeds.csv");

  await fs.writeFile(
    jsonPath,
    JSON.stringify(
      {
        meta: {
          appId: CONFIG.appId,
          indexName: CONFIG.indexName,
          filter: CONFIG.categoryFilter,
          nbHitsReported: data.nbHits,
          nbPages: data.nbPages,
          exportedAt: new Date().toISOString(),
        },
        items: normalized,
      },
      null,
      2
    ),
    "utf8"
  );

  await fs.writeFile(csvPath, toCsv(normalized), "utf8");

  console.log(`Done. Reported hits: ${data.nbHits}`);
  console.log(`Exported items: ${normalized.length}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV : ${csvPath}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
