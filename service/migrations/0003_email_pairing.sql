ALTER TABLE invites ADD COLUMN email_hash TEXT;
CREATE INDEX invites_email ON invites(email_hash);

-- Only keyed recipient hashes are stored, never email addresses or raw codes.
CREATE TABLE email_pairing_requests (
  email_hash TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  requests INTEGER NOT NULL,
  last_sent INTEGER NOT NULL
);
CREATE TABLE email_pairing_guard (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  day TEXT NOT NULL DEFAULT '',
  requests INTEGER NOT NULL DEFAULT 0
);
INSERT INTO email_pairing_guard (id) VALUES (1);
