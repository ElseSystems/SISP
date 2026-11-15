/*
 * libsisp flat ABI — one entry point over plain double arrays.
 *
 * Meant for FFI bindings (WebAssembly, Python ctypes, C#, Java/JNI, Rust, Go…)
 * where passing C structs is awkward. Each op reads a packed array of doubles
 * and writes a packed array of doubles; the layouts are documented in
 * docs/core-api.md and are the same ones used by core/tests/fixtures/parity.txt.
 *
 * SPDX-License-Identifier: MIT
 */
#ifndef SISP_FLAT_H
#define SISP_FLAT_H

#include "sisp.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef enum sisp_op {
  SISP_OP_ASSESS = 1,       /* in: count, idx, count×[sys,dia,hr,glucose,temp,sleep,mood,exercise_min,phq2,self_harm]
                               out: 6×[severity, reasons, z, baseline_mean, baseline_n, delta, avg3] */
  SISP_OP_RADIATION = 2,    /* in: days, rate, prior, logged, live, solar_active, sheltered, deep_space
                               out: mission, total, pct, days_left, event, severity, solar_reason */
  SISP_OP_SEP_DOSE = 3,     /* in: full, started_at_ms, sheltered_at_ms, duration_sec, now_ms, shelter_factor
                               out: dose, progress, avoided, projected_unsheltered, done */
  SISP_OP_PVT_SCORE = 4,    /* in: false_starts, n, n×rt_ms   (rts sorted in place)
                               out: n, mean_ms, median_ms, lapses, false_starts, speed */
  SISP_OP_FATIGUE = 5,      /* in: n_hist, n_hist×[median_ms, lapses], n_sleep, n_sleep×hours
                               out: baseline_ms, slowing_pct, sleep_avg3, severity, reasons, latest_lapses, has_latest */
  SISP_OP_BONE = 6,         /* in: days, n, n×exercise_min   out: months, adherence, low_pct, high_pct, severity */
  SISP_OP_AGGREGATE = 7,    /* in: 6×indicator severity, radiation, bone, fatigue   out: overall, 6×region severity */
  SISP_OP_PPG_RESAMPLE = 8, /* in: fs, n, n×t_ms, n×value   out: m resampled values */
  SISP_OP_PPG_FILTER = 9,   /* in: fs, n, n×value   out: n filtered values */
  SISP_OP_PPG_ESTIMATE = 10 /* in: fs, n, n×value   out: ok, bpm, quality */
} sisp_op;

#define SISP_FLAT_EINVAL (-1L)  /* malformed input */
#define SISP_FLAT_ESPACE (-2L)  /* output buffer too small */
#define SISP_FLAT_EOP (-3L)     /* unknown op */

/*
 * Runs `op`. `in` may be modified (PVT sorts its RTs in place).
 * Returns the number of doubles written to `out` (or a negative SISP_FLAT_E* code).
 * Never allocates.
 */
SISP_API long sisp_flat_call(int op, double *in, size_t n_in, double *out, size_t cap);

#ifdef __cplusplus
}
#endif
#endif /* SISP_FLAT_H */
