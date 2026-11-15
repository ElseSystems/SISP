/**
 * 3D human body / Corpo humano 3D (modelos .glb do projeto: muscular e esqueleto) com hotspots clicáveis
 * por região, coloridos pela severidade. Os modelos foram otimizados com gltf-transform
 * (meshopt + texturas WebP 1024 px) para ~1 MB cada — o decoder meshopt vem embutido, funciona offline.
 */
import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF, ContactShadows } from '@react-three/drei'
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

function Model({ id }: { id: ModelId }) {
  const { scene } = useGLTF(MODELS[id].url, false, true)
  const clone = useMemo(() => scene.clone(true), [scene])
  return <primitive object={clone} />
}

function Hotspot({ id, sev, selected, dim, lit, onSelect, onHover }: { id: BodyRegionId; sev: Severity; selected: boolean; dim: boolean; lit: boolean; onSelect: (r: BodyRegionId) => void; onHover: (r: BodyRegionId | null) => void }) {
  const halo = useRef<Mesh>(null)
  const ref = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const speed = sev >= 2 ? 6 : 2.5
    const amp = sev >= 2 ? 0.35 : 0.12
    const s = (dim ? 0.6 : 1) + Math.sin(clock.elapsedTime * speed) * amp + (selected ? 0.3 : 0) + (lit ? 0.25 : 0)
    ref.current.scale.setScalar(s)
    // hazard storytelling: an expanding sonar ring on every organ the hazard hits
    if (halo.current) {
      const ph = (clock.elapsedTime * 0.8) % 1
      halo.current.scale.setScalar(lit ? 1.5 + ph * 3.5 : selected ? 2.4 : 1.8)
      const m = halo.current.material as { opacity: number }
      m.opacity = lit ? 0.45 * (1 - ph) : dim ? 0.04 : 0.18
    }
  })
  const color = SEVERITY_COLOR[sev]
  return (
    <group position={HOTSPOTS[id]}>
      <mesh ref={ref}
        onClick={(e) => { e.stopPropagation(); onSelect(id) }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(id); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = '' }}>
        <sphereGeometry args={[0.018, 24, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected || lit ? 2.4 : dim ? 0.3 : 1.2} transparent opacity={dim ? 0.35 : 0.9} depthTest={false} />
      </mesh>
      <mesh ref={halo} scale={selected ? 2.4 : 1.8}>
        <sphereGeometry args={[0.018, 16, 16]} />
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
  return (
    <div className="relative h-[440px] w-full overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_40%,#12305e,#020617_70%)]">
      <Canvas camera={{ position: [0, 1.1, 3.3], fov: 36 }} dpr={[1, 2]} gl={{ antialias: true }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 3, 3]} intensity={1.6} />
        <directionalLight position={[-3, 2, -2]} intensity={0.8} color="#7dd3fc" />
        <hemisphereLight args={['#bae6fd', '#0f172a', 0.5]} />
        <group scale={SCALE}>
          <Suspense fallback={null}>
            <Model id={model} />
          </Suspense>
          {(Object.keys(HOTSPOTS) as BodyRegionId[]).map((r) => (
            <Hotspot key={r} id={r} sev={regions[r]} selected={selected === r} lit={!!highlight?.includes(r)} dim={!!highlight && !highlight.includes(r)} onSelect={onSelect} onHover={setHover} />
          ))}
        </group>
        <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={3} blur={2.5} far={1.5} />
        <OrbitControls target={[0, 0.98, 0]} enablePan={false} minDistance={1} maxDistance={4.5} autoRotate={selected === null || !!highlight} autoRotateSpeed={0.8} />
      </Canvas>
      {shown && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-md border px-3 py-1 text-xs font-semibold text-white shadow"
          style={{ background: '#0f172acc', borderColor: SEVERITY_COLOR[regions[shown]] }}>{tr(BODY_REGIONS[shown].name)}</div>
      )}
      <span className="pointer-events-none absolute bottom-2 left-2 text-[10px] text-slate-400">{t('arraste para girar · role para zoom · clique nos pontos', 'drag to rotate · scroll to zoom · click the dots')}</span>
    </div>
  )
}

useGLTF.preload(MODELS.muscular.url, false, true)
useGLTF.preload(MODELS.skeleton.url, false, true)
