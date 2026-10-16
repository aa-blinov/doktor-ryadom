-- In-app notifications get a read mark (the queue table doubles as the inbox).
ALTER TABLE notices ADD COLUMN read_at INTEGER;

-- The patient card is its own entity. One card per patient; entries are append-only:
-- a mistake is withdrawn with a reason, never erased, so the history stays what was written.
CREATE TABLE patient_cards (
  patient_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE TABLE card_entries (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('visit_summary','diagnosis','treatment','referral','other')),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 4000),
  occurred_on TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  withdrawn_at INTEGER,
  withdraw_reason TEXT CHECK(length(withdraw_reason) <= 500)
);
CREATE INDEX card_entries_patient ON card_entries(patient_id, created_at);
