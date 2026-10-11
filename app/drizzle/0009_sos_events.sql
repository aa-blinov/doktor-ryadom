CREATE TABLE sos_events (
 id TEXT PRIMARY KEY,
 patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL,
 notified_at INTEGER,
 acknowledged_at INTEGER,
 acknowledged_by TEXT
);
CREATE INDEX sos_events_open_idx ON sos_events(patient_id) WHERE acknowledged_at IS NULL;
