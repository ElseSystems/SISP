import PulseCam from './PulseCam'
import Pvt from './Pvt'

/** Self-tests that need no medical hardware: camera pulse + PVT. */
export default function SelfTests() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <PulseCam />
      <Pvt />
    </div>
  )
}
