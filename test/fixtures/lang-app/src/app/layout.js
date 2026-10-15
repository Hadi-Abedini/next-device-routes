import { RouteDeviceProvider } from 'next-device-routes/context'

// Shared by every route and every device. No request read, no literal per
// variant: the device is derived from the route that was rendered. `[lang]`
// sits between this layout and the variant folders, hence depth={1}.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <RouteDeviceProvider variants={{ bot: 'bot', tablet: 'tab', mobile: 'mobile' }} depth={1}>
          {children}
        </RouteDeviceProvider>
      </body>
    </html>
  )
}
