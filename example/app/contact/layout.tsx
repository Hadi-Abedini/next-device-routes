import type { ReactNode } from 'react'
import { DeviceBoundary } from 'next-device-routes/server'

/**
 * `/contact` has no mobile/tablet/bot page, so only the real request can tell
 * devices apart here. `<DeviceBoundary>` reads `headers()`, which makes this
 * route — and only this route — dynamically rendered; every other page shares
 * the root layout and stays static.
 */
export default function ContactLayout({ children }: { children: ReactNode }) {
  return <DeviceBoundary>{children}</DeviceBoundary>
}
