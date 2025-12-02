#!/usr/bin/env tsx
/**
 * Convert Markdown location files to structured JSON
 * Usage: tsx scripts/convert-md-to-json.ts <input.md> <output.json> --city "City Name"
 */

import * as fs from 'fs';
import * as path from 'path';

interface LocationEntry {
  name: string;
  address: string;
}

interface LocationJSON {
  city: string;
  categories: Record<string, LocationEntry[]>;
}

const CATEGORY_MAP: Record<string, string> = {
  'museums': 'museum',
  'games and entertainment spots': 'games-entertainment',
  'games & entertainment spots': 'games-entertainment',
  'games & entertainment spots (name + address)': 'games-entertainment',
  'games & entertainment spots (name \\+ address)': 'games-entertainment',
  'relax and recharge': 'relax-recharge',
  'spa & wellness / relax & recharge spots': 'relax-recharge',
  'spa & wellness / relax & recharge spotsoakwell': 'relax-recharge',
  'denver — spa & wellness / relax & recharge spotsoakwell': 'relax-recharge',
  'coffee shops and cafes': 'coffee',
  'coffee shops & cafés': 'coffee',
  'food': 'food',
  'nightlife': 'nightlife',
  'arts and culture': 'arts-culture',
  'arts and galleries': 'arts-culture',
  'sports and recreation': 'sports-recreation',
  'sports and recreations': 'sports-recreation',
  'shopping': 'shopping',
  'shopping locations and address': 'shopping',
  'denver — shopping locations and address': 'shopping',
  'outdoors': 'outdoors',
  'outdoors locations and address': 'outdoors',
  'denver outdoors locations and address': 'outdoors',
  'drinks and bars': 'drinks-bars',
  'fitness and classes': 'fitness-classes',
  'fitness & classes locations and addresses': 'fitness-classes',
  'live music': 'live-music',
  'live music spots': 'live-music',
  'pet friendly': 'pet-friendly',
  'road trip getaways': 'road-trip-getaways',
};

function normalizeCategoryName(rawCategory: string): string | null {
  const normalized = rawCategory.toLowerCase().trim();
  return CATEGORY_MAP[normalized] || null;
}

function stripUrlsAndCitations(text: string): string {
  // Remove markdown links [text](url)
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Remove standalone URLs
  text = text.replace(/https?:\/\/[^\s]+/g, '');
  
  // Remove source citations like "Wikipedia+1", "Visit Denver", etc.
  text = text.replace(/\s*\[[^\]]+\]\s*$/g, '');
  text = text.replace(/\s*\([^)]*(?:wikipedia|visit|stacker|funcheap|source)[^)]*\)\s*$/gi, '');
  
  return text.trim();
}

function parseListItem(line: string): { name: string; address: string } | null {
  // Remove list markers (numbers, bullets, ##)
  let cleaned = line.replace(/^\s*\d+\.\s*/, ''); // Remove "1. "
  cleaned = cleaned.replace(/^\s*[-*]\s*/, ''); // Remove "- " or "* "
  cleaned = cleaned.replace(/^\s*##\s*/, ''); // Remove "## "
  
  // Strip URLs and citations first
  cleaned = stripUrlsAndCitations(cleaned);
  
  if (!cleaned.trim()) return null;
  
  // Try to split by common delimiters: | or — or —
  let parts: string[] = [];
  
  if (cleaned.includes('|')) {
    parts = cleaned.split('|').map(p => p.trim());
  } else if (cleaned.includes('—')) {
    parts = cleaned.split('—').map(p => p.trim());
  } else if (cleaned.includes(' — ')) {
    parts = cleaned.split(' — ').map(p => p.trim());
  } else {
    // No clear delimiter, skip
    return null;
  }
  
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return null;
  }
  
  const name = parts[0].trim();
  const address = parts[1].trim();
  
  // Basic validation
  if (name.length < 2 || address.length < 5) {
    return null;
  }
  
  return { name, address };
}

function parseMarkdown(filePath: string, cityName: string): LocationJSON {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const result: LocationJSON = {
    city: cityName,
    categories: {},
  };
  
  let currentCategory: string | null = null;
  let lineNumber = 0;
  
  for (const line of lines) {
    lineNumber++;
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) continue;
    
    // Check if this is a category header: **Category Name** or ## **Category Name**
    let categoryMatch = trimmed.match(/^\*\*([^*]+)\*\*\s*$/);
    if (!categoryMatch) {
      // Try with ## prefix
      categoryMatch = trimmed.match(/^##\s+\*\*([^*]+)\*\*\s*$/);
    }
    
    if (categoryMatch) {
      const rawCategory = categoryMatch[1].trim();
      const mappedCategory = normalizeCategoryName(rawCategory);
      
      if (mappedCategory) {
        currentCategory = mappedCategory;
        if (!result.categories[currentCategory]) {
          result.categories[currentCategory] = [];
        }
        console.log(`  📂 Found category: ${rawCategory} → ${mappedCategory}`);
      } else {
        // Unknown category or city name header
        if (rawCategory.toLowerCase() !== cityName.toLowerCase() && 
            !rawCategory.toLowerCase().includes('san francisco') &&
            !rawCategory.toLowerCase().includes('denver')) {
          console.log(`  ⚠️  Unmapped category: ${rawCategory}`);
        }
        currentCategory = null;
      }
      continue;
    }
    
    // Skip separator lines (---, ***, etc.)
    if (/^[-*=]{3,}$/.test(trimmed)) continue;
    
    // If we have a current category, try to parse as list item
    if (currentCategory) {
      const item = parseListItem(trimmed);
      if (item) {
        result.categories[currentCategory].push(item);
      }
    }
  }
  
  return result;
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: tsx scripts/convert-md-to-json.ts <input.md> <output.json> --city "City Name"');
    process.exit(1);
  }
  
  const inputPath = args[0];
  const outputPath = args[1];
  
  // Find --city argument
  const cityIndex = args.indexOf('--city');
  let cityName = 'Unknown';
  if (cityIndex !== -1 && args[cityIndex + 1]) {
    cityName = args[cityIndex + 1];
  }
  
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }
  
  console.log(`\n🔍 Parsing ${inputPath}...`);
  console.log(`📍 City: ${cityName}\n`);
  
  const result = parseMarkdown(inputPath, cityName);
  
  // Print summary
  console.log('\n📊 Summary:');
  let totalListings = 0;
  for (const [category, listings] of Object.entries(result.categories)) {
    console.log(`  ${category}: ${listings.length} listings`);
    totalListings += listings.length;
  }
  console.log(`  TOTAL: ${totalListings} listings\n`);
  
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Write JSON file
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`✅ Saved to ${outputPath}\n`);
}

main();

