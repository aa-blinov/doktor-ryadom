-- Doctor time slots and appointment requests. A slot is free when it is open, in the future,
-- and has no pending or confirmed request. The partial unique index keeps one active request per slot under races.
CREATE TABLE doctor_slots (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at INTEGER NOT NULL,
  minutes INTEGER NOT NULL CHECK(minutes BETWEEN 15 AND 120),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
  UNIQUE(doctor_id, starts_at)
);
CREATE INDEX doctor_slots_free ON doctor_slots(doctor_id, status, starts_at);

CREATE TABLE appointment_requests (
  id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL REFERENCES doctor_slots(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT '' CHECK(length(reason) <= 300),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','declined','cancelled')),
  created_at INTEGER NOT NULL,
  decided_at INTEGER
);
CREATE UNIQUE INDEX appointment_one_active_per_slot ON appointment_requests(slot_id) WHERE status IN ('pending','confirmed');
CREATE INDEX appointment_requests_patient ON appointment_requests(patient_id, created_at);
CREATE INDEX appointment_requests_doctor ON appointment_requests(doctor_id, status, created_at);
