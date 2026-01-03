import 'dotenv/config';
import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

// --- Configuration ---
const RSS_SOURCES = [
  {
    id: 'funcheap',
    url: 'https://feeds.feedburner.com/funcheapsf_recent_added_events/',
    city: 'San Francisco',
    defaultCategory: 'events',
    type: 'direct_event',
  },
  {
    id: '7x7',
    url: 'https://www.7x7.com/feed', 
    city: 'San Francisco',
    defaultCategory: 'arts-culture',
    type: 'listicle',
    // Broad selector to ensure we catch the content
    containerSelector: 'article, .entry-content, .post-content, main, body'
  },
  {
    id: 'secret_sf',
    url: 'https://secretsanfrancisco.com/feed/', 
    city: 'San Francisco',
    defaultCategory: 'attractions',
    type: 'listicle',
    containerSelector: '.mn-content, .entry-content, article'
  }
];

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);

// --- Helpers ---

function parseDateString(text: string): Date {
  const now = new Date();
  // Regex for "Jan 5", "January 5", "1/5"
  const dateMatch = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})/i) ||
                    text.match(/(\d{1,2})\/(\d{1,2})/);
  
  if (dateMatch) {
    let monthIndex = 0;
    let day = 1;

    if (isNaN(parseInt(dateMatch[1]))) {
        monthIndex = "janfebmaraprmayjunjulaugsepoctnovdec".indexOf(dateMatch[1].toLowerCase()) / 3;
        day = parseInt(dateMatch[2]);
    } else {
        monthIndex = parseInt(dateMatch[1]) - 1;
        day = parseInt(dateMatch[2]);
    }

    const d = new Date(now.getFullYear(), monthIndex, day, 18, 0, 0); 
    // Handle year rollover (e.g. reading a "Jan" event in "Dec")
    if (d < now && now.getMonth() > 10 && d.getMonth() < 2) d.setFullYear(now.getFullYear() + 1);
    return d;
  }
  return new Date(); 
}

// --- PARSING STRATEGIES ---

// Strategy 1: The "Double Slash" (//) Splitter (Specific for 7x7)
// Format: "Event Name; Date // Location"
function parseByDoubleSlash($, container) {
    const events: any[] = [];
    container.find('p, li').each((_, el) => {
        const fullText = $(el).text().trim();
        
        // The magic fingerprint: looks for " // " inside the text
        if (fullText.includes('//') && fullText.length > 20) {
            
            // Step 1: Split Location from Content
            const parts = fullText.split('//');
            const contentPart = parts[0].trim(); // "Title; Date"
            const locationPart = parts[1] ? parts[1].trim() : ''; // "Location; Link"
            
            // Step 2: Split Title from Date (using the LAST semicolon)
            // 7x7 usually does: "Description of event; Monday at 7pm"
            const lastSemiIndex = contentPart.lastIndexOf(';');
            
            let title = contentPart;
            let dateText = '';
            
            if (lastSemiIndex > 10) { 
                title = contentPart.substring(0, lastSemiIndex).trim();
                dateText = contentPart.substring(lastSemiIndex + 1).trim();
            }

            // Cleanup Title (remove leading dashes or bullets)
            title = title.replace(/^[-•]\s*/, '');

            // Cleanup Location (remove parens like "(Mission)")
            const cleanLocation = locationPart.split('(')[0].trim().replace(/[;,]$/, '');

            const externalLink = $(el).find('a').attr('href');

            if (title.length > 5) {
                events.push({ 
                    title, 
                    description: fullText, // Save full text as description context
                    externalLink, 
                    dateText,
                    location: cleanLocation,
                    type: 'double_slash'
                });
            }
        }
    });
    return events;
}

// Strategy 2: Headers (H2/H3/H4) - (Specific for Secret SF)
function parseByHeaders($, container) {
    const events: any[] = [];
    container.find('h2, h3, h4').each((_, el) => {
      const title = $(el).text().trim();
      if (!title || title.length < 5 || title.includes('Related') || title.includes('Read more')) return;

      let description = '';
      let externalLink = $(el).find('a').attr('href');
      
      let nextEl = $(el).next();
      for (let i = 0; i < 3; i++) {
        const text = nextEl.text().trim();
        if (text) description += text + '\n';
        if (!externalLink) externalLink = nextEl.find('a').attr('href');
        nextEl = nextEl.next();
      }

      if (description.length > 5) {
        events.push({ title, description, externalLink, type: 'header' });
      }
    });
    return events;
}

