import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BodyRegionId, EnvironmentId, HazardId } from './knowledge'
import type { CrewMember, PulseEstimate, PvtResult, Reading } from './types'
import { eventDose } from './spaceWeather'
import type { ActiveSolar, SolarLogEntry, SolarScenario } from './spaceWeather'
import { generateCrew, isoDay, addDays } from './crew'
import { l, setCurrentLang } from './i18n'
import type { L, Lang } from './i18n'

export type Tab = 'dashboard' | 'today' | 'checkin' | 'tests' | 'trends' | 'ground' | 'emergency' | 'nasa' | 'about'

export const BADGES: Record<string, L> = {
  first: l('🥇 Primeiro check-in', '🥇 First check-in'),
  streak3: l('🔥 3 dias seguidos', '🔥 3-day streak'),
  streak7: l('🌟 7 dias seguidos', '🌟 7-day streak'),
  sleep7: l('😴 Noite de 7 h+', '😴 7 h+ night'),
  phq: l('🧠 Cuidou da mente (PHQ-2)', '🧠 Mind check (PHQ-2)'),
  pvt: l('⚡ Teste de vigilância (PVT)', '⚡ Vigilance test (PVT)'),
  pulse: l('📷 Pulso pela câmera', '📷 Camera pulse'),
  shelter: l('🛡️ Abrigo em tempestade solar', '🛡️ Solar storm shelter'),
  report: l('📡 Relatório ao flight surgeon', '📡 Flight surgeon report'),
}
type BadgeId = keyof typeof BADGES

