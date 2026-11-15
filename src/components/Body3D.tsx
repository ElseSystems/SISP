/**
 * 3D human body / Corpo humano 3D (modelos .glb do projeto: muscular e esqueleto) com hotspots clicáveis
 * por região, coloridos pela severidade. Os modelos foram otimizados com gltf-transform
 * (meshopt + texturas WebP 1024 px) para ~1 MB cada — o decoder meshopt vem embutido, funciona offline.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentRef, RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { OrbitControls, useGLTF, ContactShadows } from '@react-three/drei'
import { Vector3 } from 'three'
import type { Mesh } from 'three'
import { BODY_REGIONS, SEVERITY_COLOR } from '../lib/knowledge'
import { t, tr } from '../lib/i18n'
import type { BodyRegionId, Severity } from '../lib/knowledge'

const BASE = import.meta.env.BASE_URL
const MODELS = {
  muscular: { url: `${BASE}models/human-muscular.glb`, label: 'muscular' },
  skeleton: { url: `${BASE}models/human-skeleton.glb`, label: 'skeleton' },
} as const
export type ModelId = keyof typeof MODELS

const SCALE = 2 // modelos têm ~0,98 de altura com os pés em y=0

/** posição dos hotspots em unidades do modelo (y = altura, z+ = frente) */
const HOTSPOTS: Record<BodyRegionId, [number, number, number]> = {
  brain: [0, 0.925, 0.045],
  lungs: [-0.045, 0.745, 0.07],
  heart: [0.03, 0.715, 0.085],
  immune: [0, 0.825, 0.045],
  metabolism: [0, 0.595, 0.085],
  musculoskeletal: [0.055, 0.29, 0.06],
}

/** Camera framing per organ (targets = HOTSPOTS × SCALE; positions tuned by eye). */
const HOME: { pos: [number, number, number]; target: [number, number, number] } = { pos: [0, 1.1, 3.3], target: [0, 0.98, 0] }
const FOCUS: Record<BodyRegionId, { pos: [number, number, number]; target: [number, number, number] }> = {
  brain: { pos: [0.4, 2.0, 1.6], target: [0, 1.85, 0] },
  heart: { pos: [0.5, 1.5, 1.7], target: [0.06, 1.43, 0] },
  lungs: { pos: [-0.5, 1.55, 1.8], target: [-0.09, 1.49, 0] },
  immune: { pos: [0.0, 1.7, 1.9], target: [0, 1.65, 0] },
  metabolism: { pos: [0.3, 1.25, 1.8], target: [0, 1.19, 0] },
  musculoskeletal: { pos: [0.6, 0.8, 2.4], target: [0.1, 0.6, 0] },
}

type Controls = ComponentRef<typeof OrbitControls>

/**
 * Camera rig: when the selected region changes, dolly + retarget to that organ with exponential
 * damping (λ = 6 → ~0.6 s). It only drives the camera during the transition, so the user can still
 * orbit/zoom freely afterwards; grabbing the controls cancels it. Reduced motion → hard cut.
 */
function CameraRig({ region, controls, reduce }: { region: BodyRegionId | null; controls: RefObject<Controls | null>; reduce: boolean }) {
  const { camera } = useThree()
  const active = useRef(true)
  const pos = useMemo(() => new Vector3(), [])
  const tgt = useMemo(() => new Vector3(), [])
  useEffect(() => { active.current = true }, [region])
  useEffect(() => {
    const c = controls.current
    if (!c) return
    const stop = () => { active.current = false }
    c.addEventListener('start', stop)
    return () => c.removeEventListener('start', stop)
  }, [controls])
  useFrame((_, dt) => {
    const c = controls.current
    if (!active.current || !c) return
    const f = region ? FOCUS[region] : HOME
    pos.set(...f.pos); tgt.set(...f.target)
    const k = reduce ? 1 : 1 - Math.exp(-6 * dt)
    camera.position.lerp(pos, k)
    c.target.lerp(tgt, k)
    c.update()
    if (camera.position.distanceTo(pos) < 0.005 && c.target.distanceTo(tgt) < 0.005) active.current = false
  })
  return null
}

function Model({ id }: { id: ModelId }) {
  const { scene } = useGLTF(MODELS[id].url, false, true)
  const clone = useMemo(() => scene.clone(true), [scene])
  return <primitive object={clone} />
}

