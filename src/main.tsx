import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initCore } from './core'
import { initStorage, keepLocalCopy } from './storage'
import { useStore } from './lib/store'
import { snapshotOf } from './lib/history'

// libsisp (C11 → WebAssembly). Until it loads — or if it can't — the identical TS reference answers.
void initCore()

// remove estados salvos de versões anteriores (tinham nomes fictícios antigos da tripulação)
for (const k of ['astro-health-v1', 'sisp-v1', 'sisp-v2']) localStorage.removeItem(k)

// "sqlite" once this browser has used the SQLite history, so a slow start waits longer before falling back.
const STORAGE_KEY = 'sisp-storage'

async function boot() {
  const usedSqlite = localStorage.getItem(STORAGE_KEY) === 'sqlite'
  // Zustand has already rehydrated from localStorage: that state is the one-time import source.
  const before = useStore.getState()
  const { engine, history, imported } = await initStorage(() => snapshotOf(before.crew, before.solarLog), usedSqlite ? 20000 : 8000)
  if (engine.kind === 'sqlite' && history) {
    const n = (crew: typeof before.crew) => crew.reduce((k, c) => k + c.readings.length + (c.pvt?.length ?? 0), 0)
    if (imported && n(history.crew) < n(before.crew)) {
      console.error('[sisp] SQLite import is missing rows; keeping the localStorage copy too')
      keepLocalCopy()
    }
    useStore.getState().hydrate(history)
    localStorage.setItem(STORAGE_KEY, 'sqlite')
    // re-persist without crew/solar log: from now on they live in SQLite only
    useStore.setState({})
    if (imported) console.info('[sisp] history migrated from localStorage to SQLite (OPFS)')
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
void boot()
