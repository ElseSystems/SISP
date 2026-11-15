/**
 * NASA CCMC DONKI space weather → SISP solar particle event (SEP) scenario.
 * Offline-first: the bundled public/data/donki_space_weather.json is always available; when online
 * we also query the live DONKI API (CORS-enabled) and prefer a real SEP from the last days.
 * ⚠️ Event dose numbers below are illustrative prototype values, not a NASA dosimetry model.
 */
import type { EnvironmentId } from './knowledge'
import { core, ENV_NUMBERS, SHELTER_FACTOR as CORE_SHELTER_FACTOR } from '../core'
import { l } from './i18n'
import type { L } from './i18n'

export interface Flr { id: string; begin: string; peak: string; classType: string; source?: string; link: string }
export interface Sep { id: string; time: string; link: string; instruments?: string[] }
export interface Donki {
  fetchedAt: string
  SEP: { window: [string, string]; events: Sep[] }
  FLR: { window: [string, string]; events: Flr[] }
  CME: { window: [string, string]; total: number }
  summary: { sepCount: number; flrCount: number; xClassCount: number; mClassCount: number; cmeCount: number; strongestFlare: Flr | null }
  historicalExample?: { window: [string, string]; label: string; SEP: Sep[]; FLR_X: Flr[] }
  live?: boolean
}

/** A SEP scenario built from real DONKI records. */
export interface SolarScenario {
  sep: Sep
  flare: Flr | null
  /** true = replay of the May 2024 storm (no SEP in the current window); false = current/live event */
  replay: boolean
  label: L
}

export interface ActiveSolar extends SolarScenario {
  startedAt: number
  shelteredAt?: number
  /** event "passes" after this many real seconds (compressed mission time) */
  durationSec: number
}

export interface SolarLogEntry { id: string; at: number; env: EnvironmentId; doseMSv: number; sheltered: boolean; replay: boolean; flare?: string }

/**
 * Extra dose of a large SEP for an unsheltered crew, per environment (prototype values).
 * Order of magnitude only: magnetosphere protects the ISS; the Moon and deep space are exposed;
 * the Martian atmosphere attenuates (Curiosity RAD saw ~2× background in the Sept 2017 SEP).
 * Numbers live in the SISP core (src/core/constants.ts ⇄ core/src/sisp.c).
 */
export const SEP_DOSE_UNSHELTERED = Object.fromEntries(Object.entries(ENV_NUMBERS).map(([k, v]) => [k, v.sepDoseUnsheltered])) as Record<EnvironmentId, number>
/** dose-rate multiplier inside the storm shelter (mass/water around the crew) — prototype value */
export const SHELTER_FACTOR = CORE_SHELTER_FACTOR
export const DEEP_SPACE = Object.fromEntries(Object.entries(ENV_NUMBERS).map(([k, v]) => [k, v.deepSpace])) as Record<EnvironmentId, boolean>

const BASE = import.meta.env.BASE_URL
const API = 'https://ccmc.gsfc.nasa.gov/DONKI-API/get'
const day = (d: Date) => d.toISOString().slice(0, 10)

interface ApiFlr { flrID: string; beginTime: string; peakTime: string; classType: string; sourceLocation?: string; link: string }
interface ApiSep { sepID: string; eventTime: string; link: string; instruments?: { displayName: string }[] }

export async function loadDonki(): Promise<Donki> {
  const res = await fetch(`${BASE}data/donki_space_weather.json`)
  if (!res.ok) throw new Error('donki_space_weather.json')
  return res.json() as Promise<Donki>
}

/** Live DONKI query (last 30 days). Resolves null when offline — the bundled file stays the source. */
export async function fetchLiveDonki(signal?: AbortSignal): Promise<{ sep: Sep[]; flr: Flr[]; window: [string, string] } | null> {
  try {
    const end = new Date(), start = new Date(Date.now() - 30 * 86400000)
    const q = `?startDate=${day(start)}&endDate=${day(end)}`
    const [s, f] = await Promise.all([
      fetch(`${API}/SEP${q}`, { signal }).then((r) => (r.ok ? r.json() : [])) as Promise<ApiSep[] | null>,
      fetch(`${API}/FLR${q}`, { signal }).then((r) => (r.ok ? r.json() : [])) as Promise<ApiFlr[] | null>,
    ])
    return {
      window: [day(start), day(end)],
      sep: (s ?? []).map((x) => ({ id: x.sepID, time: x.eventTime, link: x.link, instruments: x.instruments?.map((i) => i.displayName) })),
      flr: (f ?? []).map((x) => ({ id: x.flrID, begin: x.beginTime, peak: x.peakTime, classType: x.classType, source: x.sourceLocation, link: x.link })),
    }
  } catch { return null }
}

export function flareRank(c?: string) {
  if (!c) return 0
  const b = ({ A: 1, B: 10, C: 100, M: 1000, X: 10000 } as Record<string, number>)[c[0]] ?? 0
  return b * (parseFloat(c.slice(1)) || 1)
}

/** Pick the SEP to drill on: newest real SEP in the window, else the May 2024 GOES >100 MeV event. */
export function pickScenario(d: Donki): SolarScenario | null {
  const current = [...d.SEP.events].sort((a, b) => b.time.localeCompare(a.time))[0]
  const flares = d.FLR.events
  if (current) {
    const flare = nearestFlareBefore(current.time, flares)
    return { sep: current, flare, replay: false, label: l(`SEP real do DONKI · ${fmtUtc(current.time)}`, `Real DONKI SEP · ${fmtUtc(current.time)}`) }
  }
  const h = d.historicalExample
  if (!h?.SEP.length) return null
  const sep = h.SEP.find((s) => s.instruments?.some((i) => i.includes('GOES') && i.includes('>100'))) ?? h.SEP.find((s) => s.instruments?.some((i) => i.includes('GOES'))) ?? h.SEP[0]
  const flare = nearestFlareBefore(sep.time, h.FLR_X)
  return { sep, flare, replay: true, label: l(`Replay real: tempestade de maio/2024 · ${fmtUtc(sep.time)}`, `Real replay: May 2024 storm · ${fmtUtc(sep.time)}`) }
}

function nearestFlareBefore(time: string, flares: Flr[]) {
  const t0 = Date.parse(time)
  const before = flares.filter((f) => { const p = Date.parse(f.peak); return p <= t0 && t0 - p < 36 * 3600e3 })
  return before.sort((a, b) => flareRank(b.classType) - flareRank(a.classType))[0] ?? [...flares].sort((a, b) => flareRank(b.classType) - flareRank(a.classType))[0] ?? null
}

export const fmtUtc = (iso: string) => iso.replace('T', ' ').replace(/:\d\dZ$|Z$/, '').slice(0, 16) + ' UTC'

/** Live accrued event dose (mSv) at time `now` — libsisp sisp_sep_event_dose. */
export function eventDose(s: ActiveSolar, env: EnvironmentId, now = Date.now()) {
  const d = core().sepDose(SEP_DOSE_UNSHELTERED[env], s.startedAt, s.shelteredAt ?? 0, s.durationSec, now, SHELTER_FACTOR)
  // avoided = what the crew avoided by sheltering (vs staying out for the whole event)
  return { dose: d.dose, progress: d.progress, avoided: d.avoided, projectedUnsheltered: d.projectedUnsheltered, done: d.done }
}
