/*
 * sisp_store — SQLite history store for libsisp. See include/sisp_store.h.
 * SPDX-License-Identifier: MIT
 */
#include "sisp_store.h"

#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "sqlite3.h"
#include "sisp_store_sql.h" /* generated at configure time: sisp_store_schema_sql, sisp_store_export_sql */

enum {
  ST_CREW, ST_CHECKIN, ST_PVT, ST_PPG, ST_DOSE, ST_SOLAR, ST_REPORT,
  ST_Q_CHECKIN, ST_Q_PVT, ST_Q_PPG, ST_Q_DOSE, ST_Q_SOLAR, ST_Q_REPORT, ST_DOSE_TOTAL,
  ST_EXPORT, ST__COUNT
};

static const char *const k_sql[ST_EXPORT] = {
  /* ST_CREW */
  "INSERT INTO crew (id, name, role, agency, mission_start, prior_career_dose_msv, meta, created_at)"
  " VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CAST(unixepoch('subsec') * 1000 AS INTEGER))"
  " ON CONFLICT (id) DO UPDATE SET name = excluded.name, role = excluded.role, agency = excluded.agency,"
  " mission_start = excluded.mission_start, prior_career_dose_msv = excluded.prior_career_dose_msv, meta = excluded.meta",
  /* ST_CHECKIN */
  "INSERT INTO checkins (crew_id, ts, day, sys, dia, hr, glucose, temp, sleep, mood, phq2, self_harm, exercise_min, status, source)"
  " VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)"
  " ON CONFLICT (crew_id, day) DO UPDATE SET ts = excluded.ts, sys = excluded.sys, dia = excluded.dia, hr = excluded.hr,"
  " glucose = excluded.glucose, temp = excluded.temp, sleep = excluded.sleep, mood = excluded.mood, phq2 = excluded.phq2,"
  " self_harm = excluded.self_harm, exercise_min = excluded.exercise_min, status = excluded.status, source = excluded.source"
  " RETURNING id",
  /* ST_PVT */
  "INSERT INTO pvt_results (crew_id, ts, day, duration_sec, n, mean_ms, median_ms, lapses, false_starts, speed, source)"
  " VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) RETURNING id",
  /* ST_PPG */
  "INSERT INTO ppg_results (crew_id, ts, day, bpm, quality, source) VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING id",
  /* ST_DOSE */
  "INSERT INTO radiation_doses (crew_id, ts, env, msv, source, event_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING id",
  /* ST_SOLAR */
  "INSERT INTO solar_events (event_id, ts, env, dose_msv, sheltered, replay, flare) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) RETURNING id",
  /* ST_REPORT */
  "INSERT INTO reports (crew_id, ts, format, body, delay_sec) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id",
  /* ST_Q_CHECKIN */
  "SELECT id, crew_id, ts, day, sys, dia, hr, glucose, temp, sleep, mood, phq2, self_harm, exercise_min, status, source"
  " FROM checkins WHERE (?1 IS NULL OR crew_id = ?1) AND ts BETWEEN ?2 AND ?3 ORDER BY ts, id",
  /* ST_Q_PVT */
  "SELECT id, crew_id, ts, day, duration_sec, n, mean_ms, median_ms, lapses, false_starts, speed, source"
  " FROM pvt_results WHERE (?1 IS NULL OR crew_id = ?1) AND ts BETWEEN ?2 AND ?3 ORDER BY ts, id",
  /* ST_Q_PPG */
  "SELECT id, crew_id, ts, day, bpm, quality, source"
  " FROM ppg_results WHERE (?1 IS NULL OR crew_id = ?1) AND ts BETWEEN ?2 AND ?3 ORDER BY ts, id",
  /* ST_Q_DOSE */
  "SELECT id, crew_id, ts, env, msv, source, event_id"
  " FROM radiation_doses WHERE (?1 IS NULL OR crew_id = ?1) AND ts BETWEEN ?2 AND ?3 ORDER BY ts, id",
  /* ST_Q_SOLAR */
  "SELECT id, event_id, ts, env, dose_msv, sheltered, replay, flare"
  " FROM solar_events WHERE ts BETWEEN ?1 AND ?2 ORDER BY ts, id",
  /* ST_Q_REPORT */
  "SELECT id, crew_id, ts, format, body, delay_sec"
  " FROM reports WHERE (?1 IS NULL OR crew_id = ?1) AND ts BETWEEN ?2 AND ?3 ORDER BY ts, id",
  /* ST_DOSE_TOTAL */
  "SELECT coalesce(sum(msv), 0) FROM radiation_doses WHERE crew_id = ?1 AND ts BETWEEN ?2 AND ?3",
};

