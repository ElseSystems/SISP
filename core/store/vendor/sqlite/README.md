# Vendored SQLite amalgamation

| | |
|---|---|
| Version | **3.54.1** (`SQLITE_VERSION` in `sqlite3.h`) |
| Source | <https://sqlite.org/2026/sqlite-amalgamation-3540100.zip> |
| SHA3-256 of the zip | `92281c86e2957f9b9305890f9ac04204caa7b677cc868dc326d942689df28e30` (matches sqlite.org/download.html) |
| Files kept | `sqlite3.c`, `sqlite3.h` — unmodified (`shell.c` and `sqlite3ext.h` are not needed) |
| Used by | `sisp_store` only (`core/store`). libsisp itself does not depend on SQLite. |

## License — public domain

SQLite is in the public domain; no license or attribution is required to use, modify or
redistribute it. From <https://sqlite.org/copyright.html>:

> All of the code and documentation in SQLite has been dedicated to the public domain by the
> authors. All code authors, and representatives of the companies they work for, have signed
> affidavits dedicating their contributions to the public domain and originals of those signed
> affidavits are stored in a firesafe at the main offices of Hwaci. Anyone is free to copy,
> modify, publish, use, compile, sell, or distribute the original SQLite code, either in source
> code form or as a compiled binary, for any purpose, commercial or non-commercial, and by any
> means.

The web app uses the official WebAssembly build instead, npm `@sqlite.org/sqlite-wasm`
(the same 3.54.1 release; that package's JavaScript wrapper is Apache-2.0).

## Updating

```bash
curl -O https://sqlite.org/YYYY/sqlite-amalgamation-XXXXXXX.zip   # check the SHA3-256 on the download page
unzip -j sqlite-amalgamation-XXXXXXX.zip '*/sqlite3.c' '*/sqlite3.h' -d core/store/vendor/sqlite
cmake --build core/build && ctest --test-dir core/build --output-on-failure
```

Keep the npm `@sqlite.org/sqlite-wasm` version on the same SQLite release.
