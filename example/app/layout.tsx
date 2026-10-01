import type { ReactNode } from 'react'
import { DeviceProvider } from 'next-device-routes/context'

export const metadata = { title: 'next-device-routes example' }

/**
 * Shared by every route, so it must not read the request: `variant={null}` is
 * a literal, which keeps every page static. Variant layouts and
 * `<DeviceBoundary>` override it further down the tree.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DeviceProvider variant={null}>{children}</DeviceProvider>
      </body>
    </html>
  )
}