struct sisp_store {
  sqlite3 *db;
  sqlite3_stmt *st[ST__COUNT];
  char journal[16];
  char err[256];
};

static int fail(sisp_store *s, int code, const char *msg) {
  if (s) snprintf(s->err, sizeof s->err, "%s", msg ? msg : (s->db ? sqlite3_errmsg(s->db) : "error"));
  return code;
}
static int sql_fail(sisp_store *s) { return fail(s, SISP_STORE_ERROR, NULL); }

const char *sisp_store_errmsg(const sisp_store *s) { return s ? s->err : "null store"; }
const char *sisp_store_sqlite_version(void) { return sqlite3_libversion(); }

/* Prepared statements are compiled once, on first use, and reused (reset + clear bindings). */
static sqlite3_stmt *stmt(sisp_store *s, int which) {
  if (!s->st[which]) {
    const char *sql = which == ST_EXPORT ? sisp_store_export_sql : k_sql[which];
    if (sqlite3_prepare_v3(s->db, sql, -1, SQLITE_PREPARE_PERSISTENT, &s->st[which], NULL) != SQLITE_OK) return NULL;
  }
  sqlite3_reset(s->st[which]);
  sqlite3_clear_bindings(s->st[which]);
  return s->st[which];
}

static void bind_text(sqlite3_stmt *st, int i, const char *v) {
  if (v) sqlite3_bind_text(st, i, v, -1, SQLITE_TRANSIENT); else sqlite3_bind_null(st, i);
}
static void bind_real(sqlite3_stmt *st, int i, double v) {
  if (isnan(v)) sqlite3_bind_null(st, i); else sqlite3_bind_double(st, i, v);
}
static const char *col_text(sqlite3_stmt *st, int i) { return (const char *)sqlite3_column_text(st, i); }
static double col_real(sqlite3_stmt *st, int i) {
  return sqlite3_column_type(st, i) == SQLITE_NULL ? NAN : sqlite3_column_double(st, i);
}

/* Steps an INSERT … RETURNING id. */
static int run_insert(sisp_store *s, sqlite3_stmt *st, int64_t *row_id) {
  int rc = sqlite3_step(st);
  if (rc == SQLITE_ROW) {
    if (row_id) *row_id = sqlite3_column_int64(st, 0);
    rc = sqlite3_step(st);
  }
  if (rc != SQLITE_DONE) { sql_fail(s); sqlite3_reset(st); return SISP_STORE_ERROR; }
  sqlite3_reset(st);
  return SISP_STORE_OK;
}

static int exec(sisp_store *s, const char *sql) {
  char *msg = NULL;
  if (sqlite3_exec(s->db, sql, NULL, NULL, &msg) != SQLITE_OK) {
    fail(s, SISP_STORE_ERROR, msg ? msg : sqlite3_errmsg(s->db));
    sqlite3_free(msg);
    return SISP_STORE_ERROR;
  }
  return SISP_STORE_OK;
}

static int pragma_int(sisp_store *s, const char *sql) {
  sqlite3_stmt *st = NULL;
  int v = -1;
  if (sqlite3_prepare_v2(s->db, sql, -1, &st, NULL) == SQLITE_OK && sqlite3_step(st) == SQLITE_ROW) v = sqlite3_column_int(st, 0);
  sqlite3_finalize(st);
  return v;
}

int sisp_store_schema_version(sisp_store *s) { return s ? pragma_int(s, "PRAGMA user_version") : -1; }
const char *sisp_store_journal_mode(sisp_store *s) { return s ? s->journal : ""; }

/* Applies every "-- @migration N" block of schema.sql with N > user_version, each in its own
 * transaction together with the user_version bump, so a crash never leaves a half-migrated file. */
