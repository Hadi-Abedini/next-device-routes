import type { NextConfig } from 'next'
import { withDeviceRoutes } from 'next-device-routes'

const config: NextConfig = withDeviceRoutes(
  {
    reactStrictMode: true,
  },
  {
    debug: true,
    redirectVariantPaths: true,
  }
)

export default config
