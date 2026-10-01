import { DeviceProvider } from 'next-device-routes/context'

// The rewrite already picked this variant, so a literal is enough.
export default function MobileLayout({ children }) {
  return <DeviceProvider variant="mobile">{children}</DeviceProvider>
}
