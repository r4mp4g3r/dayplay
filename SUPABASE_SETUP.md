# Supabase Setup Guide

## Step 1: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in:
   - **Name**: swipely-prod (or swipely-dev for testing)
   - **Database Password**: Save this securely!
   - **Region**: Choose closest to your users (e.g., US East for USA)
4. Click "Create new project" (takes ~2 minutes)

## Step 2: Get API Keys

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public** key: `eyJxxx...`

3. Create `.env` file in project root:
```bash
cp env.example .env
```

4. Paste your values:
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
EXPO_PUBLIC_SITE_URL=swipely://
```

## Step 3: Run Schema Migration

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy contents of `supabase/schema.sql`
4. Paste and click "Run"
5. Verify tables created: Go to **Table Editor** → Should see:
   - profiles
   - listings
   - listing_photos
   - tags
   - listing_tags
   - swipes
   - saves

## Step 4: Configure Authentication

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider (should be on by default)
3. Go to **Authentication** → **URL Configuration**
4. Set **Site URL**: `swipely://` (or your custom scheme)
5. Add **Redirect URLs**:
   - `swipely://`
   - `http://localhost:8081` (for web testing)
6. Go to **Authentication** → **Email Templates**
7. Customize confirmation email (optional)

## Step 5: Seed Listings Data

### Option A: Manual SQL Insert

1. Go to SQL Editor
2. Run this script to insert seed data:

```sql
-- Insert listings from seed data
INSERT INTO public.listings (id, title, subtitle, description, category, price_tier, latitude, longitude, city, is_published, is_featured, created_at)
VALUES 
  ('seed-001', 'Barton Springs Pool', 'Spring-fed swimming', 'Iconic spring-fed pool in Zilker Park with year-round cool water.', 'outdoors', 2, 30.2646, -97.7713, 'Austin', true, true, '2025-11-02T10:00:00Z'),
  ('seed-006', 'Franklin Barbecue', 'Legendary brisket', 'Austin''s most famous barbecue spot. Expect a line — worth it.', 'food', 3, 30.2701, -97.7312, 'Austin', true, true, now()),
  -- Add more rows...
;

-- Insert photos
INSERT INTO public.listing_photos (listing_id, url, sort_order)
VALUES
  ('seed-001', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=60', 0),
  ('seed-006', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1200&q=60', 0),
  -- Add more...
;
```

### Option B: Programmatic Import (Recommended)

Create a migration script - I'll implement this in the next step.

## Step 6: Deploy Edge Function

### Using Supabase CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy function
supabase functions deploy get_feed
```

### Or Manually:

1. Go to **Edge Functions** in dashboard
2. Click "Deploy new function"
3. Name: `get_feed`
4. Copy contents of `supabase/functions/get_feed/index.ts`
5. Deploy

## Step 7: Test Connection

1. Restart your Expo app:
```bash
npx expo start --clear
```

2. Check browser console for:
   - No Supabase connection errors
   - Feed loads from edge function

## Troubleshooting

### "Invalid API key"
- Double-check you copied the **anon** key, not the service_role key
- Verify `.env` file is in project root
- Restart Expo server after changing `.env`

### "Could not connect to Supabase"
- Check Project URL is correct
- Ensure project status is "Active" in dashboard
- Check network/firewall isn't blocking supabase.co

### "RLS policy violation"
- Verify RLS policies were created (check schema.sql ran fully)
- Check user is authenticated for protected operations
- Use Supabase logs to see which policy failed

## Next Steps

After setup is complete:
1. Test auth signup/signin
2. Verify saved items sync to cloud
3. Check swipes are recorded
4. Test real-time updates

---

**Need help?** Check Supabase docs: https://supabase.com/docs

