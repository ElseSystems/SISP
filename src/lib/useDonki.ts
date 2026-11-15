import { useEffect, useState } from 'react'
import { fetchLiveDonki, loadDonki } from './spaceWeather'
import type { Donki } from './spaceWeather'

let cache: Donki | null = null
let pending: Promise<Donki> | null = null
let liveTried = false
const subs = new Set<(d: Donki) => void>()

function emit(d: Donki) { cache = d; subs.forEach((f) => f(d)) }

/** Bundled DONKI snapshot first (offline), then a one-time live refresh when online. */
export function useDonki() {
  const [d, setD] = useState<Donki | null>(cache)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    subs.add(setD)
    if (!cache) {
      pending ??= loadDonki()
      pending.then((x) => { if (!cache) emit(x); refreshLive() }).catch((e) => setErr(String(e)))
    } else refreshLive()
    return () => { subs.delete(setD) }
  }, [])
  return { d, err, refresh: () => { liveTried = false; refreshLive() } }
}

function refreshLive() {
  if (liveTried || !cache || (typeof navigator !== 'undefined' && !navigator.onLine)) return
  liveTried = true
  fetchLiveDonki().then((live) => {
    if (!live || !cache) return
    const base = cache
    const x = [...live.flr].filter((f) => f.classType?.startsWith('X')).length
    const m = [...live.flr].filter((f) => f.classType?.startsWith('M')).length
    emit({
      ...base,
      live: true,
      fetchedAt: new Date().toISOString(),
      SEP: { window: live.window, events: live.sep },
      FLR: { window: live.window, events: live.flr },
      summary: { ...base.summary, sepCount: live.sep.length, flrCount: live.flr.length, xClassCount: x, mClassCount: m },
    })
  })
}