/* Next "-- @migration " tag that starts a line (the header comment mentions it mid-line). */
static const char *next_tag(const char *sql, const char *from, const char *tag) {
  for (const char *p = strstr(from, tag); p; p = strstr(p + 1, tag))
    if (p == sql || p[-1] == '\n') return p;
  return NULL;
}

static int migrate(sisp_store *s) {
  const char *const tag = "-- @migration ";
  const size_t tag_len = strlen(tag);
  int current = sisp_store_schema_version(s);
  if (current < 0) return sql_fail(s);
  if (current > SISP_STORE_SCHEMA_VERSION)
    return fail(s, SISP_STORE_ESCHEMA, "database schema is newer than this sisp_store");

  const char *sql_all = sisp_store_schema_sql;
  const char *p = next_tag(sql_all, sql_all, tag);
  while (p) {
    int n = atoi(p + tag_len);
    const char *body = strchr(p, '\n');
    if (!body || n <= 0) return fail(s, SISP_STORE_ERROR, "malformed schema.sql");
    const char *next = next_tag(sql_all, body, tag);
    size_t len = next ? (size_t)(next - body) : strlen(body);
    if (n > current) {
      char *sql = (char *)malloc(len + 64);
      if (!sql) return fail(s, SISP_STORE_ERROR, "out of memory");
      memcpy(sql, body, len);
      snprintf(sql + len, 64, "\nPRAGMA user_version = %d;", n);
      int rc = exec(s, "BEGIN IMMEDIATE");
      if (rc == SISP_STORE_OK) rc = exec(s, sql);
      if (rc == SISP_STORE_OK) rc = exec(s, "COMMIT");
      if (rc != SISP_STORE_OK) {
        char keep[sizeof s->err];
        memcpy(keep, s->err, sizeof keep);
        sqlite3_exec(s->db, "ROLLBACK", NULL, NULL, NULL);
        memcpy(s->err, keep, sizeof keep);
      }
      free(sql);
      if (rc != SISP_STORE_OK) return rc;
      current = n;
    }
    p = next;
  }
  return SISP_STORE_OK;
}

int sisp_store_open(const char *path, sisp_store **out) {
  if (!path || !out) return SISP_STORE_EINVAL;
  *out = NULL;
  sisp_store *s = (sisp_store *)calloc(1, sizeof *s);
  if (!s) return SISP_STORE_ERROR;
  int rc = sqlite3_open_v2(path, &s->db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_NOMUTEX, NULL);
  if (rc != SQLITE_OK) {
    fprintf(stderr, "sisp_store: cannot open %s: %s\n", path, s->db ? sqlite3_errmsg(s->db) : "?");
    sqlite3_close(s->db);
    free(s);
    return SISP_STORE_ERROR;
  }
  sqlite3_extended_result_codes(s->db, 1);
  sqlite3_busy_timeout(s->db, 5000);
  rc = exec(s, "PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL; PRAGMA trusted_schema = OFF;");
  if (rc == SISP_STORE_OK) {
    sqlite3_stmt *st = NULL;
    if (sqlite3_prepare_v2(s->db, "PRAGMA journal_mode = WAL", -1, &st, NULL) == SQLITE_OK && sqlite3_step(st) == SQLITE_ROW)
      snprintf(s->journal, sizeof s->journal, "%s", (const char *)sqlite3_column_text(st, 0));
    sqlite3_finalize(st);
  }
  if (rc == SISP_STORE_OK) rc = migrate(s);
  if (rc != SISP_STORE_OK) {
    fprintf(stderr, "sisp_store: %s\n", s->err);
    sisp_store_close(s);
    return rc;
  }
  *out = s;
  return SISP_STORE_OK;
}

void sisp_store_close(sisp_store *s) {
  if (!s) return;
  for (int i = 0; i < ST__COUNT; i++) sqlite3_finalize(s->st[i]);
  sqlite3_close(s->db); /* checkpoints the WAL into the main file */
  free(s);
}

