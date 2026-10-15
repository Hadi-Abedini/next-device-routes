import DeviceInfo from '../../components/device-info'

/**
 * Written once, shown to phones too. `mobile/pricing/page.tsx` re-exports this
 * page, which keeps it statically generated *and* lets it tell devices apart —
 * the alternative to `<DeviceBoundary>` (see /contact) that never reads the request.
 */
export default function Pricing() {
  return (
    <>
      <h1>Pricing — one page, shared by base and mobile</h1>
      <DeviceInfo />
    </>
  )
}
