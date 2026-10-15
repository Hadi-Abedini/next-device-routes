import type { ReactNode } from 'react'
import { RouteDeviceProvider } from 'next-device-routes/context'

export const metadata = { title: 'next-device-routes example' }

/**
 * Shared by every route and every device — and it never reads the request, so
 * nothing here makes the site dynamic.
 *
 * `<RouteDeviceProvider>` works out the device from the route Next.js rendered:
 * the rewrite already sent a phone to `[lang]/mobile/...`, and the router's
 * segments say so. No `headers()`, no per-variant literal to keep in sync.
 *
 *   depth={1}  `[lang]` sits between this layout and the variant folders.
 *   variants   the tablet folder is called `tab` (see `dir` in next.config.ts).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RouteDeviceProvider depth={1} variants={{ bot: 'bot', tablet: 'tab', mobile: 'mobile' }}>
          {children}
        </RouteDeviceProvider>
      </body>
    </html>
  )
}
