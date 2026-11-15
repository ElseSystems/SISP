-- SISP historical store — schema and versioned migrations.
--
-- ONE file shared by the C store (core/store, embedded at build time) and the web app
-- (src/storage, imported as text). Each block starting with "-- @migration N" is applied
-- once, in order, inside a transaction, and then PRAGMA user_version is set to N.
-- Never edit a released migration: append a new one.
--
-- Times are epoch milliseconds (UTC) in `ts`; `day` is the mission calendar day YYYY-MM-DD.
-- Severity/status columns use the libsisp scale 0–3 (N0 nominal … N3 critical).

-- @migration 1
CREATE TABLE crew (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  role                  TEXT,
  agency                TEXT,
  mission_start         TEXT,                     -- YYYY-MM-DD
  prior_career_dose_msv REAL NOT NULL DEFAULT 0,
  meta                  TEXT,                     -- free JSON for the host app (labels, avatar…)
  created_at            INTEGER NOT NULL
) STRICT;

CREATE TABLE checkins (
  id           INTEGER PRIMARY KEY,
  crew_id      TEXT NOT NULL REFERENCES crew(id) ON DELETE CASCADE,
  ts           INTEGER NOT NULL,
  day          TEXT NOT NULL,
  sys          REAL NOT NULL,                     -- mmHg
  dia          REAL NOT NULL,                     -- mmHg
  hr           REAL NOT NULL,                     -- bpm
  glucose      REAL NOT NULL,                     -- mg/dL
  temp         REAL NOT NULL,                     -- °C
  sleep        REAL NOT NULL,                     -- h
  mood         REAL NOT NULL,                     -- 1–5
  phq2         INTEGER CHECK (phq2 BETWEEN 0 AND 6),
  self_harm    INTEGER NOT NULL DEFAULT 0 CHECK (self_harm IN (0, 1)),
  exercise_min REAL,
  status       INTEGER NOT NULL DEFAULT 0 CHECK (status BETWEEN 0 AND 3),  -- worst indicator, N0–N3
  source       TEXT NOT NULL DEFAULT 'manual',    -- manual | sim | import
  UNIQUE (crew_id, day)                           -- one check-in per crew member per day
) STRICT;

CREATE TABLE pvt_results (
  id           INTEGER PRIMARY KEY,
  crew_id      TEXT NOT NULL REFERENCES crew(id) ON DELETE CASCADE,
  ts           INTEGER NOT NULL,
  day          TEXT NOT NULL,
  duration_sec REAL NOT NULL,
  n            INTEGER NOT NULL,
  mean_ms      REAL NOT NULL,
  median_ms    REAL NOT NULL,
  lapses       INTEGER NOT NULL,
  false_starts INTEGER NOT NULL,
  speed        REAL NOT NULL,
  source       TEXT NOT NULL DEFAULT 'manual'
) STRICT;

CREATE TABLE ppg_results (
  id      INTEGER PRIMARY KEY,
  crew_id TEXT NOT NULL REFERENCES crew(id) ON DELETE CASCADE,
  ts      INTEGER NOT NULL,
  day     TEXT NOT NULL,
  bpm     REAL NOT NULL,
  quality REAL NOT NULL CHECK (quality BETWEEN 0 AND 1),
  source  TEXT NOT NULL DEFAULT 'camera'          -- camera | demo
) STRICT;

CREATE TABLE radiation_doses (
  id       INTEGER PRIMARY KEY,
  crew_id  TEXT NOT NULL REFERENCES crew(id) ON DELETE CASCADE,
  ts       INTEGER NOT NULL,
  env      TEXT NOT NULL,                         -- iss | moonBase | marsTransit | marsBase
  msv      REAL NOT NULL CHECK (msv >= 0),
  source   TEXT NOT NULL DEFAULT 'sep',           -- sep | background | dosimeter
  event_id TEXT                                   -- solar_events.event_id for SEP doses
) STRICT;

CREATE TABLE solar_events (
  id        INTEGER PRIMARY KEY,
  event_id  TEXT NOT NULL,                        -- DONKI SEP id
  ts        INTEGER NOT NULL,                     -- all-clear time
  env       TEXT NOT NULL,
  dose_msv  REAL NOT NULL,
  sheltered INTEGER NOT NULL CHECK (sheltered IN (0, 1)),
  replay    INTEGER NOT NULL DEFAULT 0 CHECK (replay IN (0, 1)),
  flare     TEXT                                  -- flare class, e.g. X5.8
) STRICT;

CREATE TABLE reports (
  id        INTEGER PRIMARY KEY,
  crew_id   TEXT NOT NULL REFERENCES crew(id) ON DELETE CASCADE,
  ts        INTEGER NOT NULL,
  format    TEXT NOT NULL CHECK (format IN ('text', 'json')),
  body      TEXT NOT NULL,
  delay_sec REAL                                  -- one-way light time when sent
) STRICT;

-- @migration 2
CREATE INDEX checkins_crew_ts        ON checkins (crew_id, ts);
CREATE INDEX pvt_results_crew_ts     ON pvt_results (crew_id, ts);
CREATE INDEX ppg_results_crew_ts     ON ppg_results (crew_id, ts);
CREATE INDEX radiation_doses_crew_ts ON radiation_doses (crew_id, ts);
CREATE INDEX solar_events_ts         ON solar_events (ts);
CREATE INDEX reports_crew_ts         ON reports (crew_id, ts);

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;