int sisp_store_begin(sisp_store *s) { return s ? exec(s, "BEGIN IMMEDIATE") : SISP_STORE_EINVAL; }
int sisp_store_commit(sisp_store *s) { return s ? exec(s, "COMMIT") : SISP_STORE_EINVAL; }
int sisp_store_rollback(sisp_store *s) { return s ? exec(s, "ROLLBACK") : SISP_STORE_EINVAL; }

int sisp_store_integrity_check(sisp_store *s) {
  if (!s) return SISP_STORE_EINVAL;
  sqlite3_stmt *st = NULL;
  int ok = 0;
  if (sqlite3_prepare_v2(s->db, "PRAGMA integrity_check", -1, &st, NULL) != SQLITE_OK) return sql_fail(s);
  if (sqlite3_step(st) == SQLITE_ROW) {
    const char *r = (const char *)sqlite3_column_text(st, 0);
    ok = r && strcmp(r, "ok") == 0;
    if (!ok) fail(s, 0, r);
  }
  sqlite3_finalize(st);
  if (!ok) return SISP_STORE_ECORRUPT;
  if (sqlite3_prepare_v2(s->db, "PRAGMA foreign_key_check", -1, &st, NULL) != SQLITE_OK) return sql_fail(s);
  int orphan = sqlite3_step(st) == SQLITE_ROW;
  sqlite3_finalize(st);
  return orphan ? fail(s, SISP_STORE_ECORRUPT, "foreign_key_check found orphan rows") : SISP_STORE_OK;
}

int sisp_store_backup(sisp_store *s, const char *dest_path) {
  if (!s || !dest_path) return SISP_STORE_EINVAL;
  sqlite3 *dst = NULL;
  int rc = sqlite3_open(dest_path, &dst);
  if (rc == SQLITE_OK) {
    sqlite3_backup *b = sqlite3_backup_init(dst, "main", s->db, "main");
    if (b) { sqlite3_backup_step(b, -1); sqlite3_backup_finish(b); }
    rc = sqlite3_errcode(dst);
  }
  if (rc != SQLITE_OK) fail(s, 0, dst ? sqlite3_errmsg(dst) : "backup failed");
  sqlite3_close(dst);
  return rc == SQLITE_OK ? SISP_STORE_OK : SISP_STORE_ERROR;
}

/* ── inserts ── */

int sisp_store_upsert_crew(sisp_store *s, const sisp_store_crew *c) {
  if (!s || !c || !c->id || !c->name) return fail(s, SISP_STORE_EINVAL, "crew needs id and name");
  sqlite3_stmt *st = stmt(s, ST_CREW);
  if (!st) return sql_fail(s);
  bind_text(st, 1, c->id); bind_text(st, 2, c->name); bind_text(st, 3, c->role); bind_text(st, 4, c->agency);
  bind_text(st, 5, c->mission_start); sqlite3_bind_double(st, 6, c->prior_career_dose_msv); bind_text(st, 7, c->meta);
  return run_insert(s, st, NULL);
}

int sisp_store_insert_checkin(sisp_store *s, const sisp_store_checkin *c, int64_t *row_id) {
  if (!s || !c || !c->crew_id || !c->day) return fail(s, SISP_STORE_EINVAL, "check-in needs crew_id and day");
  sqlite3_stmt *st = stmt(s, ST_CHECKIN);
  if (!st) return sql_fail(s);
  const sisp_reading *r = &c->reading;
  bind_text(st, 1, c->crew_id); sqlite3_bind_int64(st, 2, c->ts); bind_text(st, 3, c->day);
  bind_real(st, 4, r->sys); bind_real(st, 5, r->dia); bind_real(st, 6, r->hr); bind_real(st, 7, r->glucose);
  bind_real(st, 8, r->temp); bind_real(st, 9, r->sleep); bind_real(st, 10, r->mood);
  if (r->phq2 == SISP_PHQ2_NONE) sqlite3_bind_null(st, 11); else sqlite3_bind_int(st, 11, r->phq2);
  sqlite3_bind_int(st, 12, r->self_harm ? 1 : 0);
  bind_real(st, 13, r->exercise_min);
  sqlite3_bind_int(st, 14, (int)c->status);
  bind_text(st, 15, c->source ? c->source : "manual");
  return run_insert(s, st, row_id);
}

