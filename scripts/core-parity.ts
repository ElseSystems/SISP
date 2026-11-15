/**
 * libsisp parity harness.
 *   node scripts/core-parity.ts --write   regenerate core/tests/fixtures/parity.txt from the TS reference
 *   node scripts/core-parity.ts           check TS reference AND public/core/sisp.wasm against the fixtures
 * The same fixtures are replayed against the native C library by ctest (core/tests/test_parity.c).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { OP } from '../src/core/constants.ts'
import { enc, referenceFlatCall } from '../src/core/flat.ts'
import type { FlatCall } from '../src/core/flat.ts'
import type { CoreReading } from '../src/core/reference.ts'
import { instantiateCore } from '../src/core/wasm.ts'

const FIXTURES = new URL('../core/tests/fixtures/parity.txt', import.meta.url)
const WASM = new URL('../public/core/sisp.wasm', import.meta.url)
const NAMES = Object.fromEntries(Object.entries(OP).map(([k, v]) => [v, k])) as Record<number, string>

// deterministic PRNG (mulberry32)
let seed = 0x5157
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]
const r1 = (x: number) => Math.round(x * 10) / 10
const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += rnd(); return s - 3 }

function series(n: number): CoreReading[] {
  const base = { sys: 108 + rnd() * 20, dia: 66 + rnd() * 12, hr: 56 + rnd() * 20, glucose: 80 + rnd() * 15, temp: 36.6 + rnd() * 0.8, sleep: 5.5 + rnd() * 2, mood: 3 + rnd() * 1.5 }
  const out: CoreReading[] = []
  for (let i = 0; i < n; i++) {
    const r: CoreReading = {
      sys: Math.round(base.sys + gauss() * 5), dia: Math.round(base.dia + gauss() * 4), hr: Math.round(base.hr + gauss() * 4),
      glucose: Math.round(base.glucose + gauss() * 5), temp: r1(base.temp + gauss() * 0.15), sleep: r1(base.sleep + gauss() * 0.6),
      mood: Math.min(5, Math.max(1, Math.round(base.mood + gauss()))), exerciseMin: Math.round(rnd() * 150),
    }
    if (rnd() < 0.2) r.phq2 = Math.floor(rnd() * 7)
    if (rnd() < 0.03) r.selfHarm = true
    if (rnd() < 0.15) r.sys = pick([89, 90, 119, 120, 129, 130, 139, 140, 180, 181, 200])
    if (rnd() < 0.1) r.dia = pick([59, 60, 79, 80, 89, 90, 120, 121])
    if (rnd() < 0.1) r.hr = pick([45, 59, 60, 100, 101, 130])
    if (rnd() < 0.1) r.glucose = pick([50, 53, 54, 69, 70, 99, 100, 125, 126, 160])
    if (rnd() < 0.1) r.temp = r1(base.temp + pick([0.7, 0.8, 0.9, 1.2, 1.3, 2]))
    if (rnd() < 0.08) r.temp = pick([35.5, 36, 37.9, 38, 38.4])
    if (rnd() < 0.1) r.sleep = pick([3.5, 4.9, 5, 5.4, 6.9, 7, 8.5])
    if (rnd() < 0.1) r.mood = pick([1, 2])
    out.push(r)
  }
  return out
}

function ppgFrames(bpm: number, sec: number, jitter: number) {
  const t: number[] = [], v: number[] = []
  let tm = 1_700_000_000_000 + Math.floor(rnd() * 1e6)
  for (let i = 0; tm < t[0] + sec * 1000 || i === 0; i++) {
    const ph = ((tm / 1000) * bpm / 60) % 1
    const wave = Math.exp(-((ph - 0.15) ** 2) / 0.006) + 0.35 * Math.exp(-((ph - 0.45) ** 2) / 0.01)
    t.push(tm); v.push(180 - 6 * wave + 3 * Math.sin(tm / 4000) + (rnd() - 0.5) * 1.2)
    tm += 1000 / 30 + (rnd() - 0.5) * jitter
  }
  return { t, v }
}

function cases(): [number, number[]][] {
  const out: [number, number[]][] = []
  for (let s = 0; s < 10; s++) {
    const rs = series(4 + Math.floor(rnd() * 40))
    for (let idx = 0; idx < rs.length; idx += 1 + Math.floor(rnd() * 4)) out.push([OP.ASSESS, enc.assess(rs, idx)])
  }
  { // hand-made edge cases: severe hypo, 3 low-mood days, PHQ-2, space fever below 38 °C, self-harm
    const rs = series(20).map((r) => ({ ...r, phq2: undefined, selfHarm: false, mood: 4, temp: 36.7, glucose: 88 }))
    rs[17].mood = 2; rs[18].mood = 1; rs[19].mood = 2; rs[19].glucose = 50; rs[19].temp = 37.9; rs[19].phq2 = 3
    out.push([OP.ASSESS, enc.assess(rs, 19)])
    rs[19] = { ...rs[19], selfHarm: true, temp: 37.5, glucose: 53.9 }
    out.push([OP.ASSESS, enc.assess(rs, 19)])
  }
  const envs = [[0.35, 0], [1.369, 1], [1.84, 1], [0.64, 0]]
  for (let i = 0; i < 40; i++) {
    const [rate, deep] = pick(envs)
    out.push([OP.RADIATION, [Math.floor(rnd() * 400), rate, Math.round(rnd() * 500), r1(rnd() * 20), rnd() * 30, +(rnd() < 0.5), +(rnd() < 0.5), deep]])
  }
  for (let i = 0; i < 30; i++) {
    const st = 1_700_000_000_000 + Math.floor(rnd() * 1e9), dur = pick([60, 90, 120])
    const sh = rnd() < 0.3 ? 0 : st + rnd() * dur * 1200
    out.push([OP.SEP_DOSE, [pick([1, 40, 50, 1.5]), st, sh, dur, st + rnd() * dur * 1300, 0.25]])
  }
  for (let i = 0; i < 30; i++) {
    const n = Math.floor(rnd() * 60), slow = 1 + rnd() * 0.6
    out.push([OP.PVT_SCORE, enc.pvtScore(Array.from({ length: n }, () => Math.round(rnd() < 0.05 ? 60 + rnd() * 40 : (220 + gauss() * 40) * slow + (rnd() < 0.1 ? 300 : 0))), Math.floor(rnd() * 5))])
  }
  for (let i = 0; i < 40; i++) {
    const nh = Math.floor(rnd() * 10), base = 230 + rnd() * 40
    const h = Array.from({ length: nh }, (_, k) => ({ medianMs: Math.round(base * (k === nh - 1 ? 1 + rnd() * 0.35 : 1 + gauss() * 0.03)), lapses: Math.floor(rnd() * (k === nh - 1 ? 8 : 3)) }))
    out.push([OP.FATIGUE, enc.fatigue(h, Array.from({ length: Math.floor(rnd() * 5) }, () => r1(4 + rnd() * 4)))])
  }
  for (let i = 0; i < 25; i++) out.push([OP.BONE, enc.bone(Math.floor(rnd() * 400), Array.from({ length: Math.floor(rnd() * 20) }, () => Math.round(rnd() * 160)))])
  for (let i = 0; i < 30; i++) out.push([OP.AGGREGATE, Array.from({ length: 9 }, () => Math.floor(rnd() * 4))])
  for (const [bpm, sec, jit] of [[52, 10, 4], [68, 12, 6], [96, 8, 8], [150, 7, 3], [68, 3, 2]]) {
    const { t, v } = ppgFrames(bpm, sec, jit)
    out.push([OP.PPG_RESAMPLE, enc.ppgResample(t, v, 30)])
    const sig = referenceFlatCall(OP.PPG_RESAMPLE, enc.ppgResample(t, v, 30))
    out.push([OP.PPG_FILTER, enc.ppgSignal(sig, 30)])
    const filt = referenceFlatCall(OP.PPG_FILTER, enc.ppgSignal(sig, 30))
    out.push([OP.PPG_ESTIMATE, enc.ppgSignal(filt, 30)])
  }
  out.push([OP.PPG_ESTIMATE, enc.ppgSignal(Array(200).fill(180), 30)]) // flat signal → no estimate
  return out
}

const fmt = (x: number) => String(x)
const close = (a: number, b: number) => (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))

function parse(text: string) {
  return text.split('\n').filter((l) => l && !l.startsWith('#')).map((line) => {
    const tok = line.trim().split(/\s+/)
    const op = OP[tok[0] as keyof typeof OP]
    const nIn = Number(tok[1])
    const input = tok.slice(2, 2 + nIn).map(Number)
    const nOut = Number(tok[2 + nIn])
    const expected = tok.slice(3 + nIn, 3 + nIn + nOut).map(Number)
    return { op, input, expected }
  })
}

if (process.argv.includes('--write')) {
  const lines = ['# libsisp parity fixtures — generated by `node scripts/core-parity.ts --write` from the TS reference.', '# <OP> <n_in> <in...> <n_out> <out...>   (flat ABI, see include/sisp_flat.h)']
  for (const [op, input] of cases()) {
    const o = referenceFlatCall(op, input)
    lines.push(`${NAMES[op]} ${input.length} ${input.map(fmt).join(' ')} ${o.length} ${o.map(fmt).join(' ')}`)
  }
  writeFileSync(FIXTURES, lines.join('\n') + '\n')
  console.log(`wrote ${lines.length - 2} cases → core/tests/fixtures/parity.txt`)
} else {
  const fx = parse(readFileSync(FIXTURES, 'utf8'))
  const backends: [string, FlatCall][] = [['ts', referenceFlatCall]]
  if (existsSync(WASM)) backends.push(['wasm', await instantiateCore(readFileSync(WASM))])
  else if (process.env.CI) throw new Error('public/core/sisp.wasm missing — run npm run build:core')
  let fail = 0
  for (const [name, call] of backends) {
    let bad = 0
    for (const { op, input, expected } of fx) {
      const got = call(op, [...input])
      if (got.length !== expected.length || got.some((g, i) => !close(g, expected[i]))) {
        if (bad++ < 5) console.error(`✗ ${name} ${NAMES[op]}: expected [${expected.slice(0, 12).join(', ')}] got [${got.slice(0, 12).join(', ')}]`)
      }
    }
    console.log(`${bad ? '✗' : '✓'} ${name}: ${fx.length - bad}/${fx.length} fixtures match`)
    fail += bad
  }
  if (fail) process.exit(1)
}
