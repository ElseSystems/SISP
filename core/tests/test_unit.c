/* Unit tests for libsisp thresholds and edge cases (no framework, no allocation). */
#include "sisp.h"
#include "sisp_flat.h"

#include <math.h>
#include <stdio.h>
#include <string.h>

static int failures = 0, checks = 0;
#define CHECK(cond) do { checks++; if (!(cond)) { failures++; fprintf(stderr, "%s:%d: CHECK(%s) failed\n", __FILE__, __LINE__, #cond); } } while (0)
#define NEAR(a, b) CHECK(fabs((a) - (b)) < 1e-9)

static sisp_reading normal(void) {
  sisp_reading r;
  memset(&r, 0, sizeof r);
  r.sys = 112; r.dia = 72; r.hr = 64; r.glucose = 88; r.temp = 36.6; r.sleep = 7.4; r.mood = 4;
  r.exercise_min = 120; r.phq2 = SISP_PHQ2_NONE; r.self_harm = 0;
  return r;
}

static void test_absolute_limits(void) {
  sisp_reading r = normal();
  sisp_finding f[SISP_IND_COUNT];
  CHECK(sisp_assess(&r, 1, 0, f) == 0);
  for (int k = 0; k < SISP_IND_COUNT; k++) CHECK(f[k].severity == SISP_N0_NOMINAL);
  CHECK(f[SISP_IND_BP].baseline_n == 0 && isnan(f[SISP_IND_BP].baseline_mean));

  r.sys = 181; sisp_assess(&r, 1, 0, f);
  CHECK(f[SISP_IND_BP].severity == SISP_N3_CRITICAL && (f[SISP_IND_BP].reasons & SISP_R_BP_CRISIS));
  r.sys = 140; sisp_assess(&r, 1, 0, f); CHECK(f[SISP_IND_BP].severity == 2);
  r.sys = 125; sisp_assess(&r, 1, 0, f); CHECK(f[SISP_IND_BP].reasons == SISP_R_BP_ELEVATED);
  r.sys = 132; sisp_assess(&r, 1, 0, f); CHECK(f[SISP_IND_BP].reasons == SISP_R_BP_STAGE1);
  r.sys = 85; r.dia = 55; sisp_assess(&r, 1, 0, f); CHECK(f[SISP_IND_BP].severity == 1 && f[SISP_IND_BP].reasons == SISP_R_BP_LOW);
  r = normal(); r.hr = 101; sisp_assess(&r, 1, 0, f); CHECK(f[SISP_IND_HR].reasons == SISP_R_HR_TACHY);
  r = normal(); r.glucose = 53; sisp_assess(&r, 1, 0, f); CHECK(f[SISP_IND_GLUCOSE].severity == 3);
  r.glucose = 126; sisp_assess(&r, 1, 0, f); CHECK(f[SISP_IND_GLUCOSE].severity == 2 && f[SISP_IND_GLUCOSE].reasons == SISP_R_GLU_DIABETES);
  r = normal(); r.temp = 38.0; sisp_assess(&r, 1, 0, f); CHECK(f[SISP_IND_TEMP].severity == 2 && (f[SISP_IND_TEMP].reasons & SISP_R_TEMP_FEVER));
  r = normal(); r.sleep = 4.9; sisp_assess(&r, 1, 0, f); CHECK(f[SISP_IND_SLEEP].severity == 2); NEAR(f[SISP_IND_SLEEP].avg3, 4.9);
  r = normal(); r.phq2 = 3; sisp_assess(&r, 1, 0, f); CHECK(f[SISP_IND_MOOD].severity == 2 && f[SISP_IND_MOOD].reasons == SISP_R_MOOD_PHQ2);
  r.self_harm = 1; sisp_assess(&r, 1, 0, f); CHECK(f[SISP_IND_MOOD].severity == 3);
  CHECK(sisp_assess(&r, 1, 1, f) == -1);
  CHECK(sisp_assess(NULL, 1, 0, f) == -1);
}