int sisp_store_insert_pvt(sisp_store *s, const sisp_store_pvt *p, int64_t *row_id) {
  if (!s || !p || !p->crew_id || !p->day) return fail(s, SISP_STORE_EINVAL, "PVT needs crew_id and day");
  sqlite3_stmt *st = stmt(s, ST_PVT);
  if (!st) return sql_fail(s);
  bind_text(st, 1, p->crew_id); sqlite3_bind_int64(st, 2, p->ts); bind_text(st, 3, p->day);
  sqlite3_bind_double(st, 4, p->duration_sec); sqlite3_bind_int(st, 5, p->score.n);
  sqlite3_bind_double(st, 6, p->score.mean_ms); sqlite3_bind_double(st, 7, p->score.median_ms);
  sqlite3_bind_int(st, 8, p->score.lapses); sqlite3_bind_int(st, 9, p->score.false_starts);
  sqlite3_bind_double(st, 10, p->score.speed); bind_text(st, 11, p->source ? p->source : "manual");
  return run_insert(s, st, row_id);
}

int sisp_store_insert_ppg(sisp_store *s, const sisp_store_ppg *p, int64_t *row_id) {
  if (!s || !p || !p->crew_id || !p->day) return fail(s, SISP_STORE_EINVAL, "PPG needs crew_id and day");
  sqlite3_stmt *st = stmt(s, ST_PPG);
  if (!st) return sql_fail(s);
  bind_text(st, 1, p->crew_id); sqlite3_bind_int64(st, 2, p->ts); bind_text(st, 3, p->day);
  sqlite3_bind_double(st, 4, p->bpm); sqlite3_bind_double(st, 5, p->quality);
  bind_text(st, 6, p->source ? p->source : "camera");
  return run_insert(s, st, row_id);
}

int sisp_store_insert_dose(sisp_store *s, const sisp_store_dose *d, int64_t *row_id) {
  if (!s || !d || !d->crew_id || !d->env) return fail(s, SISP_STORE_EINVAL, "dose needs crew_id and env");
  sqlite3_stmt *st = stmt(s, ST_DOSE);
  if (!st) return sql_fail(s);
  bind_text(st, 1, d->crew_id); sqlite3_bind_int64(st, 2, d->ts); bind_text(st, 3, d->env);
  sqlite3_bind_double(st, 4, d->msv); bind_text(st, 5, d->source ? d->source : "sep"); bind_text(st, 6, d->event_id);
  return run_insert(s, st, row_id);
}

int sisp_store_insert_solar_event(sisp_store *s, const sisp_store_solar_event *e, int64_t *row_id) {
  if (!s || !e || !e->event_id || !e->env) return fail(s, SISP_STORE_EINVAL, "solar event needs event_id and env");
  sqlite3_stmt *st = stmt(s, ST_SOLAR);
  if (!st) return sql_fail(s);
  bind_text(st, 1, e->event_id); sqlite3_bind_int64(st, 2, e->ts); bind_text(st, 3, e->env);
  sqlite3_bind_double(st, 4, e->dose_msv); sqlite3_bind_int(st, 5, e->sheltered ? 1 : 0);
  sqlite3_bind_int(st, 6, e->replay ? 1 : 0); bind_text(st, 7, e->flare);
  return run_insert(s, st, row_id);
}

int sisp_store_insert_report(sisp_store *s, const sisp_store_report *r, int64_t *row_id) {
  if (!s || !r || !r->crew_id || !r->format || !r->body) return fail(s, SISP_STORE_EINVAL, "report needs crew_id, format, body");
  sqlite3_stmt *st = stmt(s, ST_REPORT);
  if (!st) return sql_fail(s);
  bind_text(st, 1, r->crew_id); sqlite3_bind_int64(st, 2, r->ts); bind_text(st, 3, r->format);
  bind_text(st, 4, r->body); bind_real(st, 5, r->delay_sec);
  return run_insert(s, st, row_id);
}

/* ── queries ── */

