# libsisp — API do núcleo em C

Português · [English](core-api.md)

A `libsisp` é o motor de avaliação do SISP na forma de uma **biblioteca C11 portátil**. O app web roda o mesmo
código compilado para WebAssembly, então qualquer outro sistema (computador de bordo, gateway de wearable,
serviço do segmento de solo, ferramenta em Python ou C#) pode embutir exatamente a lógica que a tripulação vê na tela.

> [!WARNING]
> Heurísticas de protótipo de um projeto educacional do NASA Space Apps. **Não é dispositivo médico nem
> protocolo da NASA.** As faixas vêm de diretrizes terrestres publicadas (AHA, NHLBI, ADA, CDC, AASM,
> PHQ-2) e de material público da NASA; limiares de linha de base e números de radiação/SEP são valores do protótipo.

## Garantias

| | |
|---|---|
| Linguagem | ISO C11 (sem avisos com `-std=c11 -Wall -Wextra -Wpedantic -Wconversion` no gcc e no clang); o header também compila como C++ |
| Dependências | nenhuma (só `<math.h>`, `<stddef.h>`, `<stdint.h>`) |
| Memória | **nenhuma alocação dinâmica**; todos os buffers vêm de quem chama ou ficam na pilha |
| Estado | funções puras, sem globais, sem I/O → thread-safe e reentrante |
| Texto | nenhum: os resultados são números e **flags de motivo (bits)**; o sistema hospedeiro gera o texto no seu idioma |
| Paridade | `core/tests/fixtures/parity.txt` (321 casos) é conferido contra o C nativo (ctest), o WASM e o fallback TypeScript (`npm run test:core`) |

## Estrutura

```
core/
├── include/sisp.h        # API tipada (este documento)
├── include/sisp_flat.h   # ABI plana sobre arrays de double, para FFI e WebAssembly
├── src/sisp.c            # implementação
├── src/sisp_flat.c       # despachante da ABI plana
├── wasm/sisp_wasm.c      # pontos de entrada WebAssembly (buffers estáticos)
├── examples/sisp_cli.c   # sisp-cli: avalia CSV de check-ins, radiação, PVT
├── tests/                # testes unitários, replay de paridade, teste da CLI
└── CMakeLists.txt        # biblioteca estática + compartilhada, CLI, ctest, install/export
src/core/                 # fachada TS: carregador WASM + referência TypeScript idêntica
public/core/sisp.wasm     # build versionado (~12 kB, sem imports)
```

## Compilação

```bash
# nativo: libsisp.a estática + libsisp.so compartilhada, sisp-cli, testes
cmake -S core -B core/build -DCMAKE_BUILD_TYPE=Release
cmake --build core/build
ctest --test-dir core/build --output-on-failure      # ou: npm run core:native

# WebAssembly (precisa do Emscripten no PATH)
npm run build:core                                   # → public/core/sisp.wasm
npm run test:core                                    # referência TS + WASM vs fixtures
```

Opções do CMake: `SISP_BUILD_SHARED` (ON), `SISP_BUILD_TESTS` (ON), `SISP_BUILD_EXAMPLES` (ON),
`SISP_WERROR` (OFF). `cmake --install` instala os headers, as duas bibliotecas e um
pacote CMake `sisp::` (`find_package(sisp)` → `sisp::sisp_static`, `sisp::sisp_shared`).

## CLI

```console
$ sisp-cli assess < core/examples/checkins.csv     # sys,dia,hr,glucose,temp,sleep,mood[,phq2,self_harm,exercise_min]
{ ... "temperature": {"severity": "N2", "reasons": ["above_flight_baseline_1.2"], "baseline_mean": 36.53, "delta": 1.27} ... }
$ sisp-cli radiation mars-transit 180 120
{"environment": "mars-transit", "mission_mSv": 331.2, "total_mSv": 451.2, "pct_of_limit": 75.2, "days_left": 81, "severity": "N1"}
$ sisp-cli pvt 250 240 380 260 90
{"n": 4, "mean_ms": 283, "median_ms": 260, "lapses": 1, "speed": 3.7}
```

`sisp-cli assess` sai com código **3** quando o status geral é N2 ou pior, para scripts poderem alertar.

## API tipada (`sisp.h`)

### Severidade, indicadores, regiões, ambientes

| Enum | Values |
|---|---|
| `sisp_severity` | `SISP_N0_NOMINAL` 0 · `SISP_N1_CAUTION` 1 · `SISP_N2_WARNING` 2 · `SISP_N3_CRITICAL` 3 |
| `sisp_indicator` | `SISP_IND_BP`, `_HR`, `_GLUCOSE`, `_TEMP`, `_SLEEP`, `_MOOD` (`SISP_IND_COUNT` = 6) |
| `sisp_region` | `SISP_REG_BRAIN`, `_HEART`, `_LUNGS`, `_METABOLISM`, `_MUSCULOSKELETAL`, `_IMMUNE` |
| `sisp_environment` | `SISP_ENV_ISS`, `_MOON_BASE`, `_MARS_TRANSIT`, `_MARS_BASE` |

### Entrada

```c
typedef struct sisp_reading {
  double sys, dia, hr, glucose, temp, sleep, mood, exercise_min;
  int32_t phq2;       /* 0–6 or SISP_PHQ2_NONE (-1) */
  int32_t self_harm;  /* 1 = reported thoughts of self-harm */
} sisp_reading;
```

### Funções

| Função | O que faz |
|---|---|
| `int sisp_assess(const sisp_reading *r, size_t count, size_t idx, sisp_finding out[6])` | Avalia `r[idx]` contra **limites absolutos** e a **linha de base pessoal** (14 dias anteriores, ≥ 5 leituras, piso de DP). Cobre PA (AHA/NHLBI), FC, glicemia (ADA), temperatura (CDC ≥ 38 °C **e** +0,8/+1,2 °C sobre a base de voo), sono (AASM + média de 3 noites), humor (1–5, 3 dias baixos, **PHQ-2 ≥ 3**, autolesão → N3). Retorna 0, ou -1 com argumentos inválidos. |
| `sisp_baseline sisp_baseline_of(r, count, idx, field)` | Média, DP amostral (com piso) e n de um campo nos 14 dias antes de `idx`. |
| `size_t sisp_reference_bands(ind, const sisp_band **out)` / `sisp_band_severity(ind, value)` | As 6 faixas de referência usadas nos medidores (`[from, to)` → severidade). |
| `sisp_radiation sisp_radiation_status(const sisp_radiation_input *in)` | Dose da missão + carreira, **% do limite de 600 mSv** (N1 ≥ 50 %, N2 ≥ 80 %, N3 ≥ 100 %), dias de margem, escalonamento em evento solar (fora do abrigo: N2, N3 no espaço profundo; no abrigo: N1, N2 no espaço profundo). |
| `sisp_sep_dose sisp_sep_event_dose(full, started_ms, sheltered_ms, duration_s, now_ms, factor)` | Dose ao vivo de um evento de partículas solares; o tempo no abrigo é multiplicado por `factor` (`SISP_SHELTER_FACTOR` = 0,25). Também devolve o progresso e a dose evitada. |
| `const sisp_environment_info *sisp_environment_get(env)` | Taxa de dose de fundo, dose de SEP sem abrigo e flag de espaço profundo por ambiente. |
| `sisp_pvt_score sisp_pvt_score_session(double *rts, size_t n, int32_t false_starts)` | Pontua uma sessão PVT-B: TRs válidos ≥ 100 ms, média/mediana, **lapsos ≥ 355 ms**, velocidade (1000/TR). Ordena `rts` no próprio array. |
| `sisp_fatigue sisp_fatigue_status(hist, n_hist, sleep, n_sleep)` | Último PVT vs a **linha de base pessoal de PVT** (média das medianas de até 6 sessões anteriores, mínimo 3): N1 com ≥ 3 lapsos ou ≥ 10 % mais lento, N2 com ≥ 5 lapsos ou ≥ 20 % mais lento, elevado a N2 quando a média de sono de 3 noites é < 6 h. |
| `sisp_bone sisp_bone_status(days, exercise_min, n)` | Perda de DMO projetada (1–1,5 %/mês, reduzida pela adesão ao exercício resistido em 14 dias). |
| `sisp_overall sisp_aggregate(findings, radiation, bone, fatigue)` | Status geral (máximo de tudo) e os status das 6 regiões do corpo (radiação limitada a N2 nas regiões). |
| `size_t sisp_ppg_resample(t_ms, v, n, fs, out, cap)` | Quadros da câmera → grade uniforme (retorna o tamanho necessário, escreve ≤ `cap`). |
| `void sisp_ppg_filter(x, n, fs, out)` | Passa-alta por média móvel de 1,5 s + passa-baixa de 5 amostras. |
| `int sisp_ppg_estimate_bpm(x, n, fs, sisp_ppg_estimate *out)` | Frequência cardíaca por autocorrelação normalizada (40–180 bpm), checagem da fundamental e interpolação parabólica; `quality` = correlação do pico. Precisa de ≥ 5 s. |
| `int sisp_ppg_finger_on(r, g, b)` | Detecta o dedo sobre a lente pela média RGB. |
| `sisp_version()`, `sisp_severity_name(s)` | `"1.0.0"`, `"N0"`…`"N3"`. |

### Flags de motivo

Cada achado traz `reasons` (flags em bits; bit menor primeiro = ordem de exibição) e os números necessários
para explicá-los (`z`, `baseline_mean`, `baseline_n`, `delta`, `avg3`).

| Indicador | Flags |
|---|---|
| BP | `SISP_R_BP_CRISIS` (>180/120) · `_BP_STAGE2` (≥140/90) · `_BP_STAGE1` (130–139/80–89) · `_BP_ELEVATED` (120–129) · `_BP_DIA80` · `_BP_LOW` (<90/60) |
| HR | `SISP_R_HR_TACHY` (>100) · `_HR_BRADY` (<60) |
| Glicemia | `SISP_R_GLU_SEVERE_HYPO` (<54) · `_GLU_HYPO` (<70) · `_GLU_DIABETES` (≥126) · `_GLU_IMPAIRED` (100–125) |
| Temperatura | `SISP_R_TEMP_FEVER` (≥38) · `_TEMP_DELTA_ALERT` (≥ +1,2 °C vs base) · `_TEMP_DELTA_ATTN` (≥ +0,8 °C) · `_TEMP_LOW` (<36) |
| Sono | `SISP_R_SLEEP_LT5` · `_SLEEP_LT7` · `_SLEEP_DEBT3` (média de 3 noites < 5,5 h) |
| Humor | `SISP_R_MOOD_LOW` · `_MOOD_LOW3` · `_MOOD_PHQ2` · `_MOOD_SELF_HARM` |
| Linha de base | `SISP_R_Z_STRONG` (\|z\| ≥ 3 → N2) · `SISP_R_Z_OUTSIDE` (\|z\| ≥ 2 → N1) |
| Fadiga | `SISP_FAT_LAPSES5` · `_LAPSES3` · `_SLOW20` · `_SLOW10` · `_SHORT_SLEEP` |

## Exemplo de integração (C)

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
cc -std=c11 -Icore/include my_app.c core/src/sisp.c -lm   # ou simplesmente copie os dois arquivos para o seu build
```

## ABI plana (`sisp_flat.h`) — FFI e WebAssembly

Um único ponto de entrada sobre arrays de `double`, para que os bindings nunca lidem com layout de structs:

```c
long sisp_flat_call(int op, double *in, size_t n_in, double *out, size_t cap);
/* returns the number of doubles written, or SISP_FLAT_EINVAL (-1) / _ESPACE (-2) / _EOP (-3) */
```

| Op | Entrada | Saída |
|---|---|---|
| `SISP_OP_ASSESS` 1 | `count, idx, count × [sys, dia, hr, glucose, temp, sleep, mood, exercise_min, phq2 (NaN = none), self_harm]` | `6 × [severity, reasons, z, baseline_mean, baseline_n, delta, avg3]` |
| `SISP_OP_RADIATION` 2 | `days, rate, prior, logged, live, solar_active, sheltered, deep_space` | `mission, total, pct, days_left, event, severity, solar_reason` |
| `SISP_OP_SEP_DOSE` 3 | `full, started_ms, sheltered_ms, duration_s, now_ms, factor` | `dose, progress, avoided, projected, done` |
| `SISP_OP_PVT_SCORE` 4 | `false_starts, n, n × rt_ms` | `n, mean_ms, median_ms, lapses, false_starts, speed` |
| `SISP_OP_FATIGUE` 5 | `n_hist, n_hist × [median_ms, lapses], n_sleep, n_sleep × h` | `baseline_ms, slowing_pct, sleep_avg3, severity, reasons, latest_lapses, has_latest` |
| `SISP_OP_BONE` 6 | `days, n, n × exercise_min` | `months, adherence, low_pct, high_pct, severity` |
| `SISP_OP_AGGREGATE` 7 | `6 × severity, radiation, bone, fatigue` | `overall, 6 × region` |
| `SISP_OP_PPG_RESAMPLE` 8 | `fs, n, n × t_ms, n × value` | `m` valores reamostrados |
| `SISP_OP_PPG_FILTER` 9 | `fs, n, n × value` | `n` valores |
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

**JavaScript (WebAssembly)** — o carregador do app web é `src/core/wasm.ts`; avulso:

```js
const { instance } = await WebAssembly.instantiateStreaming(fetch('core/sisp.wasm'), {})
const x = instance.exports; x._initialize?.()
const input = [180, 1.84, 120, 0, 0, 0, 0, 1]
new Float64Array(x.memory.buffer, x.sisp_wasm_in(), input.length).set(input)
const n = x.sisp_wasm_call(2, input.length)
console.log(Array.from(new Float64Array(x.memory.buffer, x.sisp_wasm_out(), n)))
```

## No app web

`src/core/index.ts` expõe `core()`. Ele começa na referência TypeScript
(`src/core/reference.ts`, espelho linha a linha do `sisp.c`) e troca para o build WASM assim que
`public/core/sisp.wasm` carrega; o rodapé mostra qual motor está respondendo. Use `?core=ts` na
URL para forçar o fallback. Os dois motores geram avaliações **idênticas byte a byte** no app inteiro.

## Mantendo C, WASM e TS sincronizados

1. Altere `core/src/sisp.c` **e** `src/core/reference.ts` (mesma ordem de operações).
2. `npm run fixtures:core` regenera as fixtures a partir da referência TS.
3. `npm run core:native` (o ctest as reproduz em C), `npm run build:core && npm run test:core` (WASM + TS).
4. A CI (`.github/workflows/core.yml`) compila e testa com **gcc e clang**, com e sem
   ASan/UBSan, valida o header como C++, recompila o WASM com Emscripten 7.0.0 e roda a paridade de novo.
