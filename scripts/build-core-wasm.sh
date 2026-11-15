#!/usr/bin/env bash
# Build libsisp (core/) to WebAssembly → public/core/sisp.wasm
# Needs Emscripten (emcc) on PATH, e.g. `source /path/to/emsdk/emsdk_env.sh`.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v emcc >/dev/null || { echo "emcc not found — install/activate emsdk (https://emscripten.org/docs/getting_started/downloads.html)" >&2; exit 1; }
mkdir -p public/core
emcc -std=c11 -O3 -Wall -Wextra -Wpedantic -Werror \
  -Icore/include core/src/sisp.c core/src/sisp_flat.c core/wasm/sisp_wasm.c \
  --no-entry -sSTANDALONE_WASM -sFILESYSTEM=0 -sINITIAL_MEMORY=2MB -sSTACK_SIZE=256KB \
  -sEXPORTED_FUNCTIONS=[] -o public/core/sisp.wasm
echo "built public/core/sisp.wasm ($(wc -c < public/core/sisp.wasm) bytes, $(emcc --version | head -1))"
