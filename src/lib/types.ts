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
  agency: string
  /** dias de missão já cumpridos antes da série (para dose/osso) */
  missionStart: string
  priorCareerDoseMSv: number
  scenario: L
  readings: Reading[]
}
