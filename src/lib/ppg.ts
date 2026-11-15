/**
 * Fingertip photoplethysmography (PPG) from the camera: the red channel brightness pulses with
 * every heartbeat as blood volume in the fingertip changes. We resample to 30 Hz, remove the
 * slow drift, smooth, and estimate the period by autocorrelation (40–180 bpm).
 * ⚠️ Estimate only — accuracy varies by device, light and motion (Coppetti et al. 2017).
 */
import { core, PPG_FS } from '../core'

export interface Sample { t: number; v: number }

export const FS = PPG_FS

/** linear resampling of irregular camera frames to a uniform grid (libsisp: sisp_ppg_resample) */
export function resample(samples: Sample[], fs = FS): number[] {
  return core().ppgResample(samples.map((s) => s.t), samples.map((s) => s.v), fs)
}

/** band-limit: subtract ~1.5 s trend (high-pass) then 5-sample smoothing (low-pass ~6 Hz) — sisp_ppg_filter */
export function filter(x: number[], fs = FS): number[] {
  return core().ppgFilter(x, fs)
}

/** BPM by normalized autocorrelation; quality = peak correlation (0–1) — sisp_ppg_estimate_bpm */
export function estimateBpm(x: number[], fs = FS): { bpm: number; quality: number } | null {
  return core().ppgEstimate(x, fs)
}

/** is a fingertip covering the lens? (red-dominant, bright enough) */
export const fingerOn = (r: number, g: number, b: number) => r > 60 && r > 1.6 * g && r > 1.6 * b

/** synthetic PPG for the no-camera demo: systolic upstroke + dicrotic notch + noise */
export function demoSample(tMs: number, bpm = 68) {
  const ph = ((tMs / 1000) * bpm / 60) % 1
  const wave = Math.exp(-((ph - 0.15) ** 2) / 0.006) + 0.35 * Math.exp(-((ph - 0.45) ** 2) / 0.01)
  const drift = 3 * Math.sin(tMs / 4000)
  return 180 - 6 * wave + drift + (Math.random() - 0.5) * 1.2
}
