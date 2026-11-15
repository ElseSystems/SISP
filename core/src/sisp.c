/*
 * libsisp — assessment core. See include/sisp.h.
 * Mirrors src/core/reference.ts line by line; both are checked against
 * core/tests/fixtures/parity.txt so the C, WASM and TypeScript builds agree.
 *
 * SPDX-License-Identifier: MIT
 */
#include "sisp.h"

#include <math.h>

/* JavaScript Math.round semantics (half rounds toward +inf). */
static double js_round(double x) { return floor(x + 0.5); }
static double dmin(double a, double b) { return a < b ? a : b; }
static double dmax(double a, double b) { return a > b ? a : b; }
static size_t zmax(size_t a, size_t b) { return a > b ? a : b; }

const char *sisp_version(void) { return SISP_VERSION; }

const char *sisp_severity_name(sisp_severity s) {
  static const char *const names[] = {"N0", "N1", "N2", "N3"};
  return (s >= SISP_N0_NOMINAL && s <= SISP_N3_CRITICAL) ? names[s] : "N?";
}

/* ── reference bands (NHLBI, AHA, ADA, CDC, AASM) ───────────────────────── */
static const sisp_band BANDS_BP[] = {{0, 90, 1}, {90, 120, 0}, {120, 140, 1}, {140, 180, 2}, {180, 240, 3}};
static const sisp_band BANDS_HR[] = {{30, 60, 1}, {60, 100, 0}, {100, 180, 1}};
static const sisp_band BANDS_GLU[] = {{20, 54, 3}, {54, 70, 2}, {70, 100, 0}, {100, 126, 1}, {126, 300, 2}};
static const sisp_band BANDS_TEMP[] = {{34, 36, 1}, {36, 38, 0}, {38, 42, 2}};
static const sisp_band BANDS_SLEEP[] = {{0, 5, 2}, {5, 7, 1}, {7, 12, 0}};
static const sisp_band BANDS_MOOD[] = {{1, 2.5, 1}, {2.5, 5, 0}};

#define COUNT_OF(a) (sizeof(a) / sizeof((a)[0]))

size_t sisp_reference_bands(sisp_indicator ind, const sisp_band **out) {
  const sisp_band *b = NULL;
  size_t n = 0;
  switch (ind) {
    case SISP_IND_BP: b = BANDS_BP; n = COUNT_OF(BANDS_BP); break;
    case SISP_IND_HR: b = BANDS_HR; n = COUNT_OF(BANDS_HR); break;
    case SISP_IND_GLUCOSE: b = BANDS_GLU; n = COUNT_OF(BANDS_GLU); break;
    case SISP_IND_TEMP: b = BANDS_TEMP; n = COUNT_OF(BANDS_TEMP); break;
    case SISP_IND_SLEEP: b = BANDS_SLEEP; n = COUNT_OF(BANDS_SLEEP); break;
    case SISP_IND_MOOD: b = BANDS_MOOD; n = COUNT_OF(BANDS_MOOD); break;
    default: break;
  }
  if (out) *out = b;
  return n;
}

sisp_severity sisp_band_severity(sisp_indicator ind, double value) {
  const sisp_band *b;
  size_t n = sisp_reference_bands(ind, &b), i;
  if (!n || isnan(value)) return SISP_N0_NOMINAL;
  if (value < b[0].from) return b[0].severity;
  for (i = 0; i < n; i++)
    if (value >= b[i].from && value < b[i].to) return b[i].severity;
  return b[n - 1].severity;
}

/* ── environments ───────────────────────────────────────────────────────── */
static const sisp_environment_info ENVS[SISP_ENV_COUNT] = {
  {0.35, 1.0, 0},   /* ISS: magnetosphere protects */
  {1.369, 40.0, 1}, /* Moon surface (Chang'e-4) */
  {1.84, 50.0, 1},  /* deep-space cruise (MSL RAD) */
  {0.64, 1.5, 0},   /* Mars surface (Curiosity RAD), atmosphere attenuates */
};

const sisp_environment_info *sisp_environment_get(sisp_environment env) {
  return (env >= 0 && env < SISP_ENV_COUNT) ? &ENVS[env] : NULL;
}

