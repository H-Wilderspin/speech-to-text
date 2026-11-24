CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE invites (
  code_hash TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  claimed_hash TEXT
);
CREATE TABLE guard (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  day TEXT NOT NULL DEFAULT '',
  requests INTEGER NOT NULL DEFAULT 0,
  paused INTEGER NOT NULL DEFAULT 0
);
INSERT INTO guard (id) VALUES (1);
