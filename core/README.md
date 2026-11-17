# libsisp

Portable C11 assessment core of **SISP — Health & Prevention System** (NASA Space Apps).
No dependencies, no dynamic allocation, thread-safe. Proprietary (see [LICENSE](../LICENSE)).

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build && ctest --test-dir build --output-on-failure
./build/sisp-cli assess < examples/checkins.csv
```

Optional **`sisp_store`** ([store/](store/)): SQLite history (check-ins, PVT, pulse, doses, solar events,
reports) with versioned migrations in `store/schema.sql`, shared with the web app. It uses the vendored
SQLite amalgamation (public domain); libsisp itself does not depend on it (`-DSISP_BUILD_STORE=OFF`).

API and integration guide: [../docs/core-api.md](../docs/core-api.md) · [Português](../docs/core-api.pt.md)

> Prototype heuristics — not a medical device and not a NASA protocol.
