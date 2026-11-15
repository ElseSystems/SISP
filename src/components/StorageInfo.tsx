import { useState } from 'react'
import { history, useStorageEngine } from '../storage'
import { t } from '../lib/i18n'
import { download } from '../lib/download'
import { storageLabel } from '../lib/storageLabel'

export function StorageFooter() {
  const engine = useStorageEngine()
  return (
    <p className="mt-1 text-center text-meta text-slate-500" title={t('Histórico salvo no dispositivo, offline', 'History stored on this device, offline')}>
      🗄️ {t('Armazenamento do histórico', 'History storage')}: <span className="mono text-slate-400">{storageLabel(engine)}</span>
    </p>
  )
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')

/** About card: engine, row counts, integrity, and exports (JSON / .db). */
export default function StorageInfo() {
  const engine = useStorageEngine()
  const [stats, setStats] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sqlite = engine.kind === 'sqlite'
  const run = (fn: () => Promise<void>) => { setBusy(true); fn().catch((e: unknown) => setStats(String(e))).finally(() => setBusy(false)) }
  const btn = 'rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40'
  return (
    <div className="mt-3 rounded-lg border border-slate-700 p-3 text-sm text-slate-300" data-testid="storage-info">
      <div><b>{t('Armazenamento:', 'Storage:')}</b> <span className="mono text-meta text-sky-300" data-testid="storage-engine">{storageLabel(engine)}</span></div>
      <p className="mt-1 text-meta text-slate-400">{sqlite
        ? t('Check-ins, PVT, pulso, doses de radiação, eventos solares e relatórios ficam num banco SQLite no próprio dispositivo (OPFS), com o mesmo esquema e migrações do sisp_store em C.',
            'Check-ins, PVT, pulse, radiation doses, solar events and reports live in a SQLite database on this device (OPFS), with the same schema and migrations as the C sisp_store.')
        : t('Este navegador não oferece OPFS para o SQLite; os dados continuam salvos no localStorage.',
            'This browser does not offer OPFS for SQLite; data stays saved in localStorage.')}</p>
      {sqlite && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button className={btn} disabled={busy} onClick={() => run(async () => download(`sisp-history-${stamp()}.json`, await history.exportJson(), 'application/json'))}>⬇ {t('Exportar histórico (JSON)', 'Export history (JSON)')}</button>
          <button className={btn} disabled={busy} onClick={() => run(async () => {
            const bytes = await history.exportDb()
            const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.sqlite3' }))
            const a = document.createElement('a'); a.href = url; a.download = `sisp-history-${stamp()}.sqlite3`; a.click()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
          })}>⬇ {t('Baixar banco (.sqlite3)', 'Download database (.sqlite3)')}</button>
          <button className={btn} disabled={busy} onClick={() => run(async () => {
            const s = await history.stats()
            setStats(`integrity_check: ${s.integrity} · ` + Object.entries(s.counts).map(([k, v]) => `${k} ${v}`).join(' · '))
          })}>🩺 {t('Verificar banco', 'Check database')}</button>
        </div>
      )}
      {stats && <p className="mono mt-2 text-meta text-slate-400" data-testid="storage-stats">{stats}</p>}
    </div>
  )
}
