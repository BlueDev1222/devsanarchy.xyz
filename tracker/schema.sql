CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  transaction_hash TEXT NOT NULL,
  type TEXT NOT NULL,
  event_time INTEGER NOT NULL,
  purchase_time INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
  state TEXT NOT NULL CHECK(state IN ('complete','excluded')),
  priority INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS transaction_events ON webhook_events(transaction_hash, event_time);
CREATE TABLE IF NOT EXISTS tracker_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