/* ── baseline ───────────────────────────────────────────────────────────── */
static double field_of(const sisp_reading *r, sisp_field f) {
  switch (f) {
    case SISP_F_SYS: return r->sys;
    case SISP_F_DIA: return r->dia;
    case SISP_F_HR: return r->hr;
    case SISP_F_GLUCOSE: return r->glucose;
    case SISP_F_TEMP: return r->temp;
    case SISP_F_SLEEP: return r->sleep;
    case SISP_F_MOOD: return r->mood;
  }
  return NAN;
}

static double sd_floor(sisp_field f) {
  static const double floors[] = {4, 3, 3, 4, 0.15, 0.4, 0.5};
  return (f >= SISP_F_SYS && f <= SISP_F_MOOD) ? floors[f] : 1.0;
}

sisp_baseline sisp_baseline_of(const sisp_reading *readings, size_t count, size_t idx, sisp_field field) {
  sisp_baseline b;
  size_t upto = idx < count ? idx : count;
  size_t from = upto > SISP_BASELINE_DAYS ? upto - SISP_BASELINE_DAYS : 0, i;
  double sum = 0, ss = 0, mean, sd;
  int n = 0;
  for (i = from; i < upto; i++) {
    double v = field_of(&readings[i], field);
    if (!isnan(v)) { sum += v; n++; }
  }
  if (!n) { b.mean = NAN; b.sd = sd_floor(field); b.n = 0; return b; }
  mean = sum / n;
  for (i = from; i < upto; i++) {
    double v = field_of(&readings[i], field);
    if (!isnan(v)) ss += (v - mean) * (v - mean);
  }
  sd = sqrt(ss / (n - 1 > 1 ? n - 1 : 1));
  b.mean = mean;
  b.sd = dmax(sd, sd_floor(field));
  b.n = n;
  return b;
}

static sisp_severity z_severity(double value, sisp_baseline b, double *z_out, uint32_t *reasons) {
  double z;
  if (b.n < SISP_BASELINE_MIN_N) return SISP_N0_NOMINAL;
  z = (value - b.mean) / b.sd;
  *z_out = z;
  if (fabs(z) >= SISP_Z_ALERT) { *reasons |= SISP_R_Z_STRONG; return SISP_N2_WARNING; }
  if (fabs(z) >= SISP_Z_ATTENTION) { *reasons |= SISP_R_Z_OUTSIDE; return SISP_N1_CAUTION; }
  return SISP_N0_NOMINAL;
}

static void finding_init(sisp_finding *f) {
  f->severity = SISP_N0_NOMINAL;
  f->reasons = 0;
  f->z = NAN;
  f->baseline_mean = NAN;
  f->baseline_n = 0;
  f->delta = 0;
  f->avg3 = NAN;
}

static void set_baseline(sisp_finding *f, sisp_baseline b, double value) {
  f->baseline_mean = b.mean;
  f->baseline_n = b.n;
  f->delta = b.n ? value - b.mean : 0;
}

#define RAISE(f, s) ((f)->severity = sisp_max_severity((f)->severity, (s)))

