/*
 * WebAssembly entry points for libsisp (built by scripts/build-core-wasm.sh).
 * Static I/O buffers: the host writes doubles at sisp_wasm_in(), calls
 * sisp_wasm_call(op, n_in) and reads the result at sisp_wasm_out(). No malloc.
 * SPDX-License-Identifier: MIT
 */
#include "sisp_flat.h"

#define SISP_WASM_IN_CAP 65536
#define SISP_WASM_OUT_CAP 32768

static double g_in[SISP_WASM_IN_CAP];
static double g_out[SISP_WASM_OUT_CAP];

#define EXPORT(name) __attribute__((export_name(#name), used))

EXPORT(sisp_wasm_in) double *sisp_wasm_in(void) { return g_in; }
EXPORT(sisp_wasm_out) double *sisp_wasm_out(void) { return g_out; }
EXPORT(sisp_wasm_in_cap) int sisp_wasm_in_cap(void) { return SISP_WASM_IN_CAP; }
EXPORT(sisp_wasm_out_cap) int sisp_wasm_out_cap(void) { return SISP_WASM_OUT_CAP; }
EXPORT(sisp_wasm_abi) int sisp_wasm_abi(void) { return SISP_VERSION_MAJOR; }

EXPORT(sisp_wasm_call) int sisp_wasm_call(int op, int n_in) {
  if (n_in < 0 || n_in > SISP_WASM_IN_CAP) return (int)SISP_FLAT_EINVAL;
  return (int)sisp_flat_call(op, g_in, (size_t)n_in, g_out, SISP_WASM_OUT_CAP);
}
