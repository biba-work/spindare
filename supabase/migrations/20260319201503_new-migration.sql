-- ============================================================
-- Spindare — Full Schema (Clerk-compatible)
--
-- Key design decisions:
--   • User ID columns are TEXT (not UUID) — Clerk uses string IDs
--     like "user_3BB4L8lv1zpSWxD120VmeDlDxET", not UUIDs.
--   • camelCase column names are quoted so PostgREST/JS client
--     receives them with the correct casing (e.g. "spinCount").
--   • FKs to auth.users removed — Clerk manages auth, not Supabase.
--   • FKs to public.profiles added only where PostgREST embedded
--     queries are used (notifications, connection_requests).
-- ============================================================

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id                   TEXT NOT NULL PRIMARY KEY,
  username             TEXT UNIQUE,
  email                TEXT,
  "photoURL"           TEXT,
  hobbies              JSONB DEFAULT '[]'::jsonb,
  "studyFields"        JSONB DEFAULT '[]'::jsonb,
  xp                   INTEGER DEFAULT 0,
  level                INTEGER DEFAULT 1,
  "spinsLeft"          INTEGER DEFAULT 2,
  "lastSpinTimestamp"  BIGINT DEFAULT 0,
  "connectionPrivacy"  TEXT DEFAULT 'open',
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. POSTS
CREATE TABLE IF NOT EXISTS public.posts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  author      TEXT NOT NULL,
  avatar      TEXT,
  challenge   TEXT NOT NULL,
  content     TEXT,
  media       TEXT,
  "spinCount" INTEGER DEFAULT 0,
  reactions   JSONB DEFAULT '{"felt": 0, "thought": 0, "intrigued": 0}'::jsonb,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. REACTIONS (one reaction per user per post)
CREATE TABLE IF NOT EXISTS public.reactions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId"   TEXT NOT NULL,
  "postId"   UUID REFERENCES public.posts ON DELETE CASCADE NOT NULL,
  type       TEXT NOT NULL,   -- 'felt' | 'thought' | 'intrigued'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE("userId", "postId")
);

-- 4. COMMENTS
CREATE TABLE IF NOT EXISTS public.comments (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "postId"   UUID REFERENCES public.posts ON DELETE CASCADE NOT NULL,
  "userId"   TEXT NOT NULL,
  author     TEXT NOT NULL,
  avatar     TEXT,
  content    TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. FOLLOWS
CREATE TABLE IF NOT EXISTS public.follows (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id  TEXT NOT NULL,
  following_id TEXT NOT NULL,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(follower_id, following_id)
);

-- 6. CONNECTION REQUESTS
-- FK to profiles so PostgREST can do embedded profile queries.
CREATE TABLE IF NOT EXISTS public.connection_requests (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id  TEXT NOT NULL,
  status       TEXT DEFAULT 'pending',   -- 'pending' | 'accepted' | 'declined'
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(requester_id, receiver_id)
);

-- 7. GHOSTED USERS
CREATE TABLE IF NOT EXISTS public.ghosted_users (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT NOT NULL,
  ghosted_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, ghosted_id)
);

-- 8. NOTIFICATIONS
-- FK on from_user_id so PostgREST can embed sender profile.
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      TEXT NOT NULL,
  type         TEXT NOT NULL,
  from_user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content      TEXT NOT NULL,
  target_id    TEXT,
  read         BOOLEAN DEFAULT false,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. KEPT CHALLENGES
CREATE TABLE IF NOT EXISTS public.kept_challenges (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId"   TEXT NOT NULL,
  "postId"   UUID NOT NULL,
  challenge  TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE("userId", "postId")
);

-- 10. SPIND CHALLENGES
CREATE TABLE IF NOT EXISTS public.spind_challenges (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId"   TEXT NOT NULL,
  "postId"   UUID NOT NULL,
  challenge  TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE("userId", "postId")
);

-- ============================================================
-- 11. ROW LEVEL SECURITY (RLS)
-- ============================================================
-- ⚠️ TODO before any public release: enable RLS and add policies.
-- Example:
--   ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY "anyone can read profiles"
--     ON public.profiles FOR SELECT USING (true);
--   CREATE POLICY "users can update own profile"
--     ON public.profiles FOR UPDATE USING (id = current_setting('request.jwt.claims')::json->>'sub');
-- Repeat for all tables.
-- ============================================================

-- 12. RPC FUNCTIONS for atomic reaction updates
CREATE OR REPLACE FUNCTION increment_reaction(post_id UUID, reaction_type TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.posts
  SET reactions = jsonb_set(reactions, ARRAY[reaction_type], ((COALESCE(reactions->>reaction_type, '0')::int + 1)::text)::jsonb)
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_reaction(post_id UUID, reaction_type TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.posts
  SET reactions = jsonb_set(reactions, ARRAY[reaction_type], ((GREATEST(0, (COALESCE(reactions->>reaction_type, '0')::int - 1)))::text)::jsonb)
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION swap_reaction(post_id UUID, old_type TEXT, new_type TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.posts
  SET reactions = jsonb_set(
    jsonb_set(reactions, ARRAY[old_type], ((GREATEST(0, (COALESCE(reactions->>old_type, '0')::int - 1)))::text)::jsonb),
    ARRAY[new_type],
    ((COALESCE(reactions->>new_type, '0')::int + 1)::text)::jsonb
  )
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;