static void test_space_fever_relative_to_baseline(void) {
  sisp_reading rs[15];
  sisp_finding f[SISP_IND_COUNT];
  for (int i = 0; i < 15; i++) { rs[i] = normal(); rs[i].temp = 36.4 + 0.1 * (i % 2); }
  rs[14].temp = 37.6; /* below 38 °C but +1.15 °C over the in-flight baseline */
  sisp_assess(rs, 15, 14, f);
  CHECK(!(f[SISP_IND_TEMP].reasons & SISP_R_TEMP_FEVER));
  CHECK(f[SISP_IND_TEMP].reasons & SISP_R_TEMP_DELTA_ATTN);
  CHECK(f[SISP_IND_TEMP].severity == SISP_N1_CAUTION);
  CHECK(f[SISP_IND_TEMP].baseline_n == 14);
  rs[14].temp = 37.7;
  sisp_assess(rs, 15, 14, f);
  CHECK(f[SISP_IND_TEMP].severity == SISP_N2_WARNING && (f[SISP_IND_TEMP].reasons & SISP_R_TEMP_DELTA_ALERT));
  /* z-score on heart rate vs personal baseline */
  rs[14] = normal(); rs[14].hr = 64 + 3 * 3; /* sd floored at 3 bpm → z = 3 */
  sisp_assess(rs, 15, 14, f);
  CHECK(f[SISP_IND_HR].reasons & SISP_R_Z_STRONG);
  NEAR(f[SISP_IND_HR].z, 3.0);
}

static void test_radiation_and_sep(void) {
  sisp_radiation_input in = {100, 1.84, 120, 0, 0, 0, 0, 1};
  sisp_radiation r = sisp_radiation_status(&in);
  NEAR(r.mission_msv, 184); NEAR(r.total_msv, 304); NEAR(r.pct_of_limit, 304.0 / 6.0);
  CHECK(r.severity == SISP_N1_CAUTION && r.solar_reason == SISP_SOLAR_NONE);
  in.solar_active = 1;
  r = sisp_radiation_status(&in); CHECK(r.severity == 3 && r.solar_reason == SISP_SOLAR_GO_TO_SHELTER);
  in.sheltered = 1;
  r = sisp_radiation_status(&in); CHECK(r.severity == 2 && r.solar_reason == SISP_SOLAR_IN_SHELTER);

  /* 90 s event, 50 mSv unsheltered; shelter at 30 s → 50/3 + 50·0.25·2/3 */
  sisp_sep_dose d = sisp_sep_event_dose(50, 1000, 31000, 90, 1000 + 90000, SISP_SHELTER_FACTOR);
  NEAR(d.dose_msv, 50.0 / 3 + 50 * 0.25 * 2 / 3); NEAR(d.avoided_msv, 50 * 2.0 / 3 * 0.75); CHECK(d.done);
  d = sisp_sep_event_dose(50, 1000, 0, 90, 1000 + 45000, SISP_SHELTER_FACTOR);
  NEAR(d.dose_msv, 25); NEAR(d.progress, 0.5); CHECK(!d.done);
  CHECK(sisp_environment_get(SISP_ENV_MARS_TRANSIT)->deep_space == 1);
  CHECK(sisp_environment_get(SISP_ENV_COUNT) == NULL);
}

static void test_pvt_and_fatigue(void) {
  double rts[] = {400, 250, 90, 260, 240, 360, 230};
  sisp_pvt_score s = sisp_pvt_score_session(rts, 7, 2);
  CHECK(s.n == 6 && s.lapses == 2 && s.false_starts == 2);
  NEAR(s.median_ms, 260); NEAR(s.mean_ms, 290);
  CHECK(rts[0] == 90); /* sorted in place */

  sisp_pvt_session h[] = {{240, 0}, {250, 1}, {245, 0}, {300, 4}};
  double sleep[] = {7, 5.5, 5.0, 5.2};
  sisp_fatigue f = sisp_fatigue_status(h, 4, sleep, 4);
  NEAR(f.baseline_ms, 245); NEAR(f.slowing_pct, 55.0 / 245 * 100); NEAR(f.sleep_avg3, 15.7 / 3);
  CHECK(f.severity == 2 && (f.reasons & SISP_FAT_SLOW20) && (f.reasons & SISP_FAT_LAPSES3) && (f.reasons & SISP_FAT_SHORT_SLEEP));
  f = sisp_fatigue_status(h, 2, sleep, 0);
  CHECK(isnan(f.baseline_ms) && f.slowing_pct == 0 && f.severity == 0);
}

