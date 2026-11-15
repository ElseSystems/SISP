/**
 * Mission-day timeline (station time = GMT, the ISS standard). Inspired by the ISS daily plan:
 * wake/post-sleep, Daily Planning Conferences (DPC), ~2.5 h exercise, pre-sleep.
 * ⚠️ Illustrative schedule for the prototype, not an actual NASA timeline.
 */
import type { Tab } from './store'
import type { HazardId } from './knowledge'
import { l } from './i18n'
import type { L } from './i18n'

export type TaskKind = 'measure' | 'test' | 'exercise' | 'ops' | 'sleep' | 'report' | 'meal'
export interface MissionTask {
  id: string
  /** minutes after 00:00 GMT */
  start: number
  dur: number
  kind: TaskKind
  title: L
  why: L
  hazard?: HazardId
  /** where the task is done in the app */
  tab?: Tab
  /** prompts a reminder when it becomes due */
  remind?: boolean
  /** auto-completed by data (check-in, PVT, pulse, report) */
  auto?: boolean
}

const hm = (h: number, m = 0) => h * 60 + m

export const MISSION_DAY: MissionTask[] = [
  { id: 'wake', start: hm(6), dur: 10, kind: 'sleep', title: l('Despertar · registrar horas de sono', 'Wake-up · log sleep hours'), why: l('Sono curto é o risco comportamental nº 1 na ISS (~6 h/noite).', 'Short sleep is the #1 behavioral risk on the ISS (~6 h/night).'), hazard: 'isolation' },
  { id: 'checkin', start: hm(6, 15), dur: 20, kind: 'measure', title: l('Check-in em jejum: PA, FC, glicemia, temperatura, humor', 'Fasting check-in: BP, HR, glucose, temperature, mood'), why: l('Medidas no mesmo horário e condição tornam a comparação com a SUA base válida.', 'Same time and condition every day makes the comparison with YOUR baseline valid.'), tab: 'checkin', remind: true, auto: true },
  { id: 'pulse', start: hm(6, 35), dur: 5, kind: 'test', title: l('Pulso pela câmera (30 s, opcional)', 'Camera pulse (30 s, optional)'), why: l('Confere a FC de repouso sem equipamento extra.', 'Cross-checks resting HR with no extra hardware.'), tab: 'tests', remind: true, auto: true },
  { id: 'dpc1', start: hm(7, 30), dur: 15, kind: 'ops', title: l('Conferência de planejamento (DPC) com o solo', 'Daily Planning Conference (DPC) with the ground'), why: l('Janela para levantar dúvidas médicas de rotina.', 'Window to raise routine medical questions.'), hazard: 'distance' },
  { id: 'science', start: hm(8), dur: 120, kind: 'ops', title: l('Bloco de trabalho / ciência', 'Work / science block'), why: l('Tarefas críticas exigem vigilância — por isso o PVT.', 'Critical tasks require vigilance — hence the PVT.') },
  { id: 'ared', start: hm(10, 15), dur: 75, kind: 'exercise', title: l('Exercício resistido (ARED)', 'Resistive exercise (ARED)'), why: l('Contramedida para perda óssea de 1–1,5%/mês e atrofia muscular.', 'Countermeasure for 1–1.5%/month bone loss and muscle atrophy.'), hazard: 'gravity', remind: true },
  { id: 'lunch', start: hm(12, 30), dur: 60, kind: 'meal', title: l('Almoço + hidratação', 'Lunch + hydration'), why: l('Nutrição adequada é risco mapeado pelo HRP.', 'Adequate nutrition is an HRP-mapped risk.'), hazard: 'environment' },
  { id: 'pvt', start: hm(14), dur: 5, kind: 'test', title: l('PVT de 3 min (fadiga)', '3-min PVT (fatigue)'), why: l('Tempo de reação detecta fadiga antes que você a perceba.', 'Reaction time detects fatigue before you notice it.'), hazard: 'isolation', tab: 'tests', remind: true, auto: true },
  { id: 'cevis', start: hm(15, 30), dur: 60, kind: 'exercise', title: l('Aeróbico (esteira T2 / CEVIS)', 'Aerobic (T2 treadmill / CEVIS)'), why: l('Mantém capacidade cardiovascular e tolerância ortostática para o retorno.', 'Maintains cardiovascular fitness and orthostatic tolerance for return.'), hazard: 'gravity', remind: true },
  { id: 'report', start: hm(18, 30), dur: 15, kind: 'report', title: l('Relatório ao flight surgeon + DPC da noite', 'Flight surgeon report + evening DPC'), why: l('Pacote compacto que sobrevive ao atraso de comunicação.', 'Compact package that survives the communication delay.'), hazard: 'distance', tab: 'ground', remind: true, auto: true },
  { id: 'dinner', start: hm(19, 30), dur: 60, kind: 'meal', title: l('Jantar em grupo', 'Crew dinner'), why: l('Coesão da equipe protege a saúde comportamental.', 'Crew cohesion protects behavioral health.'), hazard: 'isolation' },
  { id: 'presleep', start: hm(21), dur: 30, kind: 'sleep', title: l('Pré-sono: luz âmbar, sem telas', 'Pre-sleep: amber light, no screens'), why: l('Iluminação ajustável da ISS (SSLA) ajuda o ritmo circadiano.', 'The ISS tunable lighting (SSLA) supports the circadian rhythm.'), hazard: 'environment', remind: true },
  { id: 'sleep', start: hm(21, 30), dur: 510, kind: 'sleep', title: l('Sono (meta ≥ 7 h)', 'Sleep (target ≥ 7 h)'), why: l('AASM: ≥ 7 h para adultos.', 'AASM: ≥ 7 h for adults.') },
]

export const nowMinutesGmt = (d = new Date()) => d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60
export const fmtHm = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export type TaskState = 'done' | 'due' | 'missed' | 'upcoming' | 'running'
export function taskState(task: MissionTask, now: number, done: boolean): TaskState {
  if (done) return 'done'
  if (now < task.start) return 'upcoming'
  if (now < task.start + Math.max(task.dur, 30)) return task.remind || task.auto ? 'due' : 'running'
  return task.remind || task.auto ? 'missed' : 'done'
}

export function nextTask(now: number, doneIds: string[]) {
  return MISSION_DAY.find((t) => !doneIds.includes(t.id) && (t.start > now || taskState(t, now, false) === 'due'))
}
