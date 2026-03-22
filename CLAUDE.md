# Spindare — Claude Code Context

This file gives Claude Code full context on the project, everything that's been built and fixed, architectural decisions, and what to work on next.

---

## What This App Is

**Spindare** is an "anti-scroll" social experiment mobile app. The core loop:
1. User spins a wheel → Gemini AI generates a personalised physical-world challenge
2. User completes it (camera, gallery, or text) → posts to a community feed
3. Others react (felt / thought / intrigued), send challenges to friends, comment

Think: a social app where the content is your real life, not infinite scrolling.

**Status:** Functional MVP. 3-person team, ~3 months of development. Running on real devices via Expo Go with USB/tunnel debugging.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | React Native + Expo SDK 55 |
| Auth | Clerk (`@clerk/clerk-expo`) — non-UUID string IDs like `user_3BB4L...` |
| Database | Supabase (PostgreSQL + Realtime) |
| AI | Google Gemini 1.5 Flash (`@google/generative-ai`) |
| Messaging | Stream Chat (`stream-chat-expo`) |
| Animations | React Native `Animated` API only (reanimated NOT installed) |
| Haptics | `expo-haptics` |

**Critical: Clerk vs Supabase Auth**
The app uses **Clerk** for authentication. Supabase is used as a database only — NOT for auth. All `userId` columns in Supabase are `TEXT` (not UUID), storing Clerk IDs. There are no `REFERENCES auth.users` FK constraints anywhere. Do not add them.

---

## Supabase Project

- **Project ID:** `jhdspfumkpbptzlakofl`
- **Project Name:** Project Spindare
- You have direct MCP access to this project to run SQL, apply migrations, list tables, etc.

### Schema Overview

All user ID columns are `TEXT NOT NULL` (Clerk IDs). All camelCase column names use double-quoted identifiers in SQL (e.g. `"spinCount"`, `"userId"`, `"photoURL"`).

**Tables:** `profiles`, `posts`, `reactions`, `comments`, `notifications`, `connection_requests`, `connections`, `kept_challenges`, `spind_challenges`, `spin_stats`

**Key columns in `posts`:** `id`, `"userId"`, `author`, `avatar`, `challenge`, `content`, `media`, `"spinCount"`, `reactions` (JSONB), `created_at`

**Key columns in `profiles`:** `id` (TEXT, Clerk ID), `username`, `email`, `"photoURL"`, `hobbies` (JSONB), `"studyFields"` (JSONB), `xp`, `level`, `"spinsLeft"`, `"lastSpinTimestamp"`

**PostgREST note:** PostgREST is case-sensitive. Always use the exact column name casing when filtering. `eq('userId', value)` NOT `eq('user_id', value)`.

---

## File Structure

```
src/
  components/
    atoms/
      AppButton.tsx          — Universal button with spring press animation
      ReactionButton.tsx     — Reaction button with ripple + glow + pop animation
    molecules/
      SpinWheel.tsx          — Gesture-driven spin wheel (PanGestureHandler)
      ReactionItem.tsx
      MediaViewer.tsx
    organisms/
      GenericOverlay.tsx     — Notifications + saved challenges overlay
  screens/
    MainFeedScreen.tsx       — Root screen: nav, feed, post creation, profile routing
    FeedScreen.tsx           — Post cards FlatList with staggered entrance animations
    ChallengeScreen.tsx      — Spin wheel + challenge card + proof submission
    ProfileScreen.tsx        — User profile, settings, stats, post grid
    PostCreationScreen.tsx   — Post composer (text + media)
    OnboardingScreen.tsx     — Clerk-based sign up / sign in
    ChatScreen.tsx           — Stream Chat conversation view
    MessagesScreen.tsx       — Stream Chat channel list
    FriendsListScreen.tsx    — Send challenge to a friend
    LogViewerScreen.tsx      — Hidden in-app log viewer (5-tap easter egg on version text)
    MediaSelectionScreen.tsx
    UserProfileView.tsx
    MultiplayerScreen.tsx
  services/
    supabaseConfig.ts        — Supabase client
    AuthService.ts           — Profile CRUD, username updates
    PostService.ts           — Feed, posts, reactions, comments, mock data seeding
    AIService.ts             — Gemini challenge generation + fallback pool
    ChatService.ts           — Stream Chat setup
    NotificationService.ts
    SearchService.ts
    SocialService.ts
    LogService.ts            — Singleton that intercepts console.* and stores logs in memory
  utils/
    errorMessages.ts         — getFriendlyError(err) — maps Clerk/Supabase errors to user-friendly strings
  contexts/
    ThemeContext.tsx          — Dark mode toggle
```

