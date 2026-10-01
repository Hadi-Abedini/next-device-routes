import { DeviceProvider } from 'next-device-routes/context'

// Shared by every route below. Must not make any of them dynamic.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <DeviceProvider variant={null}>{children}</DeviceProvider>
      </body>
    </html>
  )
}
