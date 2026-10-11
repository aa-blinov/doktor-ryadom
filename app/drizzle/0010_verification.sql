ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
CREATE TABLE specialist_requests (
 id TEXT PRIMARY KEY,
 doctor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 specialty TEXT NOT NULL,
 license TEXT NOT NULL,
 city TEXT NOT NULL,
 note TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','needs_info','approved','rejected')),
 admin_note TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 reviewer_id TEXT
);
CREATE INDEX specialist_requests_doctor_idx ON specialist_requests(doctor_id, created_at);