---

## Everything Fixed/Built in the Cowork Session

### Schema Fixes (applied directly to live Supabase via MCP)
- **UUID → TEXT migration:** All `userId` columns were `UUID REFERENCES auth.users`. Dropped all 10 tables and recreated with `TEXT NOT NULL` so Clerk string IDs work.
- **Missing columns added:** `profiles` now has `email TEXT`, `hobbies JSONB DEFAULT '[]'`, `"studyFields" JSONB DEFAULT '[]'`
- **camelCase columns:** All column names that were camelCase are now double-quoted in SQL to preserve case (e.g. `"spinCount"`, `"photoURL"`). PostgREST returns them with the correct casing.

### PostService.ts
- Added `mapPost` helper: `const mapPost = (row: any): Post => ({ ...row, timestamp: row.created_at })` — maps DB `created_at` to TS interface `timestamp`
- Applied `data.map(mapPost)` in `subscribeToFeed` and `subscribeToUserPosts`
- `seedFakeData()` is guarded with `if (!__DEV__) return` — safe in production
- Expanded mock posts to 8 varied entries with Unsplash image URLs and pravatar avatars

### AIService.ts
- Added `FALLBACK_CHALLENGES` array of 20 diverse challenges — used when Gemini API fails or is rate-limited instead of always returning the same hardcoded string
- `generateChallenge` picks randomly from fallback pool on error

### AuthService.ts
- Fixed bug: `throw new Error('User profile found')` → `throw new Error('User profile not found')`

### OnboardingScreen.tsx
- Fixed resend verification: was calling `supabase.auth.resend(...)` (wrong provider). Now calls `signUp.prepareEmailAddressVerification({ strategy: 'email_code' })`
- All 4 catch blocks now use `getFriendlyError(err)` for user-friendly errors

### App.tsx
- First import is `import "./src/services/LogService"` so console interception starts before any component renders

### LogService.ts (NEW)
- Singleton that patches `console.log/info/warn/error` on instantiation
- Stores up to 500 `LogEntry` objects in memory
- `subscribe(listener)` for real-time updates, `getLogs()`, `clear()`

### LogViewerScreen.tsx (NEW)
- Full-screen dark UI overlay with colour-coded log entries
- Search bar, level filter tabs with counts, share/copy/export, clear with confirmation
- Triggered by tapping version text in MainFeedScreen footer 5 times within 2 seconds

### errorMessages.ts (NEW)
- `getFriendlyError(error: unknown): string`
- Maps Clerk error codes (e.g. `form_password_incorrect`) and Supabase error strings to human-readable messages

### Double-posting Bug Fixes
- **ProfileScreen.tsx:** Added `isSubmittingChallenge` state. `submitChallenge()` guards with `if (!spinResult || isSubmittingChallenge) return` and sets/clears flag in try/finally. Submit button shows "Posting..." and goes `disabled` during submission.
- **MainFeedScreen.tsx:** Added `isSubmittingPost` state. `handlePostSubmit` returns early if already in flight. `PostCreationScreen` receives `isSubmitting={isSubmittingPost}`.

### Android Text Clipping Fix
React Native on Android clips the last character of `Text` with `letterSpacing` or `fontWeight: '600'+'700'` because the glyph renders slightly wider than its measured bounds. Fix: `paddingRight: Platform.OS === 'android' ? 6 : 0` on every affected Text style.

Fixed in: `FeedScreen`, `ChallengeScreen`, `MessagesScreen`, `FriendsListScreen`, `PostCreationScreen`, `MainFeedScreen`, `ChatScreen`, `GenericOverlay`.

### Animations Added

**All use React Native `Animated` API only. `react-native-reanimated` is NOT installed.**

#### AppButton.tsx
- Press-in: scale → 0.92 + opacity → 0.85 (fast: friction 10, tension 200)
- Press-out: bouncy spring back to 1.0 with overshoot (friction 4, tension 60)

#### ReactionButton.tsx
- On press: scale jumps to 0.6 then springs to 1.3 → settles at 1.0 (friction 3, tension 180)
- Ripple: expanding circle (scale 0.5→2.5, opacity 0.6→0) over 500ms
- Glow background: animates in/out with `glowAnim` interpolated rgba on selection
- Heavy haptic on select, light on deselect

#### FeedScreen.tsx / PostItem
- Staggered card entrance: each card slides up 40px + fades in on mount, with `delay = index * 80ms`
- Challenge button: scale compress 0.94 on press-in, spring back on press-out
- Reaction overlay: scale + opacity when a reaction is selected

