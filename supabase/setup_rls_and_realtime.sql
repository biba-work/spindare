-- 1. Enable RLS on all main tables
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kept_challenges" ENABLE ROW LEVEL SECURITY;

-- IMPORTANT CLERK NOTE: 
-- Because you are using Clerk, `auth.uid()` returns a UUID and only works if you use Supabase Auth.
-- Since your `"userId"` columns are TEXT (Clerk IDs), you either need to:
-- A) Setup a Clerk JWT template for Supabase to pass the user ID as `request.jwt.claims->>'sub'`
-- B) Allow public operations if you don't use JWTs.
-- Below are the strict policies assuming you use `request.jwt.claims->>'sub' = "userId"`

-- Posts Policies
CREATE POLICY "Public profiles are viewable by everyone." ON "profiles" FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON "profiles" FOR INSERT WITH CHECK (request.jwt.claims->>'sub' = "id");
CREATE POLICY "Users can update own profile." ON "profiles" FOR UPDATE USING (request.jwt.claims->>'sub' = "id");

CREATE POLICY "Posts are viewable by everyone." ON "posts" FOR SELECT USING (true);
CREATE POLICY "Users can create their own posts." ON "posts" FOR INSERT WITH CHECK (request.jwt.claims->>'sub' = "userId");
CREATE POLICY "Users can update own posts." ON "posts" FOR UPDATE USING (request.jwt.claims->>'sub' = "userId");
CREATE POLICY "Users can delete own posts." ON "posts" FOR DELETE USING (request.jwt.claims->>'sub' = "userId");

-- Reactions Policies
CREATE POLICY "Reactions are viewable by everyone." ON "reactions" FOR SELECT USING (true);
CREATE POLICY "Users can manage own reactions." ON "reactions" FOR ALL USING (request.jwt.claims->>'sub' = "userId");

-- Comments Policies
CREATE POLICY "Comments are viewable by everyone." ON "comments" FOR SELECT USING (true);
CREATE POLICY "Users can manage own comments." ON "comments" FOR ALL USING (request.jwt.claims->>'sub' = "userId");

-- Kept Challenges Policies
CREATE POLICY "Users can view own kept challenges." ON "kept_challenges" FOR SELECT USING (request.jwt.claims->>'sub' = "userId");
CREATE POLICY "Users can manage own kept challenges." ON "kept_challenges" FOR ALL USING (request.jwt.claims->>'sub' = "userId");

-- 2. Fix Realtime Publication
-- Ensure `posts` (and other tables if needed) are in the supabase_realtime publication
begin;
  -- remove the publication if it already exists to recreate it
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table "posts";
alter publication supabase_realtime add table "conversations";
alter publication supabase_realtime add table "messages";
