/* libsisp flat ABI. See include/sisp_flat.h. SPDX-License-Identifier: MIT */
#include "sisp_flat.h"

#include <math.h>

#define READING_FIELDS 10
#define ASSESS_WINDOW (SISP_BASELINE_DAYS + 1) /* the assessment never looks further back */
#define FATIGUE_WINDOW 7                       /* latest + 6 prior sessions */

static int as_count(double v, size_t *out) {
  if (!(v >= 0) || v != floor(v) || v > 1e9) return 0;
  *out = (size_t)v;
  return 1;
}

static long op_assess(const double *in, size_t n_in, double *out, size_t cap) {
  sisp_reading win[ASSESS_WINDOW];
  sisp_finding f[SISP_IND_COUNT];
  size_t count, idx, from, i, k;
  if (n_in < 2 || !as_count(in[0], &count) || !as_count(in[1], &idx)) return SISP_FLAT_EINVAL;
  if (idx >= count || n_in < 2 + count * READING_FIELDS) return SISP_FLAT_EINVAL;
  if (cap < SISP_IND_COUNT * 7) return SISP_FLAT_ESPACE;
  from = idx >= ASSESS_WINDOW - 1 ? idx - (ASSESS_WINDOW - 1) : 0;
  for (i = from; i <= idx; i++) {
    const double *r = in + 2 + i * READING_FIELDS;
    sisp_reading *w = &win[i - from];
    w->sys = r[0]; w->dia = r[1]; w->hr = r[2]; w->glucose = r[3]; w->temp = r[4];
    w->sleep = r[5]; w->mood = r[6]; w->exercise_min = r[7];
    w->phq2 = isnan(r[8]) ? SISP_PHQ2_NONE : (int32_t)r[8];
    w->self_harm = r[9] != 0;
  }
  if (sisp_assess(win, idx - from + 1, idx - from, f) != 0) return SISP_FLAT_EINVAL;
  for (k = 0; k < SISP_IND_COUNT; k++) {
    double *o = out + k * 7;
    o[0] = f[k].severity; o[1] = f[k].reasons; o[2] = f[k].z; o[3] = f[k].baseline_mean;
    o[4] = f[k].baseline_n; o[5] = f[k].delta; o[6] = f[k].avg3;
  }
  return SISP_IND_COUNT * 7;
}

static long op_radiation(const double *in, size_t n_in, double *out, size_t cap) {
  sisp_radiation_input ri;
  sisp_radiation r;
  if (n_in < 8) return SISP_FLAT_EINVAL;
  if (cap < 7) return SISP_FLAT_ESPACE;
  ri.mission_days = in[0]; ri.dose_rate = in[1]; ri.prior_career_msv = in[2];
  ri.logged_event_msv = in[3]; ri.live_event_msv = in[4];
  ri.solar_active = in[5] != 0; ri.sheltered = in[6] != 0; ri.deep_space = in[7] != 0;
  r = sisp_radiation_status(&ri);
  out[0] = r.mission_msv; out[1] = r.total_msv; out[2] = r.pct_of_limit; out[3] = r.days_left;
  out[4] = r.event_msv; out[5] = r.severity; out[6] = r.solar_reason;
  return 7;
}

static long op_sep(const double *in, size_t n_in, double *out, size_t cap) {
  sisp_sep_dose d;
  if (n_in < 6) return SISP_FLAT_EINVAL;
  if (cap < 5) return SISP_FLAT_ESPACE;
  d = sisp_sep_event_dose(in[0], in[1], in[2], in[3], in[4], in[5]);
  out[0] = d.dose_msv; out[1] = d.progress; out[2] = d.avoided_msv; out[3] = d.projected_unsheltered_msv; out[4] = d.done;
  return 5;
}

static long op_pvt(double *in, size_t n_in, double *out, size_t cap) {
  size_t n;
  sisp_pvt_score s;
  if (n_in < 2 || !as_count(in[1], &n) || n_in < 2 + n) return SISP_FLAT_EINVAL;
  if (cap < 6) return SISP_FLAT_ESPACE;
  s = sisp_pvt_score_session(in + 2, n, (int32_t)in[0]);
  out[0] = s.n; out[1] = s.mean_ms; out[2] = s.median_ms; out[3] = s.lapses; out[4] = s.false_starts; out[5] = s.speed;
  return 6;
}

