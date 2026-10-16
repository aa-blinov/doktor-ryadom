-- Every patient has one card from the moment of registration. Existing patients get theirs here.
INSERT OR IGNORE INTO patient_cards (patient_id, created_at) SELECT id, created_at FROM users WHERE role = 'patient';