int sisp_assess(const sisp_reading *readings, size_t count, size_t idx, sisp_finding out[SISP_IND_COUNT]) {
  const sisp_reading *r;
  size_t i, from3;
  int k;
  if (!readings || !out || idx >= count) return -1;
  r = &readings[idx];
  for (k = 0; k < SISP_IND_COUNT; k++) finding_init(&out[k]);
  from3 = idx >= 2 ? idx - 2 : 0;

  { /* blood pressure (AHA / NHLBI) */
    sisp_finding *f = &out[SISP_IND_BP];
    sisp_baseline b;
    if (r->sys > 180 || r->dia > 120) { f->severity = 3; f->reasons |= SISP_R_BP_CRISIS; }
    else if (r->sys >= 140 || r->dia >= 90) { f->severity = 2; f->reasons |= SISP_R_BP_STAGE2; }
    else if (r->sys >= 120) { f->severity = 1; f->reasons |= (r->sys >= 130 || r->dia >= 80) ? SISP_R_BP_STAGE1 : SISP_R_BP_ELEVATED; }
    else if (r->dia >= 80) { f->severity = 1; f->reasons |= SISP_R_BP_DIA80; }
    if (r->sys < 90 || r->dia < 60) { RAISE(f, 1); f->reasons |= SISP_R_BP_LOW; }
    b = sisp_baseline_of(readings, count, idx, SISP_F_SYS);
    RAISE(f, z_severity(r->sys, b, &f->z, &f->reasons));
    set_baseline(f, b, r->sys);
  }
  { /* heart rate (AHA 60–100) */
    sisp_finding *f = &out[SISP_IND_HR];
    sisp_baseline b;
    if (r->hr > 100) { f->severity = 1; f->reasons |= SISP_R_HR_TACHY; }
    if (r->hr < 60) { f->severity = 1; f->reasons |= SISP_R_HR_BRADY; }
    b = sisp_baseline_of(readings, count, idx, SISP_F_HR);
    RAISE(f, z_severity(r->hr, b, &f->z, &f->reasons));
    set_baseline(f, b, r->hr);
  }
  { /* fasting glucose (ADA) */
    sisp_finding *f = &out[SISP_IND_GLUCOSE];
    sisp_baseline b;
    if (r->glucose < 54) { f->severity = 3; f->reasons |= SISP_R_GLU_SEVERE_HYPO; }
    else if (r->glucose < 70) { f->severity = 2; f->reasons |= SISP_R_GLU_HYPO; }
    else if (r->glucose >= 126) { f->severity = 2; f->reasons |= SISP_R_GLU_DIABETES; }
    else if (r->glucose >= 100) { f->severity = 1; f->reasons |= SISP_R_GLU_IMPAIRED; }
    b = sisp_baseline_of(readings, count, idx, SISP_F_GLUCOSE);
    RAISE(f, z_severity(r->glucose, b, &f->z, &f->reasons));
    set_baseline(f, b, r->glucose);
  }
  { /* temperature: absolute (CDC >=38) + relative to the in-flight baseline (Stahn 2017) */
    sisp_finding *f = &out[SISP_IND_TEMP];
    sisp_baseline b = sisp_baseline_of(readings, count, idx, SISP_F_TEMP);
    double delta = b.n ? r->temp - b.mean : 0;
    if (r->temp >= 38) { f->severity = 2; f->reasons |= SISP_R_TEMP_FEVER; }
    if (b.n >= SISP_BASELINE_MIN_N && delta >= SISP_TEMP_DELTA_ALERT) { RAISE(f, 2); f->reasons |= SISP_R_TEMP_DELTA_ALERT; }
    else if (b.n >= SISP_BASELINE_MIN_N && delta >= SISP_TEMP_DELTA_ATTENTION) { RAISE(f, 1); f->reasons |= SISP_R_TEMP_DELTA_ATTN; }
    if (r->temp < 36) { RAISE(f, 1); f->reasons |= SISP_R_TEMP_LOW; }
    set_baseline(f, b, r->temp);
  }
  { /* sleep (AASM >=7 h) + 3-night average */
    sisp_finding *f = &out[SISP_IND_SLEEP];
    sisp_baseline b;
    double sum = 0;
    size_t n3 = idx + 1 - from3;
    for (i = from3; i <= idx; i++) sum += readings[i].sleep;
    f->avg3 = sum / (double)n3;
    if (r->sleep < 5) { f->severity = 2; f->reasons |= SISP_R_SLEEP_LT5; }
    else if (r->sleep < 7) { f->severity = 1; f->reasons |= SISP_R_SLEEP_LT7; }
    if (n3 == 3 && f->avg3 < 5.5) { RAISE(f, 2); f->reasons |= SISP_R_SLEEP_DEBT3; }
    b = sisp_baseline_of(readings, count, idx, SISP_F_SLEEP);
    RAISE(f, z_severity(r->sleep, b, &f->z, &f->reasons));
    set_baseline(f, b, r->sleep);
  }
  { /* mood (1–5) + PHQ-2 (Kroenke 2003) */
    sisp_finding *f = &out[SISP_IND_MOOD];
    int low = 0;
    if (r->mood <= 2) { f->severity = 1; f->reasons |= SISP_R_MOOD_LOW; }
    for (i = from3; i <= idx; i++) low += readings[i].mood <= 2;
    if (low >= 3) { RAISE(f, 2); f->reasons |= SISP_R_MOOD_LOW3; }
    if (r->phq2 >= 3) { RAISE(f, 2); f->reasons |= SISP_R_MOOD_PHQ2; }
    if (r->self_harm) { f->severity = 3; f->reasons |= SISP_R_MOOD_SELF_HARM; }
  }
  return 0;
}

