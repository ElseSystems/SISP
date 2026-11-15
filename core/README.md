# libsisp

Portable C11 assessment core of **SISP — Health & Prevention System** (NASA Space Apps).
No dependencies, no dynamic allocation, thread-safe. MIT licensed.

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build && ctest --test-dir build --output-on-failure
./build/sisp-cli assess < examples/checkins.csv
```

API and integration guide: [../docs/core-api.md](../docs/core-api.md) · [Português](../docs/core-api.pt.md)

> Prototype heuristics — not a medical device and not a NASA protocol.
