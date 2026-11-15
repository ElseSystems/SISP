/**
 * SISP core facade. The app always calls `core()`: it starts on the TypeScript reference and
 * switches to libsisp (C11 → WebAssembly) once public/core/sisp.wasm loads. Both give identical
 * results (checked by `npm run test:core`). Force the fallback with `?core=ts`.
 */
import { makeCore, tsCore } from './flat.ts'
import type { Core } from './flat.ts'
import { instantiateCore } from './wasm.ts'

export * from './constants.ts'
export type { Core, Backend } from './flat.ts'
export type * from './reference.ts'

let current: Core = tsCore
let loading: Promise<Core> | null = null
const listeners = new Set<(c: Core) => void>()

export const core = () => current

export function onCoreChange(fn: (c: Core) => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Loads the WASM core from `source` (URL or bytes). Safe to call many times. */
export function initCore(source: string | BufferSource = `${import.meta.env.BASE_URL}core/sisp.wasm`): Promise<Core> {
  if (loading) return loading
  const forceTs = typeof location !== 'undefined' && new URLSearchParams(location.search).get('core') === 'ts'
  if (forceTs || typeof WebAssembly === 'undefined') return (loading = Promise.resolve(current))
  loading = instantiateCore(typeof source === 'string' ? fetch(source) : source)
    .then((call) => {
      current = makeCore(call, 'wasm')
      listeners.forEach((fn) => fn(current))
      return current
    })
    .catch((err: unknown) => {
      console.warn('[sisp] WASM core unavailable, using the TypeScript reference:', err)
      return current
    })
  return loading
}
