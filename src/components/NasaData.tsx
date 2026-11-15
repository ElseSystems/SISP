import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, SourceLinks } from './ui'
import { SOURCES } from '../lib/knowledge'
import { t } from '../lib/i18n'

interface GlucosePoint { subject: string; timepoint: string; day: number; value: number; rangeMin: number; rangeMax: number }
interface Glucose { source: string; url: string; mission: string; notes: string; fetchedAt: string; points: GlucosePoint[] }
interface Flr { id: string; begin: string; peak: string; classType: string; source: string; link: string }
interface Sep { id: string; time: string; link: string }
interface Donki {
  fetchedAt: string
  SEP: { window: [string, string]; events: Sep[] }
  FLR: { window: [string, string]; events: Flr[] }
  CME: { window: [string, string]; total: number }
  summary: { sepCount: number; flrCount: number; xClassCount: number; mClassCount: number; cmeCount: number; strongestFlare: Flr | null }
  historicalExample?: { window: [string, string]; label: string; SEP: Sep[]; FLR_X: Flr[] }
}
interface RadEnv { mSvPerDay: number; range?: number[]; source: string; url: string }
interface Rad { careerLimitMSv: number; careerLimitSource: string; careerLimitUrl: string; rawDataNote: string; environments: Record<string, RadEnv> }

const base = import.meta.env.BASE_URL
const load = <T,>(f: string) => fetch(`${base}data/${f}`).then((r) => { if (!r.ok) throw new Error(f); return r.json() as Promise<T> })
const COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#34d399']
const ORDER = ['L-92', 'L-44', 'L-3', 'R+1', 'R+45', 'R+82', 'R+194']
const envLabel = (k: string) => ({ iss: t('🛰️ ISS (órbita baixa)', '🛰️ ISS (low Earth orbit)'), moonBase: t('🌕 Superfície lunar', '🌕 Lunar surface'), marsTransit: t('🚀 Trânsito Terra–Marte', '🚀 Earth–Mars transit'), marsBase: t('🔴 Superfície de Marte', '🔴 Mars surface') } as Record<string, string>)[k] ?? k