// Strategy 3: Bold Starts (Fallback)
function parseByBoldStarts($, container) {
    const events: any[] = [];
    container.find('p, li').each((_, el) => {
        const boldTag = $(el).find('strong, b').first();
        if (boldTag.length) {
            const title = boldTag.text().trim();
            const fullText = $(el).text().trim();
            const description = fullText.replace(title, '').trim();
            const externalLink = $(el).find('a').attr('href');

            if (title.length > 5 && title.length < 100 && description.length > 10) {
                 events.push({ title, description, externalLink, type: 'bold' });
            }
        }
    });
    return events;
}

async function extractListicleItems(url: string, sourceConfig: any) {
  console.log(`      ... ⛏️  Exploding Listicle: ${url}`);
  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);
    
    // Find Content Container
    const container = $(sourceConfig.containerSelector).first();
    if (!container.length) {
        console.log(`      ⚠️ Warning: Could not find container (${sourceConfig.containerSelector})`);
        return [];
    }

    // --- WATERFALL STRATEGY ---
    
    // 1. Try "Double Slash" (Best for 7x7)
    let rawEvents = parseByDoubleSlash($, container);
    
    // 2. If that fails, try Headers (Best for Secret SF)
    if (rawEvents.length === 0) {
        rawEvents = parseByHeaders($, container);
    }
    
    // 3. If that fails, try Bold Starts (Fallback)
    if (rawEvents.length === 0) {
        rawEvents = parseByBoldStarts($, container);
    }

    // Deduplicate and Normalize
    return rawEvents.map(ev => ({
        id: `${sourceConfig.id}_sub_${Buffer.from(ev.title).toString('base64').substring(0, 15)}`,
        title: ev.title.replace(/[:|-]$/, '').trim(), 
        external_id: ev.externalLink || url,
        description: ev.description.substring(0, 300).trim(),
        category: sourceConfig.defaultCategory,
        source: sourceConfig.id,
        city: 'San Francisco',
        // Use extracted location or default
        source_metadata: { location: ev.location || 'San Francisco', parent_article: url },
        latitude: 37.7749, 
        longitude: -122.4194,
        event_start_date: parseDateString(ev.dateText || ev.description).toISOString(),
        event_end_date: new Date(Date.now() + 7200000).toISOString(),
        is_published: true,
        last_synced_at: new Date().toISOString()
    }));

  } catch (e) {
    console.warn('      ⚠️ Error parsing listicle:', e);
    return [];
  }
}

async function main() {
  console.log('🚀 Starting Smart RSS Import (v5 - Double Slash Strategy)...');

  for (const source of RSS_SOURCES) {
    try {
      console.log(`\n📥 Fetching feed: ${source.id}...`);
      const res = await fetch(source.url);
      const xml = await res.text();
      const parser = new XMLParser({ ignoreAttributes: false, textNodeName: 'text' });
      const parsed = parser.parse(xml);
      const items = parsed?.rss?.channel?.item || [];

      for (const item of items) {
        const title = item.title;
        // Check triggers
        const isListicleTitle = /^\d+\s/.test(title) || title.includes("Things To Do") || title.includes("Guide");

        if (source.type === 'listicle' && isListicleTitle) {
          const subEvents = await extractListicleItems(item.link, source);
          console.log(`      Found ${subEvents.length} VALID sub-events in "${title}"`);
          
          for (const ev of subEvents) {
             const { error } = await supabase.from('listings').upsert(ev, { onConflict: 'id' });
          }
          if (subEvents.length > 0) console.log(`      ✅ Saved ${subEvents.length} events.`);
          
        } else if (source.type === 'direct_event') {
           // Funcheap Standard Logic
           const listing = {
            id: `${source.id}_${Buffer.from(item.link).toString('base64').substring(0, 20)}`,
            title: title,
            external_id: item.link,
            description: item.description?.replace(/<[^>]*>/g, '').substring(0, 200),
            category: source.defaultCategory,
            source: source.id,
            city: source.city,
            latitude: 37.7749,
            longitude: -122.4194,
            is_published: true,
            last_synced_at: new Date().toISOString(),
            event_start_date: new Date().toISOString(),
          };
          await supabase.from('listings').upsert(listing, { onConflict: 'id' });
        }
      }
    } catch (err) {
      console.error(`Error processing ${source.id}`, err);
    }
  }
}

main();