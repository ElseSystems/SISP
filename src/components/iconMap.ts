/**
 * Emoji-token → lucide icon map. Outline UI icons (lucide-react, tree-shaken named imports, bundled — works offline).
 *
 * The app's copy and data still carry emoji "tokens" (e.g. "📡 Act / Ground"); these
 * components swap the tokens that act as small UI icons for a consistent SVG set at
 * render time, so no strings, data, storage or core logic change. Anything not in the
 * map (notably the check-in mood scale 😣🙁😐🙂😄) passes through untouched.
 */
import type { LucideIcon } from 'lucide-react'
import {
  Activity, AlarmClock, ArrowRight, Bandage, Bed, BedDouble, Bell, BellOff, BicepsFlexed, Bone, Bot, Brain, BriefcaseMedical,
  Camera, CalendarDays, CircleCheck, CircleDot, CircleHelp, Database, Droplet, Dumbbell, Flame, Flashlight, Hand, HandHeart,
  HeartPulse, Info, ListOrdered, Medal, Megaphone, Moon, Orbit, Paperclip, PartyPopper, Pause, PenLine, PersonStanding, Phone,
  Pill, Play, PlaneLanding, Pointer, Radiation, RadioTower, Rocket, Ruler, Satellite, Settings, Shield, Siren, Snowflake,
  Sparkles, Star, Stethoscope, Sun, Thermometer, ThermometerSun, Timer, TrendingUp, TriangleAlert, Trophy, UserRound,
  Utensils, Wind, Zap, FileText, Download, ArrowLeft, SkipForward, Earth,
} from 'lucide-react'

export const MAP: Record<string, LucideIcon> = {
  '🧍': PersonStanding, '🗓': CalendarDays, '✍': PenLine, '⚡': Zap, '📈': TrendingUp, '📡': RadioTower, '🚨': Siren,
  '🛰': Satellite, 'ℹ': Info, '🛡': Shield, '❔': CircleHelp, '❓': CircleHelp, '🔥': Flame, '🏅': Medal, '⚙': Settings,
  '⏰': AlarmClock, '⏱': Timer, '⏸': Pause, '▶': Play, '☀': Sun, '☝': Pointer, '☢': Radiation, '♨': ThermometerSun,
  '⚠': TriangleAlert, '✅': CircleCheck, '🌌': Sparkles, '🌕': Moon, '🌙': Moon, '🌟': Star, '🌡': Thermometer,
  '🍽': Utensils, '🎉': PartyPopper, '🏋': Dumbbell, '👉': ArrowRight, '💊': Pill, '💓': Activity, '💪': BicepsFlexed,
  '📎': Paperclip, '📏': Ruler, '📝': FileText, '📞': Phone, '📣': Megaphone, '📷': Camera, '🔔': Bell, '🔕': BellOff,
  '🔦': Flashlight, '🔴': CircleDot, '🖐': Hand, '🗄': Database, '😴': BedDouble, '🚀': Rocket, '🛏': Bed, '🤖': Bot,
  '🤲': HandHeart, '🥇': Trophy, '🦴': Bone, '🧊': Snowflake, '🧑‍🚀': UserRound, '🧠': Brain, '🧤': Hand,
  '🧰': BriefcaseMedical, '🩸': Droplet, '🩹': Bandage, '🩺': Stethoscope, '🪂': PlaneLanding, '🪐': Orbit,
  '🪜': ListOrdered, '🫀': HeartPulse, '🫁': Wind, '⬇': Download, '◀': ArrowLeft, '⏭': SkipForward, '🌍': Earth,
}

/** Longest keys first so ZWJ sequences (🧑‍🚀) win over their parts; optional U+FE0F. */
const KEYS = Object.keys(MAP).sort((a, b) => b.length - a.length)
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const TOKEN = new RegExp(`(${KEYS.map(esc).join('|')})\\uFE0F?`, 'gu')
export const norm = (e: string) => e.replace(/\uFE0F/g, '')

/** Plain text with icon-tokens removed (for <option>, title=, SVG <text> and other non-HTML sinks). */
export function stripIcons(text: string) {
  return text.replace(TOKEN, '').replace(/\s{2,}/g, ' ').trim()
}
