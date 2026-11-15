/** Loads libsisp compiled to WebAssembly (public/core/sisp.wasm) and exposes it as a FlatCall. */
import type { FlatCall } from './flat.ts'

interface SispExports {
  memory: WebAssembly.Memory
  _initialize?: () => void
  sisp_wasm_in: () => number
  sisp_wasm_out: () => number
  sisp_wasm_in_cap: () => number
  sisp_wasm_out_cap: () => number
  sisp_wasm_abi: () => number
  sisp_wasm_call: (op: number, nIn: number) => number
}

export const WASM_ABI = 1

export async function instantiateCore(source: BufferSource | Response | Promise<Response>): Promise<FlatCall> {
  let instance: WebAssembly.Instance
  if (source instanceof Response || source instanceof Promise) {
    const res = await source
    if (!res.ok) throw new Error(`sisp.wasm: HTTP ${res.status}`)
    try {
      instance = (await WebAssembly.instantiateStreaming(res.clone(), {})).instance
    } catch {
      instance = (await WebAssembly.instantiate(await res.arrayBuffer(), {})).instance // wrong MIME type
    }
  } else {
    instance = (await WebAssembly.instantiate(source, {})).instance
  }
  const x = instance.exports as unknown as SispExports
  x._initialize?.()
  if (x.sisp_wasm_abi() !== WASM_ABI) throw new Error(`sisp.wasm ABI ${x.sisp_wasm_abi()} ≠ ${WASM_ABI}`)
  const inPtr = x.sisp_wasm_in(), outPtr = x.sisp_wasm_out()
  const inCap = x.sisp_wasm_in_cap(), outCap = x.sisp_wasm_out_cap()
  return (op, input) => {
    if (input.length > inCap) throw new Error(`sisp.wasm: input too large (${input.length})`)
    new Float64Array(x.memory.buffer, inPtr, input.length).set(input)
    const n = x.sisp_wasm_call(op, input.length)
    if (n < 0) throw new Error(`sisp.wasm: op ${op} failed (${n})`)
    return Array.from(new Float64Array(x.memory.buffer, outPtr, Math.min(n, outCap)))
  }
}
