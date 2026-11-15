import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { useStore, level, BADGES } from './lib/store'
import type { Tab } from './lib/store'
import { ENVIRONMENTS, SEVERITY_COLOR, SEVERITY_LABEL } from './lib/knowledge'
import type { EnvironmentId } from './lib/knowledge'
import { assessCrew } from './lib/assessment'
import { generateCrew, isoDay } from './lib/crew'
import { setCurrentLang, t, tr } from './lib/i18n'
import Dashboard from './components/Dashboard'
import Checkin from './components/Checkin'
import Trends from './components/Trends'
import Ground from './components/Ground'
import Emergency from './components/Emergency'
import NasaData from './components/NasaData'
import About from './components/About'
import MissionTimeline from './components/MissionTimeline'
import SelfTests from './components/SelfTests'
import SolarAlert from './components/SolarAlert'
import { ReminderToaster } from './components/Reminders'
import { useSolarContext } from './lib/useSolar'
import { useCoreBackend } from './lib/useCore'
import { screen } from './lib/motion'
import Onboarding from './components/Onboarding'
import DemoDirector from './components/DemoDirector'
import { Disclaimer } from './components/ui'
import { StatusBadge } from './components/StatusBadge'
import { STATUS } from './lib/status'
import type { CrewMember } from './lib/types'
import type { Severity } from './lib/knowledge'

const TAB_IDS: Tab[] = ['dashboard', 'today', 'checkin', 'tests', 'trends', 'ground', 'emergency', 'nasa', 'about']
const tabLabel = (id: Tab) => ({
  dashboard: t('🧍 Painel', '🧍 Dashboard'),
  today: t('🗓️ Dia de missão', '🗓️ Mission day'),
  checkin: '✍️ Check-in',
  tests: t('⚡ Autotestes', '⚡ Self-tests'),
  trends: t('📈 Tendências', '📈 Trends'),
  ground: t('📡 Agir / Solo', '📡 Act / Ground'),
  emergency: t('🚨 Emergência', '🚨 Emergency'),
  nasa: t('🛰️ Dados NASA', '🛰️ NASA data'),
  about: t('ℹ️ Sobre', 'ℹ️ About'),
})[id]

const INITIAL_HASH = window.location.hash.slice(1)

