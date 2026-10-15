'use client'

import { useDevice } from 'next-device-routes/context'

/**
 * A Client Component that reads the device from the closest provider. Under the
 * root layout's `<RouteDeviceProvider>` that is the variant of the route being
 * rendered; under `<DeviceBoundary>` (see /contact) it is the real request.
 */
export default function DeviceInfo({ note }: { note?: string }) {
  const device = useDevice()
  return (
    <p>
      Detected variant: <code>{device.variant ?? 'none (desktop)'}</code>
      {note ? ` — ${note}` : null}
    </p>
  )
}
