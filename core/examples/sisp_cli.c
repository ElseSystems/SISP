/*
 * sisp-cli — command-line front end for libsisp.
 *
 *   sisp-cli assess  < checkins.csv      # sys,dia,hr,glucose,temp,sleep,mood[,phq2,self_harm,exercise_min]
 *   sisp-cli radiation <env> <mission_days> [prior_career_mSv]
 *   sisp-cli pvt <rt_ms> <rt_ms> ...
 *   sisp-cli version
 *
 * The last CSV row is assessed against the rows before it (personal baseline).
 */
#include "sisp.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_ROWS 366

static const char *const IND[] = {"blood_pressure", "heart_rate", "glucose", "temperature", "sleep", "mood"};
static const char *const REG[] = {"brain", "heart", "lungs", "metabolism", "musculoskeletal", "immune"};
static const char *const ENV[] = {"iss", "moon", "mars-transit", "mars"};

static const struct { uint32_t bit; const char *name; } REASONS[] = {
  {SISP_R_BP_CRISIS, "bp_crisis"}, {SISP_R_BP_STAGE2, "bp_stage2"}, {SISP_R_BP_STAGE1, "bp_stage1"},
  {SISP_R_BP_ELEVATED, "bp_elevated"}, {SISP_R_BP_DIA80, "bp_diastolic_80"}, {SISP_R_BP_LOW, "bp_low"},
  {SISP_R_HR_TACHY, "tachycardia"}, {SISP_R_HR_BRADY, "bradycardia"},
  {SISP_R_GLU_SEVERE_HYPO, "severe_hypoglycemia"}, {SISP_R_GLU_HYPO, "hypoglycemia"},
  {SISP_R_GLU_DIABETES, "fasting_126"}, {SISP_R_GLU_IMPAIRED, "impaired_fasting"},
  {SISP_R_TEMP_FEVER, "fever_38"}, {SISP_R_TEMP_DELTA_ALERT, "above_flight_baseline_1.2"},
  {SISP_R_TEMP_DELTA_ATTN, "above_flight_baseline_0.8"}, {SISP_R_TEMP_LOW, "temp_low"},
  {SISP_R_SLEEP_LT5, "sleep_lt5"}, {SISP_R_SLEEP_LT7, "sleep_lt7"}, {SISP_R_SLEEP_DEBT3, "sleep_debt_3_nights"},
  {SISP_R_MOOD_LOW, "low_mood"}, {SISP_R_MOOD_LOW3, "low_mood_3_days"}, {SISP_R_MOOD_PHQ2, "phq2_positive"},
  {SISP_R_MOOD_SELF_HARM, "self_harm"}, {SISP_R_Z_STRONG, "baseline_z3"}, {SISP_R_Z_OUTSIDE, "baseline_z2"},
};

static void print_reasons(uint32_t r) {
  size_t i;
  int first = 1;
  printf("[");
  for (i = 0; i < sizeof REASONS / sizeof REASONS[0]; i++)
    if (r & REASONS[i].bit) { printf("%s\"%s\"", first ? "" : ", ", REASONS[i].name); first = 0; }
  printf("]");
}

static int usage(void) {
  fputs("usage: sisp-cli assess < checkins.csv\n"
        "       sisp-cli radiation <iss|moon|mars-transit|mars> <mission_days> [prior_career_mSv]\n"
        "       sisp-cli pvt <rt_ms>...\n"
        "       sisp-cli version\n", stderr);
  return 2;
}

