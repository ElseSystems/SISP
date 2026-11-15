import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HAZARDS } from '../lib/knowledge'
import { HAZARD_ORDER } from '../lib/story'
import { useStore } from '../lib/store'
import { t } from '../lib/i18n'

/** 30-second mission briefing shown on first launch (and from the ❔ button). */
export default function Onboarding() {
  const setIntro = useStore((s) => s.setIntro)
  const setDemo = useStore((s) => s.setDemo)
  const setTab = useStore((s) => s.setTab)
  const [i, setI] = useState(0)

  const slides = [
    {
      kicker: t('Briefing da missão · 1/3', 'Mission briefing · 1/3'),
      title: t('A Terra está a 20 minutos-luz.', 'Earth is 20 light-minutes away.'),
      body: t('Em Marte não há ambulância nem resposta imediata do médico. Os 5 hazards do voo espacial atacam o corpo todos os dias — a tripulação precisa se avaliar sozinha.',
        'On the way to Mars there is no ambulance and no instant answer from the doctor. The 5 hazards of spaceflight hit the body every day — the crew must assess itself.'),
      art: <div className="flex justify-center gap-3 text-4xl">{HAZARD_ORDER.map((h, k) => <motion.span key={h} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 * k }} title={HAZARDS[h].name.en}>{HAZARDS[h].icon}</motion.span>)}</div>,
    },
    {
      kicker: t('Como funciona · 2/3', 'How it works · 2/3'),
      title: t('60 s de check-in. Um corpo que acende.', '60-second check-in. A body that lights up.'),
      body: t('Pressão, pulso, glicemia, temperatura, sono e humor. O SISP compara com faixas clínicas E com a base de voo da própria pessoa (ex.: “febre espacial”) e pinta o mapa 3D de verde, amarelo, laranja ou vermelho.',
        'Blood pressure, pulse, glucose, temperature, sleep and mood. SISP compares each against clinical ranges AND the person’s own in-flight baseline (e.g. “space fever”) and paints the 3D body green, yellow, orange or red.'),
      art: <div className="flex justify-center gap-2">{['#22c55e', '#eab308', '#f97316', '#ef4444'].map((c, k) => <motion.span key={c} className="h-8 w-8 rounded-full" style={{ background: c, boxShadow: `0 0 20px ${c}` }} animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.6, delay: k * 0.2 }} />)}</div>,
    },
    {
      kicker: t('Por que importa · 3/3', 'Why it matters · 3/3'),
      title: t('Age antes. Avisa o solo do jeito certo.', 'Act early. Tell the ground the right way.'),
      body: t('O protocolo se adapta ao atraso de comunicação (ISS, Lua, Marte), traz manuais de emergência offline e usa dados reais da NASA (Inspiration4 OSDR, DONKI, taxas de dose do Curiosity RAD).',
        'The protocol adapts to the communication delay (ISS, Moon, Mars), ships offline emergency manuals and uses real NASA data (Inspiration4 OSDR, DONKI, taxas de dose do Curiosity RAD).'),
      art: <div className="flex items-center justify-center gap-3 text-3xl"><span>🧑‍🚀</span><motion.span className="h-0.5 w-24 bg-gradient-to-r from-sky-400 to-transparent" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2 }} /><span>📡</span><span className="text-xs text-sky-300">⏱ 20 min</span><span>🌍</span></div>,
    },
  ]
  const s = slides[i]
  const last = i === slides.length - 1

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="SISP onboarding">
      <div className="glass relative w-full max-w-lg overflow-hidden rounded-3xl p-6 shadow-[0_0_60px_rgba(56,189,248,0.25)]">
        <button onClick={() => setIntro(false)} className="absolute right-4 top-3 text-xs text-slate-400 hover:text-slate-200">{t('Pular', 'Skip')} ✕</button>
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}>
            <div className="mb-5 h-16">{s.art}</div>
            <p className="text-meta font-semibold uppercase tracking-[0.25em] text-sky-300">{s.kicker}</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{s.body}</p>
          </motion.div>
        </AnimatePresence>
        <div className="mt-6 flex items-center gap-2">
          <div className="mr-auto flex gap-1.5">{slides.map((_, k) => <button key={k} onClick={() => setI(k)} aria-label={`${k + 1}`} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-6 bg-sky-400' : 'w-1.5 bg-slate-600'}`} />)}</div>
          {last ? (
            <>
              <button onClick={() => { setIntro(false); setTab('checkin') }} className="rounded-xl border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:border-slate-400">✍️ {t('Fazer check-in', 'Do a check-in')}</button>
              <button onClick={() => setDemo(true)} className="rounded-xl bg-sky-400 px-4 py-2 text-sm font-bold text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.6)] hover:bg-sky-300">▶ {t('Ver demo (70 s)', 'Watch demo (70 s)')}</button>
            </>
          ) : (
            <button onClick={() => setI(i + 1)} className="rounded-xl bg-sky-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-sky-300">{t('Próximo', 'Next')} →</button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
