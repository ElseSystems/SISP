import { Card, Disclaimer } from './ui'
import { HAZARDS, INDICATORS, PROTOTYPE_HEURISTICS as H, SOURCES } from '../lib/knowledge'
import type { HazardId } from '../lib/knowledge'
import { EM_SOURCES } from '../lib/emergency'
import { useStore } from '../lib/store'
import { t, tr } from '../lib/i18n'

export default function About() {
  const reset = useStore((s) => s.reset)
  const sources = [...Object.values(SOURCES), ...Object.values(EM_SOURCES)]
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={t('Como funciona', 'How it works')}>
        <Disclaimer />
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
          <li><b>{t('Duas camadas de avaliação:', 'Two-layer assessment:')}</b> {t(
            `limite absoluto de diretriz publicada + desvio da sua linha de base pessoal (últimos ${H.baselineDays} dias; z ≥ ${H.zAttention} = Atenção, ≥ ${H.zAlert} = Alerta).`,
            `absolute limit from published guidelines + deviation from your personal baseline (last ${H.baselineDays} days; z ≥ ${H.zAttention} = Caution, ≥ ${H.zAlert} = Warning).`)}</li>
          <li><b>{t('Febre relativa:', 'Relative fever:')}</b> {t(
            `no espaço a temperatura de repouso sobe ~1 °C (Stahn 2017). Aumento ≥ +${H.tempDeltaAttention} °C sobre a base de voo = Atenção, ≥ +${H.tempDeltaAlert} °C = Alerta, mesmo abaixo de 38 °C.`,
            `in space resting temperature rises ~1 °C (Stahn 2017). A rise ≥ +${H.tempDeltaAttention} °C over the in-flight baseline = Caution, ≥ +${H.tempDeltaAlert} °C = Warning, even below 38 °C.`)}</li>
          <li><b>{t('Escalonamento com atraso:', 'Delay-aware escalation:')}</b> {t('na ISS chama-se o solo; em Marte (até ~20 min de ida) a tripulação age primeiro e envia relatório.', 'on the ISS you call the ground; at Mars (up to ~20 min one-way) the crew acts first and sends a report.')}</li>
          <li><b>{t('Manuais de emergência:', 'Emergency manuals:')}</b> {t('parada cardíaca (RCP/ACLS em microgravidade), lesões musculares e fraturas, com fonte em cada passo.', 'cardiac arrest (CPR/ACLS in microgravity), muscle injuries and fractures, with a source for every step.')}</li>
          <li><b>Offline-first:</b> {t('tudo roda no navegador e fica salvo no dispositivo (localStorage) — distância da Terra é um dos 5 hazards.', 'everything runs in the browser and is stored on the device (localStorage) — distance from Earth is one of the 5 hazards.')}</li>
          <li><b>{t('Dados reais NASA:', 'Real NASA data:')}</b> {t('glicemia Inspiration4 (OSDR OSD-575), clima espacial (DONKI) e taxas de dose do Curiosity RAD.', 'Inspiration4 glucose (OSDR OSD-575), space weather (DONKI) and Curiosity RAD dose rates.')}</li>
        </ul>
        <button onClick={() => { if (confirm(t('Recriar tripulação simulada e apagar check-ins/XP locais?', 'Regenerate the simulated crew and erase local check-ins/XP?'))) reset() }}
          className="mt-4 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">↺ {t('Recriar dados simulados', 'Regenerate simulated data')}</button>
      </Card>
      <Card title={t('Os 5 hazards (NASA HRP)', 'The 5 hazards (NASA HRP)')}>
        <ul className="space-y-2 text-sm">
          {(Object.keys(HAZARDS) as HazardId[]).map((h) => (
            <li key={h}><b>{HAZARDS[h].icon} {tr(HAZARDS[h].name)}:</b> <span className="text-slate-300">{tr(HAZARDS[h].summary)}</span></li>
          ))}
        </ul>
      </Card>
      <Card title={t('Como medir cada indicador', 'How to measure each indicator')} className="lg:col-span-2">
        <div className="grid gap-3 md:grid-cols-3">
          {Object.values(INDICATORS).map((i) => (
            <div key={i.id} className="rounded-lg border border-slate-700 p-3 text-xs">
              <div className="font-semibold text-slate-200">{tr(i.name)}</div>
              <p className="mt-1 text-slate-300">📏 {tr(i.howToMeasure)}</p>
              <p className="mt-1 text-slate-400">❓ {tr(i.whyItMatters)}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card title={t('Fontes', 'Sources')} className="lg:col-span-2">
        <ul className="grid gap-1 text-xs md:grid-cols-2">
          {sources.map((s) => <li key={s.url}>📎 <a className="text-sky-300 underline decoration-dotted" href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}
        </ul>
      </Card>
    </div>
  )
}