export default function NasaData() {
  const [g, setG] = useState<Glucose | null>(null)
  const [d, setD] = useState<Donki | null>(null)
  const [rad, setRad] = useState<Rad | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [storm, setStorm] = useState(false)

  useEffect(() => {
    Promise.all([load<Glucose>('inspiration4_glucose.json'), load<Donki>('donki_space_weather.json'), load<Rad>('radiation_reference.json')])
      .then(([a, b, c]) => { setG(a); setD(b); setRad(c) })
      .catch((e) => setErr(String(e)))
  }, [])

  const rows = useMemo(() => {
    if (!g) return []
    return ORDER.map((tp) => {
      const row: Record<string, number | string> = { tp }
      g.points.filter((p) => p.timepoint === tp).forEach((p) => { row[p.subject] = p.value })
      return row
    })
  }, [g])
  const subjects = useMemo(() => [...new Set(g?.points.map((p) => p.subject) ?? [])], [g])
  const outOfRange = g?.points.filter((p) => p.value < p.rangeMin || p.value > p.rangeMax) ?? []

  if (err) return <Card title={t('Dados NASA', 'NASA data')}><p className="text-sm text-red-300">{t('Não foi possível carregar public/data', 'Could not load public/data')} ({err}). <code>python3 scripts/fetch_nasa_data.py</code></p></Card>
  if (!g || !d || !rad) return <Card title={t('Dados NASA', 'NASA data')}><p className="text-sm text-slate-400">{t('Carregando dados reais…', 'Loading real data…')}</p></Card>

  const recentSep = d.summary.sepCount > 0
  const strongest = [...d.FLR.events].sort((a, b) => rank(b.classType) - rank(a.classType)).slice(0, 5)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={t('🩸 Glicemia real – tripulação Inspiration4 (NASA OSDR OSD-575)', '🩸 Real glucose – Inspiration4 crew (NASA OSDR OSD-575)')} className="lg:col-span-2">
        <p className="text-xs text-slate-400">{t('Inspiration4 (SpaceX, set/2021, ~3 dias em órbita, 4 tripulantes civis). Painel metabólico (CMP) antes (L-) e depois (R+) do voo, por tripulante anonimizado. Faixa verde = referência do laboratório (65–99 mg/dL).', 'Inspiration4 (SpaceX, Sep 2021, ~3 days in orbit, 4 civilian crew). Comprehensive metabolic panel before (L-) and after (R+) flight, per anonymized crew member. Green band = lab reference (65–99 mg/dL).')}</p>
        <div className="mt-2 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <ReferenceArea y1={65} y2={99} fill="#22c55e" fillOpacity={0.1} />
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="tp" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis domain={[30, 130]} tick={{ fill: '#94a3b8', fontSize: 11 }} unit="" />
              <ReferenceLine x="L-3" stroke="#facc15" strokeDasharray="4 3" label={{ value: t('🚀 lançamento', '🚀 launch'), fill: '#fde68a', fontSize: 10, position: 'insideTopRight' }} />
              <ReferenceLine x="R+1" stroke="#facc15" strokeDasharray="4 3" label={{ value: t('retorno 🪂', 'return 🪂'), fill: '#fde68a', fontSize: 10, position: 'insideTopLeft' }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} formatter={(v) => `${v} mg/dL`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {subjects.map((s, i) => <Line isAnimationActive={false} key={s} dataKey={s} name={`${t('Tripulante', 'Crew')} ${s}`} stroke={COLORS[i % 4]} strokeWidth={2} dot={{ r: 3 }} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs text-slate-300">
          {g.points.length} {t('medições reais', 'real measurements')} · {outOfRange.length} {t('fora da faixa do laboratório', 'outside the lab range')}
          {outOfRange.length > 0 && <> ({outOfRange.map((p) => `${p.subject} ${p.timepoint}: ${p.value}`).join(', ')})</>}.{' '}
          {t('Valores muito baixos num mesmo ponto de coleta para vários tripulantes podem ser artefato pré-analítico (manuseio da amostra); não interprete clinicamente sem o contexto do estudo. Uso no app: mostra como a glicemia é acompanhada antes/depois do voo e calibra a faixa de referência do indicador de glicemia.',
            'Very low values at the same collection point for several crew members may be a pre-analytical artifact (sample handling); do not interpret clinically without study context. In the app: shows how glucose is tracked before/after flight and calibrates the glucose indicator reference range.')}
        </p>
        <SourceLinks sources={[{ label: g.source, url: g.url }]} />
      </Card>

      <Card title={t('☀️ Clima espacial agora (NASA DONKI)', '☀️ Space weather now (NASA DONKI)')}>
        <motion.div animate={recentSep || storm ? { boxShadow: ['0 0 0 #0000', '0 0 24px #ef4444aa', '0 0 0 #0000'] } : {}} transition={{ repeat: Infinity, duration: 1.5 }}
          className={`rounded-xl border p-3 ${recentSep || storm ? 'border-red-500 bg-red-500/10' : 'border-emerald-500/50 bg-emerald-500/10'}`}>
          <div className="text-lg font-bold">{recentSep ? t('⚠️ Evento de partículas solares (SEP) recente', '⚠️ Recent solar energetic particle (SEP) event') : t('✅ Nenhum SEP nos últimos 60 dias', '✅ No SEP in the last 60 days')}</div>
          <div className="text-xs text-slate-300">{t('Janela', 'Window')} {d.SEP.window[0]} → {d.SEP.window[1]} · {t('atualizado', 'updated')} {d.fetchedAt.slice(0, 10)}</div>
        </motion.div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <Stat n={d.summary.sepCount} l="SEP" />
          <Stat n={d.summary.flrCount} l={t('Erupções', 'Flares')} />
          <Stat n={d.summary.mClassCount} l={t('Classe M', 'M-class')} />
          <Stat n={d.summary.cmeCount} l="CMEs" />
        </div>
        <h3 className="mt-3 text-xs font-semibold text-slate-400">{t('Erupções mais fortes (60 dias)', 'Strongest flares (60 days)')}</h3>
        <ul className="mt-1 space-y-1 text-xs">
          {strongest.map((f) => (
            <li key={f.id} className="flex justify-between rounded bg-slate-800/60 px-2 py-1">
              <a href={f.link} target="_blank" rel="noreferrer" className="font-semibold text-sky-300 underline decoration-dotted">{f.classType}</a>
              <span className="text-slate-400">{f.peak?.replace('T', ' ').replace('Z', ' UTC')} · {f.source}</span>
            </li>
          ))}
        </ul>
        <SourceLinks sources={[SOURCES.donki]} />
      </Card>

      <Card title={t('🛡️ Treino de alerta: tempestade solar real (maio/2024)', '🛡️ Alert drill: real solar storm (May 2024)')}>
        {d.historicalExample ? (
          <>
            <p className="text-xs text-slate-300">{t('Tempestade solar de maio/2024: o DONKI registrou', 'May 2024 solar storm: DONKI recorded')} <b>{d.historicalExample.SEP.length} {t('eventos SEP', 'SEP events')}</b> {t('e', 'and')} <b>{d.historicalExample.FLR_X.length} {t('erupções classe X', 'X-class flares')}</b> ({d.historicalExample.window[0]} → {d.historicalExample.window[1]}).</p>
            <button onClick={() => setStorm((s) => !s)} className="mt-3 w-full rounded-xl bg-red-500/80 py-2 font-bold hover:bg-red-500">{storm ? t('Encerrar simulação', 'End drill') : t('▶ Simular alerta com dados de maio/2024', '▶ Run drill with May 2024 data')}</button>
            <AnimatePresence>
              {storm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 overflow-hidden rounded-xl border border-red-500/60 bg-red-950/40 p-3 text-sm">
                  <div className="font-bold text-red-300">☢️ {t('ALERTA SEP', 'SEP ALERT')} · {d.historicalExample.SEP[0]?.time.replace('T', ' ')}</div>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-200">
                    <li>{t('Vá para o abrigo de radiação (área com mais massa/água ao redor). Em Marte/Lua: volte ao habitat, cancele EVA.', 'Go to the radiation shelter (area with the most mass/water around). On Mars/Moon: return to the habitat, cancel EVA.')}</li>
                    <li>{t('Use o dosímetro pessoal e registre a dose ao fim do evento.', 'Wear your personal dosimeter and log the dose after the event.')}</li>
                    <li>{t('Na ISS, a magnetosfera protege boa parte; em espaço profundo o risco é bem maior.', 'On the ISS the magnetosphere shields much of it; in deep space the risk is far higher.')}</li>
                    <li>{t('Aguarde liberação do solo/heliofísica antes de sair do abrigo.', 'Wait for ground/heliophysics clearance before leaving the shelter.')}</li>
                  </ol>
                  <ul className="mt-2 max-h-28 overflow-auto text-[11px] text-slate-400">
                    {d.historicalExample.FLR_X.slice(0, 8).map((f) => <li key={f.id}>☀️ <a className="underline" href={f.link} target="_blank" rel="noreferrer">{f.classType}</a> {f.peak}</li>)}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : <p className="text-xs text-slate-400">{t('Há SEP recentes na janela atual; veja o painel ao lado.', 'There are recent SEPs in the current window; see the panel beside.')}</p>}
      </Card>

      <Card title={t('📏 Taxas de dose por ambiente (valores publicados)', '📏 Dose rates by environment (published values)')} className="lg:col-span-2">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-400"><tr><th className="py-1">{t('Ambiente', 'Environment')}</th><th>mSv/{t('dia', 'day')}</th><th>{t('Dias até', 'Days to')} {rad.careerLimitMSv} mSv*</th><th>{t('Fonte', 'Source')}</th></tr></thead>
          <tbody>
            {Object.entries(rad.environments).map(([k, v]) => (
              <tr key={k} className="border-t border-slate-800">
                <td className="py-1.5">{envLabel(k)}</td>
                <td className="font-semibold">{v.mSvPerDay}{v.range ? ` (${v.range.join('–')})` : ''}</td>
                <td>{Math.round(rad.careerLimitMSv / v.mSvPerDay)}</td>
                <td><a href={v.url} target="_blank" rel="noreferrer" className="text-sky-300 underline decoration-dotted">{v.source}</a></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-slate-400">* {t('partindo de zero, só para comparação. Limite:', 'starting from zero, for comparison only. Limit:')} <a className="underline" href={rad.careerLimitUrl} target="_blank" rel="noreferrer">{rad.careerLimitSource}</a>. {rad.rawDataNote}</p>
      </Card>
    </div>
  )
}

function Stat({ n, l }: { n: number; l: string }) {
  return <div className="rounded-lg bg-slate-800/60 p-2"><div className="text-xl font-bold">{n}</div><div className="text-[10px] text-slate-400">{l}</div></div>
}
function rank(c?: string) {
  if (!c) return 0
  const b = ({ A: 1, B: 10, C: 100, M: 1000, X: 10000 } as Record<string, number>)[c[0]] ?? 0
  return b * (parseFloat(c.slice(1)) || 1)
}
