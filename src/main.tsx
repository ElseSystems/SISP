import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// remove estados salvos de versões anteriores (tinham nomes fictícios antigos da tripulação)
for (const k of ['astro-health-v1', 'sisp-v1', 'sisp-v2']) localStorage.removeItem(k)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
