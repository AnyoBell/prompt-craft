CREATE TABLE IF NOT EXISTS events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,   -- unix seconds
  sid     TEXT NOT NULL,      -- random per-visit id, not tied to a person
  event   TEXT NOT NULL,
  detail  TEXT,
  path    TEXT,
  ref     TEXT,               -- referrer hostname only
  device  TEXT,               -- mobile / tablet / desktop
  country TEXT                -- coarse, from Cloudflare
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
