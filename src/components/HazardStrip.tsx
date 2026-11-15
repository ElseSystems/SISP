import { AnimatePresence, motion } from 'framer-motion'
import { BODY_REGIONS, HAZARDS, SEVERITY_COLOR } from '../lib/knowledge'
import type { BodyRegionId, Severity } from '../lib/knowledge'
import { HAZARD_ORDER, HAZARD_STORY } from '../lib/story'
import { useStore } from '../lib/store'
import { t, tr } from '../lib/i18n'
import { Badge, SourceLinks } from './ui'
import { Icon } from './Icon'

const worst = (regions: Record<BodyRegionId, Severity>, ids: BodyRegionId[]) => ids.reduce<Severity>((m, r) => (regions[r] > m ? regions[r] : m), 0)

/** The 5 NASA HRP hazards as a story: pick one → the body lights up the organs it hits. */
export default function HazardStrip({ regions }: { regions: Record<BodyRegionId, Severity> }) {
  const hazard = useStore((s) => s.hazard)
  const setHazard = useStore((s) => s.setHazard)
  const setRegion = useStore((s) => s.setRegion)
  const story = hazard ? HAZARD_STORY[hazard] : null

  return (
    <section className="glass rounded-2xl p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-display text-body font-semibold tracking-wide text-sky-200">{t('Os 5 hazards do voo espacial · NASA HRP', 'The 5 hazards of spaceflight · NASA HRP')}</h2>
        {hazard && <button onClick={() => setHazard(null)} className="text-meta text-slate-400 hover:text-slate-200">✕ {t('limpar', 'clear')}</button>}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {HAZARD_ORDER.map((h) => {
          const sev = worst(regions, HAZARD_STORY[h].regions)
          const on = hazard === h
          return (
            <button key={h} onClick={() => { setHazard(on ? null : h); if (!on) setRegion(HAZARD_STORY[h].regions[0]) }}
              aria-pressed={on}
              className={`group relative flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-center transition ${on ? 'border-sky-400 bg-sky-500/15 shadow-[0_0_18px_rgba(56,189,248,0.35)]' : 'border-slate-700/70 bg-slate-950/40 hover:border-slate-500'}`}>
              <span className="text-xl text-sky-300 transition group-hover:scale-110"><Icon e={HAZARDS[h].icon} /></span>
              <span className="text-meta leading-tight text-slate-300">{tr(HAZARDS[h].name)}</span>
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full" style={{ background: SEVERITY_COLOR[sev], boxShadow: `0 0 8px ${SEVERITY_COLOR[sev]}` }} />
            </button>
          )
        })}
      </div>
      <AnimatePresence mode="wait">
        {story && hazard && (
          <motion.div key={hazard} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
              <div className="rounded-xl bg-red-500/10 p-2.5 ring-1 ring-red-400/20"><div className="mb-1 font-semibold text-red-200"><Icon e="⚠" className="mr-1" />{t('O que faz', 'What it does')}</div><p className="text-slate-300">{tr(story.impact)}</p></div>
              <div className="rounded-xl bg-sky-500/10 p-2.5 ring-1 ring-sky-400/20"><div className="mb-1 font-semibold text-sky-200"><Icon e="🛰" className="mr-1" />{t('O que o SISP mede', 'What SISP watches')}</div><p className="text-slate-300">{tr(story.sispWatches)}</p></div>
              <div className="rounded-xl bg-emerald-500/10 p-2.5 ring-1 ring-emerald-400/20"><div className="mb-1 font-semibold text-emerald-200"><Icon e="🛡" className="mr-1" />{t('Contramedida', 'Countermeasure')}</div><p className="text-slate-300">{tr(story.countermeasure)}</p></div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-meta text-slate-400">{t('Órgãos afetados:', 'Affected organs:')}</span>
              {story.regions.map((r) => (
                <button key={r} onClick={() => setRegion(r)} className="flex items-center gap-1 rounded-full border border-slate-600 px-2 py-0.5 text-meta text-slate-200 hover:border-sky-400">
                  <span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_COLOR[regions[r]] }} />{tr(BODY_REGIONS[r].short)}
                </button>
              ))}
              <Badge s={worst(regions, story.regions)} className="ml-auto" />
            </div>
            <SourceLinks sources={[story.source]} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
