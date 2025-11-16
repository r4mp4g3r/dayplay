# Swipely - Tinder-style Discovery App

## 🎯 What's Been Implemented

### ✅ Core Features
- **Tinder-style Swipe Interface**: Swipe right to save, left to pass
- **Visual Feedback**: "LIKE" (green) and "NOPE" (red) overlays during swipe
- **Undo Feature**: Yellow undo button appears after passing an item
- **Haptic Feedback**: Physical feedback on swipes (iOS/Android)
- **Smart Feed**: Excludes passed items, prefetches next page
- **50 Seed Listings**: Real Austin locations (restaurants, outdoor activities, events, etc.)

### 📱 Screens
1. **Discover Tab**: Main swipe deck with filters
2. **Saved Tab**: View and manage saved items
3. **Explore Tab**: List view of all items with quick category filters
4. **Profile Tab**: View current filters, reset options, guest sign-in stub

### 🎨 UI Polish
- Smooth card animations (rotation, translation)
- Icon-based action buttons (❌ Pass, ↩️ Undo, ❤️ Like)
- Better empty states
- Analytics tracking (view, swipe_like, swipe_pass)

## 🚀 Running the App

### Quick Start
```bash
cd /Users/ram/Mercury\ 2.0/dev/swipely-app

# Start development server
npx expo start --clear

# Then press:
# - w for web
# - i for iOS simulator
# - a for Android emulator
```

### Troubleshooting Empty Feed

If you see "No more items":

1. **Go to Profile tab** → Check "Current Filters"
2. **Click "Reset Filters"** → This sets categories to: food, outdoors, events
3. **Go back to Discover tab** → Should now show 50 listings

The issue was that if onboarding picked categories that don't match seed data exactly, the feed filtered them all out.

## 🧪 Testing the Swipe

### Gesture Controls
- **Swipe Right** → Saves item (shows green "LIKE" overlay)
- **Swipe Left** → Passes item (shows red "NOPE" overlay)
- **Tap Card** → Opens detail view
- **Tap ❌ Button** → Pass manually
- **Tap ❤️ Button** → Save manually
- **Tap ↩️ Button** → Undo last pass (only available after passing)

### What Gets Saved
- Right-swiped items appear in the **Saved tab**
- Long-press saved items to remove them
- Tap "Share" FAB to share your saved list

### What Gets Passed
- Left-swiped items are excluded from future feed loads
- They won't show up again (tracked in memory for this session)
- Use **Undo** button to recover accidentally passed items

## 📊 Seed Data

The app includes 50 real Austin locations across categories:
- 🍔 Food (restaurants, cafes, bars)
- 🏞️ Outdoors (parks, trails, swimming)
- 🎭 Events (theaters, concerts, markets)
- ☕ Coffee shops
- 🏛️ Museums
- 🎯 Activities (mini golf, kayaking, climbing)
- 🛍️ Shopping
- 🍺 Nightlife

All locations have:
- Real coordinates (Austin, TX area)
- High-quality Unsplash images
- Descriptions, tags, price tiers
- Categories matching the filter system

## 🔧 Filter System

Access filters via the **top-right button** on Discover tab:
- **Distance**: 1-50 km radius slider
- **Categories**: Multi-select chips (food, outdoors, nightlife, etc.)
- **Price**: $-$$$$ tier chips

Filters persist across app restarts via AsyncStorage.

## 📱 Platform Support

- ✅ **Web**: Fully functional (maps removed to avoid native module errors)
- ✅ **iOS**: Full functionality with maps
- ✅ **Android**: Full functionality with maps

## 🗺️ Maps Note

To keep web working without native module errors:
- Explore tab shows **list-only view** on all platforms
- Detail view shows **placeholder map** on web, real map on native
- If you need full maps on iOS/Android, we can add platform-specific versions

## 🎨 Design Decisions

### Why List-Only Explore?
The native `react-native-maps` library can't be bundled for web. Rather than complex platform splits, Explore shows a clean list with category filters that works everywhere.

### Why Undo Instead of Swipe History?
Tinder-style: one undo is enough for accidental swipes. Keeps UX simple and focused on forward momentum.

### Why Guest Mode Default?
Reduces friction. Users can swipe immediately. Email login is optional for syncing across devices (stub for now).

## 🔮 Next Steps

When ready to connect backend:
1. Set up Supabase project
2. Run `supabase/schema.sql` to create tables
3. Deploy `supabase/functions/get_feed/index.ts`
4. Populate listings table with seed data
5. Replace `lib/mockApi.ts` calls with Supabase queries
6. Add real auth (email magic link via Supabase)

The `lib/supabase.ts` client is already configured - just need to add env vars:
```bash
# Copy env.example to .env
EXPO_PUBLIC_SUPABASE_URL=your_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 📈 Analytics

PostHog events tracked:
- `view_card`: When card appears
- `swipe_like`: Right swipe / heart button
- `swipe_pass`: Left swipe / X button  
- `open_details`: Tap card to view details

To enable, add to `.env`:
```bash
EXPO_PUBLIC_POSTHOG_KEY=your_key
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

## 🐛 Known Issues

None currently! All features working as designed.

## 💡 Feature Ideas (Not Implemented)

- [ ] Map view in Explore (native only)
- [ ] "New this week" special category
- [ ] Social sharing of lists
- [ ] Group planning mode
- [ ] Push notifications for new events
- [ ] User-submitted listings
- [ ] Featured/promoted listings boost
- [ ] Multiple saved lists (Date Ideas, Weekend Plans, etc.)

