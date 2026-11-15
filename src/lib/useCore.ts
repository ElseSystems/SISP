import { useSyncExternalStore } from 'react'
import { core, onCoreChange } from '../core'
import type { Backend } from '../core'

/** Which SISP core is answering: 'wasm' (libsisp, C11 → WebAssembly) or 'ts' (reference fallback). */
export function useCoreBackend(): Backend {
  return useSyncExternalStore(onCoreChange, () => core().backend, () => 'ts')
}
