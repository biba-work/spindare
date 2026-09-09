# Spindare — Android

Native Android client (Kotlin + Jetpack Compose) for the same backend the iOS
app uses. This is a **second client**, not a second product: the Nest API on
Railway, Clerk auth, Postgres, and R2 storage are all shared and already live.

---

## Why frontend-first

There is no backend work to do. The server is client-agnostic — Clerk JWT in,
camelCase JSON out — and already serves ~48 endpoints to iOS in production. The
entire risk in this port is on the client side, which is why the first thing
built here is a walking skeleton that proves the risky parts end to end rather
than a pile of screens that can't talk to anything.

---

## Toolchain (and why these exact versions)

| Piece | Version | Why pinned |
|---|---|---|
| Kotlin | 2.4.10 | `clerk-android-api:1.0.36` ships `kotlin-stdlib 2.4.0`. An older compiler **cannot read** its metadata. |
| AGP | 8.13.2 | Latest stable 8.x. |
| Gradle | 8.13 | Matches AGP's major/minor. |
| Compose BOM | 2026.06.01 | Clerk resolves 2026.06.00; staying adjacent avoids a split Compose runtime. |
| Retrofit / OkHttp / kotlinx-serialization | 3.0.0 / 5.4.0 / 1.11.0 | **Identical to Clerk's own dependencies**, so there is exactly one resolved copy of each. |
| minSdk | 24 | Clerk's floor. |
| Java | 17 | Clerk's floor. Core-library desugaring is on for `java.time`. |

Bumping Clerk means re-checking its POM's `kotlin-stdlib` version before
anything else.

---

## Architecture — mirrors `SpindareKit`

The iOS app is a Swift package with a strict split, and that split is what made
it buildable before the backend existed. Same shape here:

```
com.spindare/
  model/Models.kt        <- SpindareKit/Models/Models.swift
  net/                   <- APIClient + endpoint surface
  services/              <- 8 capability interfaces, each with Live + Mock
  services/AppEnvironment.kt  <- the composition switchboard
  ui/theme/              <- Design/DesignTokens.swift
  ui/                    <- Compose rewrite of Views/
```

`AppEnvironment` is written once at launch and read everywhere after. Flipping
the whole app between mock and live is one call, exactly as on iOS — set
`API_BASE_URL` to `""` in `app/build.gradle.kts` and the app runs entirely on
on-device seed data while auth stays real Clerk.

---

## Scope, honestly measured

iOS is 17,312 lines of Swift:

| Layer | Lines | Ports how |
|---|---|---|
| Models | 756 | Near-mechanical; server JSON pins the shape |
| Services | 3,130 | Interfaces transfer, impls rewrite |
| Navigation | 390 | Different idiom, small |
| Design | 725 | Mechanical |
| **Views** | **11,324** | **Genuine rewrite** |

So roughly a quarter carries over with its architecture intact and the rest is
real Compose work. The half that is usually riskiest — API contract, auth,
data shapes — is already settled and proven in production.

---

## Phases

**Phase 0 — walking skeleton (this commit).** Gradle + Compose build, Clerk
sign-in, one authenticated call to the live API, feed rendered from Postgres,
contract tests over real server JSON. The point is to prove the pipeline, not to
cover the app.

**Phase 1 — the data spine.** Port the remaining 7 service interfaces
(`Profile`, `Social`, `Notification`, `Search`, `Chat`, `Speedy`, `Zone`) with
Live + Mock pairs, plus the R2 presign-and-PUT uploader. No new UI. Ends with
every endpoint reachable and tested.

**Phase 2 — the core loop.** Onboarding (incl. the OAuth → username/interests
step), spin wheel, challenge, composer, profile. This is the app being usable.

**Phase 3 — the rest of the surface.** Speedys (Media3/ExoPlayer), Zone
(Maps Compose — needs a Maps API key), chat, notifications, settings.

**Phase 4 — feel.** The gesture physics and motion work: interpolated
pull-to-dismiss, morphing drag handles, pre-buffered video. Device-only work.

