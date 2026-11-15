/* sisp-store — tiny CLI over sisp_store.
 *   sisp-store DB stats                 row counts, schema version, journal mode
 *   sisp-store DB check                 PRAGMA integrity_check (exit 1 if corrupt)
 *   sisp-store DB export [CREW_ID]      history as JSON on stdout
 *   sisp-store DB import CREW_ID [START] < CSV   check-ins (same CSV as `sisp-cli assess`, one row per day
 *                                                from START, default 2026-01-01); status via sisp_assess
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "sisp_store.h"

static int to_stdout(void *u, const char *data, size_t len) {
  (void)u;
  return fwrite(data, 1, len, stdout) != len;
}

#define MAX_ROWS 4096
static sisp_reading rows[MAX_ROWS];

/* Days since 1970-01-01 for a proleptic Gregorian date (Howard Hinnant's days_from_civil). */
static long long days_from_civil(int y, int m, int d) {
  y -= m <= 2;
  const int era = (y >= 0 ? y : y - 399) / 400;
  const int yoe = y - era * 400;
  const int doy = (153 * (m > 2 ? m - 3 : m + 9) + 2) / 5 + d - 1;
  const int doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return (long long)era * 146097 + doe - 719468;
}
static void civil_from_days(long long z, char out[48]) {
  z += 719468;
  const long long era = (z >= 0 ? z : z - 146096) / 146097;
  const long long doe = z - era * 146097;
  const long long yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
  const long long doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  const long long mp = (5 * doy + 2) / 153;
  const long long d = doy - (153 * mp + 2) / 5 + 1;
  const long long m = mp < 10 ? mp + 3 : mp - 9;
  snprintf(out, 48, "%04d-%02d-%02d", (int)(yoe + era * 400 + (m <= 2)), (int)m, (int)d);
}

/* Same CSV as `sisp-cli assess` (one row per day): sys,dia,hr,glucose,temp,sleep,mood[,phq2,self_harm,exercise_min].
 * Row i is stored on day START + i, at 12:00 UTC; status is the worst finding from sisp_assess. */
static int import_csv(sisp_store *s, const char *crew_id, const char *start) {
  char line[512];
  size_t n = 0;
  while (fgets(line, sizeof line, stdin) && n < MAX_ROWS) {
    double v[10] = {0, 0, 0, 0, 0, 0, 0, -1, 0, 0};
    int k = 0;
    char *p = line, *end;
    if (line[0] == '#' || line[0] == '\n' || strncmp(line, "sys", 3) == 0) continue;
    while (k < 10) {
      v[k] = strtod(p, &end);
      if (end == p) break;
      k++;
      p = end;
      if (*p == ',') p++;
    }
    if (k < 7) { fprintf(stderr, "skipping malformed row: %s", line); continue; }
    sisp_reading r = { v[0], v[1], v[2], v[3], v[4], v[5], v[6], k > 9 ? v[9] : 0,
                       k > 7 ? (int32_t)v[7] : SISP_PHQ2_NONE, k > 8 && v[8] != 0 };
    rows[n++] = r;
  }
  int y = 0, m = 0, d = 0;
  if (sscanf(start, "%d-%d-%d", &y, &m, &d) != 3) { fprintf(stderr, "bad start date %s\n", start); return 2; }
  const long long day0 = days_from_civil(y, m, d);

  sisp_store_crew c = { crew_id, crew_id, NULL, NULL, start, 0, NULL };
  if (sisp_store_upsert_crew(s, &c) != SISP_STORE_OK || sisp_store_begin(s) != SISP_STORE_OK) return 1;
  for (size_t i = 0; i < n; i++) {
    sisp_finding f[SISP_IND_COUNT];
    sisp_severity worst = SISP_N0_NOMINAL;
    if (sisp_assess(rows, n, i, f) == 0)
      for (int j = 0; j < SISP_IND_COUNT; j++) if (f[j].severity > worst) worst = f[j].severity;
    char day[48];
    const long long dn = day0 + (long long)i;
    civil_from_days(dn, day);
    sisp_store_checkin ci = { 0, crew_id, dn * 86400000LL + 43200000LL, day, rows[i], worst, "import" };
    if (sisp_store_insert_checkin(s, &ci, NULL) != SISP_STORE_OK) { sisp_store_rollback(s); return 1; }
  }
  if (sisp_store_commit(s) != SISP_STORE_OK) return 1;
  printf("imported %zu check-ins for %s\n", n, crew_id);
  return 0;
}

int main(int argc, char **argv) {
  if (argc < 3) {
    fprintf(stderr, "usage: %s DB {stats|check|export [CREW]|import CREW [YYYY-MM-DD] < checkins.csv}\n", argv[0]);
    return 2;
  }
  sisp_store *s = NULL;
  if (sisp_store_open(argv[1], &s) != SISP_STORE_OK) return 1;
  int rc = 0;
  const char *cmd = argv[2];
  if (strcmp(cmd, "stats") == 0) {
    static const char *const t[] = { "crew", "checkins", "pvt_results", "ppg_results", "radiation_doses", "solar_events", "reports" };
    printf("{\"sqlite\": \"%s\", \"schema_version\": %d, \"journal_mode\": \"%s\"", sisp_store_sqlite_version(),
           sisp_store_schema_version(s), sisp_store_journal_mode(s));
    for (size_t i = 0; i < sizeof t / sizeof *t; i++) printf(", \"%s\": %lld", t[i], (long long)sisp_store_count(s, t[i]));
    printf("}\n");
  } else if (strcmp(cmd, "check") == 0) {
    rc = sisp_store_integrity_check(s) == SISP_STORE_OK ? 0 : 1;
    puts(rc ? sisp_store_errmsg(s) : "ok");
  } else if (strcmp(cmd, "export") == 0) {
    rc = sisp_store_export_json(s, argc > 3 ? argv[3] : NULL, INT64_MIN, INT64_MAX, to_stdout, NULL) != SISP_STORE_OK;
    putchar('\n');
  } else if (strcmp(cmd, "import") == 0 && argc > 3) {
    rc = import_csv(s, argv[3], argc > 4 ? argv[4] : "2026-01-01");
  } else {
    fprintf(stderr, "unknown command %s\n", cmd);
    rc = 2;
  }
  if (rc == 1) fprintf(stderr, "sisp-store: %s\n", sisp_store_errmsg(s));
  sisp_store_close(s);
  return rc;
}
