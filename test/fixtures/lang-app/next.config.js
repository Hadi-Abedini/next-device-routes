// Self-reference: resolves to this checkout through the root package.json `exports`.
const { withDeviceRoutes } = require('next-device-routes')

// Every route starts at src/app/[lang]; variants live in src/app/[lang]/<variant>.
// Tablets are the exception: that variant lives in a folder of its own.
module.exports = withDeviceRoutes(
  {},
  {
    cwd: __dirname,
    root: '[lang]',
    variants: {
      bot: ['Googlebot', 'bingbot'],
      tablet: { match: ['iPad'], dir: '[lang]/tab' },
      mobile: { match: ['Mobi', 'iPhone'], exclude: ['iPad'] },
    },
    redirectVariantPaths: true,
  }
)
