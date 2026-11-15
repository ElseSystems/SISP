import type { CrewMember } from '../lib/types'

/** Sex used only to pick the bust. Persisted rows from before the field existed fall back by crew id (t2/t4 female). */
export const crewSex = (c: Pick<CrewMember, 'id' | 'sex'>): 'male' | 'female' =>
  c.sex ?? (c.id === 't2' || c.id === 't4' ? 'female' : 'male')