interface State {
  lang: Lang
  env: EnvironmentId
  crew: CrewMember[]
  selectedId: string
  tab: Tab
  xp: number
  streak: number
  lastCheckin?: string
  badges: BadgeId[]
  /** onboarding already seen (persisted) */
  onboarded: boolean
  /** body-map focus — shared so the demo director can drive it (not persisted) */
  region: BodyRegionId | null
  hazard: HazardId | null
  /** scripted one-click demo running (not persisted) */
  demo: boolean
  showIntro: boolean
  /** solar particle event in progress (persisted so a reload keeps the crew in the shelter) */
  solar: ActiveSolar | null
  solarLog: SolarLogEntry[]
  /** mission-day tasks marked done: { 'YYYY-MM-DD': ['wake', …] } */
  tasks: Record<string, string[]>
  /** epoch ms of the last flight-surgeon report sent (simulated) */
  reportSentAt?: number
  notify: boolean
  setLang: (l: Lang) => void
  setEnv: (e: EnvironmentId) => void
  select: (id: string) => void
  setTab: (t: Tab) => void
  setRegion: (r: BodyRegionId | null) => void
  setHazard: (h: HazardId | null) => void
  setDemo: (on: boolean) => void
  setIntro: (on: boolean) => void
  addReading: (r: Reading) => { xpGained: number; newBadges: BadgeId[] }
  addPvt: (r: PvtResult) => void
  addPulse: (p: PulseEstimate) => void
  triggerSolar: (s: SolarScenario, durationSec?: number) => void
  shelter: () => void
  allClear: () => void
  toggleTask: (date: string, id: string, done?: boolean) => void
  markReportSent: () => void
  setNotify: (on: boolean) => void
  reset: () => void
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      lang: 'en', // English first (NASA judging); PT is one click away
      env: 'iss',
      crew: generateCrew(),
      selectedId: 't1',
      tab: 'dashboard',
      xp: 0,
      streak: 0,
      badges: [],
      onboarded: false,
      region: 'heart',
      hazard: null,
      demo: false,
      showIntro: false,
      solar: null,
      solarLog: [],
      tasks: {},
      notify: false,
      setLang: (lang) => { setCurrentLang(lang); set({ lang }) },
      setEnv: (env) => set({ env }),
      select: (selectedId) => set({ selectedId }),
      setTab: (tab) => set({ tab }),
      setRegion: (region) => set({ region }),
      setHazard: (hazard) => set({ hazard }),
      setDemo: (demo) => set({ demo, showIntro: false, onboarded: true }),
      setIntro: (showIntro) => set(showIntro ? { showIntro } : { showIntro, onboarded: true }),
      addReading: (r) => {
        const s = get()
        const crew = s.crew.map((c) => {
          if (c.id !== s.selectedId) return c
          const readings = c.readings.filter((x) => x.date !== r.date)
          readings.push(r)
          readings.sort((a, b) => a.date.localeCompare(b.date))
          return { ...c, readings }
        })
        const yesterday = isoDay(addDays(new Date(r.date + 'T12:00:00'), -1))
        const streak = s.lastCheckin === r.date ? s.streak : s.lastCheckin === yesterday ? s.streak + 1 : 1
        let xpGained = s.lastCheckin === r.date ? 5 : 20
        if (r.sleep >= 7) xpGained += 5
        if (r.phq2 !== undefined) xpGained += 5
        const has = new Set<BadgeId>(s.badges)
        const newBadges: BadgeId[] = []
        const award = (b: BadgeId) => { if (!has.has(b)) { has.add(b); newBadges.push(b) } }
        award('first')
        if (streak >= 3) award('streak3')
        if (streak >= 7) award('streak7')
        if (r.sleep >= 7) award('sleep7')
        if (r.phq2 !== undefined) award('phq')
        set({ crew, xp: s.xp + xpGained, streak, lastCheckin: r.date, badges: [...has], tasks: withTask(s.tasks, r.date, 'checkin') })
        return { xpGained, newBadges }
      },
      addPvt: (r) => {
        const s = get()
        set({
          crew: s.crew.map((c) => (c.id === s.selectedId ? { ...c, pvt: [...(c.pvt ?? []), r] } : c)),
          xp: s.xp + 15,
          badges: s.badges.includes('pvt') ? s.badges : [...s.badges, 'pvt'],
          tasks: withTask(s.tasks, r.date, 'pvt'),
        })
      },
      addPulse: (p) => {
        const s = get()
        set({
          crew: s.crew.map((c) => (c.id === s.selectedId ? { ...c, pulse: [...(c.pulse ?? []), p].slice(-20) } : c)),
          xp: s.xp + 10,
          badges: s.badges.includes('pulse') ? s.badges : [...s.badges, 'pulse'],
          tasks: withTask(s.tasks, p.date, 'pulse'),
        })
      },
      triggerSolar: (sc, durationSec = 90) => set({ solar: { ...sc, startedAt: Date.now(), durationSec }, region: 'brain', hazard: 'radiation' }),
      shelter: () => {
        const s = get()
        if (!s.solar || s.solar.shelteredAt) return
        set({ solar: { ...s.solar, shelteredAt: Date.now() }, xp: s.xp + 25, badges: s.badges.includes('shelter') ? s.badges : [...s.badges, 'shelter'] })
      },
      allClear: () => {
        const s = get()
        if (!s.solar) return
        const { dose } = eventDose(s.solar, s.env)
        const entry: SolarLogEntry = { id: s.solar.sep.id, at: Date.now(), env: s.env, doseMSv: dose, sheltered: !!s.solar.shelteredAt, replay: s.solar.replay, flare: s.solar.flare?.classType }
        set({ solar: null, solarLog: [...s.solarLog, entry], hazard: null })
      },
      toggleTask: (date, id, done) => {
        const s = get()
        const cur = new Set(s.tasks[date] ?? [])
        const on = done ?? !cur.has(id)
        if (on) cur.add(id); else cur.delete(id)
        set({ tasks: { ...s.tasks, [date]: [...cur] } })
      },
      markReportSent: () => {
        const s = get()
        set({ reportSentAt: Date.now(), xp: s.xp + 10, badges: s.badges.includes('report') ? s.badges : [...s.badges, 'report'], tasks: withTask(s.tasks, isoDay(new Date()), 'report') })
      },
      setNotify: (notify) => set({ notify }),
      reset: () => set({ crew: generateCrew(), xp: 0, streak: 0, lastCheckin: undefined, badges: [], selectedId: 't1', solar: null, solarLog: [], tasks: {}, reportSentAt: undefined }),
    }),
    {
      name: 'sisp-v3',
      version: 4,
      // v4 adds PVT/pulse history on the crew + solar/timeline state: regenerate the simulated crew
      migrate: (old) => ({ ...(old as object), crew: generateCrew(), solar: null, solarLog: [], tasks: {} }) as unknown as State,
      partialize: ({ region: _r, hazard: _h, demo: _d, showIntro: _s, ...rest }) => rest,
      onRehydrateStorage: () => (state) => { if (state) setCurrentLang(state.lang) },
    },
  ),
)

setCurrentLang(useStore.getState().lang)

export const level = (xp: number) => Math.floor(xp / 100) + 1

function withTask(tasks: Record<string, string[]>, date: string, id: string) {
  const cur = tasks[date] ?? []
  return cur.includes(id) ? tasks : { ...tasks, [date]: [...cur, id] }
}
