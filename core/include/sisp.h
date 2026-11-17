/*
 * libsisp — SISP (Health & Prevention System) assessment core.
 *
 * Portable C11, no dependencies beyond <math.h>, no dynamic allocation.
 * Every function is pure (no globals, no I/O) and thread-safe.
 *
 * WARNING: prototype heuristics for an educational NASA Space Apps project.
 * NOT a medical device and NOT a NASA protocol. Ranges come from published
 * terrestrial guidelines (AHA, NHLBI, ADA, CDC, AASM, PHQ-2) and public NASA
 * material; baseline-deviation thresholds are prototype design parameters.
 *
 * SPDX-License-Identifier: LicenseRef-Proprietary
 */
#ifndef SISP_H
#define SISP_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#if defined(_WIN32) && defined(SISP_SHARED)
#  ifdef SISP_BUILDING
#    define SISP_API __declspec(dllexport)
#  else
#    define SISP_API __declspec(dllimport)
#  endif
#elif defined(__GNUC__) || defined(__clang__)
#  define SISP_API __attribute__((visibility("default")))
#else
#  define SISP_API
#endif

#define SISP_VERSION_MAJOR 1
#define SISP_VERSION_MINOR 0
#define SISP_VERSION_PATCH 0
#define SISP_VERSION "1.0.0"

/* ── Severity scale (N0–N3) ─────────────────────────────────────────────── */
typedef enum sisp_severity {
  SISP_N0_NOMINAL = 0,
  SISP_N1_CAUTION = 1,
  SISP_N2_WARNING = 2,
  SISP_N3_CRITICAL = 3
} sisp_severity;

/* ── The 6 self-check indicators ────────────────────────────────────────── */
typedef enum sisp_indicator {
  SISP_IND_BP = 0,      /* blood pressure, mmHg (bands on systolic) */
  SISP_IND_HR = 1,      /* resting heart rate, bpm */
  SISP_IND_GLUCOSE = 2, /* fasting glucose, mg/dL */
  SISP_IND_TEMP = 3,    /* body temperature, °C */
  SISP_IND_SLEEP = 4,   /* sleep last night, h */
  SISP_IND_MOOD = 5,    /* mood 1–5 (+ optional PHQ-2) */
  SISP_IND_COUNT = 6
} sisp_indicator;

/* ── Body regions shown on the 3D/2D body map ───────────────────────────── */
typedef enum sisp_region {
  SISP_REG_BRAIN = 0,
  SISP_REG_HEART = 1,
  SISP_REG_LUNGS = 2,
  SISP_REG_METABOLISM = 3,
  SISP_REG_MUSCULOSKELETAL = 4,
  SISP_REG_IMMUNE = 5,
  SISP_REG_COUNT = 6
} sisp_region;

/* ── Mission environments ───────────────────────────────────────────────── */
typedef enum sisp_environment {
  SISP_ENV_ISS = 0,
  SISP_ENV_MOON_BASE = 1,
  SISP_ENV_MARS_TRANSIT = 2,
  SISP_ENV_MARS_BASE = 3,
  SISP_ENV_COUNT = 4
} sisp_environment;

typedef struct sisp_environment_info {
  double dose_msv_per_day;      /* background dose rate */
  double sep_dose_unsheltered;  /* extra dose of a large SEP, unsheltered (prototype value) */
  int deep_space;               /* 1 = no magnetosphere (SEP is critical) */
} sisp_environment_info;

/* ── Prototype constants ────────────────────────────────────────────────── */
#define SISP_BASELINE_DAYS 14
#define SISP_BASELINE_MIN_N 5
#define SISP_Z_ATTENTION 2.0
#define SISP_Z_ALERT 3.0
#define SISP_TEMP_DELTA_ATTENTION 0.8
#define SISP_TEMP_DELTA_ALERT 1.2
#define SISP_CAREER_LIMIT_MSV 600.0 /* NASA-STD-3001 */
#define SISP_SHELTER_FACTOR 0.25    /* dose multiplier inside the storm shelter (prototype) */
#define SISP_PVT_LAPSE_MS 355.0     /* PVT-B lapse threshold (Basner 2011) */
#define SISP_PVT_MIN_VALID_MS 100.0 /* faster = false start */
#define SISP_PPG_FS 30.0            /* default PPG resampling rate, Hz */
#define SISP_PPG_MAX_LAG 1024       /* supports fs up to ~680 Hz */
#define SISP_PHQ2_NONE (-1)

/* ── Input: one daily check-in ──────────────────────────────────────────── */
typedef struct sisp_reading {
  double sys, dia;      /* mmHg */
  double hr;            /* bpm */
  double glucose;       /* mg/dL */
  double temp;          /* °C */
  double sleep;         /* h */
  double mood;          /* 1–5 */
  double exercise_min;  /* resistive exercise, minutes (0 if unknown) */
  int32_t phq2;         /* 0–6, or SISP_PHQ2_NONE */
  int32_t self_harm;    /* 1 = reported thoughts of self-harm */
} sisp_reading;

