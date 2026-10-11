ALTER TABLE specialist_requests ADD COLUMN kind TEXT CHECK(kind IN ('psychologist','psychotherapist','psychiatrist'));
ALTER TABLE users ADD COLUMN specialty_kind TEXT CHECK(specialty_kind IN ('psychologist','psychotherapist','psychiatrist'));
UPDATE specialist_requests SET kind=CASE WHEN specialty LIKE '%сихиатр%' THEN 'psychiatrist' WHEN specialty LIKE '%сихотерап%' THEN 'psychotherapist' ELSE 'psychologist' END;
UPDATE users SET specialty_kind=(SELECT r.kind FROM specialist_requests r WHERE r.doctor_id=users.id AND r.status='approved' ORDER BY r.updated_at DESC LIMIT 1) WHERE role='doctor' AND specialist_verified_at IS NOT NULL;
CREATE TABLE doctor_reviews (
 id TEXT PRIMARY KEY,
 doctor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 body TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 hidden_at INTEGER,
 UNIQUE(doctor_id,patient_id)
);
CREATE INDEX doctor_reviews_doctor_idx ON doctor_reviews(doctor_id,hidden_at,created_at);
CREATE TABLE connection_requests (
 id TEXT PRIMARY KEY,
 patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 doctor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 message TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled')),
 created_at INTEGER NOT NULL,
 decided_at INTEGER
);
CREATE UNIQUE INDEX connection_requests_open ON connection_requests(patient_id,doctor_id) WHERE status='pending';
CREATE INDEX connection_requests_doctor_idx ON connection_requests(doctor_id,status,created_at);
