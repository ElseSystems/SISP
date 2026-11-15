import type { Engine } from '../storage'
import { t } from './i18n'

/** One-line label of the storage engine in use (footer / About). */
export function storageLabel(e: Engine): string {
  if (e.kind === 'sqlite') return `SQLite ${e.sqliteVersion} · OPFS (${e.vfs}) · ${t('journal', 'journal')} ${e.journalMode.toUpperCase()} · schema v${e.schemaVersion}`
  return e.reason === 'starting' ? t('iniciando…', 'starting…') : `localStorage (${t('fallback', 'fallback')}: ${e.reason})`
}
