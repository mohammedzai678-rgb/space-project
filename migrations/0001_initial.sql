CREATE TABLE IF NOT EXISTS satellites (
  id TEXT PRIMARY KEY,
  sort_index INTEGER NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_satellites_sort_index ON satellites(sort_index);

CREATE TABLE IF NOT EXISTS launches (
  id TEXT PRIMARY KEY,
  sort_index INTEGER NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_launches_sort_index ON launches(sort_index);

CREATE TABLE IF NOT EXISTS catastrophes (
  id TEXT PRIMARY KEY,
  sort_index INTEGER NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_catastrophes_sort_index ON catastrophes(sort_index);

CREATE TABLE IF NOT EXISTS change_alerts (
  id TEXT PRIMARY KEY,
  sort_index INTEGER NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_change_alerts_sort_index ON change_alerts(sort_index);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);
