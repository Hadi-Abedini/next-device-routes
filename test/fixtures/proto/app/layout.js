import { DeviceProvider } from 'next-device-routes/context'
import Seg from './components/seg'
export default function RootLayout({ children }) {
  return (<html lang="en"><body><Seg /><DeviceProvider variant={null}>{children}</DeviceProvider></body></html>)
}