static sqlite3_stmt *range(sisp_store *s, int which, const char *crew_id, int64_t from_ms, int64_t to_ms) {
  sqlite3_stmt *st = stmt(s, which);
  if (!st) return NULL;
  int i = 1;
  if (which != ST_Q_SOLAR) bind_text(st, i++, crew_id);
  sqlite3_bind_int64(st, i++, from_ms);
  sqlite3_bind_int64(st, i, to_ms);
  return st;
}

/* Shared loop: fill a row from the statement, hand it to the callback, stop on non-zero. */
#define QUERY_LOOP(ROW_T, WHICH, FILL)                                                     \
  if (!s || !cb) return SISP_STORE_EINVAL;                                                \
  sqlite3_stmt *st = range(s, WHICH, crew_id, from_ms, to_ms);                            \
  if (!st) return sql_fail(s);                                                            \
  int rc;                                                                                 \
  while ((rc = sqlite3_step(st)) == SQLITE_ROW) {                                         \
    ROW_T row;                                                                            \
    memset(&row, 0, sizeof row);                                                          \
    FILL                                                                                  \
    if (cb(user, &row)) { sqlite3_reset(st); return SISP_STORE_ABORTED; }                 \
  }                                                                                       \
  sqlite3_reset(st);                                                                      \
  return rc == SQLITE_DONE ? SISP_STORE_OK : sql_fail(s);

int sisp_store_query_checkins(sisp_store *s, const char *crew_id, int64_t from_ms, int64_t to_ms, sisp_store_checkin_cb cb, void *user) {
  QUERY_LOOP(sisp_store_checkin, ST_Q_CHECKIN,
    row.id = sqlite3_column_int64(st, 0); row.crew_id = col_text(st, 1); row.ts = sqlite3_column_int64(st, 2);
    row.day = col_text(st, 3);
    row.reading.sys = col_real(st, 4); row.reading.dia = col_real(st, 5); row.reading.hr = col_real(st, 6);
    row.reading.glucose = col_real(st, 7); row.reading.temp = col_real(st, 8); row.reading.sleep = col_real(st, 9);
    row.reading.mood = col_real(st, 10);
    row.reading.phq2 = sqlite3_column_type(st, 11) == SQLITE_NULL ? SISP_PHQ2_NONE : sqlite3_column_int(st, 11);
    row.reading.self_harm = sqlite3_column_int(st, 12);
    row.reading.exercise_min = sqlite3_column_type(st, 13) == SQLITE_NULL ? 0 : sqlite3_column_double(st, 13);
    row.status = (sisp_severity)sqlite3_column_int(st, 14); row.source = col_text(st, 15);)
}

int sisp_store_query_pvt(sisp_store *s, const char *crew_id, int64_t from_ms, int64_t to_ms, sisp_store_pvt_cb cb, void *user) {
  QUERY_LOOP(sisp_store_pvt, ST_Q_PVT,
    row.id = sqlite3_column_int64(st, 0); row.crew_id = col_text(st, 1); row.ts = sqlite3_column_int64(st, 2);
    row.day = col_text(st, 3); row.duration_sec = sqlite3_column_double(st, 4);
    row.score.n = sqlite3_column_int(st, 5); row.score.mean_ms = sqlite3_column_double(st, 6);
    row.score.median_ms = sqlite3_column_double(st, 7); row.score.lapses = sqlite3_column_int(st, 8);
    row.score.false_starts = sqlite3_column_int(st, 9); row.score.speed = sqlite3_column_double(st, 10);
    row.source = col_text(st, 11);)
}

int sisp_store_query_ppg(sisp_store *s, const char *crew_id, int64_t from_ms, int64_t to_ms, sisp_store_ppg_cb cb, void *user) {
  QUERY_LOOP(sisp_store_ppg, ST_Q_PPG,
    row.id = sqlite3_column_int64(st, 0); row.crew_id = col_text(st, 1); row.ts = sqlite3_column_int64(st, 2);
    row.day = col_text(st, 3); row.bpm = sqlite3_column_double(st, 4); row.quality = sqlite3_column_double(st, 5);
    row.source = col_text(st, 6);)
}