/* ── radiation ──────────────────────────────────────────────────────────── */
sisp_radiation sisp_radiation_status(const sisp_radiation_input *in) {
  sisp_radiation o;
  double days = dmax(0, in->mission_days);
  o.event_msv = in->logged_event_msv + in->live_event_msv;
  o.mission_msv = days * in->dose_rate + o.event_msv;
  o.total_msv = in->prior_career_msv + o.mission_msv;
  o.pct_of_limit = (o.total_msv / SISP_CAREER_LIMIT_MSV) * 100;
  /* % of the career limit thresholds = prototype heuristic */
  o.severity = o.pct_of_limit >= 100 ? 3 : o.pct_of_limit >= 80 ? 2 : o.pct_of_limit >= 50 ? 1 : 0;
  o.solar_reason = SISP_SOLAR_NONE;
  if (in->solar_active) {
    sisp_severity ev = in->sheltered ? (in->deep_space ? 2 : 1) : (in->deep_space ? 3 : 2);
    o.severity = sisp_max_severity(o.severity, ev);
    o.solar_reason = in->sheltered ? SISP_SOLAR_IN_SHELTER : SISP_SOLAR_GO_TO_SHELTER;
  }
  o.days_left = dmax(0, (SISP_CAREER_LIMIT_MSV - o.total_msv) / in->dose_rate);
  return o;
}

sisp_sep_dose sisp_sep_event_dose(double full, double started_at, double sheltered_at, double duration_sec,
                                  double now, double factor) {
  sisp_sep_dose o;
  double dur = duration_sec * 1000;
  double end = dmin(now, started_at + dur);
  double shelter_at = sheltered_at > 0 ? dmin(sheltered_at, end) : end;
  double unsheltered = dmax(0, shelter_at - started_at);
  double sheltered = dmax(0, end - shelter_at);
  o.dose_msv = full * (unsheltered / dur) + full * factor * (sheltered / dur);
  o.progress = dmin(1, (now - started_at) / dur);
  o.avoided_msv = full * (sheltered / dur) * (1 - factor);
  o.projected_unsheltered_msv = full;
  o.done = o.progress >= 1;
  return o;
}

/* ── PVT ────────────────────────────────────────────────────────────────── */
static void sort_doubles(double *a, size_t n) { /* Shell sort: in place, no allocation */
  static const size_t gaps[] = {701, 301, 132, 57, 23, 10, 4, 1};
  size_t g, i, j;
  for (g = 0; g < COUNT_OF(gaps); g++) {
    size_t gap = gaps[g];
    for (i = gap; i < n; i++) {
      double t = a[i];
      for (j = i; j >= gap && a[j - gap] > t; j -= gap) a[j] = a[j - gap];
      a[j] = t;
    }
  }
}

sisp_pvt_score sisp_pvt_score_session(double *rts, size_t n, int32_t false_starts) {
  sisp_pvt_score s;
  size_t first = 0, i, nv;
  double sum = 0, speed = 0;
  s.n = 0; s.mean_ms = 0; s.median_ms = 0; s.lapses = 0; s.false_starts = false_starts; s.speed = 0;
  if (!rts || !n) return s;
  sort_doubles(rts, n);
  while (first < n && !(rts[first] >= SISP_PVT_MIN_VALID_MS)) first++;
  nv = n - first;
  if (!nv) return s;
  for (i = first; i < n; i++) {
    sum += rts[i];
    if (rts[i] >= SISP_PVT_LAPSE_MS) s.lapses++;
  }
  for (i = first; i < n; i++) speed += 1000 / rts[i];
  s.n = (int32_t)nv;
  s.mean_ms = js_round(sum / (double)nv);
  s.median_ms = js_round(rts[first + nv / 2]);
  s.speed = js_round((speed / (double)nv) * 10) / 10;
  return s;
}