function Hotspot({ id, sev, selected, dim, lit, reduce, onSelect, onHover }: { id: BodyRegionId; sev: Severity; selected: boolean; dim: boolean; lit: boolean; reduce: boolean; onSelect: (r: BodyRegionId) => void; onHover: (r: BodyRegionId | null) => void }) {
  const halo = useRef<Mesh>(null)
  const ref = useRef<Mesh>(null)
  const sonar = lit || sev >= 2 // sonar ring for hazard-lit organs and anything at Warning or above
  useFrame(({ clock }) => {
    if (!ref.current) return
    const speed = sev === 3 ? 3.9 : sev === 2 ? 6 : 2.5 // Critical ≈ 0.6 Hz
    const amp = reduce ? 0 : sev >= 2 ? 0.35 : 0.12
    const s = (dim ? 0.6 : 1) + Math.sin(clock.elapsedTime * speed) * amp + (selected ? 0.3 : 0) + (lit ? 0.25 : 0)
    ref.current.scale.setScalar(s)
    if (halo.current) {
      const ph = reduce ? 0.5 : (clock.elapsedTime * 0.8) % 1
      halo.current.scale.setScalar(sonar && !dim ? 1.5 + ph * 3.5 : selected ? 2.4 : 1.8)
      const m = halo.current.material as { opacity: number }
      m.opacity = sonar && !dim ? 0.45 * (1 - ph) : dim ? 0.04 : 0.18
    }
  })
  const color = SEVERITY_COLOR[sev]
  return (
    <group position={HOTSPOTS[id]}>
      <mesh ref={ref}
        onClick={(e) => { e.stopPropagation(); onSelect(id) }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(id); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = '' }}>
        <sphereGeometry args={[0.024, 24, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected || lit ? 2.4 : dim ? 0.3 : 1.2} transparent opacity={dim ? 0.35 : 0.9} depthTest={false} />
      </mesh>
      <mesh ref={halo} scale={selected ? 2.4 : 1.8}>
        <sphereGeometry args={[0.024, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} depthTest={false} />
      </mesh>
    </group>
  )
}

interface Props { regions: Record<BodyRegionId, Severity>; selected: BodyRegionId | null; onSelect: (r: BodyRegionId) => void; model: ModelId; highlight?: BodyRegionId[] | null }

export default function Body3D({ regions, selected, onSelect, model, highlight }: Props) {
  // label rendered as a plain DOM overlay (no drei <Html> portals → no stray React roots on unmount)
  const [hover, setHover] = useState<BodyRegionId | null>(null)
  const shown = hover ?? selected
  const controls = useRef<Controls>(null)
  const reduce = !!useReducedMotion()
  // auto-rotate pauses while the rig frames an organ / the user interacts, and resumes after 8 s idle
  const [idle, setIdle] = useState(selected === null)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const bump = () => { setIdle(false); clearTimeout(idleTimer.current); idleTimer.current = setTimeout(() => setIdle(true), 8000) }
  const [prevSel, setPrevSel] = useState(selected)
  if (prevSel !== selected) { setPrevSel(selected); setIdle(false) } // new focus → stop rotating (derived during render)
  useEffect(() => {
    if (selected === null) return
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setIdle(true), 8000)
  }, [selected])
  useEffect(() => () => clearTimeout(idleTimer.current), [])
  return (
    <div className="relative h-[min(70vh,640px)] w-full overflow-hidden rounded-xl">
      <Canvas camera={{ position: [...HOME.pos], fov: 36 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 3, 3]} intensity={1.6} />
        <directionalLight position={[-3, 2, -2]} intensity={0.8} color="#7dd3fc" />
        <hemisphereLight args={['#bae6fd', '#0f172a', 0.5]} />
        <group scale={SCALE}>
          <Suspense fallback={null}>
            <Model id={model} />
          </Suspense>
          {(Object.keys(HOTSPOTS) as BodyRegionId[]).map((r) => (
            <Hotspot key={r} id={r} sev={regions[r]} selected={selected === r} reduce={reduce}
              lit={!!highlight?.includes(r)}
              dim={highlight ? !highlight.includes(r) : selected !== null && selected !== r}
              onSelect={onSelect} onHover={setHover} />
          ))}
        </group>
        <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={3} blur={2.5} far={1.5} />
        <OrbitControls ref={controls} target={[...HOME.target]} enablePan={false} minDistance={1} maxDistance={4.5}
          autoRotate={!reduce && idle} autoRotateSpeed={0.8} onStart={bump} />
        <CameraRig region={selected} controls={controls} reduce={reduce} />
      </Canvas>
      <AnimatePresence>
        {shown && (
          <motion.div key={shown} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-md border bg-surface-1/80 px-3 py-1 text-body-sm font-semibold text-fg-1 shadow backdrop-blur"
            style={{ borderColor: SEVERITY_COLOR[regions[shown]] }}>{tr(BODY_REGIONS[shown].name)}</motion.div>
        )}
      </AnimatePresence>
      <span className="pointer-events-none absolute bottom-2 left-2 text-meta text-fg-3">{t('arraste para girar · role para zoom · clique nos pontos', 'drag to rotate · scroll to zoom · click the dots')}</span>
    </div>
  )
}

useGLTF.preload(MODELS.muscular.url, false, true)
useGLTF.preload(MODELS.skeleton.url, false, true)
