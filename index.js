'use strict'

/**
 * next-device-routes
 *
 * Device- and crawler-aware routing for the Next.js App Router.
 * Zero dependencies, no middleware — everything is compiled into `rewrites`
 * that are generated from your folder structure at config load time.
 *
 *   app/page.js          -> served to everyone by default
 *   app/mobile/page.js   -> served to phones on "/"
 *   app/about/page.js    -> served to phones too, because app/mobile/about is missing
 */

const { defaultVariants } = require('./lib/variants')
const { findAppDir } = require('./lib/scan')
const { buildRules, buildVariantRedirects } = require('./lib/rules')

const EMPTY = { beforeFiles: [], afterFiles: [], folders: [], pairs: [] }

/** Normalize whatever `nextConfig.rewrites()` returned into the object form. */
async function resolveRewrites(fn) {
  if (typeof fn !== 'function') return { beforeFiles: [], afterFiles: [], fallback: [] }
  const result = await fn()
  if (Array.isArray(result)) return { beforeFiles: [], afterFiles: result, fallback: [] }
  return {
    beforeFiles: result?.beforeFiles ?? [],
    afterFiles: result?.afterFiles ?? [],
    fallback: result?.fallback ?? [],
  }
}

/**
 * @param {import('next').NextConfig | Function} [nextConfig]
 * @param {import('./index').DeviceRoutesOptions} [options]
 */
function withDeviceRoutes(nextConfig = {}, options = {}) {
  // `next.config` may export a function — keep that shape.
  if (typeof nextConfig === 'function') {
    return async (...args) => withDeviceRoutes(await nextConfig(...args), options)
  }

  const {
    variants = defaultVariants,
    appDir,
    pageExtensions = nextConfig.pageExtensions,
    redirectVariantPaths = false,
    permanentRedirects = false,
    cwd = process.cwd(),
    debug = false,
  } = options

  let cache = null

  const scan = () => {
    if (cache) return cache

    const dir = findAppDir(cwd, appDir)
    if (!dir) {
      console.warn('[next-device-routes] App Router directory not found — no routes generated.')
      return (cache = EMPTY)
    }

    cache = buildRules(dir, variants, pageExtensions)

    if (debug) {
      const label = cache.folders.length ? cache.folders.join(', ') : '(none found)'
      console.log(`[next-device-routes] variants: ${label}`)
      for (const [source, destination] of cache.pairs) {
        console.log(`  ${source}  ->  ${destination}`)
      }
      if (!cache.pairs.length) console.log('  no variant pages found')
    }

    return cache
  }

  return {
    ...nextConfig,

    async rewrites() {
      const generated = scan()
      const user = await resolveRewrites(nextConfig.rewrites)
      return {
        beforeFiles: [...generated.beforeFiles, ...user.beforeFiles],
        afterFiles: [...generated.afterFiles, ...user.afterFiles],
        fallback: user.fallback,
      }
    },

    async redirects() {
      const user = typeof nextConfig.redirects === 'function' ? await nextConfig.redirects() : []
      if (!redirectVariantPaths) return user
      return [...user, ...buildVariantRedirects(scan().folders, permanentRedirects)]
    },
  }
}

module.exports = withDeviceRoutes
module.exports.withDeviceRoutes = withDeviceRoutes
module.exports.defaultVariants = defaultVariants
module.exports.default = withDeviceRoutes
