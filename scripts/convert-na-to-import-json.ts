#!/usr/bin/env tsx
/**
 * Convert NA.json (simple category → [name]) into the structured JSON format
 * expected by scripts/import-from-json.ts:
 *
 * {
 *   "city": "Northern Virginia",
 *   "categories": {
 *     "shopping": [{ "name": "...", "address": "Northern Virginia, USA" }],
 *     ...
 *   }
 * }
 */

/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

type RawNA = Record<string, string[]>;

type OutputLocation = {
  name: string;
  address: string;
};

type OutputJSON = {
  city: string;
  categories: Record<string, OutputLocation[]>;
};

// Map human-friendly category names in NA.json → canonical slugs used in the app
const CATEGORY_MAP: Record<string, string> = {
  'Shopping': 'shopping',
  'Museums': 'museum',
  'Food': 'food',
  'Outdoor': 'outdoors',
  'Nightlife': 'nightlife',
  'Coffee': 'coffee',
  'Arts and culture': 'arts-culture',
  'Live Music': 'live-music',
  'Games and entertainment': 'games-entertainment',
  'Relax and Wellness': 'relax-recharge',
  'Sports and Recreation': 'sports-recreation',
  'Drinks and Bars': 'drinks-bars',
  'Pet friendly': 'pet-friendly',
  'Road trip getaways': 'road-trip-getaways',
  'Fitness and classes': 'fitness-classes',
  'Activities': 'activities',
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'") // fancy single quotes → '
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"') // fancy double quotes → "
    .replace(/\s+/g, ' ')
    .trim();
}

// High-confidence manual overrides for cases where PDF layout is tricky (e.g. Shopping list)
// Keys are normalized with normalizeName().
const HARDCODED_ADDRESS_ENTRIES: Array<[string, string]> = [
  ['Tysons Corner Center', '1961 Chain Bridge Rd, McLean, VA 22102'],
  ['Tysons Galleria', '2001 International Dr, McLean, VA 22102'],
  ['Fair Oaks Mall', '11750 Fair Oaks Mall, Fairfax, VA 22033'],
  ['Fashion Centre at Pentagon City', '1100 S Hayes St, Arlington, VA 22202'],
  ['Dulles Town Center', '21100 Dulles Town Circle, Dulles, VA 20166'],
  ['Reston Town Center', '11900 Market St, Reston, VA 20190'],
  ['Mosaic District', '2910 District Ave, Merrifield, VA 22031'],
  ['Ballston Quarter', '4238 Wilson Blvd, Arlington, VA 22203'],
  ['Crystal City Shops', '1600-1750 Crystal Dr, Arlington, VA 22202'],
  ['Springfield Town Center', '6500 Springfield Mall, Springfield, VA 22150'],
  ['Potomac Mills', '2700 Potomac Mills Cir, Woodbridge, VA 22192'],
  ['Manassas Mall', '8300 Sudley Rd, Manassas, VA 20109'],
  ['Fairfax Corner', '4100 Monument Corner Dr, Fairfax, VA 22030'],
  ['Potomac Yard Center', '3671 Jefferson Davis Hwy, Alexandria, VA 22305'],
  ['Village at Shirlington', '4280 Campbell Ave, Arlington, VA 22206'],
  ['Mode on Main by Mara', '10417 Main St, Fairfax, VA 22030'],
  ['Falls Church Farmers Market', '300 Park Ave, Falls Church, VA 22046'],
  ['Reston Farmers Market', '1609 Washington Plaza, Reston, VA 20190'],
  ['Westover Farmers Market', '1644 N McKinley Rd, Arlington, VA 22205'],
  ['McLean Farmers Market', '1659 Chain Bridge Rd, McLean, VA 22101'],
  ['Columbia Pike Farmers Market', 'Columbia Pike & S Walter Reed Dr, Arlington, VA 22204'],
  ['Ballston FRESHFARM Market', '901 N Taylor St, Arlington, VA 22203'],
  ['Crystal City FRESHFARM Market', '333 Long Bridge Dr, Arlington, VA 22202'],
  ['Lubber Run Farmers Market', '4401 N Henderson Rd, Arlington, VA 22203'],
  ['Village Hardware', 'Hollin Halls Shopping Center, Alexandria, VA'],
  ['Nest', 'Inside Fairfax Corner shopping district, Fairfax, VA 22030'],
  ['Mobius Records', 'Fairfax, VA'],
  ['Nostalgia Vintage Boutique', 'Falls Church, VA'],
  ['Old Town Books', 'King Street, Old Town Alexandria, VA'],
  ['The Shoe Hive', 'King Street, Old Town Alexandria, VA'],
  ['An American in Paris Boutique', 'King Street, Old Town Alexandria, VA'],
  ['Vienna’s Maple Ave Shopping Strip', 'Maple Ave, Vienna, VA 22180'],
  ['Bard’s Alley Bookstore', 'Church St / Maple Ave area, Vienna, VA'],
  ['Vienna Music Exchange', 'Maple Ave, Vienna, VA'],
  ['Historic Downtown Occoquan Shops', 'Mill Street & surrounding, Occoquan, VA 22125'],
  ['Historic Downtown Leesburg Shops', 'Historic District, Leesburg, VA 20176'],
  ['Middleburg Boutique District', 'Washington St & nearby, Middleburg, VA 20117'],
  ['Historic Old Town Alexandria Shopping District', 'King St & nearby streets, Alexandria, VA 22314'],
  ['Old Town Fairfax City Shopping Area', 'Main St / Downtown Fairfax, VA 22030'],
  ['Historic Manassas Downtown Shops', 'Center St / Main St area, Manassas, VA 20110'],
  ['Smart Markets Springfield', '6417 Loisdale Rd, Springfield, VA 22150'],
  ['Smart Markets Manassas Park', '99 Adams St, Manassas Park, VA 20111'],
  ['Fairfax‑City Farmers Market', 'Fairfax City, VA'],
  ['Village at Fairfax Square', '8075 Leesburg Pike, Vienna, VA 22182'],
  ['Potomac River Running Store', 'Inside Fairfax Corner complex, Fairfax, VA 22030'],
  ['Bluemercury', 'Inside Fairfax Corner, Fairfax, VA 22030'],
  ['Le Village Marché', '2700 S Quincy St, Arlington, VA 22206'],
  ['One, Two Kangaroo Toys!', '4022 Campbell Ave, Arlington, VA 22206'],
  ['Hardwood Artisans Furniture', '2800 S Randolph St, Arlington, VA 22206'],
  ['Diament Jewelry Boutique', '4017B Campbell Ave, Arlington, VA 22206'],
  ['BUSBOYS & POETS', '4251 South Campbell Ave, Arlington, VA 22206'],
  ['Le Shopping & Boutiques Cluster', 'King St & surrounding, Alexandria, VA 22314'],
  ['Leesburg Corner Premium Outlets', '241 Fort Evans Rd NE, Leesburg, VA 20176'],
  ['Virginia Gateway Shopping District', 'Loudoun / Sterling, VA'],
  // A couple of key museum entries where the earlier heuristic could mis-align
  ['MOCA Arlington', '3550 Wilson Boulevard, Arlington, VA 22201'],
  ['Steven F. Udvar‑Hazy Center', '14390 Air and Space Museum Pkwy, Chantilly, VA 20151'],
  ['Fairfax Museum', '10209 Main St, Fairfax, VA 22030'],
  ['Fairfax Station Railroad Museum', '11200 Fairfax Station Road, Fairfax Station, VA 22039'],
];

