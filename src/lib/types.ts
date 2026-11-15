import type { L } from './i18n'

export interface Reading {
  date: string // YYYY-MM-DD
  sys: number
  dia: number
  hr: number
  glucose: number
  temp: number
  sleep: number
  mood: number // 1–5
  phq2?: number // 0–6 (semanal ou quando informado)
  selfHarm?: boolean
  exerciseMin?: number
  source: 'sim' | 'manual'
}

export interface CrewMember {
  id: string
  name: L
  role: L
  avatar: string
  /** Drives the bust avatar only (UI). Optional: rows persisted before it existed fall back by crew id. */
  sex?: 'male' | 'female'
  agency: string
  /** dias de missão já cumpridos antes da série (para dose/osso) */
  missionStart: string
  priorCareerDoseMSv: number
  scenario: L
  readings: Reading[]
  /** Psychomotor Vigilance Test sessions (oldest → newest) */
  pvt?: PvtResult[]
  /** camera PPG pulse estimates (oldest → newest) */
  pulse?: PulseEstimate[]
}

/** PVT-B style session summary (Basner et al. 2011). */
export interface PvtResult {
  date: string // YYYY-MM-DD
  at: number // epoch ms
  durationSec: number
  n: number
  meanMs: number
  medianMs: number
  /** RT ≥ 355 ms (PVT-B lapse threshold) */
  lapses: number
  /** responses before the stimulus or < 100 ms */
  falseStarts: number
  /** mean response speed, 1000/RT (1/s) */
  speed: number
  source: 'sim' | 'manual'
}

/** Heart-rate estimate from fingertip photoplethysmography on the camera. */
export interface PulseEstimate {
  at: number
  date: string
  bpm: number
  /** 0–1 periodicity score of the signal */
  quality: number
  source: 'camera' | 'demo'
}
