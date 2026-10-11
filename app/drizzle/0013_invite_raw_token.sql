ALTER TABLE invites ADD COLUMN raw TEXT;
UPDATE invites SET raw = NULL WHERE used = 1;