#### ChallengeScreen.tsx
- Challenge card: pops in with `cardScale` 0.92→1.0 (spring) alongside existing fade+slide
- Action buttons (SEND, DO IT): staggered slide-up + fade 300ms after card appears
- Proof icons (camera/gallery/text): staggered bounce entrance when proofMode activates
- All reset on challenge clear

#### MainFeedScreen.tsx
- Saved badge: continuous pulse loop (1.0→1.18→1.0) after initial spring-in using `Animated.multiply(badgeScale, badgePulse)`
- Feed content: fades in on mount with `feedFadeAnim`

#### ProfileScreen.tsx
- Post count: animated counter from 0 to actual value using `postCountAnim` + `addListener`
- Post grid items: staggered entrance with 60ms stagger per item

---

## ChallengeScreen CHALLENGES Array (15 items)

```ts
const CHALLENGES = [
    "Photograph something that reminds you of silence.",
    "Write one thing you've never told anyone.",
    "Ask a stranger what their favourite memory is.",
    "Walk 10 minutes without looking at any screen.",
    "Draw how you feel using only circles.",
    "Trace the outline of a shadow with your finger.",
    "Find something broken and make it beautiful.",
    "Stare at the sky for exactly 60 seconds.",
    "Write a letter you'll never send.",
    "Eat your next meal with zero distractions.",
    "Spend 2 hours in complete silence.",
    "Touch 5 different textures in the next 5 minutes.",
    "Go the whole day without checking how you look.",
    "Photograph something that no one else would notice.",
    "Close your eyes for 3 minutes and just listen.",
];
```

---

## Known Issues / Remaining Work

### Realtime not working
Supabase Realtime subscriptions aren't firing. The user has to manually refresh the app to see new posts. The `subscribeToFeed` function sets up a channel correctly but `postgres_changes` events may not be reaching the client. Possible causes:
- RLS (Row Level Security) blocking realtime events
- Supabase Realtime not enabled on the table
- Channel not connecting due to missing auth context
**To investigate:** Check Supabase dashboard → Database → Replication — make sure `posts` table has replication enabled. Also check RLS policies.

### Stream Chat dev token
`ChatService.ts` uses `devToken()` which is NOT safe for production. Must be replaced with a proper JWT-generating backend before shipping.

### AIService.analyzeCompletion is a stub
Returns a random hardcoded string. Needs real Gemini integration once media upload works.

### Missing TypeScript errors (pre-existing, not caused by our work)
These exist in the original codebase and are not related to our changes:
- `GenericOverlay.tsx` — wrong argument counts on several calls
- `OnboardingScreen.tsx` — `signUp` possibly undefined
- `src/scripts/verify_ai.ts` — missing `dotenv` types

---

## Environment Variables

```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_GEMINI_API_KEY=
```

App.tsx reads: `process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`

---

## Running the App

```bash
npx expo start --tunnel        # for physical device testing
npx expo start --clear         # clear Metro cache
npx expo start -c --tunnel     # both
```

The VM/Cowork sandbox cannot run the tunnel (no ngrok access). Run from your local terminal.

---

## Coding Rules / Conventions

1. **Never add `import { auth } from '../services/firebaseConfig'`** — Firebase is not used. The app uses Clerk + Supabase.
2. **Never add `REFERENCES auth.users`** to Supabase migrations — Clerk manages auth, not Supabase Auth.
3. **All animations use `useNativeDriver: true`** for opacity and transforms. Only layout properties (width, height, padding, margin) must use `useNativeDriver: false`.
4. **`react-native-reanimated` and `moti` are NOT installed.** Use only `Animated` from `react-native`.
5. **Android `paddingRight` fix:** Any `Text` with `letterSpacing` or `fontWeight: '600'/'700'` inside a button needs `paddingRight: Platform.OS === 'android' ? 6 : 0` to prevent last-character clipping.
6. **PostgREST column names are case-sensitive.** Use `"spinCount"` not `spincount`. All camelCase columns must be double-quoted in raw SQL.
7. **`getFriendlyError(err)`** from `src/utils/errorMessages.ts` should be used in all catch blocks that display errors to users.
8. **`__DEV__` guard** all mock/seed data functions so they never run in production builds.
9. **Double-post prevention:** Any button that triggers an async Supabase write must have an `isSubmitting` state that disables the button during the request.
10. **Clerk user IDs** are strings like `user_3BB4L8lv1zpSWxD120VmeDlDxET`. Never cast them to UUID.
