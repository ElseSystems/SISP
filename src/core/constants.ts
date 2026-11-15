/**
 * Numeric constants shared by the TypeScript reference core and libsisp (core/include/sisp.h).
 * Keep both in sync — core/tests/fixtures/parity.txt fails CI if they drift.
 * ⚠️ Prototype heuristics — not a medical protocol.
 */
export type Severity = 0 | 1 | 2 | 3
export type IndicatorId = 'bp' | 'hr' | 'glucose' | 'temp' | 'sleep' | 'mood'
export type BodyRegionId = 'brain' | 'heart' | 'lungs' | 'metabolism' | 'musculoskeletal' | 'immune'
export type EnvironmentId = 'iss' | 'moonBase' | 'marsTransit' | 'marsBase'

/** Index order = sisp_indicator / sisp_region / sisp_environment in sisp.h */
export const INDICATOR_ORDER: readonly IndicatorId[] = ['bp', 'hr', 'glucose', 'temp', 'sleep', 'mood']
export const REGION_ORDER: readonly BodyRegionId[] = ['brain', 'heart', 'lungs', 'metabolism', 'musculoskeletal', 'immune']
export const ENVIRONMENT_ORDER: readonly EnvironmentId[] = ['iss', 'moonBase', 'marsTransit', 'marsBase']

export const BASELINE_DAYS = 14
export const BASELINE_MIN_N = 5
export const Z_ATTENTION = 2
export const Z_ALERT = 3
export const TEMP_DELTA_ATTENTION = 0.8
export const TEMP_DELTA_ALERT = 1.2
export const CAREER_LIMIT_MSV = 600
export const SHELTER_FACTOR = 0.25
export const PVT_LAPSE_MS = 355
export const PVT_MIN_VALID_MS = 100
export const PPG_FS = 30
export const PPG_MAX_LAG = 1024
export const BONE_LOSS_PER_MONTH_PCT = [1, 1.5] as const

export const SD_FLOOR = { sys: 4, dia: 3, hr: 3, glucose: 4, temp: 0.15, sleep: 0.4, mood: 0.5 } as const

export interface EnvNumbers { doseMSvPerDay: number; sepDoseUnsheltered: number; deepSpace: boolean }
export const ENV_NUMBERS: Record<EnvironmentId, EnvNumbers> = {
  iss: { doseMSvPerDay: 0.35, sepDoseUnsheltered: 1, deepSpace: false },
  moonBase: { doseMSvPerDay: 1.369, sepDoseUnsheltered: 40, deepSpace: true },
  marsTransit: { doseMSvPerDay: 1.84, sepDoseUnsheltered: 50, deepSpace: true },
  marsBase: { doseMSvPerDay: 0.64, sepDoseUnsheltered: 1.5, deepSpace: false },
}

export interface Band { from: number; to: number; severity: Severity }
/** Reference bands (NHLBI, AHA, ADA, CDC, AASM) — BP bands are on systolic. */
export const BANDS: Record<IndicatorId, readonly Band[]> = {
  bp: [{ from: 0, to: 90, severity: 1 }, { from: 90, to: 120, severity: 0 }, { from: 120, to: 140, severity: 1 }, { from: 140, to: 180, severity: 2 }, { from: 180, to: 240, severity: 3 }],
  hr: [{ from: 30, to: 60, severity: 1 }, { from: 60, to: 100, severity: 0 }, { from: 100, to: 180, severity: 1 }],
  glucose: [{ from: 20, to: 54, severity: 3 }, { from: 54, to: 70, severity: 2 }, { from: 70, to: 100, severity: 0 }, { from: 100, to: 126, severity: 1 }, { from: 126, to: 300, severity: 2 }],
  temp: [{ from: 34, to: 36, severity: 1 }, { from: 36, to: 38, severity: 0 }, { from: 38, to: 42, severity: 2 }],
  sleep: [{ from: 0, to: 5, severity: 2 }, { from: 5, to: 7, severity: 1 }, { from: 7, to: 12, severity: 0 }],
  mood: [{ from: 1, to: 2.5, severity: 1 }, { from: 2.5, to: 5, severity: 0 }],
}

/** Reason flags — identical bit values to SISP_R_* in sisp.h. */
export const R = {
  BP_CRISIS: 1 << 0, BP_STAGE2: 1 << 1, BP_STAGE1: 1 << 2, BP_ELEVATED: 1 << 3, BP_DIA80: 1 << 4, BP_LOW: 1 << 5,
  HR_TACHY: 1 << 6, HR_BRADY: 1 << 7,
  GLU_SEVERE_HYPO: 1 << 8, GLU_HYPO: 1 << 9, GLU_DIABETES: 1 << 10, GLU_IMPAIRED: 1 << 11,
  TEMP_FEVER: 1 << 12, TEMP_DELTA_ALERT: 1 << 13, TEMP_DELTA_ATTN: 1 << 14, TEMP_LOW: 1 << 15,
  SLEEP_LT5: 1 << 16, SLEEP_LT7: 1 << 17, SLEEP_DEBT3: 1 << 18,
  MOOD_LOW: 1 << 19, MOOD_LOW3: 1 << 20, MOOD_PHQ2: 1 << 21, MOOD_SELF_HARM: 1 << 22,
  Z_STRONG: 1 << 29, Z_OUTSIDE: 1 << 30,
} as const

/** Fatigue reason flags — SISP_FAT_* in sisp.h. */
export const FAT = { LAPSES5: 1, LAPSES3: 2, SLOW20: 4, SLOW10: 8, SHORT_SLEEP: 16 } as const

/** SISP_SOLAR_* */
export const SOLAR = { NONE: 0, GO_TO_SHELTER: 1, IN_SHELTER: 2 } as const

/** SISP_OP_* (flat ABI) */
export const OP = { ASSESS: 1, RADIATION: 2, SEP_DOSE: 3, PVT_SCORE: 4, FATIGUE: 5, BONE: 6, AGGREGATE: 7, PPG_RESAMPLE: 8, PPG_FILTER: 9, PPG_ESTIMATE: 10 } as const
