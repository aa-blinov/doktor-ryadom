-- Queued notifications about appointments and reminders. The key makes each event for each person happen once.
CREATE TABLE notices (
  key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK(length(body) <= 300),
  url TEXT NOT NULL DEFAULT '/#/today',
  created_at INTEGER NOT NULL,
  sent_at INTEGER
);
CREATE INDEX notices_unsent ON notices(sent_at, created_at);
