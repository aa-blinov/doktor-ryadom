CREATE TABLE practice_templates (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  minutes INTEGER NOT NULL,
  category TEXT NOT NULL,
  basis TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  steps TEXT NOT NULL,
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX practice_templates_doctor ON practice_templates(doctor_id);
CREATE TABLE practice_media (
  practice_id TEXT NOT NULL REFERENCES practice_templates(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('photo','video')),
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (practice_id, kind)
);
