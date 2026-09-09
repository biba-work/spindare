# Prompt for Android Studio's Gemini (or any AI working on this module)

Paste everything between the lines into the Gemini chat in Android Studio, with
the `spindare-android` project open.

---

You are working on **Spindare Android**, a native Kotlin + Jetpack Compose client
in `spindare-android/` of a monorepo. Read this fully before writing code.

**What the app is:** an "anti-scroll" social app. You spin a wheel, get a
real-world challenge, complete it with a photo/video/text, and post it. Others
react (felt / thought / intrigued), send challenges to friends, and comment.

**Critical context: this is the SECOND client, not a new app.**
- A complete native **iOS/SwiftUI** app already exists at `spindare-ios/`
  (17,000 lines) and is the reference implementation.
- A **NestJS + Prisma + Postgres** backend is already deployed and live at
  `https://spindare-production.up.railway.app`, serving ~48 endpoints.
- Auth is **Clerk**, storage is **Cloudflare R2**. Both are live in production.
- **Do not design new APIs or data models.** The server defines them. When in
  doubt, read `spindare-ios/SpindareKit/Sources/SpindareKit/Models/Models.swift`
  and `server/src/**/*.controller.ts`.

**App identity — do not change either of these:**
- `applicationId = "al.SPIND.Spindare"` — matches the iOS bundle identifier exactly.
- `namespace = "al.spind.spindare"` — lowercase Kotlin package, per Android convention.
They differ on purpose. Do not "fix" one to match the other.

**Architecture — mirror the iOS structure, do not invent a new one:**
```
al.spind.spindare/
  model/Models.kt          <- mirrors Models.swift (kotlinx.serialization)
  net/ApiClient.kt         <- Retrofit + OkHttp + Clerk auth interceptor
  net/SpindareApi.kt       <- Retrofit endpoint declarations
  services/Services.kt     <- capability interfaces, each with a Live + Mock impl
  services/AppEnvironment.kt <- composition switchboard, written once at launch
  ui/theme/                <- palette ported from iOS DesignTokens.swift
  ui/                      <- Compose screens
```
Every capability is an **interface with both a Live (API) and Mock (in-memory)
implementation**, selected in `AppEnvironment`. This is what lets screens be
built and previewed without a network or a signed-in user. Keep this pattern.

## Do NOT change these — they are pinned for reasons that already broke the build

- **Kotlin must stay 2.4.x.** `clerk-android-api:1.0.36` ships `kotlin-stdlib
  2.4.0`; an older compiler cannot read its metadata.
- **`androidx.lifecycle` stays at 2.10.0.** 2.11.0 demands AGP 9.1+ and
  compileSdk 37. This project is AGP 8.13.2 / compileSdk 36.
- **compileSdk stays 36.** It is `clerk-android-api`'s own `minCompileSdk`, so it
  cannot go lower, and platform 37 is not installed locally.
- **minSdk stays 24.** That is the device-reach setting (Android 7.0+). Do not
  raise it. It is unrelated to compileSdk.
- **Do not add `clerk-android-ui`.** D8 emits a Kotlin-metadata warning for every
  sealed-class state in it — ~400,000 log lines and minutes of dex time. The app
  builds its own onboarding.
- **Configuration cache stays off.** AGP 8.13.2's `ProcessNavigationXmlTask`
  fails to serialise, which is a hard build failure.
- Retrofit 3.0.0 / OkHttp 5.4.0 / kotlinx-serialization 1.11.0 are deliberately
  the same versions Clerk depends on. Keep them aligned.

## Landmines that already cost real debugging time

1. **Chat `MessagePayload` wire format.** The server emits Swift's *synthesised*
   enum encoding — externally tagged with a single key:
   `{"text":{}}`, `{"image":{"url":…}}`, `{"voice":{"url":…,"duration":…,"samples":[…]}}`.
   kotlinx's default sealed-class encoding is different. `MessagePayloadSerializer`
   in `Models.kt` is hand-written to match. **Getting this wrong fails silently** —
   media messages render as blank text lines. It is pinned by unit tests; do not
   "simplify" it.
2. **The Clerk token must be fetched per-request**, never cached at construction.
   A cached token goes stale after an hour and every call 401s until restart.
   See `ClerkAuthInterceptor`.
3. **Never give `username` a placeholder fallback value.** On iOS a literal
   `"you"` default was persisted as real users' handles. Null means "unknown" and
   renders as a placeholder; it must never be saved.
4. **`user.hasUploadedImage` does not exist** in clerk-android 1.0.36, despite
   `hasImage`'s deprecation message claiming it does. Use `hasImage`.
5. **The API returns whole Prisma rows**, including `pushToken`. `ignoreUnknownKeys`
   is mandatory and `pushToken` is deliberately not modelled (it is a data leak we
   do not want on a second client).
6. **Media uploads go direct to R2**: `POST /storage/presign`, then PUT the raw
   bytes to the returned URL. Never base64 into JSON — that path 413'd on the
   server body limit and was the root cause of "nothing saves" on iOS.
7. **Android Studio's Gradle sync competes with CLI `./gradlew`** for cache locks.
   Do not run both at once.

## Current state

**Phase 0 is complete and verified**: the project builds, installs, launches on an
emulator, Clerk initialises and reaches its API, and the sign-in screen renders.
13 JSON contract tests pass (`./gradlew :app:testDebugUnitTest`).

Implemented so far: full model layer, `ApiClient` + auth interceptor, a partial
`SpindareApi`, `FeedServing` (Live + Mock), `AppEnvironment`, theme, a minimal
email/password `SignInScreen`, and `FeedScreen` with distinct
loading/empty/error/loaded states.

## What to build next (Phase 1) — service layer only, no new UI

Port the remaining capability interfaces from
`spindare-ios/SpindareKit/Sources/SpindareKit/Services/Services.swift`, each with
a Live and Mock implementation, plus a `MediaUploader` doing R2 presign + PUT:
`ProfileServing`, `SocialServing`, `NotificationServing`, `SearchServing`,
`ChatServing`, `SpeedyServing`, `ZoneServing`.

Add the matching Retrofit declarations to `SpindareApi` **only for endpoints that
actually exist** in `server/src/**/*.controller.ts`. Add a contract test for every
new model, using JSON shaped exactly as the server sends it — follow the existing
tests in `app/src/test/java/com/spindare/ModelsJsonTest.kt`.

## Rules

- Match the surrounding code's style and comment density. The codebase explains
  *why*, not *what*.
- Do not add dependencies without checking them against the pinned versions above.
- Do not mark work complete without running `./gradlew :app:assembleDebug
  :app:testDebugUnitTest` and reporting the actual result.
- If something is ambiguous, read the iOS implementation rather than guessing.

---
