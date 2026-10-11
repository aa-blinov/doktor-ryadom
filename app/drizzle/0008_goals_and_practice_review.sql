CREATE TABLE goals (
 id TEXT PRIMARY KEY,
 patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL,
 reason TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 closed_at INTEGER
);
CREATE TABLE goal_logs (
 id TEXT PRIMARY KEY,
 patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
 status TEXT NOT NULL CHECK(status IN ('step','difficult','reached')),
 note TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 reviewed_at INTEGER,
 reviewer_id TEXT
);
ALTER TABLE practices ADD COLUMN note TEXT NOT NULL DEFAULT '';
ALTER TABLE practices ADD COLUMN reviewed_at INTEGER;
ALTER TABLE practices ADD COLUMN reviewer_id TEXT;
CREATE INDEX goals_patient ON goals(patient_id, created_at);
CREATE INDEX goal_logs_patient ON goal_logs(patient_id, created_at);