static void test_bone_and_aggregate(void) {
  double ex[14];
  for (int i = 0; i < 14; i++) ex[i] = 120;
  sisp_bone b = sisp_bone_status(304.4, ex, 14);
  NEAR(b.months, 10); NEAR(b.adherence, 1); NEAR(b.high_pct, 6); CHECK(b.severity == 2);

  sisp_finding f[SISP_IND_COUNT];
  memset(f, 0, sizeof f);
  f[SISP_IND_TEMP].severity = SISP_N1_CAUTION;
  sisp_overall o = sisp_aggregate(f, SISP_N3_CRITICAL, SISP_N0_NOMINAL, SISP_N2_WARNING);
  CHECK(o.overall == 3);
  CHECK(o.regions[SISP_REG_IMMUNE] == 2); /* radiation capped at N2 on body regions */
  CHECK(o.regions[SISP_REG_BRAIN] == 2 && o.regions[SISP_REG_HEART] == 0);
}

static void test_bands_and_ppg(void) {
  const sisp_band *bands;
  CHECK(sisp_reference_bands(SISP_IND_GLUCOSE, &bands) == 5 && bands[0].severity == 3);
  CHECK(sisp_band_severity(SISP_IND_SLEEP, 6.5) == 1);
  CHECK(sisp_band_severity(SISP_IND_TEMP, 45) == 2);

  static double t[600], v[600], x[600], y[600];
  for (int i = 0; i < 600; i++) {
    t[i] = i * 1000.0 / 30;
    v[i] = 180 - 6 * sin(2 * 3.14159265358979 * (72.0 / 60) * t[i] / 1000);
  }
  size_t m = sisp_ppg_resample(t, v, 600, 30, x, 600);
  CHECK(m == 599);
  sisp_ppg_filter(x, m, 30, y);
  sisp_ppg_estimate e;
  CHECK(sisp_ppg_estimate_bpm(y, m, 30, &e) == 1);
  CHECK(fabs(e.bpm - 72) <= 1 && e.quality > 0.8);
  CHECK(sisp_ppg_estimate_bpm(y, 100, 30, &e) == 0); /* < 5 s */
  CHECK(sisp_ppg_finger_on(200, 40, 30) && !sisp_ppg_finger_on(120, 110, 100));
}

static void test_flat_errors(void) {
  double in[4] = {0}, out[8];
  CHECK(sisp_flat_call(99, in, 4, out, 8) == SISP_FLAT_EOP);
  CHECK(sisp_flat_call(SISP_OP_RADIATION, in, 4, out, 8) == SISP_FLAT_EINVAL);
  in[0] = 1; in[1] = 0;
  CHECK(sisp_flat_call(SISP_OP_ASSESS, in, 2, out, 8) == SISP_FLAT_EINVAL);
  CHECK(strcmp(sisp_version(), SISP_VERSION) == 0);
  CHECK(strcmp(sisp_severity_name(SISP_N2_WARNING), "N2") == 0);
}

int main(void) {
  test_absolute_limits();
  test_space_fever_relative_to_baseline();
  test_radiation_and_sep();
  test_pvt_and_fatigue();
  test_bone_and_aggregate();
  test_bands_and_ppg();
  test_flat_errors();
  printf("%d/%d checks passed\n", checks - failures, checks);
  return failures ? 1 : 0;
}
