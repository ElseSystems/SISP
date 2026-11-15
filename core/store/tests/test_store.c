/* sisp_store tests: migrations, inserts, range queries, upsert, persistence across a reopen,
 * integrity_check, foreign keys, backup and JSON export. Usage: test_store <scratch.db> */
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "sisp_store.h"
#include "sqlite3.h" /* only to craft a "future" database file */

static int failures = 0;
#define CHECK(cond) do { if (!(cond)) { fprintf(stderr, "%s:%d: CHECK failed: %s\n", __FILE__, __LINE__, #cond); failures++; } } while (0)
#define OK(expr) do { int rc_ = (expr); if (rc_ != SISP_STORE_OK) { fprintf(stderr, "%s:%d: %s -> %d (%s)\n", __FILE__, __LINE__, #expr, rc_, sisp_store_errmsg(s)); failures++; } } while (0)

#define DAY_MS 86400000LL
static const int64_t T0 = 1767225600000LL; /* 2026-01-01T00:00:00Z */

static void remove_db(const char *path) {
  char buf[1024];
  remove(path);
  snprintf(buf, sizeof buf, "%s-wal", path); remove(buf);
  snprintf(buf, sizeof buf, "%s-shm", path); remove(buf);
}

static sisp_reading reading(double temp) {
  sisp_reading r = { 112, 72, 62, 92, temp, 7.2, 4, 30, SISP_PHQ2_NONE, 0 };
  return r;
}

typedef struct { int n; double last_temp; int64_t last_ts; int phq2_none; char last_source[16]; } acc;
static int count_checkin(void *u, const sisp_store_checkin *row) {
  acc *a = (acc *)u;
  a->n++;
  a->last_temp = row->reading.temp;
  a->last_ts = row->ts;
  a->phq2_none += row->reading.phq2 == SISP_PHQ2_NONE;
  snprintf(a->last_source, sizeof a->last_source, "%s", row->source);
  return 0;
}
static int stop_first(void *u, const sisp_store_checkin *row) { (void)row; (*(int *)u)++; return 1; }
static int count_pvt(void *u, const sisp_store_pvt *row) { (void)row; (*(int *)u)++; return 0; }
static int count_ppg(void *u, const sisp_store_ppg *row) { (void)row; (*(int *)u)++; return 0; }
static int count_dose(void *u, const sisp_store_dose *row) { (void)row; (*(int *)u)++; return 0; }
static int count_solar(void *u, const sisp_store_solar_event *row) { (*(int *)u) += row->sheltered ? 1 : 100; return 0; }
static int count_report(void *u, const sisp_store_report *row) { (*(int *)u) += isnan(row->delay_sec) ? 100 : 1; return 0; }

typedef struct { char *buf; size_t len; } sink;
static int collect(void *u, const char *data, size_t len) {
  sink *k = (sink *)u;
  k->buf = (char *)realloc(k->buf, k->len + len + 1);
  memcpy(k->buf + k->len, data, len);
  k->len += len;
  k->buf[k->len] = 0;
  return 0;
}

