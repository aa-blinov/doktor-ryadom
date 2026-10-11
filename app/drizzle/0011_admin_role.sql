UPDATE users SET role='admin' WHERE is_admin=1;
ALTER TABLE users ADD COLUMN blocked_at INTEGER;
