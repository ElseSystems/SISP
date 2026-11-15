# libsisp — C core API

[Português](core-api.pt.md) · English

`libsisp` is the assessment engine of SISP as a **portable C11 library**. The web app runs the same
code compiled to WebAssembly, so any other system (an onboard computer, a wearable gateway, a
ground-segment service, a Python or C# tool) can embed exactly the logic the crew sees on screen.

> [!WARNING]
> Prototype heuristics for an educational NASA Space Apps project. **Not a medical device and not
> a NASA protocol.** Ranges come from published terrestrial guidelines (AHA, NHLBI, ADA, CDC, AASM,
> PHQ-2) and public NASA material; baseline thresholds and radiation/SEP numbers are prototype values.

## Guarantees

| | |
|---|---|
| Language | ISO C11 (`-std=c11 -Wall -Wextra -Wpedantic -Wconversion` clean on gcc and clang); header also compiles as C++ |
| Dependencies | none (only `<math.h>`, `<stddef.h>`, `<stdint.h>`) |
| Memory | **no dynamic allocation** anywhere; all buffers are caller-provided or on the stack |
| State | pure functions, no globals, no I/O → thread-safe and re-entrant |
| Text | none: results are numbers and **reason bit flags**; the host renders text in its own language |
| Parity | `core/tests/fixtures/parity.txt` (321 cases) is checked against native C (ctest), WASM and the TypeScript fallback (`npm run test:core`) |

## Layout

```
core/
├── include/sisp.h        # typed API (this document)
├── include/sisp_flat.h   # flat ABI over double arrays, for FFI and WebAssembly
├── src/sisp.c            # implementation
├── src/sisp_flat.c       # flat ABI dispatcher
├── wasm/sisp_wasm.c      # WebAssembly entry points (static I/O buffers)
├── examples/sisp_cli.c   # sisp-cli: assess a CSV of check-ins, radiation, PVT
├── tests/                # unit tests, parity replay, CLI test
├── store/                # sisp_store — optional SQLite history store (see below)
└── CMakeLists.txt        # static + shared library, CLI, ctest, install/export
src/core/                 # TS facade: WASM loader + identical TypeScript reference
public/core/sisp.wasm     # committed build (~12 kB, no imports)
```

## Build

```bash
# native: static libsisp.a + shared libsisp.so, sisp-cli, tests
cmake -S core -B core/build -DCMAKE_BUILD_TYPE=Release
cmake --build core/build
ctest --test-dir core/build --output-on-failure      # or: npm run core:native

# WebAssembly (needs Emscripten on PATH)
npm run build:core                                   # → public/core/sisp.wasm
npm run test:core                                    # TS reference + WASM vs fixtures
```

CMake options: `SISP_BUILD_SHARED` (ON), `SISP_BUILD_TESTS` (ON), `SISP_BUILD_EXAMPLES` (ON),
`SISP_BUILD_STORE` (ON), `SISP_WERROR` (OFF). `cmake --install` installs the headers, the libraries and a
`sisp::` CMake package (`find_package(sisp)` → `sisp::sisp_static`, `sisp::sisp_shared`, `sisp::sisp_store`).

## CLI

```console
$ sisp-cli assess < core/examples/checkins.csv     # sys,dia,hr,glucose,temp,sleep,mood[,phq2,self_harm,exercise_min]
{ ... "temperature": {"severity": "N2", "reasons": ["above_flight_baseline_1.2"], "baseline_mean": 36.53, "delta": 1.27} ... }
$ sisp-cli radiation mars-transit 180 120
{"environment": "mars-transit", "mission_mSv": 331.2, "total_mSv": 451.2, "pct_of_limit": 75.2, "days_left": 81, "severity": "N1"}
$ sisp-cli pvt 250 240 380 260 90
{"n": 4, "mean_ms": 283, "median_ms": 260, "lapses": 1, "speed": 3.7}
```

`sisp-cli assess` exits with **3** when the overall status is N2 or worse, so scripts can alert on it.

## Typed API (`sisp.h`)

### Severity, indicators, regions, environments

| Enum | Values |
|---|---|
| `sisp_severity` | `SISP_N0_NOMINAL` 0 · `SISP_N1_CAUTION` 1 · `SISP_N2_WARNING` 2 · `SISP_N3_CRITICAL` 3 |
| `sisp_indicator` | `SISP_IND_BP`, `_HR`, `_GLUCOSE`, `_TEMP`, `_SLEEP`, `_MOOD` (`SISP_IND_COUNT` = 6) |
| `sisp_region` | `SISP_REG_BRAIN`, `_HEART`, `_LUNGS`, `_METABOLISM`, `_MUSCULOSKELETAL`, `_IMMUNE` |
| `sisp_environment` | `SISP_ENV_ISS`, `_MOON_BASE`, `_MARS_TRANSIT`, `_MARS_BASE` |

### Input

```c
typedef struct sisp_reading {
  double sys, dia, hr, glucose, temp, sleep, mood, exercise_min;
  int32_t phq2;       /* 0–6 or SISP_PHQ2_NONE (-1) */
  int32_t self_harm;  /* 1 = reported thoughts of self-harm */
} sisp_reading;
```

### Functions

| Function | What it does |
|---|---|
| `int sisp_assess(const sisp_reading *r, size_t count, size_t idx, sisp_finding out[6])` | Assesses `r[idx]` against **absolute limits** and the **personal baseline** (previous 14 days, ≥ 5 readings, SD floors). Covers BP (AHA/NHLBI), HR, glucose (ADA), temperature (CDC ≥ 38 °C **and** +0.8/+1.2 °C over the in-flight baseline), sleep (AASM + 3-night average), mood (1–5, 3 low days, **PHQ-2 ≥ 3**, self-harm → N3). Returns 0, or -1 on bad arguments. |
| `sisp_baseline sisp_baseline_of(r, count, idx, field)` | Mean, floored sample SD and n of one field over the 14 days before `idx`. |
| `size_t sisp_reference_bands(ind, const sisp_band **out)` / `sisp_band_severity(ind, value)` | The 6 reference ranges used by the gauges (`[from, to)` → severity). |
| `sisp_radiation sisp_radiation_status(const sisp_radiation_input *in)` | Mission + career dose, **% of the 600 mSv limit** (N1 ≥ 50 %, N2 ≥ 80 %, N3 ≥ 100 %), days of margin, solar-event escalation (unsheltered: N2, N3 in deep space; sheltered: N1, N2 in deep space). |
| `sisp_sep_dose sisp_sep_event_dose(full, started_ms, sheltered_ms, duration_s, now_ms, factor)` | Live dose of a solar particle event; time inside the shelter is multiplied by `factor` (`SISP_SHELTER_FACTOR` = 0.25). Also returns progress and dose avoided. |
| `const sisp_environment_info *sisp_environment_get(env)` | Background dose rate, unsheltered SEP dose and deep-space flag per environment. |
| `sisp_pvt_score sisp_pvt_score_session(double *rts, size_t n, int32_t false_starts)` | Scores a PVT-B session: valid RTs ≥ 100 ms, mean/median, **lapses ≥ 355 ms**, speed (1000/RT). Sorts `rts` in place. |
| `sisp_fatigue sisp_fatigue_status(hist, n_hist, sleep, n_sleep)` | Latest PVT vs the **personal PVT baseline** (mean median of up to 6 prior sessions, needs 3): N1 at ≥ 3 lapses or ≥ 10 % slower, N2 at ≥ 5 lapses or ≥ 20 % slower, raised to N2 when the 3-night sleep average is < 6 h. |
| `sisp_bone sisp_bone_status(days, exercise_min, n)` | Projected BMD loss (1–1.5 %/month, reduced by resistive-exercise adherence over 14 days). |
| `sisp_overall sisp_aggregate(findings, radiation, bone, fatigue)` | Overall status (max of everything) and the 6 body-region statuses (radiation is capped at N2 on regions). |
| `size_t sisp_ppg_resample(t_ms, v, n, fs, out, cap)` | Camera frames → uniform grid (returns required length, writes ≤ `cap`). |
| `void sisp_ppg_filter(x, n, fs, out)` | 1.5 s moving-average high-pass + 5-sample low-pass. |
| `int sisp_ppg_estimate_bpm(x, n, fs, sisp_ppg_estimate *out)` | Heart rate by normalized autocorrelation (40–180 bpm), fundamental check and parabolic interpolation; `quality` = peak correlation. Needs ≥ 5 s. |
| `int sisp_ppg_finger_on(r, g, b)` | Fingertip-on-lens test from mean RGB. |
| `sisp_version()`, `sisp_severity_name(s)` | `"1.0.0"`, `"N0"`…`"N3"`. |

### Reason flags

Findings carry `reasons` (bit flags, low bit first = display order) plus the numbers needed to
explain them (`z`, `baseline_mean`, `baseline_n`, `delta`, `avg3`).

| Indicator | Flags |
|---|---|
| BP | `SISP_R_BP_CRISIS` (>180/120) · `_BP_STAGE2` (≥140/90) · `_BP_STAGE1` (130–139/80–89) · `_BP_ELEVATED` (120–129) · `_BP_DIA80` · `_BP_LOW` (<90/60) |
| HR | `SISP_R_HR_TACHY` (>100) · `_HR_BRADY` (<60) |
| Glucose | `SISP_R_GLU_SEVERE_HYPO` (<54) · `_GLU_HYPO` (<70) · `_GLU_DIABETES` (≥126) · `_GLU_IMPAIRED` (100–125) |
| Temperature | `SISP_R_TEMP_FEVER` (≥38) · `_TEMP_DELTA_ALERT` (≥ +1.2 °C vs baseline) · `_TEMP_DELTA_ATTN` (≥ +0.8 °C) · `_TEMP_LOW` (<36) |
| Sleep | `SISP_R_SLEEP_LT5` · `_SLEEP_LT7` · `_SLEEP_DEBT3` (3-night average < 5.5 h) |
| Mood | `SISP_R_MOOD_LOW` · `_MOOD_LOW3` · `_MOOD_PHQ2` · `_MOOD_SELF_HARM` |
| Baseline | `SISP_R_Z_STRONG` (\|z\| ≥ 3 → N2) · `SISP_R_Z_OUTSIDE` (\|z\| ≥ 2 → N1) |
| Fatigue | `SISP_FAT_LAPSES5` · `_LAPSES3` · `_SLOW20` · `_SLOW10` · `_SHORT_SLEEP` |

## Integration example (C)

```c
#include <stdio.h>
#include "sisp.h"

int main(void) {
  sisp_reading days[15];
  for (int i = 0; i < 15; i++)          /* 14 in-flight days + today */
    days[i] = (sisp_reading){ .sys = 112, .dia = 72, .hr = 62, .glucose = 88, .temp = 36.5,
                              .sleep = 7.0, .mood = 4, .exercise_min = 120, .phq2 = SISP_PHQ2_NONE };
  days[14].temp = 37.8;                  /* below 38 °C, but +1.3 °C over the flight baseline */

  sisp_finding f[SISP_IND_COUNT];
  sisp_assess(days, 15, 14, f);

  const sisp_environment_info *mars = sisp_environment_get(SISP_ENV_MARS_TRANSIT);
  sisp_radiation_input rin = { .mission_days = 180, .dose_rate = mars->dose_msv_per_day,
                               .prior_career_msv = 120, .deep_space = mars->deep_space };
  sisp_radiation rad = sisp_radiation_status(&rin);

  sisp_overall o = sisp_aggregate(f, rad.severity, SISP_N0_NOMINAL, SISP_N0_NOMINAL);
  printf("temperature %s (Δ %+.1f °C)%s · radiation %.0f%% of limit · overall %s\n",
         sisp_severity_name(f[SISP_IND_TEMP].severity), f[SISP_IND_TEMP].delta,
         (f[SISP_IND_TEMP].reasons & SISP_R_TEMP_DELTA_ALERT) ? " space fever" : "",
         rad.pct_of_limit, sisp_severity_name(o.overall));
  return o.overall >= SISP_N2_WARNING;
}
```

```cmake
add_subdirectory(path/to/sisp/core)          # or: find_package(sisp) after cmake --install
target_link_libraries(my_app PRIVATE sisp_static)
```

```bash
cc -std=c11 -Icore/include my_app.c core/src/sisp.c -lm   # or just drop the two files into your build
```

## Flat ABI (`sisp_flat.h`) — FFI and WebAssembly

One entry point over packed `double` arrays, so bindings never deal with struct layouts:

```c
long sisp_flat_call(int op, double *in, size_t n_in, double *out, size_t cap);
/* returns the number of doubles written, or SISP_FLAT_EINVAL (-1) / _ESPACE (-2) / _EOP (-3) */
```

| Op | Input | Output |
|---|---|---|
| `SISP_OP_ASSESS` 1 | `count, idx, count × [sys, dia, hr, glucose, temp, sleep, mood, exercise_min, phq2 (NaN = none), self_harm]` | `6 × [severity, reasons, z, baseline_mean, baseline_n, delta, avg3]` |
| `SISP_OP_RADIATION` 2 | `days, rate, prior, logged, live, solar_active, sheltered, deep_space` | `mission, total, pct, days_left, event, severity, solar_reason` |
| `SISP_OP_SEP_DOSE` 3 | `full, started_ms, sheltered_ms, duration_s, now_ms, factor` | `dose, progress, avoided, projected, done` |
| `SISP_OP_PVT_SCORE` 4 | `false_starts, n, n × rt_ms` | `n, mean_ms, median_ms, lapses, false_starts, speed` |
| `SISP_OP_FATIGUE` 5 | `n_hist, n_hist × [median_ms, lapses], n_sleep, n_sleep × h` | `baseline_ms, slowing_pct, sleep_avg3, severity, reasons, latest_lapses, has_latest` |
| `SISP_OP_BONE` 6 | `days, n, n × exercise_min` | `months, adherence, low_pct, high_pct, severity` |
| `SISP_OP_AGGREGATE` 7 | `6 × severity, radiation, bone, fatigue` | `overall, 6 × region` |
| `SISP_OP_PPG_RESAMPLE` 8 | `fs, n, n × t_ms, n × value` | `m` resampled values |
| `SISP_OP_PPG_FILTER` 9 | `fs, n, n × value` | `n` values |
| `SISP_OP_PPG_ESTIMATE` 10 | `fs, n, n × value` | `ok, bpm, quality` |

**Python (ctypes)**

```python
import ctypes, math
sisp = ctypes.CDLL("core/build/libsisp.so")
sisp.sisp_flat_call.restype = ctypes.c_long
D = ctypes.c_double
def call(op, values, cap=64):
    src, out = (D * len(values))(*values), (D * cap)()
    n = sisp.sisp_flat_call(op, src, len(values), out, cap)
    if n < 0: raise RuntimeError(n)
    return list(out[:n])
print(call(2, [180, 1.84, 120, 0, 0, 0, 0, 1]))   # radiation, Mars transit, day 180
```

**JavaScript (WebAssembly)** — the web app's loader is `src/core/wasm.ts`; standalone:

```js
const { instance } = await WebAssembly.instantiateStreaming(fetch('core/sisp.wasm'), {})
const x = instance.exports; x._initialize?.()
const input = [180, 1.84, 120, 0, 0, 0, 0, 1]
new Float64Array(x.memory.buffer, x.sisp_wasm_in(), input.length).set(input)
const n = x.sisp_wasm_call(2, input.length)
console.log(Array.from(new Float64Array(x.memory.buffer, x.sisp_wasm_out(), n)))
```

## In the web app

`src/core/index.ts` exposes `core()`. It starts on the TypeScript reference
(`src/core/reference.ts`, a line-by-line mirror of `sisp.c`) and switches to the WASM build as soon
as `public/core/sisp.wasm` loads; the footer shows which engine is answering. Add `?core=ts` to the
URL to force the fallback. Both engines produce **byte-identical** assessments for the whole app.

## Keeping C, WASM and TS in sync

1. Change `core/src/sisp.c` **and** `src/core/reference.ts` (same operation order).
2. `npm run fixtures:core` regenerates the fixtures from the TS reference.
3. `npm run core:native` (ctest replays them in C), `npm run build:core && npm run test:core` (WASM + TS).
4. CI (`.github/workflows/core.yml`) builds and tests with **gcc and clang**, with and without
   ASan/UBSan, checks the header as C++, rebuilds the WASM with Emscripten 7.0.0 and re-runs parity.

## SQLite history store (`sisp_store`)

`core/store/` is an **optional** second library for keeping the history: check-ins, PVT, camera pulse,
radiation doses, solar events and reports. libsisp itself stays dependency-free and allocation-free. Only
`sisp_store` links SQLite: the 3.54.1 amalgamation in `core/store/vendor/sqlite/` (public domain, see its README).
Turn it off with `-DSISP_BUILD_STORE=OFF`.

```
core/store/
├── schema.sql            # tables + versioned migrations — also run by the web app
├── export.sql            # history → one JSON document — also run by the web app
├── include/sisp_store.h  # API
├── src/sisp_store.c      # implementation (SQL embedded at configure time)
├── examples/sisp_store_cli.c  # sisp-store: import / stats / check / export
├── tests/test_store.c    # ctest "store"
└── vendor/sqlite/        # sqlite3.c, sqlite3.h (unmodified) + license note
```

### Schema and migrations

`schema.sql` is split on lines that start with `-- @migration N`. On open, every block with
`N > PRAGMA user_version` runs in its own `BEGIN IMMEDIATE` transaction together with
`PRAGMA user_version = N`, so a crash never leaves a half-migrated file. Re-opening is a no-op.
A file from a **newer** schema is refused (`SISP_STORE_ESCHEMA`) rather than modified. Released
migrations are never edited; changes are appended as a new block.

| Table (STRICT) | Key columns | Notes |
|---|---|---|
| `crew` | `id` PK, `name`, `role`, `agency`, `mission_start`, `prior_career_dose_msv`, `meta` (JSON) | upsert |
| `checkins` | `crew_id` → crew, `ts`, `day`, the 6 indicators (+ `phq2`, `self_harm`, `exercise_min`), `status` 0–3, `source` | `UNIQUE(crew_id, day)`: one per day, upsert |
| `pvt_results` | `crew_id`, `ts`, `day`, `duration_sec`, `n`, `mean_ms`, `median_ms`, `lapses`, `false_starts`, `speed` | |
| `ppg_results` | `crew_id`, `ts`, `day`, `bpm`, `quality` 0–1, `source` | |
| `radiation_doses` | `crew_id`, `ts`, `env`, `msv` ≥ 0, `source`, `event_id` | |
| `solar_events` | `event_id` (DONKI), `ts`, `env`, `dose_msv`, `sheltered`, `replay`, `flare` | |
| `reports` | `crew_id`, `ts`, `format` text/json, `body`, `delay_sec` | |
| `meta` (v2) | `key`, `value` | e.g. the web's one-time localStorage import flag |

Times are epoch milliseconds (UTC). Every child table has a `(crew_id, ts)` index (migration 2) and
`ON DELETE CASCADE` to `crew`.

### Durability

`PRAGMA journal_mode = WAL`, `synchronous = FULL`, `foreign_keys = ON`, `trusted_schema = OFF`, and a
5 s busy timeout. Every statement is a cached prepared statement with bound parameters. Use
`sisp_store_begin/commit/rollback` to batch writes. `sisp_store_integrity_check` runs
`PRAGMA integrity_check` plus `foreign_key_check`. `sisp_store_backup` makes an online copy
(`sqlite3_backup`). Use one `sisp_store` per thread.

### API (`sisp_store.h`)

| Function | |
|---|---|
| `sisp_store_open(path, &s)` / `sisp_store_close(s)` | open or create + migrate; `":memory:"` works |
| `sisp_store_errmsg`, `sisp_store_schema_version`, `sisp_store_journal_mode`, `sisp_store_sqlite_version` | |
| `sisp_store_begin` / `commit` / `rollback` | explicit transactions |
| `sisp_store_upsert_crew` | crew member |
| `sisp_store_insert_checkin` | upsert on `(crew_id, day)`; takes a `sisp_reading` + `sisp_severity` |
| `sisp_store_insert_pvt` / `_ppg` / `_dose` / `_solar_event` / `_report` | `row_id` out-param optional |
| `sisp_store_query_checkins` / `_pvt` / `_ppg` / `_doses` / `_reports(s, crew_id or NULL, from_ms, to_ms, cb, user)` | oldest first, inclusive range; return non-zero from `cb` to stop |
| `sisp_store_query_solar_events(s, from_ms, to_ms, cb, user)` | |
| `sisp_store_dose_total(s, crew_id, from_ms, to_ms, &msv)` | sum of recorded doses |
| `sisp_store_count(s, table)` | rows in one of the 7 tables |
| `sisp_store_export_json(s, crew_id or NULL, from_ms, to_ms, write, user)` | `export.sql`, same JSON as the web |
| `sisp_store_integrity_check`, `sisp_store_backup(s, dest)` | |

All functions return `SISP_STORE_OK` (0) or a negative `sisp_store_status`. Strings in query rows are
valid only during the callback.

```c
#include "sisp.h"
#include "sisp_store.h"

static int print_row(void *user, const sisp_store_checkin *c) {
  (void)user;
  printf("%s %s temp %.1f status N%d\n", c->crew_id, c->day, c->reading.temp, (int)c->status);
  return 0;
}

int log_today(const sisp_reading *days, size_t n, int64_t now_ms, const char *today) {
  sisp_store *db;
  if (sisp_store_open("history.sqlite3", &db) != SISP_STORE_OK) return -1;
  sisp_store_crew me = { "t1", "Crew Member 1", "Commander", "NASA", "2026-01-01", 120.0, NULL };
  sisp_store_upsert_crew(db, &me);

  sisp_finding f[SISP_IND_COUNT];
  sisp_assess(days, n, n - 1, f);                       /* libsisp: today's findings */
  sisp_severity worst = SISP_N0_NOMINAL;
  for (int i = 0; i < SISP_IND_COUNT; i++) if (f[i].severity > worst) worst = f[i].severity;

  sisp_store_checkin c = { 0, "t1", now_ms, today, days[n - 1], worst, "manual" };
  if (sisp_store_insert_checkin(db, &c, NULL) != SISP_STORE_OK) fprintf(stderr, "%s\n", sisp_store_errmsg(db));
  sisp_store_query_checkins(db, "t1", now_ms - 14 * 86400000LL, now_ms, print_row, NULL);
  sisp_store_close(db);                                 /* checkpoints the WAL */
  return 0;
}
```

```cmake
find_package(sisp 1 REQUIRED)
target_link_libraries(my_app PRIVATE sisp::sisp_store)   # brings sisp::sisp_static along
```

`sisp-store DB stats | check | export [CREW] | import CREW [START] < checkins.csv` is the CLI version
(the CSV format is the same as `sisp-cli assess`).

### The same database on the web

`src/storage/` runs the same `schema.sql` and `export.sql` with the official `@sqlite.org/sqlite-wasm`
in a Web Worker on the `opfs-sahpool` VFS. That VFS uses OPFS sync access handles, needs no
`SharedArrayBuffer`, and works on GitHub Pages without COOP/COEP headers. WAL is enabled with
`PRAGMA locking_mode = EXCLUSIVE`, which must be the first statement on the connection: it puts the WAL
index on the heap because the VFS has no shared memory. On first run the app migrates its old
`localStorage` state once (recorded in `meta`). Without OPFS it keeps using `localStorage`. **About →
Download database** exports a `.sqlite3` that `sisp-store` reads, and CI (`store-web` job) checks both
directions: C writes → web reads, web writes → C `integrity_check`.

