-- ============================================================
-- ARKA Supabase Database Setup
-- Run this entire script in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- MIGRATIONS (safe to run on existing databases)
-- ============================================================
ALTER TABLE posts ADD COLUMN IF NOT EXISTS embed_url text;
ALTER TABLE content_pipeline ADD COLUMN IF NOT EXISTS embed_url text;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  published_at date,
  type text,
  caption text,
  tags text[],
  image_url text,
  slides jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_analytics_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts,
  user_id uuid REFERENCES auth.users,
  log_date date,
  day_marker int,
  reactions int DEFAULT 0,
  comments int DEFAULT 0,
  reposts int DEFAULT 0,
  saves int DEFAULT 0,
  impressions int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbound_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users,
  lead_name text,
  company text,
  deal_value numeric DEFAULT 0,
  stage text,
  source text,
  expected_close_date date,
  priority text,
  tags text[],
  notes text,
  stage_history jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inbound_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users,
  lead_name text,
  company text,
  deal_value numeric DEFAULT 0,
  stage text,
  source text,
  content_source text,
  priority text,
  tags text[],
  notes text,
  stage_history jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users,
  title text,
  description text,
  priority text,
  status text,
  due_date date,
  estimated_hours numeric,
  tags text[],
  linked_module text,
  time_logs jsonb,
  total_seconds int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users,
  title text,
  format text,
  status text,
  body text,
  tags text[],
  scheduled_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_magnets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users,
  title text,
  type text,
  description text,
  file_url text,
  external_url text,
  cover_url text,
  tags text[],
  performance_notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users,
  type text,
  action text,
  label text,
  ref_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users UNIQUE,
  name text,
  email text,
  linkedin_url text,
  photo_url text,
  hourly_rate numeric DEFAULT 50,
  cac_spend numeric DEFAULT 0,
  exchange_rate numeric DEFAULT 278,
  goal_mrr numeric DEFAULT 1000,
  goal_new_clients int DEFAULT 1,
  goal_dms_per_week int DEFAULT 30,
  goal_posts_per_week int DEFAULT 7,
  goal_impressions int DEFAULT 50000,
  goal_comments int DEFAULT 100,
  goal_connections int DEFAULT 50,
  goal_engagement_rate numeric DEFAULT 3.0,
  goal_pipeline_deals int DEFAULT 5,
  goal_revenue_pkr numeric DEFAULT 500000,
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_analytics_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_magnets ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users see own posts" ON posts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own analytics" ON post_analytics_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own outbound" ON outbound_deals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own inbound" ON inbound_leads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own tasks" ON tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own pipeline" ON content_pipeline FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own magnets" ON lead_magnets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own activity" ON activity_log FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
-- Run this separately in the Supabase dashboard or via API:
-- Create a bucket named 'arka-media' with public access enabled
-- INSERT INTO storage.buckets (id, name, public) VALUES ('arka-media', 'arka-media', true);
