# Spindare API — setup

This replaces the Supabase project that was deleted. Postgres + Storage +
Realtime + Stream Chat tokens now all live behind this Nest.js server instead
of being called directly from the mobile app.

## What Claude could not do for you (sandbox has no network access to
external services — same reason `git pull`/`npm install` had to run on your
machine earlier)

1. **Create a Postgres database.** Sign up for [Neon](https://neon.tech)
   (free tier is fine) → create a project → copy the connection string into
   `DATABASE_URL` in `.env` (copy `.env.example` → `.env` first).
2. **Create object storage for photos/videos.** Cloudflare R2 recommended
   (free 10GB, no egress fees): dash.cloudflare.com → R2 → create bucket
   named `spindare-assets` → Manage API Tokens → create a token with
   read+write → fill in `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY_ID`,
   `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_PUBLIC_URL` in `.env`. Make the
   bucket public (R2 dashboard → bucket settings → allow public access) so
   `STORAGE_PUBLIC_URL` actually serves files.
3. **Get your Clerk secret key.** Clerk dashboard → API Keys → Secret Key →
   `CLERK_SECRET_KEY` in `.env`. (Different from the publishable key the
   mobile app uses.)
4. **Get Stream Chat server credentials.** Stream dashboard → your app →
   `STREAM_KEY` and `STREAM_SECRET` in `.env`.
5. **Deploy this server somewhere reachable from your phone.** For local
   testing during the redesign phase, just running it on your Mac and
   pointing the app at your Mac's LAN IP works (see below). For anything
   beyond that, Railway or Render both have a free/cheap tier and deploy
   straight from this folder.

## Running it locally

```bash
cd server
cp .env.example .env   # fill in the 4 sections above
npm install
npx prisma migrate dev --name init   # creates all 10 tables in your new Postgres
npm run start:dev
```

Check `http://localhost:3000/health` — should return `{"status":"ok"}`.

## Pointing the mobile app at it

In `spindare/spindare/.env` (the mobile app, not this server), set:

```
EXPO_PUBLIC_API_URL=http://<your-mac's-LAN-IP>:3000
```

Find your Mac's LAN IP with `ipconfig getifaddr en0` (or `en1` on some
Macs). `127.0.0.1`/`localhost` will NOT work from a physical phone — that
address means "the phone itself" on-device, not your computer.

The old `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` vars in
the mobile app's `.env` are no longer read by anything (grep the codebase —
nothing imports `supabaseConfig.ts` anymore) and can be deleted whenever you
get to it. `supabaseConfig.ts` itself and `@supabase/supabase-js` in
`package.json` are dead code/dependency now too — left in place rather than
deleted since only you should decide to remove files from your repo, but
safe to clean up.

## What's implemented vs. approximated

Fully ported: profiles, posts, reactions, comments, follows, connection
requests, ghosting, notifications (+ Expo push), kept/spind challenges,
image + video upload, Stream Chat tokens.

Approximated on purpose: real-time updates were Supabase's `postgres_changes`
subscriptions, which per your own CLAUDE.md's "Known Issues" section never
actually worked anyway. Two things now exist instead — a Socket.IO gateway
(`RealtimeGateway`) that broadcasts on every write, and the mobile client
polls every 8–15 seconds as the reliable fallback. Wire the client to listen
to the socket events instead of polling later if you want instant updates;
polling is correct today, just not instant.