const HARDCODED_ADDRESSES = new Map<string, string>(
  HARDCODED_ADDRESS_ENTRIES.map(([name, addr]) => [normalizeName(name), addr]),
);

function buildAddressMapFromText(text: string): Map<string, string> {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const map = new Map<string, string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1) Table rows with pipes: | # | Name | Address |
    if (line.includes('|')) {
      const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 3) {
        const name = parts[1];
        const addr = parts[2];
        if (name && addr) {
          map.set(normalizeName(name), addr);
          continue;
        }
      }
    }

    // 2) Lines like "1. CorePower Yoga - Arlington, VA" or "CorePower Yoga - Arlington, VA"
    const dashMatch = line.match(/^(?:\d+\.\s*)?(.+?)\s*[-–—]\s*(.+)$/);
    if (dashMatch) {
      const name = dashMatch[1].trim();
      const addr = dashMatch[2].trim();
      if (name && addr) {
        map.set(normalizeName(name), addr);
        continue;
      }
    }
  }

  return map;
}

async function main() {
  const root = process.cwd();
  const inputPath = path.join(root, 'NA.json');
  const outputPath = path.join(root, 'data', 'northern-virginia.json');
  const pdfPath = path.join(root, 'Dayplay Norther Virginia_DC areas .pdf');

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`🔄 Reading ${inputPath} ...`);
  const raw: RawNA = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

  // Build a name → address map from the PDF, if available
  let addressMap: Map<string, string> = new Map();
  if (fs.existsSync(pdfPath)) {
    console.log(`🔎 Parsing addresses from ${pdfPath} ...`);
    try {
      const pdfBuffer = fs.readFileSync(pdfPath);
      const parsed = await pdfParse(pdfBuffer);
      addressMap = buildAddressMapFromText(parsed.text);
      console.log(`   Found ${addressMap.size} name→address mappings in PDF`);
    } catch (e) {
      console.warn('⚠️  Failed to parse PDF for addresses, falling back to generic region:', (e as Error).message);
    }
  } else {
    console.warn(`⚠️  PDF file not found at ${pdfPath}, using generic region addresses`);
  }

  const output: OutputJSON = {
    city: 'Northern Virginia',
    categories: {},
  };

  Object.entries(raw).forEach(([prettyName, names]) => {
    const slug = CATEGORY_MAP[prettyName];
    if (!slug) {
      console.warn(`⚠️  Unknown category key in NA.json, skipping: "${prettyName}"`);
      return;
    }
    if (!Array.isArray(names)) {
      console.warn(`⚠️  Expected an array for category "${prettyName}", skipping`);
      return;
    }

    output.categories[slug] = names
      .filter((n) => typeof n === 'string' && n.trim().length > 0)
      .map<OutputLocation>((name) => {
        const cleanedName = name.trim();
        const key = normalizeName(cleanedName);
        const addrFromHardcoded = HARDCODED_ADDRESSES.get(key);
        const addrFromPdf = addressMap.get(key);
        return {
          name: cleanedName,
          address: addrFromHardcoded || addrFromPdf || 'Northern Virginia, USA',
        };
      });
  });

  // Ensure data directory exists
  const dataDir = path.dirname(outputPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`✅ Wrote structured JSON to ${outputPath}`);
  console.log('   You can now import it with:');
  console.log('   npx tsx scripts/import-from-json.ts data/northern-virginia.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