/* ── Reason flags (bitmask). Text/i18n stays in the host application. ──── */
enum {
  /* blood pressure */
  SISP_R_BP_CRISIS = 1u << 0,    /* >180/120 (AHA) */
  SISP_R_BP_STAGE2 = 1u << 1,    /* >=140/90 */
  SISP_R_BP_STAGE1 = 1u << 2,    /* 130–139 / 80–89 */
  SISP_R_BP_ELEVATED = 1u << 3,  /* 120–129 */
  SISP_R_BP_DIA80 = 1u << 4,     /* diastolic >=80 with systolic <120 */
  SISP_R_BP_LOW = 1u << 5,       /* <90/60 (NHLBI) */
  /* heart rate */
  SISP_R_HR_TACHY = 1u << 6,     /* >100 bpm */
  SISP_R_HR_BRADY = 1u << 7,     /* <60 bpm */
  /* glucose */
  SISP_R_GLU_SEVERE_HYPO = 1u << 8, /* <54 */
  SISP_R_GLU_HYPO = 1u << 9,        /* <70 */
  SISP_R_GLU_DIABETES = 1u << 10,   /* >=126 */
  SISP_R_GLU_IMPAIRED = 1u << 11,   /* 100–125 */
  /* temperature */
  SISP_R_TEMP_FEVER = 1u << 12,       /* >=38 °C (CDC) */
  SISP_R_TEMP_DELTA_ALERT = 1u << 13, /* >= +1.2 °C over in-flight baseline */
  SISP_R_TEMP_DELTA_ATTN = 1u << 14,  /* >= +0.8 °C over in-flight baseline */
  SISP_R_TEMP_LOW = 1u << 15,         /* <36 °C */
  /* sleep */
  SISP_R_SLEEP_LT5 = 1u << 16,
  SISP_R_SLEEP_LT7 = 1u << 17,
  SISP_R_SLEEP_DEBT3 = 1u << 18,  /* 3-night average <5.5 h */
  /* mood */
  SISP_R_MOOD_LOW = 1u << 19,     /* mood <=2 today */
  SISP_R_MOOD_LOW3 = 1u << 20,    /* low mood 3 days in a row */
  SISP_R_MOOD_PHQ2 = 1u << 21,    /* PHQ-2 >=3 (positive screen) */
  SISP_R_MOOD_SELF_HARM = 1u << 22,
  /* personal baseline (z-score; systolic for BP) */
  SISP_R_Z_STRONG = 1u << 29,     /* |z| >= 3 */
  SISP_R_Z_OUTSIDE = 1u << 30     /* |z| >= 2 */
};

typedef struct sisp_baseline {
  double mean; /* NaN when n == 0 */
  double sd;   /* sample SD, floored per indicator */
  int32_t n;   /* readings in the window */
} sisp_baseline;

typedef struct sisp_finding {
  sisp_severity severity;
  uint32_t reasons;      /* SISP_R_* flags, in display order of the bits */
  double z;              /* z-score vs baseline (NaN if not computed) */
  double baseline_mean;  /* NaN when no baseline */
  int32_t baseline_n;
  double delta;          /* value − baseline mean (0 when no baseline) */
  double avg3;           /* sleep: 3-night average (NaN for other indicators) */
} sisp_finding;

/* Reference band for UI gauges (value in [from, to) → severity). */
typedef struct sisp_band {
  double from, to;
  sisp_severity severity;
} sisp_band;

/* ── Indicators ─────────────────────────────────────────────────────────── */

/* Reference bands of an indicator; returns count and sets *out (static table). */
SISP_API size_t sisp_reference_bands(sisp_indicator ind, const sisp_band **out);

/* Severity of `value` in the reference bands (clamped to the outer bands). */
SISP_API sisp_severity sisp_band_severity(sisp_indicator ind, double value);

/* Personal baseline of `field` from readings[idx-14 .. idx-1] (current day excluded). */
typedef enum sisp_field {
  SISP_F_SYS, SISP_F_DIA, SISP_F_HR, SISP_F_GLUCOSE, SISP_F_TEMP, SISP_F_SLEEP, SISP_F_MOOD
} sisp_field;
SISP_API sisp_baseline sisp_baseline_of(const sisp_reading *readings, size_t count, size_t idx, sisp_field field);

/*
 * Assess readings[idx] against absolute limits AND the personal baseline.
 * Writes SISP_IND_COUNT findings, indexed by sisp_indicator.
 * Returns 0 on success, -1 on invalid arguments.
 */
SISP_API int sisp_assess(const sisp_reading *readings, size_t count, size_t idx,
                         sisp_finding out[SISP_IND_COUNT]);

/* ── Radiation ──────────────────────────────────────────────────────────── */
enum { SISP_SOLAR_NONE = 0, SISP_SOLAR_GO_TO_SHELTER = 1, SISP_SOLAR_IN_SHELTER = 2 };

typedef struct sisp_radiation_input {
  double mission_days;     /* days since mission start (>= 0) */
  double dose_rate;        /* mSv/day for the environment */
  double prior_career_msv; /* dose before this mission */
  double logged_event_msv; /* finished solar events */
  double live_event_msv;   /* current solar event, accrued so far */
  int solar_active;
  int sheltered;
  int deep_space;
} sisp_radiation_input;