static void fill(sisp_store *s) {
  sisp_store_crew c1 = { "t1", "Crew Member 1", "Commander", "NASA", "2026-01-01", 120.0, "{\"avatar\":\"A\"}" };
  sisp_store_crew c2 = { "t2", "Crew Member 2", "Flight Engineer", "ESA", "2026-01-01", 40.0, NULL };
  OK(sisp_store_upsert_crew(s, &c1));
  OK(sisp_store_upsert_crew(s, &c2));
  c1.role = "Mission Commander";
  OK(sisp_store_upsert_crew(s, &c1)); /* upsert keeps one row */

  OK(sisp_store_begin(s));
  for (int d = 0; d < 20; d++) {
    char day[11];
    snprintf(day, sizeof day, "2026-01-%02d", d + 1);
    sisp_store_checkin ci = { 0, "t1", T0 + d * DAY_MS + 8 * 3600000LL, day, reading(36.6 + 0.01 * d), SISP_N0_NOMINAL, "sim" };
    int64_t id = 0;
    OK(sisp_store_insert_checkin(s, &ci, &id));
    CHECK(id > 0);
    ci.crew_id = "t2";
    OK(sisp_store_insert_checkin(s, &ci, NULL));
  }
  OK(sisp_store_commit(s));

  /* same day again: replaces the reading instead of adding a row */
  sisp_store_checkin fever = { 0, "t1", T0 + 19 * DAY_MS + 20 * 3600000LL, "2026-01-20", reading(38.1), SISP_N2_WARNING, "manual" };
  fever.reading.phq2 = 2;
  OK(sisp_store_insert_checkin(s, &fever, NULL));

  sisp_store_pvt p = { 0, "t1", T0 + DAY_MS, "2026-01-02", 180, { 42, 281, 270, 3, 1, 3.6 }, "manual" };
  OK(sisp_store_insert_pvt(s, &p, NULL));
  sisp_store_ppg g = { 0, "t1", T0 + DAY_MS, "2026-01-02", 64, 0.82, "camera" };
  OK(sisp_store_insert_ppg(s, &g, NULL));
  sisp_store_solar_event e = { 0, "2026-01-05T10:00:00-SEP-001", T0 + 5 * DAY_MS, "marsTransit", 12.5, 1, 0, "X5.8" };
  OK(sisp_store_insert_solar_event(s, &e, NULL));
  sisp_store_dose d1 = { 0, "t1", T0 + 5 * DAY_MS, "marsTransit", 12.5, "sep", e.event_id };
  sisp_store_dose d2 = { 0, "t1", T0 + 9 * DAY_MS, "marsTransit", 0.5, "dosimeter", NULL };
  OK(sisp_store_insert_dose(s, &d1, NULL));
  OK(sisp_store_insert_dose(s, &d2, NULL));
  sisp_store_report r = { 0, "t1", T0 + 19 * DAY_MS, "text", "SISP MEDREP …", 754.0 };
  OK(sisp_store_insert_report(s, &r, NULL));
  r.format = "json"; r.body = "{\"v\":1}"; r.delay_sec = NAN;
  OK(sisp_store_insert_report(s, &r, NULL));
}

static void verify(sisp_store *s, const char *when) {
  fprintf(stderr, "verify (%s)\n", when);
  CHECK(sisp_store_schema_version(s) == SISP_STORE_SCHEMA_VERSION);
  CHECK(sisp_store_count(s, "crew") == 2);
  CHECK(sisp_store_count(s, "checkins") == 40);
  CHECK(sisp_store_count(s, "pvt_results") == 1);
  CHECK(sisp_store_count(s, "ppg_results") == 1);
  CHECK(sisp_store_count(s, "radiation_doses") == 2);
  CHECK(sisp_store_count(s, "solar_events") == 1);
  CHECK(sisp_store_count(s, "reports") == 2);
  CHECK(sisp_store_count(s, "sqlite_master") == -1); /* not a whitelisted table */

  acc a = { 0 };
  OK(sisp_store_query_checkins(s, "t1", T0, T0 + 30 * DAY_MS, count_checkin, &a));
  CHECK(a.n == 20);
  CHECK(fabs(a.last_temp - 38.1) < 1e-9); /* upserted day keeps the newest reading */
  CHECK(a.last_ts == T0 + 19 * DAY_MS + 20 * 3600000LL);
  CHECK(a.phq2_none == 19);
  CHECK(strcmp(a.last_source, "manual") == 0);

  memset(&a, 0, sizeof a);
  OK(sisp_store_query_checkins(s, "t1", T0 + 5 * DAY_MS, T0 + 9 * DAY_MS + 8 * 3600000LL, count_checkin, &a));
  CHECK(a.n == 5); /* days 6..10, range bounds inclusive */
  memset(&a, 0, sizeof a);
  OK(sisp_store_query_checkins(s, NULL, T0, T0 + 30 * DAY_MS, count_checkin, &a));
  CHECK(a.n == 40);
  memset(&a, 0, sizeof a);
  OK(sisp_store_query_checkins(s, "nobody", T0, T0 + 30 * DAY_MS, count_checkin, &a));
  CHECK(a.n == 0);
  int stops = 0;
  CHECK(sisp_store_query_checkins(s, "t1", T0, T0 + 30 * DAY_MS, stop_first, &stops) == SISP_STORE_ABORTED);
  CHECK(stops == 1);

  int n = 0;
  OK(sisp_store_query_pvt(s, "t1", T0, T0 + 30 * DAY_MS, count_pvt, &n)); CHECK(n == 1);
  n = 0; OK(sisp_store_query_ppg(s, "t1", T0, T0 + 30 * DAY_MS, count_ppg, &n)); CHECK(n == 1);
  n = 0; OK(sisp_store_query_doses(s, "t1", T0, T0 + 30 * DAY_MS, count_dose, &n)); CHECK(n == 2);
  n = 0; OK(sisp_store_query_solar_events(s, T0, T0 + 30 * DAY_MS, count_solar, &n)); CHECK(n == 1);
  n = 0; OK(sisp_store_query_reports(s, "t1", T0, T0 + 30 * DAY_MS, count_report, &n)); CHECK(n == 101);

  double msv = 0;
  OK(sisp_store_dose_total(s, "t1", T0, T0 + 30 * DAY_MS, &msv)); CHECK(fabs(msv - 13.0) < 1e-9);
  OK(sisp_store_dose_total(s, "t1", T0, T0 + 6 * DAY_MS, &msv)); CHECK(fabs(msv - 12.5) < 1e-9);

  sink k = { 0 };
  OK(sisp_store_export_json(s, "t1", T0, T0 + 30 * DAY_MS, collect, &k));
  CHECK(k.buf && strncmp(k.buf, "{\"format\":\"sisp-history\",\"schema_version\":2,", 44) == 0);
  CHECK(k.buf && strstr(k.buf, "\"role\":\"Mission Commander\"") != NULL);
  CHECK(k.buf && strstr(k.buf, "\"meta\":{\"avatar\":\"A\"}") != NULL);
  CHECK(k.buf && strstr(k.buf, "\"temp\":38.1") != NULL);
  CHECK(k.buf && strstr(k.buf, "Crew Member 2") == NULL); /* filtered by crew */
  free(k.buf);

  OK(sisp_store_integrity_check(s));
}