int sisp_store_query_doses(sisp_store *s, const char *crew_id, int64_t from_ms, int64_t to_ms, sisp_store_dose_cb cb, void *user) {
  QUERY_LOOP(sisp_store_dose, ST_Q_DOSE,
    row.id = sqlite3_column_int64(st, 0); row.crew_id = col_text(st, 1); row.ts = sqlite3_column_int64(st, 2);
    row.env = col_text(st, 3); row.msv = sqlite3_column_double(st, 4); row.source = col_text(st, 5);
    row.event_id = col_text(st, 6);)
}

int sisp_store_query_solar_events(sisp_store *s, int64_t from_ms, int64_t to_ms, sisp_store_solar_event_cb cb, void *user) {
  const char *crew_id = NULL;
  QUERY_LOOP(sisp_store_solar_event, ST_Q_SOLAR,
    row.id = sqlite3_column_int64(st, 0); row.event_id = col_text(st, 1); row.ts = sqlite3_column_int64(st, 2);
    row.env = col_text(st, 3); row.dose_msv = sqlite3_column_double(st, 4); row.sheltered = sqlite3_column_int(st, 5);
    row.replay = sqlite3_column_int(st, 6); row.flare = col_text(st, 7);)
}

int sisp_store_query_reports(sisp_store *s, const char *crew_id, int64_t from_ms, int64_t to_ms, sisp_store_report_cb cb, void *user) {
  QUERY_LOOP(sisp_store_report, ST_Q_REPORT,
    row.id = sqlite3_column_int64(st, 0); row.crew_id = col_text(st, 1); row.ts = sqlite3_column_int64(st, 2);
    row.format = col_text(st, 3); row.body = col_text(st, 4); row.delay_sec = col_real(st, 5);)
}

int sisp_store_dose_total(sisp_store *s, const char *crew_id, int64_t from_ms, int64_t to_ms, double *out_msv) {
  if (!s || !crew_id || !out_msv) return SISP_STORE_EINVAL;
  sqlite3_stmt *st = range(s, ST_DOSE_TOTAL, crew_id, from_ms, to_ms);
  if (!st) return sql_fail(s);
  int rc = sqlite3_step(st);
  if (rc == SQLITE_ROW) *out_msv = sqlite3_column_double(st, 0);
  sqlite3_reset(st);
  return rc == SQLITE_ROW ? SISP_STORE_OK : sql_fail(s);
}

int64_t sisp_store_count(sisp_store *s, const char *table) {
  static const char *const tables[] = { "crew", "checkins", "pvt_results", "ppg_results", "radiation_doses", "solar_events", "reports" };
  if (!s || !table) return -1;
  for (size_t i = 0; i < sizeof tables / sizeof *tables; i++) {
    if (strcmp(table, tables[i]) != 0) continue;
    char sql[64];
    snprintf(sql, sizeof sql, "SELECT count(*) FROM %s", tables[i]); /* whitelisted name */
    sqlite3_stmt *st = NULL;
    int64_t n = -1;
    if (sqlite3_prepare_v2(s->db, sql, -1, &st, NULL) == SQLITE_OK && sqlite3_step(st) == SQLITE_ROW) n = sqlite3_column_int64(st, 0);
    sqlite3_finalize(st);
    return n;
  }
  return -1;
}

int sisp_store_export_json(sisp_store *s, const char *crew_id, int64_t from_ms, int64_t to_ms, sisp_store_write_fn write, void *user) {
  if (!s || !write) return SISP_STORE_EINVAL;
  sqlite3_stmt *st = stmt(s, ST_EXPORT);
  if (!st) return sql_fail(s);
  bind_text(st, sqlite3_bind_parameter_index(st, ":crew"), crew_id);
  sqlite3_bind_int64(st, sqlite3_bind_parameter_index(st, ":from"), from_ms);
  sqlite3_bind_int64(st, sqlite3_bind_parameter_index(st, ":to"), to_ms);
  int rc = sqlite3_step(st);
  int out = SISP_STORE_OK;
  if (rc == SQLITE_ROW) {
    const char *json = (const char *)sqlite3_column_text(st, 0);
    size_t len = (size_t)sqlite3_column_bytes(st, 0);
    if (write(user, json ? json : "{}", json ? len : 2)) out = SISP_STORE_ABORTED;
  } else {
    out = sql_fail(s);
  }
  sqlite3_reset(st);
  return out;
}