export default function App() {
  const { lang, env, crew, selectedId, tab, xp, streak, badges, lastCheckin, setLang, setEnv, select, setTab, onboarded, demo, showIntro, setDemo, setIntro } = useStore()
  setCurrentLang(lang)
  const today = isoDay(new Date())

  useEffect(() => { document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR' }, [lang])

  // Simulated series follows the calendar: if only simulated data from another day, regenerate.
  useEffect(() => {
    const stale = crew.every((c) => c.readings.every((r) => r.source === 'sim') && c.readings.at(-1)?.date !== today)
    if (stale) useStore.setState({ crew: generateCrew() })
  }, [crew, today])

  // Hash deep-links (#nasa, #emergency…, #demo starts the guided tour, #intro the briefing).
  useEffect(() => {
    if (TAB_IDS.includes(INITIAL_HASH as Tab)) setTab(INITIAL_HASH as Tab)
    if (INITIAL_HASH === 'demo') setDemo(true)
    else if (INITIAL_HASH === 'intro' || (!onboarded && !TAB_IDS.includes(INITIAL_HASH as Tab))) setIntro(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { history.replaceState(null, '', `#${tab}`) }, [tab])
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.slice(1)
      if (TAB_IDS.includes(h as Tab)) setTab(h as Tab)
      else if (h === 'demo') setDemo(true)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [setTab, setDemo])

  const c = crew.find((x) => x.id === selectedId) ?? crew[0]
  const solarCtx = useSolarContext()
  const coreBackend = useCoreBackend()
  const solarKey = `${solarCtx.active}-${solarCtx.sheltered}-${solarCtx.liveDoseMSv.toFixed(2)}-${solarCtx.loggedDoseMSv.toFixed(2)}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const assessments = useMemo(() => Object.fromEntries(crew.map((m) => [m.id, assessCrew(m, env, solarCtx)])), [crew, env, solarKey, coreBackend])
  const a = assessments[c.id]
  const pending = lastCheckin !== today
  const fleetWorst = Math.max(...crew.map((m) => assessments[m.id]?.overall ?? 0)) as 0 | 1 | 2 | 3
  const met = useMissionClock(c.missionStart)

  return (
    <MotionConfig reducedMotion="user">
    <div className={`space-bg min-h-screen text-slate-100 ${demo ? 'pb-28' : ''} ${tab === 'emergency' ? 'paused' : ''}`}>
      <header className="sticky top-0 z-20 border-b border-sky-500/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="mr-auto">
            <h1 className="text-lg font-black tracking-tight"><span className="text-glow">🛡️ SISP</span> <span className="text-sky-400">· {t('Sistema de Saúde e Prevenção', 'Health & Prevention System')}</span></h1>
            <p className="text-meta text-slate-400">{t('Autoavaliação e prevenção de saúde para tripulações espaciais · NASA Space Apps', 'Health self-assessment and prevention for space crews · NASA Space Apps')}</p>
          </div>
          <div className="hidden items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-950/60 px-3 py-1 md:flex" title={t('Tempo decorrido de missão (MET) do tripulante selecionado', 'Mission Elapsed Time (MET) of the selected crew member')}>
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: SEVERITY_COLOR[fleetWorst] }} />
            <span className="text-meta uppercase tracking-widest text-slate-400">MET</span>
            <span className="mono text-xs text-sky-200">{met}</span>
          </div>
          <button onClick={() => setDemo(!demo)}
            className={`rounded-lg px-3 py-1 text-xs font-bold transition ${demo ? 'bg-red-500 text-white' : 'bg-sky-400 text-slate-950 shadow-[0_0_16px_rgba(56,189,248,0.55)] hover:bg-sky-300'}`}>
            {demo ? `■ ${t('Parar demo', 'Stop demo')}` : `▶ ${t('Demo', 'Demo')}`}
          </button>
          <button onClick={() => setIntro(true)} aria-label={t('Briefing', 'Briefing')} title={t('Briefing da missão', 'Mission briefing')}
            className="rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:border-slate-400">❔</button>
          <div className="flex overflow-hidden rounded-lg border border-slate-600 text-xs" role="group" aria-label="language">
            {(['pt', 'en'] as const).map((lg) => (
              <button key={lg} onClick={() => setLang(lg)} className={`px-2 py-1 ${lang === lg ? 'bg-sky-500 font-bold text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}>{lg.toUpperCase()}</button>
            ))}
          </div>
          <label className="text-xs text-slate-400">{t('Ambiente', 'Environment')}
            <select value={env} onChange={(e) => setEnv(e.target.value as EnvironmentId)}
              className="ml-2 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-100">
              {(Object.keys(ENVIRONMENTS) as EnvironmentId[]).map((id) => <option key={id} value={id}>{ENVIRONMENTS[id].emoji} {tr(ENVIRONMENTS[id].name)}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1 text-xs" title={badges.map((b) => tr(BADGES[b])).join('\n') || t('Faça check-ins para ganhar medalhas', 'Check in to earn badges')}>
            <span className="font-bold text-amber-300">{t('Nv', 'Lv')} {level(xp)}</span>
            <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-700"><div className="h-full bg-amber-400" style={{ width: `${xp % 100}%` }} /></div>
            <span>{xp} XP</span><span>🔥 {streak}</span><span>🏅 {badges.length}</span>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-2">
          {crew.map((m) => {
            const s = assessments[m.id]?.overall ?? 0
            return (
              <button key={m.id} onClick={() => select(m.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-left text-xs transition ${m.id === c.id ? 'border-sky-400 bg-sky-500/10' : 'border-slate-700 hover:border-slate-500'}`}>
                <span className="text-xl">{m.avatar}</span>
                <span><span className="block font-semibold">{tr(m.name)}</span><span className="text-slate-400">{tr(m.role).split(' (')[0]}</span></span>
                <span className="ml-1 h-3 w-3 rounded-full" style={{ background: SEVERITY_COLOR[s] }} title={tr(SEVERITY_LABEL[s])} />
              </button>
            )
          })}
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {TAB_IDS.map((id) => (
            <button key={id} onClick={() => setTab(id)}
              className={`relative shrink-0 px-3 py-2 text-sm ${tab === id ? (id === 'emergency' ? 'text-red-300' : 'text-sky-300') : id === 'emergency' ? 'text-red-400/80 hover:text-red-300' : 'text-slate-400 hover:text-slate-200'}`}>
              {tabLabel(id)}{id === 'checkin' && pending && <span className="ml-1 rounded-full bg-amber-400 px-1.5 text-meta font-bold text-slate-950">1</span>}
              {tab === id && <motion.span layoutId="tab" className={`absolute inset-x-1 -bottom-px h-0.5 ${id === 'emergency' ? 'bg-red-400' : 'bg-sky-400'}`} />}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        {tab !== 'emergency' && <SolarAlert />}
        {a && tab !== 'emergency' && (
          <StatusHero c={c} index={crew.indexOf(c)} s={a.overall} days={a.radiation.days} env={env}
            pending={pending && tab !== 'checkin'} onCheckin={() => setTab('checkin')} onAct={tab === 'ground' ? undefined : () => setTab('ground')} />
        )}
        <AnimatePresence mode="wait">
          <motion.div key={tab + c.id} variants={screen} initial="initial" animate="enter" exit="exit">
            {tab === 'dashboard' && a && <Dashboard a={a} c={c} />}
            {tab === 'today' && <MissionTimeline />}
            {tab === 'checkin' && <Checkin key={c.id} />}
            {tab === 'tests' && <SelfTests key={c.id} />}
            {tab === 'trends' && <Trends c={c} />}
            {tab === 'ground' && a && <Ground c={c} a={a} met={met} />}
            {tab === 'emergency' && <Emergency />}
            {tab === 'nasa' && <NasaData />}
            {tab === 'about' && <About />}
          </motion.div>
        </AnimatePresence>
        <Disclaimer />
        <p className="mt-2 text-center text-meta text-slate-500" title={t('Mesmo resultado nos dois motores (npm run test:core)', 'Same results on both engines (npm run test:core)')}>
          ⚙️ {t('Motor de avaliação', 'Assessment engine')}: <span className="mono text-slate-400">{coreBackend === 'wasm' ? 'libsisp (C11 → WebAssembly)' : t('referência TypeScript (fallback)', 'TypeScript reference (fallback)')}</span>
        </p>
      </main>
      <AnimatePresence>{showIntro && !demo && <Onboarding key="intro" />}</AnimatePresence>
      {demo && <DemoDirector />}
      <ReminderToaster />
    </div>
    </MotionConfig>
  )
}

/** Mission Elapsed Time, ticking every second: "D075 · 14:02:31". */
function useMissionClock(missionStart: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  const ms = Math.max(0, now - new Date(missionStart + 'T00:00:00').getTime())
  const d = Math.floor(ms / 86400000)
  const hms = new Date(ms % 86400000).toISOString().slice(11, 19)
  return `D${String(d).padStart(3, '0')} · ${hms}`
}

/** Status hero bar: the crew member's overall status is the most important datum on screen. */
function StatusHero({ c, index, s, days, env, pending, onCheckin, onAct }:
  { c: CrewMember; index: number; s: Severity; days: number; env: EnvironmentId; pending: boolean; onCheckin: () => void; onAct?: () => void }) {
  const color = STATUS[s].color
  return (
    <section className="glass flex flex-wrap items-center gap-4 rounded-2xl px-5 py-4" aria-label={t('Status do tripulante', 'Crew member status')}>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] bg-surface-2 font-display text-title font-bold text-fg-1"
        style={{ borderColor: color, boxShadow: `0 0 18px color-mix(in oklab, ${color} 35%, transparent)` }} aria-hidden>
        {t('T', 'C')}{index + 1}
      </span>
      <div className="mr-auto min-w-0">
        <h2 className="font-display text-display-sm font-bold text-fg-1">{tr(c.name)}</h2>
        <p className="text-body-sm text-fg-2">
          {tr(c.role)} · {c.agency} · {t('dia', 'day')} {days} {t('de missão', 'of mission')} · {ENVIRONMENTS[env].emoji} {tr(ENVIRONMENTS[env].name)} ({t('atraso', 'delay')} {tr(ENVIRONMENTS[env].delayLabel)})
        </p>
        <p className="text-meta text-fg-3">{t('Cenário simulado', 'Simulated scenario')}: {tr(c.scenario)}</p>
      </div>
      <motion.div key={s} initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
        <StatusBadge s={s} size="lg" showLevel />
      </motion.div>
      <div className="flex flex-wrap gap-2">
        {pending && (
          <button onClick={onCheckin} className="rounded-lg border border-accent/60 px-3 py-2 text-body-sm font-semibold text-accent hover:bg-accent/10">
            {t('⏰ Check-in de hoje pendente', '⏰ Today’s check-in due')} <span className="text-xp">+20 XP</span>
          </button>
        )}
        {onAct && <button onClick={onAct} className="rounded-lg bg-accent px-4 py-2 text-body-sm font-bold text-accent-ink shadow-glow-accent hover:bg-accent-strong">
          {t('Agir / Solo →', 'Act / Ground →')}
        </button>}
      </div>
    </section>
  )
}
