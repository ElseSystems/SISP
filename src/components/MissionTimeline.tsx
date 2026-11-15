import { useMemo } from 'react'
import { KIND_STYLE, useDoneToday, useGmtNow, useToday } from '../lib/mission'
import { motion } from 'framer-motion'
import { Card, SourceLinks } from './ui'
import { Icon, IconText } from './Icon'
import { useStore } from '../lib/store'
import { isoDay } from '../lib/crew'
import { MISSION_DAY, fmtHm, nowMinutesGmt, taskState } from '../lib/schedule'
import type { MissionTask, TaskState } from '../lib/schedule'
import { HAZARDS, SOURCES } from '../lib/knowledge'
import { useDonki } from '../lib/useDonki'
import { flareRank, fmtUtc, pickScenario } from '../lib/spaceWeather'
import { item, list } from '../lib/motion'
import { t, tr } from '../lib/i18n'

const STATE_LABEL = (): Record<TaskState, string> => ({
  done: t('feito', 'done'), due: t('agora', 'due now'), missed: t('atrasado', 'overdue'), upcoming: t('próximo', 'upcoming'), running: t('em curso', 'in progress'),
})

export default function MissionTimeline() {
  const now = useGmtNow()
  const done = useDoneToday()
  const toggle = useStore((s) => s.toggleTask)
  const setTab = useStore((s) => s.setTab)
  const solar = useStore((s) => s.solar)
  const solarLog = useStore((s) => s.solarLog)
  const trigger = useStore((s) => s.triggerSolar)
  const notify = useStore((s) => s.notify)
  const setNotify = useStore((s) => s.setNotify)
  const { d } = useDonki()
  const today = useToday()
  const labels = STATE_LABEL()
  const scenario = d ? pickScenario(d) : null
  const DAY0 = 6 * 60, DAY1 = 23 * 60
  const pct = (m: number) => `${((Math.min(DAY1, Math.max(DAY0, m)) - DAY0) / (DAY1 - DAY0)) * 100}%`
  const counts = MISSION_DAY.filter((x) => x.remind || x.auto)
  const doneCount = counts.filter((x) => done.includes(x.id)).length

  // real DONKI flares of the last 7 days of the data window
  const week = useMemo(() => {
    if (!d) return []
    const endT = Date.parse(d.FLR.window[1] + 'T23:59:59Z')
    return d.FLR.events.filter((f) => endT - Date.parse(f.peak) < 7 * 86400e3).map((f) => ({ ...f, x: 1 - (endT - Date.parse(f.peak)) / (7 * 86400e3) }))
  }, [d])
  const todaysEvents = solarLog.filter((e) => isoDay(new Date(e.at)) === today)

  const enableNotify = async () => {
    if (!('Notification' in window)) return
    const p = await Notification.requestPermission()
    setNotify(p === 'granted')
  }

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Card className="lg:col-span-8" title={t('🗓️ Dia de missão · horário da estação (GMT)', '🗓️ Mission day · station time (GMT)')}
        right={<span className="font-mono text-body-sm text-fg-2">{fmtHm(now)} GMT · {doneCount}/{counts.length} ✓</span>}>
        {/* day bar */}
        <div className="relative mb-4 h-10 rounded-xl bg-surface-2" aria-hidden>
          {MISSION_DAY.filter((x) => x.start < DAY1).map((x) => (
            <div key={x.id} className="absolute top-1.5 h-7 rounded-md" title={`${fmtHm(x.start)} ${tr(x.title)}`}
              style={{ left: pct(x.start), width: `max(4px, calc(${pct(x.start + Math.min(x.dur, DAY1 - x.start))} - ${pct(x.start)}))`, background: `color-mix(in oklab, ${KIND_STYLE[x.kind].color} ${done.includes(x.id) ? 25 : 55}%, transparent)` }} />
          ))}
          {solar && <div className="absolute inset-y-0 w-1 animate-pulse bg-critical" style={{ left: pct(now) }} />}
          <div className="absolute -top-1 bottom-[-4px] w-0.5 bg-fg-1 shadow-[0_0_8px_white]" style={{ left: pct(now) }} />
          {[6, 9, 12, 15, 18, 21].map((h) => <span key={h} className="absolute -bottom-5 -translate-x-1/2 font-mono text-[0.7rem] text-fg-3" style={{ left: pct(h * 60) }}>{h}h</span>)}
        </div>
        <motion.ol variants={list} initial="initial" animate="enter" className="relative mt-8 space-y-2 border-l border-line pl-5">
          {solar && (
            <motion.li variants={item} className="relative rounded-xl border-2 border-critical bg-[#1A0609] p-3">
              <span className="absolute -left-[29px] top-3 flex h-4 w-4 items-center justify-center rounded-full bg-critical ring-4 ring-critical/30" />
              <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-body-sm text-critical">{fmtHm(nowMinutesGmt(new Date(solar.startedAt)))}</span><b className="text-fg-1"><Icon e="☢" className="mr-1" />{t('Evento de partículas solares — abrigo', 'Solar particle event — shelter')}</b>
                <span className="text-meta text-fg-2">{solar.sep.id}{solar.flare ? ` · ${solar.flare.classType}` : ''}</span></div>
              <p className="text-body-sm text-fg-2">{t('Tarefas pausadas até a liberação do solo. EVA cancelada.', 'Tasks on hold until ground all-clear. EVA cancelled.')}</p>
            </motion.li>
          )}
          {todaysEvents.map((e) => (
            <motion.li variants={item} key={e.at} className="relative rounded-xl border border-warning/50 bg-surface-1 p-3 text-body-sm">
              <span className="absolute -left-[27px] top-3.5 h-3 w-3 rounded-full bg-warning" />
              <span className="font-mono text-warning">{fmtHm(nowMinutesGmt(new Date(e.at)))}</span> · ☢️ SEP {e.flare ?? ''} · +{e.doseMSv.toFixed(2)} mSv · {e.sheltered ? t('abrigado', 'sheltered') : t('sem abrigo', 'unsheltered')}{e.replay ? ` · ${t('replay maio/2024', 'May 2024 replay')}` : ''}
            </motion.li>
          ))}
          {MISSION_DAY.map((task) => <TaskRow key={task.id} task={task} state={taskState(task, now, done.includes(task.id))} label={labels} onToggle={() => toggle(today, task.id)} onGo={task.tab ? () => setTab(task.tab!) : undefined} paused={!!solar && task.kind !== 'sleep'} />)}
        </motion.ol>
      </Card>

      <div className="space-y-4 lg:col-span-4">
        <Card title={t('🔔 Lembretes', '🔔 Reminders')}>
          <p className="text-body-sm text-fg-2">{t('O SISP avisa quando uma medição vence (no app, offline). Opcional: notificações do sistema.', 'SISP prompts you when a measurement is due (in-app, offline). Optional: system notifications.')}</p>
          <button onClick={notify ? () => setNotify(false) : enableNotify} className="mt-2 rounded-lg border border-line-strong px-3 py-1.5 text-body-sm text-fg-1 hover:bg-surface-3">
            <IconText text={notify ? t('🔕 Desativar notificações', '🔕 Disable notifications') : t('🔔 Ativar notificações', '🔔 Enable notifications')} iconClassName="mr-1" />
          </button>
        </Card>
        <Card title={t('☀️ Clima espacial real · últimos 7 dias (DONKI)', '☀️ Real space weather · last 7 days (DONKI)')}>
          <div className="relative h-16 rounded-lg bg-surface-2">
            {week.map((f) => {
              const r = flareRank(f.classType)
              const big = r >= 1000
              return <a key={f.id} href={f.link} target="_blank" rel="noreferrer" title={`${f.classType} · ${fmtUtc(f.peak)}`}
                className="absolute bottom-1 w-1.5 -translate-x-1/2 rounded-t" style={{ left: `${f.x * 100}%`, height: `${Math.min(56, 8 + Math.log10(r) * 12)}px`, background: big ? 'var(--sisp-warning)' : 'var(--sisp-caution)' }} />
            })}
            {!week.length && <span className="absolute inset-0 flex items-center justify-center text-meta text-fg-3">{t('Sem erupções na janela', 'No flares in the window')}</span>}
          </div>
          <div className="mt-1 flex justify-between font-mono text-[0.7rem] text-fg-3"><span>−7 d</span><span>{d?.FLR.window[1]}</span></div>
          <p className="mt-2 text-body-sm text-fg-2">{week.length} {t('erupções', 'flares')} · {week.filter((f) => f.classType.startsWith('M')).length} M · {week.filter((f) => f.classType.startsWith('X')).length} X · SEP {d?.summary.sepCount ?? 0} {t('na janela', 'in window')}{d?.live ? ` · ${t('ao vivo', 'live')}` : ` · ${t('snapshot offline', 'offline snapshot')}`}</p>
          {scenario && !solar && (
            <button onClick={() => trigger(scenario)} className="mt-3 w-full rounded-xl bg-critical/90 py-2 font-bold text-[#01030B] hover:bg-critical">
              <Icon e="☢" className="mr-1" />{scenario.replay ? t('Injetar SEP real (maio/2024) na timeline', 'Inject real SEP (May 2024) into the timeline') : t('Injetar o SEP real mais recente', 'Inject the latest real SEP')}
            </button>
          )}
          <SourceLinks sources={[SOURCES.donki, SOURCES.srag]} />
        </Card>
        <Card title={t('Por que essa rotina?', 'Why this routine?')}>
          <ul className="space-y-1.5 text-body-sm text-fg-2">
            <li><Icon e="🩺" className="mr-1" />{t('Mesma hora, mesma condição: só assim o desvio da SUA base tem significado.', 'Same time, same condition: only then is the deviation from YOUR baseline meaningful.')}</li>
            <li><Icon e="🏋" className="mr-1" />{t('~2,5 h/dia de exercício é contramedida obrigatória na ISS.', '~2.5 h/day of exercise is a mandatory countermeasure on the ISS.')}</li>
            <li><Icon e="⚡" className="mr-1" />{t('O PVT à tarde captura a queda circadiana de vigilância.', 'The afternoon PVT captures the circadian dip in vigilance.')}</li>
            <li><Icon e="📡" className="mr-1" />{t('O relatório da noite chega ao solo mesmo com 20 min de atraso.', 'The evening report reaches the ground even with a 20-min delay.')}</li>
          </ul>
          <p className="mt-2 text-meta text-fg-3">{t('Rotina ilustrativa inspirada no plano diário da ISS — não é uma timeline oficial da NASA.', 'Illustrative routine inspired by the ISS daily plan — not an official NASA timeline.')}</p>
          <SourceLinks sources={[SOURCES.standardMeasures, SOURCES.barger2014]} />
        </Card>
      </div>
    </div>
  )
}