static int cmd_assess(void) {
  static sisp_reading rows[MAX_ROWS];
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
    rows[n].sys = v[0]; rows[n].dia = v[1]; rows[n].hr = v[2]; rows[n].glucose = v[3];
    rows[n].temp = v[4]; rows[n].sleep = v[5]; rows[n].mood = v[6];
    rows[n].phq2 = k > 7 ? (int32_t)v[7] : SISP_PHQ2_NONE;
    rows[n].self_harm = k > 8 && v[8] != 0;
    rows[n].exercise_min = k > 9 ? v[9] : 0;
    n++;
  }
  if (!n) { fputs("no check-ins on stdin\n", stderr); return 1; }
  {
    sisp_finding f[SISP_IND_COUNT];
    sisp_overall o;
    int i;
    sisp_assess(rows, n, n - 1, f);
    o = sisp_aggregate(f, SISP_N0_NOMINAL, SISP_N0_NOMINAL, SISP_N0_NOMINAL);
    printf("{\n  \"version\": \"%s\",\n  \"day\": %zu,\n  \"overall\": \"%s\",\n  \"findings\": {\n", sisp_version(), n, sisp_severity_name(o.overall));
    for (i = 0; i < SISP_IND_COUNT; i++) {
      printf("    \"%s\": {\"severity\": \"%s\", \"reasons\": ", IND[i], sisp_severity_name(f[i].severity));
      print_reasons(f[i].reasons);
      printf(", \"baseline_n\": %d", (int)f[i].baseline_n);
      if (f[i].baseline_n) printf(", \"baseline_mean\": %.2f, \"delta\": %.2f", f[i].baseline_mean, f[i].delta);
      if (f[i].z == f[i].z) printf(", \"z\": %.2f", f[i].z);
      printf("}%s\n", i + 1 < SISP_IND_COUNT ? "," : "");
    }
    printf("  },\n  \"regions\": {");
    for (i = 0; i < SISP_REG_COUNT; i++) printf("%s\"%s\": \"%s\"", i ? ", " : "", REG[i], sisp_severity_name(o.regions[i]));
    printf("}\n}\n");
    return o.overall >= SISP_N2_WARNING ? 3 : 0;
  }
}

static int cmd_radiation(int argc, char **argv) {
  int e;
  sisp_radiation_input in;
  sisp_radiation r;
  const sisp_environment_info *info = NULL;
  if (argc < 4) return usage();
  for (e = 0; e < SISP_ENV_COUNT; e++) if (!strcmp(argv[2], ENV[e])) info = sisp_environment_get((sisp_environment)e);
  if (!info) return usage();
  memset(&in, 0, sizeof in);
  in.mission_days = atof(argv[3]);
  in.dose_rate = info->dose_msv_per_day;
  in.prior_career_msv = argc > 4 ? atof(argv[4]) : 0;
  in.deep_space = info->deep_space;
  r = sisp_radiation_status(&in);
  printf("{\"environment\": \"%s\", \"mission_mSv\": %.1f, \"total_mSv\": %.1f, \"pct_of_limit\": %.1f, \"days_left\": %.0f, \"severity\": \"%s\"}\n",
         argv[2], r.mission_msv, r.total_msv, r.pct_of_limit, r.days_left, sisp_severity_name(r.severity));
  return 0;
}

static int cmd_pvt(int argc, char **argv) {
  static double rts[4096];
  size_t n = 0;
  int i;
  sisp_pvt_score s;
  for (i = 2; i < argc && n < 4096; i++) rts[n++] = atof(argv[i]);
  s = sisp_pvt_score_session(rts, n, 0);
  printf("{\"n\": %d, \"mean_ms\": %.0f, \"median_ms\": %.0f, \"lapses\": %d, \"speed\": %.1f}\n", (int)s.n, s.mean_ms, s.median_ms, (int)s.lapses, s.speed);
  return 0;
}

int main(int argc, char **argv) {
  if (argc < 2) return usage();
  if (!strcmp(argv[1], "assess")) return cmd_assess();
  if (!strcmp(argv[1], "radiation")) return cmd_radiation(argc, argv);
  if (!strcmp(argv[1], "pvt")) return cmd_pvt(argc, argv);
  if (!strcmp(argv[1], "version")) { puts(sisp_version()); return 0; }
  return usage();
}
