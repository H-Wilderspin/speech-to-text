CREATE TABLE pairing_guard (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  short_start INTEGER NOT NULL DEFAULT 0,
  short_attempts INTEGER NOT NULL DEFAULT 0,
  long_start INTEGER NOT NULL DEFAULT 0,
  long_attempts INTEGER NOT NULL DEFAULT 0
);
INSERT INTO pairing_guard (id) VALUES (1);
