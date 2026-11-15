import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initCore } from './core'

// libsisp (C11 → WebAssembly). Until it loads — or if it can't — the identical TS reference answers.
void initCore()

// remove estados salvos de versões anteriores (tinham nomes fictícios antigos da tripulação)
for (const k of ['astro-health-v1', 'sisp-v1', 'sisp-v2']) localStorage.removeItem(k)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
