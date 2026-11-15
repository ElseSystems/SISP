/**
 * "When to call the ground": depends on severity AND communication delay.
 * At Mars (up to ~20 min one-way) a question + answer takes ≥40 min, so the crew must act
 * autonomously first and send a structured report.
 * ⚠️ Prototype heuristic – not a medical protocol.
 */
import { ENVIRONMENTS } from './knowledge'
import type { EnvironmentId, Severity } from './knowledge'
import { t } from './i18n'

export function fmtDelay(sec: number) {
  if (sec < 60) return `${sec.toFixed(1)} s`
  return `${Math.round(sec / 60)} min`
}

export interface EscalationPlan { headline: string; contact: string; steps: string[]; roundTrip: string; autonomous: boolean }

export function escalationPlan(sev: Severity, env: EnvironmentId): EscalationPlan {
  const e = ENVIRONMENTS[env]
  const roundTrip = fmtDelay(e.delaySecOneWay * 2)
  const far = e.delaySecOneWay > 60
  const moon = env === 'moonBase'
  const evac = t(e.evacuation.pt, e.evacuation.en).toLowerCase()

  if (sev === 0) return {
    headline: t('Tudo nominal', 'All nominal'), contact: t('Sem contato necessário', 'No contact needed'), roundTrip, autonomous: false,
    steps: [t('Continue o check-in diário.', 'Keep the daily check-in.'), t('Envie os dados no pacote de telemetria de rotina.', 'Send data with the routine telemetry package.')],
  }
  if (sev === 1) return {
    headline: t('Atenção – monitorar', 'Caution – monitor'), contact: t('Registro para o solo no próximo passe de rotina', 'Log for the ground on the next routine pass'), roundTrip, autonomous: far,
    steps: [
      t('Siga a ação recomendada no cartão do indicador.', 'Follow the recommended action on the indicator card.'),
      t('Remeça no próximo período (4–24 h).', 'Re-measure in the next period (4–24 h).'),
      t('Avise o médico da tripulação (CMO) a bordo.', 'Inform the onboard Crew Medical Officer (CMO).'),
      far ? t(`Inclua no relatório diário — a resposta do solo levará ≥ ${roundTrip} + tempo de análise.`, `Include in the daily report — the ground reply will take ≥ ${roundTrip} + review time.`)
        : t('Inclua no relatório diário para o flight surgeon.', 'Include in the daily report to the flight surgeon.'),
    ],
  }
  if (sev === 2) return {
    headline: t('Alerta – envolver CMO e solo', 'Warning – involve CMO and ground'),
    contact: far ? t('CMO a bordo AGORA + relatório assíncrono ao solo', 'Onboard CMO NOW + asynchronous report to ground') : t('Conferência médica privada (PMC) com o flight surgeon hoje', 'Private Medical Conference (PMC) with the flight surgeon today'),
    roundTrip, autonomous: far,
    steps: [
      t('Pare tarefas críticas/EVA até reavaliação.', 'Stop critical tasks/EVA until reassessed.'),
      t('CMO a bordo revisa o caso com o checklist do kit médico.', 'Onboard CMO reviews the case with the medical kit checklist.'),
      far
        ? t(`Envie relatório estruturado (valores, tendência, sintomas, ação tomada). Ida e volta ≥ ${roundTrip}: não espere a resposta para iniciar os cuidados.`, `Send a structured report (values, trend, symptoms, action taken). Round trip ≥ ${roundTrip}: do not wait for the reply to start care.`)
        : moon ? t(`Ligue para o solo (atraso ~${roundTrip} ida e volta, conversa quase normal).`, `Call the ground (~${roundTrip} round trip, near-normal conversation).`)
          : t('Agende PMC (Private Medical Conference) ainda hoje.', 'Schedule a PMC (Private Medical Conference) today.'),
      t('Remeça em 1–4 h e registre no app.', 'Re-measure in 1–4 h and log it in the app.'),
    ],
  }
  return {
    headline: t('CRÍTICO – ação imediata', 'CRITICAL – immediate action'),
    contact: far ? t('Protocolo de emergência AUTÔNOMO + alerta ao solo', 'AUTONOMOUS emergency protocol + alert to ground') : t('Contato imediato com o solo (canal médico de emergência)', 'Immediate ground contact (medical emergency channel)'),
    roundTrip, autonomous: true,
    steps: [
      t('Acione o comandante e o CMO imediatamente.', 'Alert the commander and the CMO immediately.'),
      far ? t(`Envie alerta prioritário ao solo AGORA, mas a primeira resposta chega em ≥ ${roundTrip}. A tripulação decide.`, `Send a priority alert to the ground NOW, but the first reply arrives in ≥ ${roundTrip}. The crew decides.`)
        : t(`Chame o solo agora (atraso ${roundTrip} ida e volta).`, `Call the ground now (${roundTrip} round trip).`),
      e.evacuationPossible ? t(`Evacuação: ${evac} — avaliar com o solo.`, `Evacuation: ${evac} — assess with the ground.`) : t(`Evacuação: ${evac} — estabilização a bordo.`, `Evacuation: ${evac} — stabilize on board.`),
    ],
  }
}