sisp_fatigue sisp_fatigue_status(const sisp_pvt_session *hist, size_t n_hist, const double *sleep, size_t n_sleep) {
  sisp_fatigue f;
  size_t i, n_prior = n_hist ? n_hist - 1 : 0, p_from, s_from;
  f.baseline_ms = NAN; f.slowing_pct = 0; f.sleep_avg3 = NAN;
  f.severity = 0; f.reasons = 0; f.latest_lapses = 0; f.has_latest = n_hist > 0;
  p_from = n_prior > 6 ? n_prior - 6 : 0;
  if (n_prior - p_from >= 3) {
    double s = 0;
    for (i = p_from; i < n_prior; i++) s += hist[i].median_ms;
    f.baseline_ms = s / (double)(n_prior - p_from);
  }
  if (n_sleep) {
    double s = 0;
    s_from = n_sleep > 3 ? n_sleep - 3 : 0;
    for (i = s_from; i < n_sleep; i++) s += sleep[i];
    f.sleep_avg3 = s / (double)(n_sleep - s_from);
  }
  if (!n_hist) return f;
  {
    const sisp_pvt_session *latest = &hist[n_hist - 1];
    f.latest_lapses = latest->lapses;
    if (!isnan(f.baseline_ms)) f.slowing_pct = ((latest->median_ms - f.baseline_ms) / f.baseline_ms) * 100;
    if (latest->lapses >= 5) { f.severity = 2; f.reasons |= SISP_FAT_LAPSES5; }
    else if (latest->lapses >= 3) { f.severity = 1; f.reasons |= SISP_FAT_LAPSES3; }
    if (f.slowing_pct >= 20) { f.severity = sisp_max_severity(f.severity, 2); f.reasons |= SISP_FAT_SLOW20; }
    else if (f.slowing_pct >= 10) { f.severity = sisp_max_severity(f.severity, 1); f.reasons |= SISP_FAT_SLOW10; }
    if (f.severity >= 1 && f.sleep_avg3 < 6) { f.severity = sisp_max_severity(f.severity, 2); f.reasons |= SISP_FAT_SHORT_SLEEP; }
  }
  return f;
}

/* ── bone ───────────────────────────────────────────────────────────────── */
sisp_bone sisp_bone_status(double mission_days, const double *ex, size_t n) {
  sisp_bone b;
  size_t from = n > 14 ? n - 14 : 0, i;
  double sum = 0, factor;
  double days = dmax(0, mission_days);
  for (i = from; i < n; i++) sum += ex[i];
  b.months = days / 30.44;
  b.adherence = dmin(1, (sum / (double)zmax(1, n - from)) / 120);
  /* no countermeasure: 1–1.5 %/month (NASA HRP); resistive exercise factor = prototype heuristic */
  factor = 1 - 0.6 * b.adherence;
  b.low_pct = b.months * 1.0 * factor;
  b.high_pct = b.months * 1.5 * factor;
  b.severity = b.high_pct >= 5 ? 2 : b.high_pct >= 3 ? 1 : 0;
  return b;
}

/* ── aggregation ────────────────────────────────────────────────────────── */
sisp_overall sisp_aggregate(const sisp_finding f[SISP_IND_COUNT], sisp_severity rad, sisp_severity bone, sisp_severity fat) {
  sisp_overall o;
  sisp_severity rad2 = rad < 2 ? rad : 2;
  int k;
  o.regions[SISP_REG_BRAIN] = sisp_max_severity(sisp_max_severity(sisp_max_severity(f[SISP_IND_SLEEP].severity, f[SISP_IND_MOOD].severity),
                                                                   sisp_max_severity(f[SISP_IND_TEMP].severity, rad2)), fat);
  o.regions[SISP_REG_HEART] = sisp_max_severity(f[SISP_IND_BP].severity, f[SISP_IND_HR].severity);
  o.regions[SISP_REG_LUNGS] = f[SISP_IND_HR].severity;
  o.regions[SISP_REG_METABOLISM] = f[SISP_IND_GLUCOSE].severity;
  o.regions[SISP_REG_MUSCULOSKELETAL] = bone;
  o.regions[SISP_REG_IMMUNE] = sisp_max_severity(f[SISP_IND_TEMP].severity, rad2);
  o.overall = sisp_max_severity(sisp_max_severity(rad, bone), fat);
  for (k = 0; k < SISP_IND_COUNT; k++) o.overall = sisp_max_severity(o.overall, f[k].severity);
  return o;
}

