import type { ReactNode } from 'react'
import { DeviceBoundary } from 'next-device-routes/server'

/**
 * `/contact` has no per-device page and has to know the *real* device, so it
 * reads the request here. That makes this route — and only this route —
 * dynamic. Every other page stays static.
 */
export default function ContactLayout({ children }: { children: ReactNode }) {
  return <DeviceBoundary>{children}</DeviceBoundary>
}
