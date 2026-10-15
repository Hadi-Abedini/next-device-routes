import { DeviceBoundary } from 'next-device-routes/server'

// The one route that needs the real request.
export default function LiveLayout({ children }) {
  return <DeviceBoundary>{children}</DeviceBoundary>
}