---

## Running it

```bash
cd spindare-android
./gradlew :app:testDebugUnitTest      # contract tests, no device needed
./gradlew :app:assembleDebug          # build the APK
./gradlew :app:installDebug           # onto a running emulator/device
```

Emulators already configured on this machine: `Medium_Phone_API_35`,
`Low_End_Phone_API_35`.

```bash
~/Library/Android/sdk/emulator/emulator -avd Medium_Phone_API_35 &
~/Library/Android/sdk/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk
```

To point at a locally-run server instead of Railway, set `API_BASE_URL` to
`http://10.0.2.2:3000` (the emulator's alias for the host machine's localhost).

**Heads-up:** Android Studio auto-imports this project as soon as it appears, and
its background sync competes with a CLI `./gradlew` run for the same artifact-cache
locks — a command-line build can appear to hang for minutes while Studio is
syncing. Let the sync finish (or build from Studio) rather than running both at
once. Studio has also been observed editing `gradle.properties` on import.

---

## App identity

| Field | Value | Why |
|---|---|---|
| `applicationId` | `al.SPIND.Spindare` | Store/device identity — **identical to the iOS `PRODUCT_BUNDLE_IDENTIFIER`** so deep links, analytics, and console listings line up across platforms. |
| `namespace` | `al.spind.spindare` | The Kotlin package. Lowercase per Android convention; uppercase segments trip lint and are a case-sensitivity hazard on Linux CI. |

These two deliberately differ, which is what those fields are for. Do not
"fix" the namespace to match the applicationId.

## Build constraints discovered the hard way

These are pinned deliberately. Changing them without checking will break the build.

- **`androidx.lifecycle` is held at 2.10.0.** 2.11.0 requires AGP 9.1+ *and*
  compileSdk 37. This project is AGP 8.13.2 / compileSdk 36, and 36 is also
  `clerk-android-api`'s own `minCompileSdk`, so it cannot go lower either.
  Moving to lifecycle 2.11 means moving AGP, Gradle, and the installed SDK
  platform together.
- **`clerk-android-ui` is not a dependency.** D8 emits a Kotlin-metadata warning
  for every sealed-class state in it — ~400,000 log lines, and dexing took
  minutes. The app builds its own onboarding anyway. Only add it back if Clerk's
  drop-in screens are genuinely adopted.
- **Configuration cache is off.** AGP 8.13.2's `ProcessNavigationXmlTask` fails
  to serialise its file collection, which is a hard build failure, not a warning.
- **compileSdk 36 is the ceiling** until platform 37 is installed. `cmdline-tools`
  is not present in the local SDK, so `sdkmanager` isn't available — install
  platforms through Android Studio's SDK Manager.

## Gotchas already paid for

- **`MessagePayload` wire format.** Chat payloads use Swift's *synthesised* enum
  encoding — `{"text":{}}`, `{"image":{"url":…}}`, `{"voice":{…}}` — which is
  externally tagged with a single key. kotlinx's default sealed-class encoding is
  different, so `MessagePayloadSerializer` is hand-written. Getting this wrong
  fails **silently**: media messages render as blank text lines. Pinned by tests.
- **Auth token must be fetched per-request**, not cached at construction. A token
  cached at sign-in goes stale after an hour and every call 401s until restart.
  This bug was already shipped and fixed once on iOS.
- **Never let a username fall back to a placeholder value.** On iOS a literal
  `"you"` default reached the database as people's real handle. `RestoredIdentity.username`
  is nullable here for that reason — null means "unknown", rendered as a
  placeholder, never persisted.
- **The API returns whole Prisma rows**, including `pushToken`. `ignoreUnknownKeys`
  is mandatory, and `pushToken` is deliberately not modelled.
- **Media uploads go direct to R2** via `POST /storage/presign` then a PUT of the
  raw bytes. Do not base64 into JSON — that path 413'd on the server's body limit
  and was the root cause of "nothing saves" on iOS.