/* ── PPG ────────────────────────────────────────────────────────────────── */
size_t sisp_ppg_resample(const double *t, const double *v, size_t n, double fs, double *out, size_t cap) {
  size_t i, j = 0, m;
  double t0, t1, span;
  if (n < 2 || !(fs > 0)) return 0;
  t0 = t[0]; t1 = t[n - 1];
  span = floor(((t1 - t0) / 1000) * fs);
  if (!(span > 0)) return 0;
  m = (size_t)span;
  for (i = 0; i < m && i < cap; i++) {
    double ti = t0 + ((double)i * 1000.0) / fs, k;
    while (j < n - 2 && t[j + 1] < ti) j++;
    k = t[j + 1] == t[j] ? 0 : (ti - t[j]) / (t[j + 1] - t[j]);
    out[i] = v[j] + (v[j + 1] - v[j]) * k;
  }
  return m;
}

void sisp_ppg_filter(const double *x, size_t n, double fs, double *out) {
  size_t w = (size_t)js_round(fs * 1.5), i;
  double s = 0, s2 = 0, ring[5];
  if (!n) return;
  if (w < 1) w = 1;
  /* high-pass: subtract the ~1.5 s moving average (trailing window, like the TS reference) */
  for (i = 0; i < n; i++) {
    s += x[i];
    if (i >= w) s -= x[i - w];
    out[i] = x[i] - s / (double)(i + 1 < w ? i + 1 : w);
  }
  /* low-pass: 5-sample moving average, in place with a ring buffer */
  for (i = 0; i < n; i++) {
    double hp = out[i];
    s2 += hp;
    if (i >= 5) s2 -= ring[i % 5];
    ring[i % 5] = hp;
    out[i] = s2 / (double)(i + 1 < 5 ? i + 1 : 5);
  }
}

int sisp_ppg_estimate_bpm(const double *x, size_t n, double fs, sisp_ppg_estimate *out) {
  double ac[SISP_PPG_MAX_LAG + 2];
  double mean = 0, e = 0, best = -1, a, b, c, den, shift, lag_f;
  size_t i, lag, min_lag, max_lag, best_lag = 0, half;
  if (!x || !out || !(fs > 0) || (double)n < fs * 5) return 0;
  min_lag = (size_t)js_round((fs * 60) / 180);
  max_lag = (size_t)js_round((fs * 60) / 40);
  if (max_lag > SISP_PPG_MAX_LAG || min_lag < 1 || max_lag >= n) return 0;
  for (i = 0; i < n; i++) mean += x[i];
  mean /= (double)n;
  for (i = 0; i < n; i++) e += (x[i] - mean) * (x[i] - mean);
  if (e == 0) return 0;
  for (lag = min_lag; lag <= max_lag; lag++) {
    double s = 0, r;
    for (i = 0; i + lag < n; i++) s += (x[i] - mean) * (x[i + lag] - mean);
    r = s / e * ((double)n / (double)(n - lag));
    ac[lag] = r;
    if (r > best) { best = r; best_lag = lag; }
  }
  if (!best_lag) return 0;
  /* prefer the fundamental: if half the lag is also strongly periodic, take it */
  half = (size_t)js_round((double)best_lag / 2.0);
  if (half >= min_lag && ac[half] > 0.8 * best) best_lag = half;
  /* parabolic interpolation for sub-sample precision */
  b = ac[best_lag];
  a = best_lag - 1 >= min_lag ? ac[best_lag - 1] : b;
  c = best_lag + 1 <= max_lag ? ac[best_lag + 1] : b;
  den = a - 2 * b + c;
  shift = den != 0 ? (0.5 * (a - c)) / den : 0;
  lag_f = (double)best_lag + dmax(-0.5, dmin(0.5, shift));
  out->bpm = js_round((60 * fs) / lag_f);
  out->quality = dmax(0, dmin(1, best));
  return 1;
}

int sisp_ppg_finger_on(double r, double g, double b) { return r > 60 && r > 1.6 * g && r > 1.6 * b; }
