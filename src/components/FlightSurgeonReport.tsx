import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CopyButton } from './ui'
import { download } from '../lib/download'
import { useStore } from '../lib/store'
import { buildReport, GROUND_REVIEW_MIN } from '../lib/report'
import type { CrewAssessment } from '../lib/assessment'
import type { CrewMember } from '../lib/types'
import { escalationPlan, fmtDelay } from '../lib/escalation'
import { ENVIRONMENTS } from '../lib/knowledge'
import { t, tr } from '../lib/i18n'

/** Compact report for the flight surgeon: JSON (machine) + text (voice/email), delay-aware ETA. */
export default function FlightSurgeonReport({ c, a, met, onSend }: { c: CrewMember; a: CrewAssessment; met: string; onSend?: () => void }) {
  const env = useStore((s) => s.env)
  const solar = useStore((s) => s.solar)
  const sentAt = useStore((s) => s.reportSentAt)
  const markSent = useStore((s) => s.markReportSent)
  const plan = escalationPlan(a.overall, env)
  const [checked, setChecked] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [fmt, setFmt] = useState<'text' | 'json'>('text')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  const rep = useMemo(() => buildReport({ c, a, env, met, actions: checked, notes, solar }), [c, a, env, met, checked, notes, solar])
  const e = ENVIRONMENTS[env]
  const rttMs = e.delaySecOneWay * 2000
  const replyAt = sentAt ? sentAt + rttMs + GROUND_REVIEW_MIN * 60000 : 0
  const arrivedAt = sentAt ? sentAt + e.delaySecOneWay * 1000 : 0
  const body = fmt === 'json' ? JSON.stringify(rep.json, null, 1) : rep.text
  const mmss = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

  return (
    <Card title={t('📝 Relatório compacto ao flight surgeon', '📝 Compact flight surgeon report')}
      right={<span className="font-mono text-meta text-fg-2">{fmt === 'json' ? rep.bytes : rep.textBytes} B</span>}>
      <div className="mb-2 text-body-sm text-fg-2">{t('Ações já tomadas a bordo (entram no relatório):', 'Actions already taken on board (go into the report):')}</div>
      <div className="space-y-1">
        {plan.steps.map((s) => (
          <label key={s} className="flex items-start gap-2 text-body-sm text-fg-1">
            <input type="checkbox" className="mt-1" checked={checked.includes(s)} onChange={(ev) => setChecked(ev.target.checked ? [...checked, s] : checked.filter((x) => x !== s))} />{s}
          </label>
        ))}
      </div>
      <textarea value={notes} onChange={(ev) => setNotes(ev.target.value.slice(0, 280))} rows={2} placeholder={t('Sintomas / observações (máx. 280)', 'Symptoms / notes (max 280)')}
        className="mt-2 w-full rounded-lg border border-line bg-surface-2 p-2 text-body-sm text-fg-1 outline-none focus:border-accent" />
      <div className="mt-2 flex items-center gap-1" role="tablist">
        {(['text', 'json'] as const).map((f) => (
          <button key={f} role="tab" aria-selected={fmt === f} onClick={() => setFmt(f)} className={`rounded-md px-2.5 py-1 font-mono text-meta ${fmt === f ? 'bg-surface-3 text-fg-1' : 'text-fg-3 hover:text-fg-1'}`}>{f.toUpperCase()}</button>
        ))}
        <span className="ml-auto text-meta text-fg-3">{t('chaves curtas para link lento', 'short keys for a slow link')}</span>
      </div>
      <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 font-mono text-meta text-fg-1">{body}</pre>
      <div className="mt-2 flex flex-wrap gap-2">
        <CopyButton primary text={rep.text} label={t('Copiar texto', 'Copy text')} />
        <CopyButton text={rep.jsonStr} label={t('Copiar JSON', 'Copy JSON')} />
        <button onClick={() => download(`sisp-medrep-${c.id}-${rep.json.utc.replace(/[:]/g, '')}.json`, JSON.stringify(rep.json, null, 2), 'application/json')} className="rounded-lg border border-line-strong px-3 py-1.5 text-body-sm text-fg-1 hover:bg-surface-3">⬇ .json</button>
        <button onClick={() => { markSent({ format: fmt, body: fmt === 'json' ? rep.jsonStr : rep.text, delaySec: e.delaySecOneWay }); onSend?.() }} className="ml-auto rounded-lg bg-surface-3 px-3 py-1.5 text-body-sm font-semibold text-fg-1 hover:brightness-125">📡 {t('Transmitir (simulado)', 'Transmit (simulated)')}</button>
      </div>
      {sentAt && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 grid gap-2 rounded-xl border border-line bg-surface-1 p-3 text-body-sm sm:grid-cols-3">
          <div><div className="text-meta text-fg-3">{t('Enviado', 'Sent')}</div><div className="font-mono text-fg-1">{new Date(sentAt).toISOString().slice(11, 19)}Z</div></div>
          <div><div className="text-meta text-fg-3">{t('Chega ao solo', 'Reaches ground')}</div><div className="font-mono text-fg-1">{now >= arrivedAt ? '✓ ' : `T−${mmss(arrivedAt - now)} · `}{new Date(arrivedAt).toISOString().slice(11, 19)}Z</div></div>
          <div><div className="text-meta text-fg-3">{t('Resposta mais cedo', 'Earliest reply')}</div><div className="font-mono text-fg-1">{now >= replyAt ? '✓ ' : `T−${mmss(replyAt - now)} · `}{new Date(replyAt).toISOString().slice(11, 16)}Z</div></div>
          <p className="text-meta text-fg-3 sm:col-span-3">{t(`= ida e volta ${fmtDelay(e.delaySecOneWay * 2)} + ~${GROUND_REVIEW_MIN} min de análise no solo (premissa do protótipo). ${plan.autonomous ? 'Não espere: siga os passos autônomos.' : ''}`,
            `= ${fmtDelay(e.delaySecOneWay * 2)} round trip + ~${GROUND_REVIEW_MIN} min ground review (prototype assumption). ${plan.autonomous ? 'Do not wait: follow the autonomous steps.' : ''}`)} {tr(e.name)}.</p>
        </motion.div>
      )}
    </Card>
  )
}
