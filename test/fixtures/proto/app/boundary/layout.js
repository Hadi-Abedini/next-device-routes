import { DeviceBoundary } from 'next-device-routes/server'

export default function BoundaryLayout({ children }) {
  return <DeviceBoundary>{children}</DeviceBoundary>
}
