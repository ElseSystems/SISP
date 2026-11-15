import { useEffect, useMemo, useState } from 'react'
import { useStore } from './store'
import { eventDose } from './spaceWeather'
import type { SolarContext } from './assessment'

/** Ticks while a solar particle event is active and returns the dose context for the assessment. */
export function useSolarContext(): SolarContext & { progress: number; avoided: number; done: boolean; projected: number } {
  const solar = useStore((s) => s.solar)
  const env = useStore((s) => s.env)
  const log = useStore((s) => s.solarLog)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!solar) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [solar])
  const logged = useMemo(() => log.reduce((a, e) => a + e.doseMSv, 0), [log])
  if (!solar) return { active: false, sheltered: false, liveDoseMSv: 0, loggedDoseMSv: logged, progress: 0, avoided: 0, done: false, projected: 0 }
  const d = eventDose(solar, env, now)
  return { active: true, sheltered: !!solar.shelteredAt, liveDoseMSv: d.dose, loggedDoseMSv: logged, progress: d.progress, avoided: d.avoided, done: d.done, projected: d.projectedUnsheltered }
}
