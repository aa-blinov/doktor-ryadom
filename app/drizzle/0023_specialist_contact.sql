-- A doctor leaves one way to reach them besides the mail: a phone number or a messenger.
-- The administrator needs it to settle a question about the qualification, and the request
-- is the only place the doctor already writes to a person, so the field lives here.
ALTER TABLE specialist_requests ADD COLUMN contact TEXT CHECK(contact IS NULL OR length(contact) <= 120);
