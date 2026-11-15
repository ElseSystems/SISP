import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { EnvironmentId } from './knowledge'
import type { CrewMember, Reading } from './types'
import { generateCrew, isoDay, addDays } from './crew'
import { detectLang, l, setCurrentLang } from './i18n'
import type { L, Lang } from './i18n'

export type Tab = 'dashboard' | 'checkin' | 'trends' | 'ground' | 'emergency' | 'nasa' | 'about'

export const BADGES: Record<string, L> = {
  first: l('🥇 Primeiro check-in', '🥇 First check-in'),
  streak3: l('🔥 3 dias seguidos', '🔥 3-day streak'),
  streak7: l('🌟 7 dias seguidos', '🌟 7-day streak'),
  sleep7: l('😴 Noite de 7 h+', '😴 7 h+ night'),
  phq: l('🧠 Cuidou da mente (PHQ-2)', '🧠 Mind check (PHQ-2)'),
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
  setLang: (l: Lang) => void
  setEnv: (e: EnvironmentId) => void
  select: (id: string) => void
  setTab: (t: Tab) => void
  addReading: (r: Reading) => { xpGained: number; newBadges: BadgeId[] }
  reset: () => void
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      lang: detectLang(),
      env: 'iss',
      crew: generateCrew(),
      selectedId: 't1',
      tab: 'dashboard',
      xp: 0,
      streak: 0,
      badges: [],
      setLang: (lang) => { setCurrentLang(lang); set({ lang }) },
      setEnv: (env) => set({ env }),
      select: (selectedId) => set({ selectedId }),
      setTab: (tab) => set({ tab }),
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
        set({ crew, xp: s.xp + xpGained, streak, lastCheckin: r.date, badges: [...has] })
        return { xpGained, newBadges }
      },
      reset: () => set({ crew: generateCrew(), xp: 0, streak: 0, lastCheckin: undefined, badges: [], selectedId: 't1' }),
    }),
    {
      name: 'sisp-v3',
      version: 3,
      onRehydrateStorage: () => (state) => { if (state) setCurrentLang(state.lang) },
    },
  ),
)

setCurrentLang(useStore.getState().lang)

export const level = (xp: number) => Math.floor(xp / 100) + 1
