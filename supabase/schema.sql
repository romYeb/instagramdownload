-- InstaGrab: Download History Table
CREATE TABLE IF NOT EXISTS download_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  full_name TEXT,
  profile_pic_url TEXT,
  follower_count INTEGER,
  media_count INTEGER DEFAULT 0,
  downloaded_at TIMESTAMPTZ DEFAULT NOW(),
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_download_history_username ON download_history(username);
CREATE INDEX IF NOT EXISTS idx_download_history_downloaded_at ON download_history(downloaded_at DESC);

-- Row Level Security
ALTER TABLE download_history ENABLE ROW LEVEL SECURITY;

-- Public read (for history display)
CREATE POLICY "public_read" ON download_history
  FOR SELECT USING (true);

-- Public insert (no auth required)
CREATE POLICY "public_insert" ON download_history
  FOR INSERT WITH CHECK (true);
