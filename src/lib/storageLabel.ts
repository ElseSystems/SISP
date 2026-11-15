import type { Engine } from '../storage'
import { t } from './i18n'

/** One-line label of the storage engine in use (footer / About). */
export function storageLabel(e: Engine): string {
  if (e.kind === 'sqlite') return `SQLite ${e.sqliteVersion} · OPFS (${e.vfs}) · ${t('journal', 'journal')} ${e.journalMode.toUpperCase()} · schema v${e.schemaVersion}`
  if (e.reason === 'starting') return t('iniciando…', 'starting…')
  if (e.reason === 'other-tab') return `localStorage (${t('o SQLite está aberto em outra aba do SISP', 'SQLite is open in another SISP tab')})`
  return `localStorage (${t('fallback', 'fallback')}: ${e.reason})`
}
