# Spindare 🌀 `v1.1.0`

**The Anti-Scroll Social Experiment.** Spindare is a reaction-algorithm-based platform designed to turn digital intent into physical action. Built by a tight-knit team of three, we are redefining social connection through the "Active Reveal" system.

> **Status:** Native APK Build — Internal Testing.
> **Platform:** React Native + Expo SDK 55 — standalone Android APK via EAS Build.

---

## 🧠 The Philosophy

Spindare isn't a gallery; it's a gauntlet. We believe social media should make you *feel* the world around you, not just the glass in your hand.

### 🎡 The Cycle

1. **The Spin:** AI-driven challenges personalised to your "DNA" (Character & Interests).
2. **The Action:** Complete the challenge. Take the photo. Write the reflection.
3. **The Reaction:** Engage with others through three distinct emotional pillars: **Felt**, **Thought**, and **Intrigued**.
4. **The Messaging:** Communicate freely with any active user, with the ability to **GHOST** on command.

---

## 🛠 Project Progress

### v1.1.0 — Current (Native Build)

* ✅ **Native APK** — First standalone Android build via EAS Build. No longer requires Expo Go.
* ✅ **Video Support** — Post and view video in the feed and challenge submissions. Camera and gallery now support video alongside photos.
* ✅ **Persistent Reactions** — Reactions saved to the database. Users cannot re-react after refreshing the app.
* ✅ **Reaction Summary on Feed** — Compact emoji + count display on every post card. No need to navigate to profile to see reaction totals.
* ✅ **Real Timestamps** — "Just now" replaced with live relative timestamps (2m ago, 3h ago, 1d ago) from actual `created_at` values.
* ✅ **Keyboard Fix** — Full keyboard support restored across Messages, challenge writing, and all input screens on Android.
* ✅ **Android Card Border Fix** — Resolved "square inside card" rendering bug caused by conflicting `overflow: hidden` + `borderRadius` + `borderWidth`.
* ✅ **AI Moved Server-Side** — Gemini API key and all prompt engineering now run inside a Supabase Edge Function. Zero AI secrets in the APK.
* ✅ **Hermes Bytecode** — JS bundle compiled to Hermes bytecode. Not shipped as readable source code.
* ✅ **ProGuard / R8** — Android release builds minify and shrink the native Java/Kotlin layer.
* ✅ **Sound System** — `SoundService` wired into ProfileScreen: spin land, save challenge, and username update all trigger haptic + audio feedback.
* ✅ **Friends List → Database** — Friends/connections list linked to live database. Challenge sends based on real connections.
* ✅ **Animations** — Spring press on AppButton, ripple + glow + pop on ReactionButtons, staggered card entrance in feed, animated post counter on profile, pulsing saved badge.
* ✅ **Double-Post Prevention** — All async write buttons guarded with `isSubmitting` state.
* ✅ **In-App Log Viewer** — Hidden debug overlay triggered by tapping version text 5 times. Colour-coded, filterable, exportable.
* ✅ **Friendly Error Messages** — All user-facing catch blocks use `getFriendlyError(err)` for human-readable errors.
* ✅ **Fallback Challenge Pool** — 200 categorised offline challenges used when Gemini is unavailable.

### v0.61.64 — Previous

* ✅ Challenge Persistence: "Save for Later" functionality.
* ✅ Multi-Medium Posts: Camera, Gallery, and Text responses.
* ✅ The Reaction Trinity: Initial implementation of Felt, Thought, Intrigued.
* ✅ UI Overhaul: Minimalist dark mode interface.

### Roadmap (Next Phase)

* **Realtime Feed** — Supabase Realtime subscriptions not yet firing. Posts require manual refresh. Investigate RLS + replication settings.
* **Stream Chat Production Token** — Currently using `devToken()`. Must be replaced with a JWT-generating backend before public launch.
* **AI Completion Analysis** — `analyzeCompletion` is a stub. Needs real Gemini integration once media upload is confirmed working.
* **iOS Build** — EAS Build for iOS pending Apple Developer account setup.

---

## 🔒 Security

* **No API keys in the bundle** — Gemini key lives exclusively as a Supabase server-side secret.
* **Hermes bytecode** — JS is not shipped as readable source code.
* **ProGuard / R8** — Native Android layer is minified in all release builds.
* **Stream Chat** — Needs production JWT before public launch (currently dev token).

---

## 👥 The Team

* **[Biba]** — "The Brains" – Algorithm & Logic Architecture.
* **[Daniel]** — IT Master's Lead – Systems & Infrastructure.
* **[Kristian]** — CO-Developer – UI/UX & Frontend Integration.

---

## ⚙️ Environment

```
SDK:         Expo SDK 55
JS Engine:   Hermes (bytecode)
Version:     1.1.0
Build:       EAS Build — preview (APK)
Database:    Supabase (PostgreSQL)
Auth:        Clerk
AI:          Gemini 1.5 Flash (server-side Edge Function)
Messaging:   Stream Chat
```

## 🚀 Running Locally

```bash
npx expo start --tunnel        # physical device via Expo Go (dev only)
npx expo start --clear         # clear Metro cache
npx expo start -c --tunnel     # both
```

## 📦 Building

```bash
npx expo prebuild --platform android --clean    # sync app.json → native
eas build --platform android --profile preview  # APK for internal testing
eas build --platform android --profile production  # AAB for Play Store
```
