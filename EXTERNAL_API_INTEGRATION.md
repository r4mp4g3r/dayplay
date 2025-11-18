# External API Integration Guide

This guide covers the Google Places API and Eventbrite API integration for populating Swipely with real-world locations and events.

## 📋 Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Database Migration](#database-migration)
- [Importing Data](#importing-data)
- [API Cost Estimates](#api-cost-estimates)
- [Scheduling Sync Jobs](#scheduling-sync-jobs)
- [Troubleshooting](#troubleshooting)

## Overview

The integration adds two powerful data sources:

1. **Google Places API** - Populate with restaurants, cafes, parks, museums, and more
2. **Eventbrite API** - Import upcoming events like concerts, festivals, workshops

### New Features

- ✅ Automatic location data from Google Places (with ratings, photos, hours)
- ✅ Event listings from Eventbrite (with dates, times, ticket info)
- ✅ Event-specific UI badges (Happening Now, Soon, etc.)
- ✅ Deduplication to prevent duplicate listings
- ✅ Automatic expiration of past events

## Setup

### 1. Get API Keys

#### Google Places API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable these APIs:
   - Places API
   - Places API (New)
   - Maps JavaScript API
4. Create credentials → API Key
5. (Recommended) Restrict the API key to only the enabled APIs

**Note:** Google Places API is pay-as-you-go. See [pricing](#api-cost-estimates) below.

#### Eventbrite API

1. Go to [Eventbrite Platform](https://www.eventbrite.com/platform/api)
2. Sign in to your Eventbrite account
3. Create an app to get your private API token
4. Copy the token

**Note:** Eventbrite API is FREE for read-only public event data.

### 2. Configure Environment Variables

Copy your `.env.example` to `.env` and add your API keys:

```bash
cp env.example .env
```

Edit `.env`:

```bash
# Google Places API
GOOGLE_PLACES_API_KEY=your-google-places-api-key-here

# Eventbrite API
EVENTBRITE_API_TOKEN=your-eventbrite-token-here
```

## Database Migration

Before importing data, run the database migration to add new fields:

### Option 1: Using Supabase Dashboard

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy the contents of `supabase/migrations/001_add_external_api_support.sql`
4. Paste and run it

### Option 2: Using Supabase CLI

```bash
supabase db push
```

### Migration Changes

The migration adds these columns to the `listings` table:

- `external_id` - External API identifier (Place ID or Event ID)
- `event_start_date` - Event start date/time
- `event_end_date` - Event end date/time
- `source_metadata` - JSONB field for API-specific data
- `last_synced_at` - Timestamp of last data sync
- `hours`, `phone`, `website` - Contact/hours information

## Importing Data

### Google Places Import

Import locations from Google Places API:

```bash
# Basic import for a city
npx tsx scripts/import-google-places.ts \
  --city "Denver" \
  --lat 39.7392 \
  --lng -104.9903

# Custom radius (in meters, max 50000)
npx tsx scripts/import-google-places.ts \
  --city "Denver" \
  --lat 39.7392 \
  --lng -104.9903 \
  --radius 10000

# Limit places per type
npx tsx scripts/import-google-places.ts \
  --city "Denver" \
  --lat 39.7392 \
  --lng -104.9903 \
  --max-places 50
```

#### What Gets Imported

The script imports these place types:
- Restaurants
- Cafes & Coffee Shops
- Bars & Night Clubs
- Parks
- Museums & Art Galleries
- Shopping Malls
- Tourist Attractions
- Movie Theaters
- Amusement Parks

#### Category Mapping

Google place types are automatically mapped to Swipely categories:

| Google Type | Swipely Category |
|-------------|------------------|
| restaurant, cafe, bakery | food |
| coffee_shop | coffee |
| bar, night_club | nightlife |
| park, campground | outdoors |
| museum, art_gallery | museum |
| shopping_mall, store | shopping |
| amusement_park, zoo, aquarium | activities |

### Eventbrite Import

Import events from Eventbrite:

```bash
# Basic import for a city
npx tsx scripts/import-eventbrite.ts \
  --city "Denver" \
  --lat 39.7392 \
  --lng -104.9903

# Custom radius (e.g., "10km", "25mi")
npx tsx scripts/import-eventbrite.ts \
  --city "Denver" \
  --lat 39.7392 \
  --lng -104.9903 \
  --radius "50km"

# Look ahead more days
npx tsx scripts/import-eventbrite.ts \
  --city "Denver" \
  --lat 39.7392 \
  --lng -104.9903 \
  --days-ahead 90

# Filter by category (see category IDs below)
npx tsx scripts/import-eventbrite.ts \
  --city "Denver" \
  --lat 39.7392 \
  --lng -104.9903 \
  --categories "103,110"
```

#### Eventbrite Category IDs

| ID | Category |
|----|----------|
| 103 | Music |
| 101 | Business & Professional |
| 110 | Food & Drink |
| 113 | Community & Culture |
| 105 | Performing & Visual Arts |
| 104 | Film, Media & Entertainment |
| 108 | Sports & Fitness |
| 107 | Health & Wellness |
| 102 | Science & Technology |
| 109 | Travel & Outdoor |

#### Event Features

- ✅ Automatic expiration of past events
- ✅ Event date/time display
- ✅ "Happening Now" and "Soon" badges
- ✅ Price tier based on ticket costs
- ✅ Tags for free/virtual/series events

## API Cost Estimates

### Google Places API (Pay-as-you-go)

| API Call | Cost per 1,000 requests |
|----------|------------------------|
| Nearby Search | $32 |
| Place Details | $17 |
| Place Photos | $7 |

**Example cost for importing 100 places:**
- 100 × Nearby Search: ~$3.20
- 100 × Place Details: ~$1.70
- 500 × Photos (5 per place): ~$3.50
- **Total: ~$8.40**

**Monthly estimate for 1,000 places:** ~$84

### Eventbrite API

- **FREE** for public event data (read-only)

## Scheduling Sync Jobs

To keep data fresh, schedule regular syncs:

### Using Cron (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Add these lines:

# Sync Google Places weekly (Sunday at 2 AM)
0 2 * * 0 cd /path/to/swipely-app && npx tsx scripts/import-google-places.ts --city "Denver" --lat 39.7392 --lng -104.9903

# Sync Eventbrite daily (every day at 3 AM)
0 3 * * * cd /path/to/swipely-app && npx tsx scripts/import-eventbrite.ts --city "Denver" --lat 39.7392 --lng -104.9903
```

### Using GitHub Actions

Create `.github/workflows/sync-data.yml`:

```yaml
name: Sync External Data

on:
  schedule:
    # Run weekly for Google Places (Sundays at 2 AM UTC)
    - cron: '0 2 * * 0'
    # Run daily for Eventbrite (every day at 3 AM UTC)
    - cron: '0 3 * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  sync-places:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - name: Import Google Places
        if: github.event.schedule == '0 2 * * 0'
        env:
          GOOGLE_PLACES_API_KEY: ${{ secrets.GOOGLE_PLACES_API_KEY }}
          EXPO_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
        run: |
          npx tsx scripts/import-google-places.ts \
            --city "Denver" --lat 39.7392 --lng -104.9903

  sync-events:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - name: Import Eventbrite Events
        if: github.event.schedule == '0 3 * * *'
        env:
          EVENTBRITE_API_TOKEN: ${{ secrets.EVENTBRITE_API_TOKEN }}
          EXPO_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
        run: |
          npx tsx scripts/import-eventbrite.ts \
            --city "Denver" --lat 39.7392 --lng -104.9903
```

## Troubleshooting

### "API key not configured" error

Make sure your `.env` file contains the correct API keys:
```bash
GOOGLE_PLACES_API_KEY=your-key-here
EVENTBRITE_API_TOKEN=your-token-here
```

### Google Places API quota exceeded

Google Places has usage limits. To reduce costs:
1. Reduce `--max-places` parameter
2. Increase `--radius` to get more places per search
3. Enable billing alerts in Google Cloud Console

### No events found in Eventbrite

Try:
1. Increasing `--radius` (e.g., "50km" or "100mi")
2. Increasing `--days-ahead` to look further into the future
3. Checking if events exist in your area on Eventbrite.com

### Duplicate listings

The import scripts automatically deduplicate by `external_id`. If you see duplicates:
1. Check if listings have different sources
2. Manually clean up with SQL:
```sql
DELETE FROM listings 
WHERE id IN (
  SELECT id FROM listings 
  WHERE external_id IN (
    SELECT external_id 
    FROM listings 
    GROUP BY external_id 
    HAVING COUNT(*) > 1
  )
  AND created_at < NOW() - INTERVAL '1 day'
);
```

### Missing photos

Some places/events may not have photos in the API. This is normal. The UI handles missing images gracefully.

## Data Source Metadata

Listings imported from external APIs include rich metadata in the `source_metadata` field:

### Google Places Metadata
```json
{
  "rating": 4.5,
  "user_ratings_total": 1250,
  "google_maps_url": "https://maps.google.com/?cid=...",
  "types": ["restaurant", "food", "point_of_interest"],
  "business_status": "OPERATIONAL"
}
```

### Eventbrite Metadata
```json
{
  "eventbrite_url": "https://www.eventbrite.com/e/...",
  "online_event": false,
  "capacity": 500,
  "is_free": false,
  "venue_name": "Red Rocks Amphitheatre",
  "venue_address": "18300 W Alameda Pkwy, Morrison, CO 80465"
}
```

This metadata can be used for advanced filtering, sorting, and display features.

## Next Steps

1. **Set up monitoring** - Track API usage and costs in Google Cloud Console
2. **Implement caching** - Cache Place Details to reduce API calls
3. **Add user feedback** - Let users report outdated information
4. **Enhance discovery** - Use ratings and review counts for better recommendations
5. **Multi-city support** - Import data for multiple cities

---

**Questions?** Check the main [README.md](./README.md) or open an issue.

