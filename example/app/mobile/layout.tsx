import type { ReactNode } from 'react'
import { DeviceProvider } from 'next-device-routes/context'

// Optional: a layout that wraps only the mobile variant. The rewrite already
// decided this is a phone, so the variant is a literal and the pages stay static.
export default function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <DeviceProvider variant="mobile">
      <div data-variant="mobile">{children}</div>
    </DeviceProvider>
  )
}