typedef struct sisp_radiation {
  double mission_msv, total_msv, pct_of_limit, days_left, event_msv;
  sisp_severity severity;
  int solar_reason; /* SISP_SOLAR_* */
} sisp_radiation;

SISP_API sisp_radiation sisp_radiation_status(const sisp_radiation_input *in);

/* Live dose of a solar particle event (SEP), with the shelter factor. Times in ms. */
typedef struct sisp_sep_dose {
  double dose_msv, progress, avoided_msv, projected_unsheltered_msv;
  int done;
} sisp_sep_dose;

/* sheltered_at_ms <= 0 means "not sheltered". */
SISP_API sisp_sep_dose sisp_sep_event_dose(double full_unsheltered_msv, double started_at_ms,
                                           double sheltered_at_ms, double duration_sec,
                                           double now_ms, double shelter_factor);

SISP_API const sisp_environment_info *sisp_environment_get(sisp_environment env);

/* ── PVT (psychomotor vigilance) ────────────────────────────────────────── */
typedef struct sisp_pvt_score {
  int32_t n;            /* valid responses (>= 100 ms) */
  double mean_ms, median_ms; /* rounded to integer ms */
  int32_t lapses;       /* RT >= 355 ms */
  int32_t false_starts;
  double speed;         /* mean 1000/RT, rounded to 0.1 */
} sisp_pvt_score;

/* Scores one session. `rts` is SORTED IN PLACE (no allocation). */
SISP_API sisp_pvt_score sisp_pvt_score_session(double *rts, size_t n, int32_t false_starts);

typedef struct sisp_pvt_session { double median_ms; int32_t lapses; } sisp_pvt_session;

enum {
  SISP_FAT_LAPSES5 = 1u << 0, SISP_FAT_LAPSES3 = 1u << 1,
  SISP_FAT_SLOW20 = 1u << 2, SISP_FAT_SLOW10 = 1u << 3,
  SISP_FAT_SHORT_SLEEP = 1u << 4
};

typedef struct sisp_fatigue {
  double baseline_ms;  /* mean median of up to 6 prior sessions (NaN if < 3) */
  double slowing_pct;  /* latest vs baseline, % */
  double sleep_avg3;   /* NaN when no sleep data */
  sisp_severity severity;
  uint32_t reasons;    /* SISP_FAT_* */
  int32_t latest_lapses;
  int has_latest;
} sisp_fatigue;

/* hist: oldest → newest. sleep: last nights, oldest → newest (only the last 3 are used). */
SISP_API sisp_fatigue sisp_fatigue_status(const sisp_pvt_session *hist, size_t n_hist,
                                          const double *sleep, size_t n_sleep);

/* ── Bone (BMD loss projection) ─────────────────────────────────────────── */
typedef struct sisp_bone {
  double months, adherence, low_pct, high_pct;
  sisp_severity severity;
} sisp_bone;

/* exercise_min: last days (only the last 14 are used). */
SISP_API sisp_bone sisp_bone_status(double mission_days, const double *exercise_min, size_t n);

/* ── Aggregation ────────────────────────────────────────────────────────── */
typedef struct sisp_overall {
  sisp_severity overall;
  sisp_severity regions[SISP_REG_COUNT];
} sisp_overall;

SISP_API sisp_overall sisp_aggregate(const sisp_finding findings[SISP_IND_COUNT],
                                     sisp_severity radiation, sisp_severity bone,
                                     sisp_severity fatigue);

/* ── PPG (camera pulse) ─────────────────────────────────────────────────── */

/* Linear resampling of irregular frames (t in ms) to a uniform grid at fs Hz.
 * Returns the number of samples the grid needs; writes min(that, cap). */
SISP_API size_t sisp_ppg_resample(const double *t_ms, const double *v, size_t n, double fs,
                                  double *out, size_t cap);

/* Band-limit: subtract ~1.5 s moving-average trend, then 5-sample smoothing.
 * `out` must hold n values and must not alias `x`. */
SISP_API void sisp_ppg_filter(const double *x, size_t n, double fs, double *out);

typedef struct sisp_ppg_estimate { double bpm; double quality; } sisp_ppg_estimate;

/* BPM by normalized autocorrelation (40–180 bpm). Returns 1 on success, 0 when
 * the signal is too short (< 5 s), flat, or fs is out of range. */
SISP_API int sisp_ppg_estimate_bpm(const double *x, size_t n, double fs, sisp_ppg_estimate *out);

/* Is a fingertip covering the lens? (red-dominant, bright enough) */
SISP_API int sisp_ppg_finger_on(double r, double g, double b);

/* ── Misc ───────────────────────────────────────────────────────────────── */
static inline sisp_severity sisp_max_severity(sisp_severity a, sisp_severity b) { return a > b ? a : b; }
SISP_API const char *sisp_version(void);
SISP_API const char *sisp_severity_name(sisp_severity s); /* "N0".."N3" */

#ifdef __cplusplus
}
#endif
#endif /* SISP_H */
