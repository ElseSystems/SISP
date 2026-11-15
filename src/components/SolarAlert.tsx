import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useStore } from '../lib/store'
import { useSolarContext } from '../lib/useSolar'
import { DEEP_SPACE, SEP_DOSE_UNSHELTERED, SHELTER_FACTOR, fmtUtc } from '../lib/spaceWeather'
import { ENVIRONMENTS, SOURCES } from '../lib/knowledge'
import { t, tr } from '../lib/i18n'

const SHELTER_STEPS = {
  iss: () => [t('Vá para a área mais blindada (alojamentos / segmento russo, conforme o plano de voo).', 'Move to the most shielded area (crew quarters / Russian segment, per the flight plan).'), t('Suspenda EVA e trabalho perto de janelas.', 'Suspend EVA and work near windows.')],
  moonBase: () => [t('Cancele EVA e volte ao habitat AGORA.', 'Cancel EVA and return to the habitat NOW.'), t('Entre no abrigo de tempestade (regolito / água ao redor).', 'Enter the storm shelter (regolith / water around you).')],
  marsTransit: () => [t('Monte o abrigo de tempestade: cerque-se de água, comida e estiva (como na Orion).', 'Build the storm shelter: surround yourself with water, food and stowage (as on Orion).'), t('Permaneça até a liberação do solo — pode levar horas.', 'Stay until ground clearance — it can take hours.')],
  marsBase: () => [t('Cancele EVA e volte ao habitat.', 'Cancel EVA and return to the habitat.'), t('A atmosfera de Marte atenua, mas o abrigo reduz ainda mais a dose.', 'The Martian atmosphere attenuates, but the shelter reduces dose further.')],
} as const

/** Global red alert while a solar particle event is in progress: shelter CTA + live event dose. */
export default function SolarAlert() {
  const solar = useStore((s) => s.solar)
  const env = useStore((s) => s.env)
  const shelter = useStore((s) => s.shelter)
  const allClear = useStore((s) => s.allClear)
  const ctx = useSolarContext()
  const reduce = useReducedMotion()
  const startedAt = solar?.startedAt
  // a new event pulls the alert into view
  useEffect(() => { if (startedAt) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }) }, [startedAt, reduce])
  if (!solar) return null
  const sheltered = !!solar.shelteredAt
  const deep = DEEP_SPACE[env]
  const full = SEP_DOSE_UNSHELTERED[env]
  return (
    <motion.section role="alert" aria-live="assertive" initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`relative overflow-hidden rounded-2xl border-2 p-4 ${sheltered ? 'border-warning/70 bg-[#1f1206]' : 'border-critical bg-[#1A0609]'}`}>
      {!sheltered && !reduce && <motion.div aria-hidden className="pointer-events-none absolute inset-0" animate={{ opacity: [0.05, 0.28, 0.05] }} transition={{ duration: 1.6, repeat: Infinity }}
        style={{ background: 'radial-gradient(ellipse at top, rgba(255,107,107,0.55), transparent 65%)' }} />}
      <div className="relative flex flex-wrap items-start gap-4">
        <div className="text-5xl" aria-hidden>{sheltered ? '🛡️' : '☢️'}</div>
        <div className="mr-auto min-w-0 max-w-2xl">
          <p className="font-mono text-meta tracking-widest text-critical">{t('ALERTA DE CLIMA ESPACIAL · NASA DONKI', 'SPACE WEATHER ALERT · NASA DONKI')} {solar.replay && <span className="ml-1 rounded bg-surface-3 px-1.5 text-fg-2">{t('REPLAY REAL', 'REAL REPLAY')}</span>}</p>
          <h2 className="font-display text-display-sm font-bold text-fg-1">
            {sheltered ? t('No abrigo — aguarde liberação', 'In shelter — wait for all-clear') : t('Evento de partículas solares: VÁ PARA O ABRIGO', 'Solar particle event: GO TO SHELTER')}
          </h2>
          <p className="mt-1 text-body-sm text-fg-2">
            <a href={solar.sep.link} target="_blank" rel="noreferrer" className="underline decoration-dotted">SEP {fmtUtc(solar.sep.time)}</a>
            {solar.sep.instruments?.[0] && <> · {solar.sep.instruments[0]}</>}
            {solar.flare && <> · {t('erupção', 'flare')} <a href={solar.flare.link} target="_blank" rel="noreferrer" className="font-semibold text-warning underline decoration-dotted">{solar.flare.classType}</a> {fmtUtc(solar.flare.peak)}</>}
            {' · '}{ENVIRONMENTS[env].emoji} {tr(ENVIRONMENTS[env].name)} {deep ? t('(sem magnetosfera)', '(no magnetosphere)') : ''}
          </p>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-body-sm text-fg-1">
            {SHELTER_STEPS[env]().map((s) => <li key={s}>{s}</li>)}
            <li>{t('Dosímetro pessoal ligado; registre a dose ao final.', 'Personal dosimeter on; log the dose at the end.')}</li>
          </ol>
        </div>
        <div className="w-full min-w-[240px] sm:w-auto">
          <div className="text-meta text-fg-2">{t('Dose do evento (ao vivo)', 'Event dose (live)')}</div>
          <div className="font-mono text-display font-bold tnum" style={{ color: sheltered ? 'var(--sisp-warning)' : 'var(--sisp-critical)' }}>
            +{ctx.liveDoseMSv.toFixed(2)} <span className="text-title text-fg-2">mSv</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-3">
            <div className="h-full bg-critical transition-[width] duration-500" style={{ width: `${ctx.progress * 100}%` }} />
          </div>
          <div className="mt-1 text-meta text-fg-2">
            {ctx.done ? t('Fluxo de prótons caindo', 'Proton flux decreasing') : `${t('Evento', 'Event')} ${(ctx.progress * 100).toFixed(0)}% · ${t('sem abrigo', 'unsheltered')} ≈ ${full} mSv`}
            {sheltered && ctx.avoided > 0 && <> · <span className="text-nominal">{t('evitado', 'avoided')} {ctx.avoided.toFixed(2)} mSv</span></>}
          </div>
          <div className="mt-2 flex gap-2">
            {!sheltered && <button onClick={shelter} className="flex-1 rounded-lg bg-critical px-4 py-2 font-bold text-[#01030B] shadow-glow-critical hover:brightness-110">🛡️ {t('Estou no abrigo', 'I’m in the shelter')}</button>}
            <button onClick={allClear} disabled={!ctx.done && !sheltered} title={t('Libera quando o evento passar (ou após abrigar-se, para encerrar o treino)', 'Enabled when the event passes (or once sheltered, to end the drill)')}
              className="flex-1 rounded-lg border border-line-strong px-3 py-2 text-body-sm font-semibold text-fg-1 enabled:hover:bg-surface-3 disabled:opacity-40">
              ✓ {t('Liberação do solo', 'Ground all-clear')}
            </button>
          </div>
        </div>
      </div>
      <p className="relative mt-2 text-meta text-fg-3">
        {t(`Eventos e horários são registros reais do DONKI; a dose (${full} mSv sem abrigo, ×${SHELTER_FACTOR} no abrigo) é ilustrativa do protótipo, e o evento é comprimido em ${solar.durationSec} s.`,
          `Events and times are real DONKI records; the dose (${full} mSv unsheltered, ×${SHELTER_FACTOR} in shelter) is an illustrative prototype value, and the event is compressed into ${solar.durationSec} s.`)}{' '}
        <a href={SOURCES.srag.url} target="_blank" rel="noreferrer" className="underline decoration-dotted">NASA SRAG</a>
      </p>
    </motion.section>
  )
}
