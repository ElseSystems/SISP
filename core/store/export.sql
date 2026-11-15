-- SISP history export — one JSON document. Shared by the C store and the web app.
-- Each sub-array is wrapped in json(): JSON subtypes do not survive a scalar subquery.
-- Parameters: :crew (crew id, or NULL for everyone), :from and :to (epoch ms, inclusive).
SELECT json_object(
  'format', 'sisp-history',
  'schema_version', (SELECT user_version FROM pragma_user_version),
  'crew', json((SELECT coalesce(json_group_array(json_object(
      'id', id, 'name', name, 'role', role, 'agency', agency, 'mission_start', mission_start,
      'prior_career_dose_msv', prior_career_dose_msv, 'meta', json(coalesce(meta, 'null')))), json('[]'))
    FROM (SELECT * FROM crew WHERE :crew IS NULL OR id = :crew ORDER BY id))),
  'checkins', json((SELECT coalesce(json_group_array(json_object(
      'crew_id', crew_id, 'ts', ts, 'day', day, 'sys', sys, 'dia', dia, 'hr', hr, 'glucose', glucose,
      'temp', temp, 'sleep', sleep, 'mood', mood, 'phq2', phq2, 'self_harm', self_harm,
      'exercise_min', exercise_min, 'status', status, 'source', source)), json('[]'))
    FROM (SELECT * FROM checkins WHERE (:crew IS NULL OR crew_id = :crew) AND ts BETWEEN :from AND :to ORDER BY crew_id, ts))),
  'pvt_results', json((SELECT coalesce(json_group_array(json_object(
      'crew_id', crew_id, 'ts', ts, 'day', day, 'duration_sec', duration_sec, 'n', n, 'mean_ms', mean_ms,
      'median_ms', median_ms, 'lapses', lapses, 'false_starts', false_starts, 'speed', speed, 'source', source)), json('[]'))
    FROM (SELECT * FROM pvt_results WHERE (:crew IS NULL OR crew_id = :crew) AND ts BETWEEN :from AND :to ORDER BY crew_id, ts))),
  'ppg_results', json((SELECT coalesce(json_group_array(json_object(
      'crew_id', crew_id, 'ts', ts, 'day', day, 'bpm', bpm, 'quality', quality, 'source', source)), json('[]'))
    FROM (SELECT * FROM ppg_results WHERE (:crew IS NULL OR crew_id = :crew) AND ts BETWEEN :from AND :to ORDER BY crew_id, ts))),
  'radiation_doses', json((SELECT coalesce(json_group_array(json_object(
      'crew_id', crew_id, 'ts', ts, 'env', env, 'msv', msv, 'source', source, 'event_id', event_id)), json('[]'))
    FROM (SELECT * FROM radiation_doses WHERE (:crew IS NULL OR crew_id = :crew) AND ts BETWEEN :from AND :to ORDER BY crew_id, ts))),
  'solar_events', json((SELECT coalesce(json_group_array(json_object(
      'event_id', event_id, 'ts', ts, 'env', env, 'dose_msv', dose_msv, 'sheltered', sheltered, 'replay', replay, 'flare', flare)), json('[]'))
    FROM (SELECT * FROM solar_events WHERE ts BETWEEN :from AND :to ORDER BY ts))),
  'reports', json((SELECT coalesce(json_group_array(json_object(
      'crew_id', crew_id, 'ts', ts, 'format', format, 'body', body, 'delay_sec', delay_sec)), json('[]'))
    FROM (SELECT * FROM reports WHERE (:crew IS NULL OR crew_id = :crew) AND ts BETWEEN :from AND :to ORDER BY crew_id, ts)))
);
