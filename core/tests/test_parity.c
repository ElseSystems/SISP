/* Replays core/tests/fixtures/parity.txt (generated from the TS reference) against libsisp. */
#include "sisp_flat.h"

#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAXN 65536

static const struct { const char *name; int op; } OPS[] = {
  {"ASSESS", SISP_OP_ASSESS}, {"RADIATION", SISP_OP_RADIATION}, {"SEP_DOSE", SISP_OP_SEP_DOSE},
  {"PVT_SCORE", SISP_OP_PVT_SCORE}, {"FATIGUE", SISP_OP_FATIGUE}, {"BONE", SISP_OP_BONE},
  {"AGGREGATE", SISP_OP_AGGREGATE}, {"PPG_RESAMPLE", SISP_OP_PPG_RESAMPLE},
  {"PPG_FILTER", SISP_OP_PPG_FILTER}, {"PPG_ESTIMATE", SISP_OP_PPG_ESTIMATE},
};

static double in[MAXN], expected[MAXN], got[MAXN];

static int close_enough(double a, double b) {
  double scale;
  if (isnan(a) || isnan(b)) return isnan(a) && isnan(b);
  scale = fabs(a) > fabs(b) ? fabs(a) : fabs(b);
  if (scale < 1) scale = 1;
  return fabs(a - b) <= 1e-9 * scale;
}

static int read_doubles(FILE *f, double *dst, long n) {
  long i;
  char tok[64];
  for (i = 0; i < n; i++) {
    if (fscanf(f, "%63s", tok) != 1) return 0;
    dst[i] = strtod(tok, NULL); /* accepts NaN */
  }
  return 1;
}

int main(int argc, char **argv) {
  FILE *f;
  char name[32];
  long cases = 0, failures = 0;
  if (argc < 2) { fprintf(stderr, "usage: %s parity.txt\n", argv[0]); return 2; }
  f = fopen(argv[1], "r");
  if (!f) { perror(argv[1]); return 2; }
  while (fscanf(f, "%31s", name) == 1) {
    long n_in, n_out, n, i;
    int op = 0;
    size_t k;
    if (name[0] == '#') { int c; while ((c = fgetc(f)) != '\n' && c != EOF) {} continue; }
    for (k = 0; k < sizeof OPS / sizeof OPS[0]; k++) if (!strcmp(OPS[k].name, name)) op = OPS[k].op;
    if (!op || fscanf(f, "%ld", &n_in) != 1 || n_in > MAXN || !read_doubles(f, in, n_in) ||
        fscanf(f, "%ld", &n_out) != 1 || n_out > MAXN || !read_doubles(f, expected, n_out)) {
      fprintf(stderr, "malformed fixture near case %ld (%s)\n", cases + 1, name);
      return 2;
    }
    cases++;
    n = sisp_flat_call(op, in, (size_t)n_in, got, MAXN);
    if (n != n_out) {
      failures++;
      fprintf(stderr, "case %ld %s: %ld outputs, expected %ld\n", cases, name, n, n_out);
      continue;
    }
    for (i = 0; i < n; i++) {
      if (!close_enough(got[i], expected[i])) {
        failures++;
        fprintf(stderr, "case %ld %s: out[%ld] = %.17g, expected %.17g\n", cases, name, i, got[i], expected[i]);
        break;
      }
    }
  }
  fclose(f);
  printf("%ld/%ld parity fixtures match the TypeScript reference\n", cases - failures, cases);
  return failures || !cases ? 1 : 0;
}
