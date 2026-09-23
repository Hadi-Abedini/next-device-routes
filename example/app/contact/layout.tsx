import type { ReactNode } from 'react'
import { getDevice } from 'next-device-routes/server'
import { DeviceProvider } from 'next-device-routes/context'

/**
 * Scoped to this one route segment, not the root layout. `getDevice()` reads
 * `headers()`, a dynamic API — putting it in the root layout would make
 * every page in the app dynamically rendered. Placing it in the layout of
 * just the segment that needs it keeps the rest of the site static.
 */
export default async function ContactLayout({ children }: { children: ReactNode }) {
  const device = await getDevice()
  return <DeviceProvider variant={device.variant}>{children}</DeviceProvider>
}
