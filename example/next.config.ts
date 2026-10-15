import type { NextConfig } from 'next'
import { withDeviceRoutes, defaultVariants } from 'next-device-routes'

const config: NextConfig = withDeviceRoutes(
  { reactStrictMode: true },
  {
    appDir: 'src/app',

    // Every route of this project starts at src/app/[lang], so the variant
    // folders live there too: src/app/[lang]/mobile, src/app/[lang]/bot, ...
    root: '[lang]',

    variants: {
      ...defaultVariants,
      // One variant can live somewhere else: its own folder name, its own place.
      tablet: { ...defaultVariants.tablet, dir: '[lang]/tab' },
    },

    // /en/mobile/about -> /en/about, so variant URLs are never indexed directly.
    redirectVariantPaths: true,

    // Prints where each variant is looked up and every generated rewrite.
    debug: true,
  }
)

export default config