static long op_fatigue(const double *in, size_t n_in, double *out, size_t cap) {
  sisp_pvt_session hist[FATIGUE_WINDOW];
  size_t nh, ns, from, i;
  const double *sleep;
  sisp_fatigue f;
  if (n_in < 1 || !as_count(in[0], &nh) || n_in < 2 + nh * 2) return SISP_FLAT_EINVAL;
  if (!as_count(in[1 + nh * 2], &ns) || n_in < 2 + nh * 2 + ns) return SISP_FLAT_EINVAL;
  if (cap < 7) return SISP_FLAT_ESPACE;
  from = nh > FATIGUE_WINDOW ? nh - FATIGUE_WINDOW : 0;
  for (i = from; i < nh; i++) { hist[i - from].median_ms = in[1 + i * 2]; hist[i - from].lapses = (int32_t)in[2 + i * 2]; }
  sleep = in + 2 + nh * 2;
  f = sisp_fatigue_status(hist, nh - from, sleep, ns);
  out[0] = f.baseline_ms; out[1] = f.slowing_pct; out[2] = f.sleep_avg3; out[3] = f.severity;
  out[4] = f.reasons; out[5] = f.latest_lapses; out[6] = f.has_latest;
  return 7;
}

static long op_bone(const double *in, size_t n_in, double *out, size_t cap) {
  size_t n;
  sisp_bone b;
  if (n_in < 2 || !as_count(in[1], &n) || n_in < 2 + n) return SISP_FLAT_EINVAL;
  if (cap < 5) return SISP_FLAT_ESPACE;
  b = sisp_bone_status(in[0], in + 2, n);
  out[0] = b.months; out[1] = b.adherence; out[2] = b.low_pct; out[3] = b.high_pct; out[4] = b.severity;
  return 5;
}

static sisp_severity as_sev(double v) { return v >= 3 ? SISP_N3_CRITICAL : v >= 2 ? SISP_N2_WARNING : v >= 1 ? SISP_N1_CAUTION : SISP_N0_NOMINAL; }

static long op_aggregate(const double *in, size_t n_in, double *out, size_t cap) {
  sisp_finding f[SISP_IND_COUNT];
  sisp_overall o;
  int k;
  if (n_in < 9) return SISP_FLAT_EINVAL;
  if (cap < 1 + SISP_REG_COUNT) return SISP_FLAT_ESPACE;
  for (k = 0; k < SISP_IND_COUNT; k++) f[k].severity = as_sev(in[k]);
  o = sisp_aggregate(f, as_sev(in[6]), as_sev(in[7]), as_sev(in[8]));
  out[0] = o.overall;
  for (k = 0; k < SISP_REG_COUNT; k++) out[1 + k] = o.regions[k];
  return 1 + SISP_REG_COUNT;
}

static long op_ppg(int op, const double *in, size_t n_in, double *out, size_t cap) {
  size_t n;
  double fs;
  if (n_in < 2 || !as_count(in[1], &n)) return SISP_FLAT_EINVAL;
  fs = in[0];
  if (op == SISP_OP_PPG_RESAMPLE) {
    size_t m;
    if (n_in < 2 + 2 * n) return SISP_FLAT_EINVAL;
    m = sisp_ppg_resample(in + 2, in + 2 + n, n, fs, out, cap);
    return m > cap ? SISP_FLAT_ESPACE : (long)m;
  }
  if (n_in < 2 + n) return SISP_FLAT_EINVAL;
  if (op == SISP_OP_PPG_FILTER) {
    if (cap < n) return SISP_FLAT_ESPACE;
    sisp_ppg_filter(in + 2, n, fs, out);
    return (long)n;
  }
  {
    sisp_ppg_estimate e = {0, 0};
    int ok;
    if (cap < 3) return SISP_FLAT_ESPACE;
    ok = sisp_ppg_estimate_bpm(in + 2, n, fs, &e);
    out[0] = ok; out[1] = ok ? e.bpm : 0; out[2] = ok ? e.quality : 0;
    return 3;
  }
}

long sisp_flat_call(int op, double *in, size_t n_in, double *out, size_t cap) {
  if (!in || !out) return SISP_FLAT_EINVAL;
  switch (op) {
    case SISP_OP_ASSESS: return op_assess(in, n_in, out, cap);
    case SISP_OP_RADIATION: return op_radiation(in, n_in, out, cap);
    case SISP_OP_SEP_DOSE: return op_sep(in, n_in, out, cap);
    case SISP_OP_PVT_SCORE: return op_pvt(in, n_in, out, cap);
    case SISP_OP_FATIGUE: return op_fatigue(in, n_in, out, cap);
    case SISP_OP_BONE: return op_bone(in, n_in, out, cap);
    case SISP_OP_AGGREGATE: return op_aggregate(in, n_in, out, cap);
    case SISP_OP_PPG_RESAMPLE:
    case SISP_OP_PPG_FILTER:
    case SISP_OP_PPG_ESTIMATE: return op_ppg(op, in, n_in, out, cap);
    default: return SISP_FLAT_EOP;
  }
}