int main(int argc, char **argv) {
  const char *path = argc > 1 ? argv[1] : "test-store.db";
  char backup[1024];
  snprintf(backup, sizeof backup, "%s.bak", path);
  remove_db(path);
  remove_db(backup);
  fprintf(stderr, "SQLite %s\n", sisp_store_sqlite_version());

  sisp_store *s = NULL;
  OK(sisp_store_open(path, &s));
  if (!s) return 1;
  CHECK(strcmp(sisp_store_journal_mode(s), "wal") == 0);
  CHECK(sisp_store_schema_version(s) == SISP_STORE_SCHEMA_VERSION);
  fill(s);
  verify(s, "same connection");

  /* constraint and argument errors are reported, not swallowed */
  sisp_store_checkin orphan = { 0, "ghost", T0, "2026-01-01", reading(36.6), SISP_N0_NOMINAL, NULL };
  CHECK(sisp_store_insert_checkin(s, &orphan, NULL) == SISP_STORE_ERROR); /* FK: unknown crew */
  CHECK(strstr(sisp_store_errmsg(s), "FOREIGN KEY") != NULL);
  sisp_store_checkin bad = { 0, "t1", T0, "2026-02-01", reading(36.6), (sisp_severity)7, NULL };
  CHECK(sisp_store_insert_checkin(s, &bad, NULL) == SISP_STORE_ERROR); /* CHECK status 0–3 */
  CHECK(sisp_store_insert_checkin(s, NULL, NULL) == SISP_STORE_EINVAL);

  /* rollback leaves nothing behind */
  OK(sisp_store_begin(s));
  sisp_store_checkin tmp = { 0, "t1", T0 + 40 * DAY_MS, "2026-02-10", reading(36.6), SISP_N0_NOMINAL, NULL };
  OK(sisp_store_insert_checkin(s, &tmp, NULL));
  OK(sisp_store_rollback(s));
  CHECK(sisp_store_count(s, "checkins") == 40);

  OK(sisp_store_backup(s, backup));
  sisp_store_close(s);

  /* reopen: data survived, migrations are idempotent */
  s = NULL;
  OK(sisp_store_open(path, &s));
  if (!s) return 1;
  verify(s, "after reopen");
  sisp_store_close(s);

  s = NULL;
  OK(sisp_store_open(backup, &s));
  if (!s) return 1;
  verify(s, "backup copy");
  sisp_store_close(s);

  /* a database from a newer schema is refused rather than mangled */
  sqlite3 *raw = NULL;
  CHECK(sqlite3_open(backup, &raw) == SQLITE_OK);
  CHECK(sqlite3_exec(raw, "PRAGMA user_version = 99", NULL, NULL, NULL) == SQLITE_OK);
  sqlite3_close(raw);
  s = NULL;
  CHECK(sisp_store_open(backup, &s) == SISP_STORE_ESCHEMA);
  CHECK(s == NULL);

  s = NULL;
  OK(sisp_store_open(":memory:", &s));
  if (s) {
    CHECK(strcmp(sisp_store_journal_mode(s), "memory") == 0);
    CHECK(sisp_store_count(s, "checkins") == 0);
    sisp_store_close(s);
  }

  remove_db(backup);
  if (failures) { fprintf(stderr, "%d failure(s)\n", failures); return 1; }
  fprintf(stderr, "store: all checks passed\n");
  return 0;
}
