-- Times are stored as instants. The zone each row was entered in travels with it:
-- a slot keeps the clinic zone it was created in, a request keeps the patient's zone at booking time.
ALTER TABLE doctor_slots ADD COLUMN tz TEXT NOT NULL DEFAULT 'Asia/Almaty';
ALTER TABLE appointment_requests ADD COLUMN patient_tz TEXT NOT NULL DEFAULT 'Asia/Almaty';
