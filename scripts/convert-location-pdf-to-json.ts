#!/usr/bin/env tsx
/**
 * Convert a location PDF (Swipely-style list) into JSON for Google Places import
 *
 * This generates JSON in the same shape as `data/northern-virginia.json`, i.e.:
 *
 * {
 *   "city": "Northern Virginia, VA",
 *   "categories": {
 *     "shopping": [{ "name": "...", "address": "..." }],
 *     "museum":   [{ "name": "...", "address": "..." }]
 *   }
 * }
 *
 * Usage examples:
 *
 *   # Northern Virginia list
 *   tsx scripts/convert-location-pdf-to-json.ts "Norther virginia location list 2.0.pdf" \
 *     --city "Northern Virginia, VA" \
 *     --output "data/northern-virginia-2.0.json"
 *
 *   # San Francisco lists
 *   tsx scripts/convert-location-pdf-to-json.ts "San Fran location list 2.0.pdf" \
 *     --city "San Francisco, CA" \
 *     --output "data/san-francisco-2.0.json"
 *
 *   tsx scripts/convert-location-pdf-to-json.ts "San Fran location list 3.0.pdf" \
 *     --city "San Francisco, CA" \
 *     --output "data/san-francisco-3.0.json"
 */

/* eslint-disable no-console */

import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';

// ---------- Types ----------

interface ParsedRow {
  name: string;
  address: string;
  category?: string;
}

interface LocationEntry {
  name: string;
  address: string;
}

interface LocationJSON {
  city: string;
  categories: Record<string, LocationEntry[]>;
}

// ---------- Category mapping & parsing ----------

// Keep this in sync with the headings used in the PDFs and category slugs in the app
const CATEGORY_MAP: Record<string, string> = {
  'museums': 'museum',
  'games & entertainment': 'games-entertainment',
  'games & entertainment spots (name + address)': 'games-entertainment',
  'games and entertainment': 'games-entertainment',
  'games and entertainment spots': 'games-entertainment',
  'arts & culture': 'arts-culture',
  'arts and culture': 'arts-culture',
  'live music': 'live-music',
  'relax & recharge': 'relax-recharge',
  'relax and recharge': 'relax-recharge',
  'sports & recreation': 'sports-recreation',
  'sports and recreation': 'sports-recreation',
  'drinks & bars': 'drinks-bars',
  'drinks and bars': 'drinks-bars',
  'pet-friendly': 'pet-friendly',
  'pet friendly': 'pet-friendly',
  'road trip getaways': 'road-trip-getaways',
  'festivals & pop-ups': 'festivals-pop-ups',
  'festivals and pop-ups': 'festivals-pop-ups',
  'fitness & classes': 'fitness-classes',
  'fitness and classes': 'fitness-classes',
  'shopping': 'shopping',
  'coffee': 'coffee',
  'coffee shops and cafes': 'coffee',
  'coffee shops & cafes': 'coffee',
  'nightlife': 'nightlife',
  'outdoors': 'outdoors',
  'activities': 'activities',
  'food': 'food',
};

function normalizeHeading(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Parse raw PDF text into rows of { name, address, category }
 * Assumes lines in the format:
 *   "1. Union Market — 1309 5th St NE, Washington, DC 20002"
 * and headings like "SHOPPING - 25 Spots (name — address)".
 */
function parseLines(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00A0/g, ' ').trim())
    .filter((l) => l.length > 0);

  const out: ParsedRow[] = [];
  let currentCategory: string | undefined;

  for (const raw of lines) {
    // Strip leading list numbering: "1. ", "23 " etc.
    const l = raw.replace(/^\d+\.?\s*/, '');

    const key = normalizeHeading(l);
    if (CATEGORY_MAP[key]) {
      currentCategory = CATEGORY_MAP[key];
      continue;
    }

    // Fuzzy heading detection: if a line contains the heading words (helps with PDF formatting)
    for (const [h, slug] of Object.entries(CATEGORY_MAP)) {
      const hNorm = normalizeHeading(h);
      if (key.includes(hNorm) && Math.abs(key.length - hNorm.length) < 15) {
        currentCategory = slug;
        continue;
      }
    }

    // Split on em-dash (—), en-dash (-), or pipe (|) with surrounding whitespace
    const parts = l.split(/\s+[—|\-|]\s+/);
    if (parts.length >= 2) {
      const name = parts[0].trim();
      let address = parts.slice(1).join(' - ').trim();

      // Strip trailing source citations that confuse Google Places; keep up to the ZIP/state when present.
      const zipMatch = address.match(
        /(.*\b(?:CA|CO|VA|DC|MD|California|Colorado|Virginia|Maryland)\s+\d{5}(?:-\d{4})?)/,
      );
      if (zipMatch) {
        address = zipMatch[1].trim();
      }

      if (name && address) {
        out.push({ name, address, category: currentCategory });
      }
    }
  }

  return out;
}

// ---------- CLI + Main ----------

interface CLIOptions {
  pdfPath: string;
  city: string;
  outputPath: string;
}

function parseArgs(argv: string[]): CLIOptions {
  if (argv.length === 0) {
    console.log(
      'Usage: tsx scripts/convert-location-pdf-to-json.ts <pdfPath> --city "City, ST" --output <output.json>',
    );
    process.exit(1);
  }

  const pdfPath = path.resolve(argv[0]);
  let city = 'Unknown City';
  let outputPath = '';

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--city' && next) {
      city = next;
      i++;
    } else if (arg === '--output' && next) {
      outputPath = next;
      i++;
    }
  }

  if (!outputPath) {
    const base = path.basename(pdfPath).replace(/\.[^.]+$/, '');
    outputPath = path.join('data', `${base}.json`);
  }

  return { pdfPath, city, outputPath };
}

async function main() {
  const argv = process.argv.slice(2);
  const { pdfPath, city, outputPath } = parseArgs(argv);

  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`);
    process.exit(1);
  }

  console.log(`📄 Reading PDF: ${pdfPath}`);
  console.log(`🏙  City: ${city}`);
  console.log(`📦 Output: ${outputPath}`);

  const buffer = fs.readFileSync(pdfPath);
  const parsed = await pdf(buffer);
  const rows = parseLines(parsed.text);

  console.log(`✅ Parsed ${rows.length} rows from PDF`);

  const categories: Record<string, LocationEntry[]> = {};

  for (const row of rows) {
    const cat = row.category || 'activities';
    if (!categories[cat]) {
      categories[cat] = [];
    }
    categories[cat].push({
      name: row.name,
      address: row.address,
    });
  }

  const json: LocationJSON = {
    city,
    categories,
  };

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(json, null, 2), 'utf-8');

  console.log(`🎉 Wrote JSON to ${outputPath}`);
  console.log(
    'You can now import it with: tsx scripts/import-from-json.ts ' +
      outputPath +
      ' --limit 500',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


