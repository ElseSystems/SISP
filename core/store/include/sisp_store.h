/*
 * sisp_store — optional SQLite history store for libsisp.
 *
 * Separate CMake target (`sisp_store`) so libsisp itself stays dependency-free.
 * Uses the vendored SQLite amalgamation (public domain, core/store/vendor/sqlite).
 * Schema + versioned migrations live in core/store/schema.sql (PRAGMA user_version),
 * the same file the web app runs in @sqlite.org/sqlite-wasm.
 *
 * Durability: WAL journal, synchronous=FULL, foreign keys ON, every write is a prepared
 * statement; batch writes with sisp_store_begin/commit. One sisp_store per thread.
 *
 * SPDX-License-Identifier: LicenseRef-Proprietary
 */
#ifndef SISP_STORE_H
#define SISP_STORE_H

#include <stddef.h>
#include <stdint.h>

#include "sisp.h"

#ifdef __cplusplus
extern "C" {
#endif

#if defined(_WIN32) && defined(SISP_STORE_SHARED)
#  ifdef SISP_STORE_BUILDING
#    define SISP_STORE_API __declspec(dllexport)
#  else
#    define SISP_STORE_API __declspec(dllimport)
#  endif
#elif defined(__GNUC__) || defined(__clang__)
#  define SISP_STORE_API __attribute__((visibility("default")))
#else
#  define SISP_STORE_API
#endif

#define SISP_STORE_SCHEMA_VERSION 2

typedef enum sisp_store_status {
  SISP_STORE_OK = 0,
  SISP_STORE_ERROR = -1,     /* SQLite error — see sisp_store_errmsg() */
  SISP_STORE_EINVAL = -2,    /* bad argument */
  SISP_STORE_ESCHEMA = -3,   /* database is newer than this library */
  SISP_STORE_ECORRUPT = -4,  /* integrity_check failed */
  SISP_STORE_ABORTED = -5    /* a callback asked to stop */
} sisp_store_status;

typedef struct sisp_store sisp_store; /* opaque */

/* ── lifecycle ──────────────────────────────────────────────────────────── */

/* Opens (creating if needed) and migrates the database at `path` (":memory:" works). */
SISP_STORE_API int sisp_store_open(const char *path, sisp_store **out);
SISP_STORE_API void sisp_store_close(sisp_store *s);
SISP_STORE_API const char *sisp_store_errmsg(const sisp_store *s);
SISP_STORE_API int sisp_store_schema_version(sisp_store *s);
SISP_STORE_API const char *sisp_store_journal_mode(sisp_store *s); /* "wal" on disk, "memory" for :memory: */
SISP_STORE_API const char *sisp_store_sqlite_version(void);

SISP_STORE_API int sisp_store_begin(sisp_store *s);
SISP_STORE_API int sisp_store_commit(sisp_store *s);
SISP_STORE_API int sisp_store_rollback(sisp_store *s);

/* PRAGMA integrity_check + foreign_key_check: SISP_STORE_OK or SISP_STORE_ECORRUPT. */
SISP_STORE_API int sisp_store_integrity_check(sisp_store *s);

/* Online backup of the whole database to another file (sqlite3_backup). */
SISP_STORE_API int sisp_store_backup(sisp_store *s, const char *dest_path);

/* ── records ────────────────────────────────────────────────────────────── */

typedef struct sisp_store_crew {
  const char *id, *name, *role, *agency;
  const char *mission_start;   /* YYYY-MM-DD, may be NULL */
  double prior_career_dose_msv;
  const char *meta;            /* JSON or NULL */
} sisp_store_crew;

typedef struct sisp_store_checkin {
  int64_t id;
  const char *crew_id;
  int64_t ts;                  /* epoch ms */
  const char *day;             /* YYYY-MM-DD */
  sisp_reading reading;        /* the 6 indicators (+ PHQ-2, self-harm, exercise) */
  sisp_severity status;        /* worst indicator, e.g. from sisp_assess */
  const char *source;          /* "manual", "sim", "import" (NULL → "manual") */
} sisp_store_checkin;

typedef struct sisp_store_pvt {
  int64_t id;
  const char *crew_id;
  int64_t ts;
  const char *day;
  double duration_sec;
  sisp_pvt_score score;
  const char *source;
} sisp_store_pvt;

typedef struct sisp_store_ppg {
  int64_t id;
  const char *crew_id;
  int64_t ts;
  const char *day;
  double bpm, quality;
  const char *source;          /* "camera" | "demo" */
} sisp_store_ppg;

typedef struct sisp_store_dose {
  int64_t id;
  const char *crew_id;
  int64_t ts;
  const char *env;             /* "iss" | "moonBase" | "marsTransit" | "marsBase" */
  double msv;
  const char *source;          /* "sep" | "background" | "dosimeter" */
  const char *event_id;        /* may be NULL */
} sisp_store_dose;

typedef struct sisp_store_solar_event {
  int64_t id;
  const char *event_id;        /* DONKI SEP id */
  int64_t ts;
  const char *env;
  double dose_msv;
  int sheltered, replay;
  const char *flare;           /* may be NULL */
} sisp_store_solar_event;

typedef struct sisp_store_report {
  int64_t id;
  const char *crew_id;
  int64_t ts;
  const char *format;          /* "text" | "json" */
  const char *body;
  double delay_sec;            /* NaN → NULL */
} sisp_store_report;

/* Inserts. `row_id` (optional) receives the rowid. Check-ins upsert on (crew_id, day). */
SISP_STORE_API int sisp_store_upsert_crew(sisp_store *s, const sisp_store_crew *c);
SISP_STORE_API int sisp_store_insert_checkin(sisp_store *s, const sisp_store_checkin *c, int64_t *row_id);
SISP_STORE_API int sisp_store_insert_pvt(sisp_store *s, const sisp_store_pvt *p, int64_t *row_id);
SISP_STORE_API int sisp_store_insert_ppg(sisp_store *s, const sisp_store_ppg *p, int64_t *row_id);
SISP_STORE_API int sisp_store_insert_dose(sisp_store *s, const sisp_store_dose *d, int64_t *row_id);
SISP_STORE_API int sisp_store_insert_solar_event(sisp_store *s, const sisp_store_solar_event *e, int64_t *row_id);
SISP_STORE_API int sisp_store_insert_report(sisp_store *s, const sisp_store_report *r, int64_t *row_id);

/* ── queries (by crew and time range, oldest first) ─────────────────────── */
/* `crew_id` NULL = every crew member. `from_ms`/`to_ms` inclusive.
 * The record and its strings are valid only during the callback.
 * Return non-zero from the callback to stop (the query then returns SISP_STORE_ABORTED). */

typedef int (*sisp_store_checkin_cb)(void *user, const sisp_store_checkin *row);
typedef int (*sisp_store_pvt_cb)(void *user, const sisp_store_pvt *row);
typedef int (*sisp_store_ppg_cb)(void *user, const sisp_store_ppg *row);
typedef int (*sisp_store_dose_cb)(void *user, const sisp_store_dose *row);
typedef int (*sisp_store_solar_event_cb)(void *user, const sisp_store_solar_event *row);
typedef int (*sisp_store_report_cb)(void *user, const sisp_store_report *row);

SISP_STORE_API int sisp_store_query_checkins(sisp_store *s, const char *crew_id, int64_t from_ms, int64_t to_ms, sisp_store_checkin_cb cb, void *user);
SISP_STORE_API int sisp_store_query_pvt(sisp_store *s, const char *crew_id, int64_t from_ms, int64_t to_ms, sisp_store_pvt_cb cb, void *user);
SISP_STORE_API int sisp_store_query_ppg(sisp_store *s, const char *crew_id, int64_t from_ms, int64_t to_ms, sisp_store_ppg_cb cb, void *user);
SISP_STORE_API int sisp_store_query_doses(sisp_store *s, const char *crew_id, int64_t from_ms, int64_t to_ms, sisp_store_dose_cb cb, void *user);
SISP_STORE_API int sisp_store_query_solar_events(sisp_store *s, int64_t from_ms, int64_t to_ms, sisp_store_solar_event_cb cb, void *user);
SISP_STORE_API int sisp_store_query_reports(sisp_store *s, const char *crew_id, int64_t from_ms, int64_t to_ms, sisp_store_report_cb cb, void *user);

/* Sum of recorded doses (mSv) for a crew member in a time range. */
SISP_STORE_API int sisp_store_dose_total(sisp_store *s, const char *crew_id, int64_t from_ms, int64_t to_ms, double *out_msv);

/* Number of rows in one of the 7 tables ("crew", "checkins", …); -1 for an unknown table. */
SISP_STORE_API int64_t sisp_store_count(sisp_store *s, const char *table);

/* ── export ─────────────────────────────────────────────────────────────── */
typedef int (*sisp_store_write_fn)(void *user, const char *data, size_t len);

/* Writes the history as one JSON document (core/store/export.sql, same as the web export). */
SISP_STORE_API int sisp_store_export_json(sisp_store *s, const char *crew_id, int64_t from_ms, int64_t to_ms,
                                    sisp_store_write_fn write, void *user);

#ifdef __cplusplus
}
#endif
#endif /* SISP_STORE_H */
