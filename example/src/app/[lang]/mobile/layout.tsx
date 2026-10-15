import type { ReactNode } from 'react'

// Optional: chrome for the mobile variant only. Nothing to provide here — the
// root layout's <RouteDeviceProvider> already knows this is `mobile`.
export default function MobileLayout({ children }: { children: ReactNode }) {
  return <div data-variant="mobile">{children}</div>
}
