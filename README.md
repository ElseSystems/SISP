<div align="center">

# 🛡️ SISP — Health & Prevention System

**Offline-first health self-assessment and emergency guidance for astronauts**

NASA Space Apps Challenge · *Create Health Monitoring Software for Astronauts on Space Missions*

**🚀 Live demo: [elsesystems.github.io/SISP](https://elsesystems.github.io/SISP/)**

[Português](README.pt.md) · English

![C11](https://img.shields.io/badge/core-C11-A8B9CC?logo=c&logoColor=white)
![WebAssembly](https://img.shields.io/badge/WebAssembly-libsisp-654FF0?logo=webassembly&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![three.js](https://img.shields.io/badge/three.js-R3F-000000?logo=three.js&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

</div>

> [!WARNING]
> **SISP is not a medical device and not a NASA protocol.** It is an educational hackathon prototype.
> Clinical ranges come from published terrestrial guidelines (AHA, NHLBI, ADA, CDC, AASM, PHQ-2) and public NASA material;
> the operational limits used by NASA flight surgeons are not public. Personal-baseline thresholds are prototype heuristics and all crew data is **simulated**.
> Emergency manuals are summaries of public NASA documents and do not replace training, the current (non-public) ISS medical checklist, or a flight surgeon.

![Dashboard](docs/screenshots/dashboard.webp)

## Overview

On a long mission, the crew cannot always wait for the ground. SISP lets each astronaut log six vital indicators in under a minute, see on a 3D body **which system is drifting**, and get a clear answer to two questions: **what do I do now?** and **when do I call the ground?** The answer adapts to where the crew is: the ISS (near real-time link), the Moon, or Mars (up to ~20 min one-way delay).

## Features

| | |
|---|---|
| 🧍 **Interactive 3D body** | Muscular and skeleton `.glb` models (React Three Fiber). Rotate, zoom and click per-region hotspots colored by severity. A 2D SVG body map is available as a fallback. |
| ✍️ **Daily check-in** | Blood pressure, heart rate, fasting glucose, body temperature, sleep, and mood (1–5 scale + PHQ-2), each with measurement instructions. |
| 🧠 **Two-layer assessment** | (1) absolute limits from published guidelines; (2) deviation from the astronaut's **personal 14-day baseline** (z-score). Output: *Nominal / Caution / Warning / Critical*. |
| 🌡️ **Relative fever** | Resting core temperature rises ~1 °C in flight (Stahn 2017), so SISP warns at +0.8 °C over *your* in-flight baseline, even below 38 °C. |
| 📡 **Delay-aware escalation** | Guidance that adapts to the selected environment (ISS, lunar base, Mars transit, Mars base), an animated Earth ⟷ destination signal diagram and an N0→N3 escalation ladder. |
| 📝 **Flight surgeon report** | Compact report as **text or JSON** (short keys, a few hundred bytes): vitals, flags, radiation incl. solar event dose, bone, PVT, camera pulse, actions already taken and notes. Copy, download `.json`, or "transmit" (simulated) to see when it reaches the ground and the **earliest reply** (round-trip delay + ~30 min review). |
| ☢️ **Real solar storm alert (DONKI)** | A real DONKI solar particle event (latest live SEP, or a replay of the real May 2024 GOES >100 MeV event after an X5.8 flare) fires a red **"go to shelter"** alert. Event dose climbs live on the radiation bar until the crew taps *I'm in the shelter*; the event lands on the mission-day timeline and in the report. |
| 📷 **Camera pulse (PPG)** | Fingertip on the camera (torch on phones): live waveform, signal-quality meter and a BPM **estimate** via autocorrelation; compared with the check-in HR. A demo signal works without a camera. Video never leaves the device. |
| ⚡ **PVT vigilance test** | PVT-B style reaction-time test (30 s demo, 1, 2 or 3 min; ISI 1–4 s; lapse ≥ 355 ms). Compared with the astronaut's **own PVT baseline** and cross-checked with the 3-night sleep average → fatigue status feeding the brain region and the overall status. |
| 🗓️ **Mission-day timeline** | ISS-style day in station time (GMT): fasting check-in, camera pulse, ARED/CEVIS exercise, afternoon PVT, evening report, pre-sleep. Due/overdue states, auto-completion from data, in-app reminder toasts (+ optional system notifications) and a 7-day strip of real DONKI flares. |
| 🚨 **Emergency manuals** | Step-by-step guides for **cardiac arrest (CPR/ACLS in microgravity)**, **muscle injuries** (strains/sprains) and **fractures/dislocations**, with illustrations, a 110/min CPR metronome and a citation on every step. |
| 📈 **Trends** | Current value + delta vs baseline in each header, nominal band + dashed guideline limits, synchronized hover across all charts, BP and glucose full width. |
| ☢️ **Radiation & bone** | Cumulative dose vs. the 600 mSv career limit (NASA-STD-3001) and estimated bone loss (1–1.5 %/month). |
| 🛰️ **Real NASA data** | Inspiration4 crew glucose (OSDR OSD-575), DONKI space weather with a drill based on the real May 2024 solar storm, and published RAD dose rates. |
| 🌐 **PT / EN** | Full Portuguese and English UI. The language is detected from the browser and can be switched at any time. |
| 🎮 **Light gamification** | XP, levels, streaks and badges for check-ins, PVT, camera pulse, sheltering and reports. |
| ⚙️ **Portable C core** | The whole assessment runs in **libsisp**, a dependency-free C11 library with no dynamic allocation, compiled to WebAssembly for the app (identical TypeScript fallback). Embeddable in other systems — see [Portable C core](#portable-c-core-libsisp). |
| 📴 **Offline-first** | Runs entirely in the browser. History is kept in **SQLite on the device** (OPFS, in a Web Worker), with `localStorage` as the fallback. No backend and no tracking. |

<table>
<tr>
<td><img src="docs/screenshots/emergency.webp" alt="Emergency manuals"></td>
<td><img src="docs/screenshots/ground.webp" alt="Ground escalation"></td>
</tr>
</table>

### Guided demo & onboarding

- **▶ Demo** (header button or `/#demo`): a ~90 s, one-click guided tour that drives the app by itself (ISS → relative fever → isolation trend → Mars transit → **real DONKI solar storm + shelter** → self-tests → delay-aware escalation → emergency manuals → NASA data). The demo leaves no trace (its solar event and dose are discarded on exit). Keys: `←`/`→` step, `space` pause, `Esc` exit. Your previous view is restored on exit.
- **Mission briefing** (first launch, `❔` button or `/#intro`): a 3-card, 30-second onboarding explaining the problem, how SISP works, and why it matters.
- **5 hazards on the body**: pick one of NASA HRP's five hazards and the 3D body lights up every organ it affects (sonar rings), with *what it does / what SISP watches / countermeasure* and its source.
- **Mission Elapsed Time** clock and deep-space visual theme (pure CSS, works offline).

### How to try each feature

| Feature | Where | Try this |
|---|---|---|
| Solar storm alert | **🗓️ Mission day** → *Inject real SEP*, or **🛰️ NASA data** → *Fire crew alert* | Watch the red banner and the dose rise on the radiation bar; tap **I'm in the shelter** (dose rate ×0.25, "avoided" counter), then **Ground all-clear**. Switch to *Mars transit* first for a Critical event. |
| Camera pulse | **⚡ Self-tests** | *Measure with camera* (phone: rear camera + torch; laptop: finger on webcam with a lamp behind) or *Demo signal*. 20 s → *Save estimate*. Needs `https` or `localhost`. |
| PVT | **⚡ Self-tests** | Pick *30 s demo* or *3 min · PVT-B*, press **Space** / tap when the counter appears. Select Crew Member 2 to see fatigue linked to short sleep. |
| Flight surgeon report | **📡 Act / Ground** | Tick the actions taken, add a note, switch TEXT/JSON, *Copy*, *⬇ .json*, *Transmit (simulated)*. Try ISS vs Mars transit. |
| Mission-day timeline | **🗓️ Mission day** (also the *Today* strip on the Dashboard) | Due items glow and raise a reminder toast; check-in / PVT / pulse / report auto-complete. *Enable notifications* for system alerts. |
| Language | `PT` / `EN` in the header | Every screen, the report and the demo captions switch. |

### Simulated crew

Four anonymous crew members (30 days of seeded data), each illustrating a scenario:

| Crew member | Role | Scenario |
|---|---|---|
| Crew Member 1 | Commander | Stable — healthy reference |
| Crew Member 2 | Flight Engineer | Sleep loss + low mood (positive PHQ-2 screen) |
| Crew Member 3 | Mission Specialist (CMO) | Relative fever below 38 °C |
| Crew Member 4 | Pilot | Blood pressure and fasting glucose trending up |

## Getting started

Requirements: **Node.js ≥ 20.19** (see `.nvmrc`). Python 3.9+ is optional and only needed to refresh the data.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script | Description |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and build a static bundle into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Lint with oxlint |
| `npm run check` | Lint + C-core parity + SQLite store tests + build (CI gate) |
| `npm run build:core` | Compile `core/` to `public/core/sisp.wasm` (needs Emscripten) |
| `npm run test:core` | Check the TS reference and `sisp.wasm` against the shared fixtures |
| `npm run fixtures:core` | Regenerate `core/tests/fixtures/parity.txt` from the TS reference |
| `npm run core:native` | CMake build + ctest of the native C library and `sisp_store` (needs CMake and a C compiler) |
| `npm run test:storage` | Web SQLite store (`src/storage`) on `@sqlite.org/sqlite-wasm` in Node: migrations, round trip, export |
| `npm run data` | Re-download NASA datasets into `public/data/` (Python standard library only) |

**Demo deep links:** `#dashboard`, `#checkin`, `#trends`, `#ground`, `#emergency`, `#nasa`, `#about`.

### Deploy

Vite is configured with `base: './'`, so `dist/` works on any static host:

- **GitHub Pages**: workflow in `.github/workflows/pages.yml` (runs on push to `main`).

## Portable C core (libsisp)

The assessment engine is a **dependency-free C11 library** in [`core/`](core/), so SISP's logic can be
embedded in onboard computers, wearable gateways or ground tools — not only in this web app.

- **What's in C:** the 6 indicator reference ranges and N0–N3 classification (incl. temperature vs the
  in-flight baseline and PHQ-2), overall/body-region aggregation, radiation dose with the storm-shelter
  factor and % of the career limit, PVT scoring vs the personal baseline, and the camera-PPG heart-rate estimate.
- **Embedded-friendly:** no dynamic allocation, no globals, no I/O, thread-safe; warning-free on gcc and clang
  (`-Wall -Wextra -Wpedantic -Wconversion`); header usable from C++.
- **Deliverables:** static + shared library (CMake, `find_package(sisp)`), `sisp-cli`, unit + parity tests (ctest),
  and a 12 kB **WebAssembly** build (`public/core/sisp.wasm`) that the web app uses, with an identical TypeScript fallback.
- **Proven identical:** 321 shared fixtures are replayed against native C, WASM and TS; the full app output is
  byte-identical on both engines. CI builds and tests with gcc and clang (plus ASan/UBSan).

```c
#include "sisp.h"

sisp_finding f[SISP_IND_COUNT];
sisp_assess(days, n_days, n_days - 1, f);             /* today vs absolute limits + personal baseline */
if (f[SISP_IND_TEMP].reasons & SISP_R_TEMP_DELTA_ALERT)
  printf("space fever: %+.1f °C over the in-flight baseline\n", f[SISP_IND_TEMP].delta);
```

```bash
cmake -S core -B core/build && cmake --build core/build && ctest --test-dir core/build
core/build/sisp-cli assess < core/examples/checkins.csv
```

Full API, flat FFI ABI (Python/JS examples) and integration guide: **[docs/core-api.md](docs/core-api.md)**.

## Historical data (SQLite)

Check-ins, PVT sessions, camera-pulse results, radiation doses, solar events and flight-surgeon reports are
kept in **SQLite**, with **one schema for C and the web**: [`core/store/schema.sql`](core/store/schema.sql)
(STRICT tables, versioned migrations via `PRAGMA user_version`) and [`core/store/export.sql`](core/store/export.sql)
(the JSON export).

- **C — `sisp_store`** ([`core/store/`](core/store/)): an optional CMake target next to libsisp, which stays
  dependency-free. It uses the vendored SQLite 3.54.1 amalgamation (public domain). WAL journal, `synchronous=FULL`,
  foreign keys, prepared statements, transactions. The API covers open/close, insert for each record kind, queries
  by crew member and time range, dose totals, JSON export, online backup and `integrity_check`.
  ctest checks that data survives a reopen and that the file passes `integrity_check`.
- **Web — `src/storage/`**: the official `@sqlite.org/sqlite-wasm` running in a **Web Worker** on the
  **`opfs-sahpool`** VFS. It needs no `SharedArrayBuffer`, so it works on GitHub Pages **without COOP/COEP headers**.
  WAL is used too: exclusive locking keeps the WAL index on the heap. On first run, the existing `localStorage` data
  is migrated into SQLite once. If OPFS isn't available (or with `?storage=local`), the app keeps using `localStorage`. Only one tab can hold
  the database at a time; a second SISP tab uses `localStorage` and says so in the footer.
  The footer and **About** show which engine is active. About also exports the history as JSON or downloads the
  `.sqlite3` file, which `sisp-store` reads.
- **Same files on both sides:** CI writes a database in C and reads it on the web, then does the reverse
  (`store-web` job).

```c
#include "sisp_store.h"

sisp_store *db;
sisp_store_open("history.sqlite3", &db);                 /* creates + migrates; WAL, synchronous=FULL */
sisp_store_checkin c = { .crew_id = "t1", .ts = now_ms, .day = "2026-11-15", .reading = today, .status = worst };
sisp_store_insert_checkin(db, &c, NULL);                 /* upsert: one check-in per crew member per day */
sisp_store_query_checkins(db, "t1", from_ms, to_ms, on_row, ctx);
sisp_store_close(db);
```

```bash
core/build/store/sisp-store history.sqlite3 import t1 < core/examples/checkins.csv
core/build/store/sisp-store history.sqlite3 stats     # row counts, schema version, journal mode
core/build/store/sisp-store history.sqlite3 export t1 # same JSON as the web export
```

## Architecture

```
core/                   # libsisp — portable C11 assessment core (see docs/core-api.md)
├── include/            # sisp.h (typed API), sisp_flat.h (flat ABI for FFI/WASM)
├── src/ wasm/          # implementation, WebAssembly entry points
├── tests/ examples/    # ctest unit + parity tests, sisp-cli
└── store/              # sisp_store — optional SQLite history store (schema.sql shared with the web)
src/
├── core/               # WASM loader + identical TypeScript reference of libsisp
├── storage/            # SQLite (sqlite-wasm, OPFS) in a Web Worker + localStorage fallback
├── lib/
│   ├── knowledge.ts    # clinical ranges, sources, hazards, body regions, environments
│   ├── assessment.ts   # core results → bilingual findings (guideline + baseline, radiation, bone, PVT)
│   ├── escalation.ts   # "when to call the ground" by severity × comm delay
│   ├── emergency.ts    # emergency manuals (steps + NASA/ILCOR/AHA citations)
│   ├── spaceWeather.ts # DONKI loader (bundled + live API), SEP scenario, event dose
│   ├── ppg.ts          # camera PPG (resample/filter/autocorrelation run in libsisp)
│   ├── schedule.ts     # mission-day timeline + task states
│   ├── report.ts       # compact flight-surgeon report (JSON + text)
│   ├── motion.ts       # shared Framer Motion variants
│   ├── crew.ts         # seeded simulated crew (vitals + PVT history)
│   ├── store.ts        # Zustand store (prefs in localStorage, history written through to SQLite), XP / badges
│   └── i18n.ts         # tiny PT/EN helper, no dependency
├── components/         # Dashboard, Body3D, BodyMap, Checkin, Trends, Ground, CommLink,
│                       # FlightSurgeonReport, SolarAlert, MissionTimeline, Reminders,
│                       # SelfTests, PulseCam, Pvt, Emergency, NasaData, About, ui
public/
├── models/             # optimized 3D models (~1 MB each)
├── data/               # static NASA datasets (JSON)
└── core/sisp.wasm      # libsisp compiled to WebAssembly (~12 kB)
scripts/
├── fetch_nasa_data.py  # OSDR OSD-575 + DONKI + radiation reference → public/data
├── build-core-wasm.sh  # emcc → public/core/sisp.wasm
├── core-parity.ts      # fixtures generator + TS/WASM parity check
└── storage-test.ts     # web SQLite store tests (+ C ⇄ web database exchange)
```

Every number shown in the app is traceable: clinical bands and actions live in `knowledge.ts`, emergency steps in `emergency.ts`, and each is linked to its source in the **About** tab.

### 3D models

The original Tripo exports (~65 MB and ~2 M triangles each) are **not versioned**. They were optimized with [glTF-Transform](https://gltf-transform.dev/):

```bash
npx @gltf-transform/cli optimize "human muscular 3d model.glb" public/models/human-muscular.glb \
  --simplify-ratio 0.06 --simplify-error 0.002 --texture-size 1024 --texture-compress webp --compress meshopt
```

The result is ~117 k triangles with 1024 px WebP textures, about 1 MB per model. The meshopt decoder ships with three.js, so the models load offline. The 3D view is lazy-loaded and falls back to 2D when WebGL is unavailable.

## Emergency manuals: sources

Steps are paraphrased from public material only. **No drug doses are given.**

- [NASA JSC-48522-E4 — ISS Medical Checklist (2001 public version, archived)](http://web.archive.org/web/20230519222418/https://www.nasa.gov/centers/johnson/pdf/163533main_ISS_Med_CL.pdf): CPR/ACLS on the Crew Medical Restraint System, strains/sprains, fractures
- [NASA NTRS — ISS Medical Checklist procedures validation](https://ntrs.nasa.gov/citations/20000026308)
- [ILCOR CoSTR BLS 2721 — CPR in microgravity](https://costr.ilcor.org/document/bls-2721-cpr-in-microgravity-environments)
- [AHA — Adult BLS/ALS guidelines](https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/adult-basic-and-advanced-life-support): 100–120/min, 5–6 cm, 30:2
- NASA Human Research Roadmap evidence: [Sudden Cardiac Arrest](https://humanresearchroadmap.nasa.gov/Evidence/medicalConditions/Sudden_Cardiac_Arrest.pdf), [Back Injury](https://humanresearchroadmap.nasa.gov/Evidence/medicalConditions/Back_Injury.pdf), [Shoulder Dislocation](https://humanresearchroadmap.nasa.gov/Evidence/medicalConditions/Shoulder_Dislocation.pdf), [Lumbar Spine Fracture](https://humanresearchroadmap.nasa.gov/Evidence/medicalConditions/Lumbar_Spine_Fracture.pdf)
- [NASA HRP Evidence Report — Risk of Bone Fracture (2024)](https://ntrs.nasa.gov/api/citations/20240005190/downloads/2024%20FINAL%20HRP-F07-ERft%20R2%20Fracture.pdf)

The 2001 checklist uses outdated CPR values (80–100/min, 15:2, precordial thump). SISP flags these and follows current AHA/ILCOR guidance.

## NASA data used

| Dataset | Used for | Source |
|---|---|---|
| Inspiration4 metabolic panel (glucose, 4 crew, L-92 → R+194) | Real pre/post-flight chart | [NASA OSDR OSD-575](https://osdr.nasa.gov/bio/repo/data/studies/OSD-575) |
| DONKI — SEP, flares, CMEs | Space-weather panel, live crew SEP alert ("go to shelter"), 7-day flare strip on the timeline. Bundled snapshot offline; refreshed from the CORS-enabled live API when online | [NASA CCMC DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) |
| Dose rates: Curiosity RAD (Mars surface and cruise), ISS, Chang'e-4 (Moon) | Radiation meter per environment | Hassler 2014 · Zeitlin 2013 · PMC10919966 · Zhang 2020 |
| 600 mSv career limit | Radiation meter target | [NASA-STD-3001](https://www.nasa.gov/reference/4-0-human-performance/) |
| Five hazards, bone loss, communication delay | Educational content, escalation | [NASA HRP hazards](https://www.nasa.gov/hrp/hazards/) |

### Clinical ranges (terrestrial)

- **Blood pressure:** AHA < 120/80 normal, > 180/120 crisis; low < 90/60 (NHLBI)
- **Resting HR:** 60–100 bpm (AHA)
- **Fasting glucose:** < 100 normal, ≥ 126 diabetes range, < 70 hypoglycemia, < 54 severe (ADA)
- **Temperature:** fever ≥ 38 °C (CDC); in-flight baseline +~1 °C (Stahn 2017)
- **Sleep:** ≥ 7 h (AASM); ISS average ~6.1 h (Barger 2014)
- **Mood:** PHQ-2 ≥ 3 = positive screen (Kroenke 2003)

## Privacy

All data stays on the device (SQLite in the browser's private file system, or `localStorage`). There are no servers, analytics, or API keys. `npm run data` only calls public NASA endpoints.

## License

[MIT](LICENSE) © 2026 Samuel Nogueira. The NASA data and documents referenced here are public and remain subject to their original terms.