function TaskRow({ task, state, label, onToggle, onGo, paused }: { task: MissionTask; state: TaskState; label: Record<TaskState, string>; onToggle: () => void; onGo?: () => void; paused: boolean }) {
  const k = KIND_STYLE[task.kind]
  const tone = state === 'due' ? 'border-accent bg-accent/10 shadow-glow-accent' : state === 'missed' ? 'border-warning/60 bg-surface-1' : state === 'done' ? 'border-line-subtle opacity-60' : 'border-line bg-surface-1'
  return (
    <motion.li variants={item} className={`relative rounded-xl border p-3 transition ${tone}`}>
      <span className="absolute -left-[27px] top-3.5 h-3 w-3 rounded-full ring-4 ring-bg" style={{ background: state === 'done' ? 'var(--sisp-nominal)' : k.color }} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-body-sm text-fg-2">{fmtHm(task.start)}</span>
        <span className="font-semibold text-fg-1"><Icon e={k.icon} className="mr-1" />{tr(task.title)}</span>
        {task.hazard && <span className="text-meta text-fg-3" title={tr(HAZARDS[task.hazard].name)}><Icon e={HAZARDS[task.hazard].icon} /></span>}
        <span className={`rounded-full px-2 text-meta ${state === 'due' ? 'bg-accent text-accent-ink' : state === 'missed' ? 'bg-warning/20 text-warning' : state === 'done' ? 'text-nominal' : 'text-fg-3'}`}>{state === 'done' ? '✓ ' : ''}{label[state]}</span>
        {paused && state !== 'done' && <span className="text-meta text-critical"><Icon e="⏸" className="mr-1" />SEP</span>}
        <span className="ml-auto flex gap-1.5">
          {onGo && state !== 'done' && <button onClick={onGo} className="rounded-lg bg-accent px-2.5 py-1 text-meta font-bold text-accent-ink hover:bg-accent-strong">{t('Fazer', 'Start')} →</button>}
          {!task.auto && <button onClick={onToggle} aria-pressed={state === 'done'} className="rounded-lg border border-line-strong px-2 py-1 text-meta text-fg-2 hover:text-fg-1">{state === 'done' ? t('desfazer', 'undo') : '✓'}</button>}
        </span>
      </div>
      <p className="mt-0.5 text-body-sm text-fg-3">{tr(task.why)}</p>
    </motion.li>
  )
}
