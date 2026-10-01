'use strict'

/**
 * Server-only. Import from 'next-device-routes/server' inside a Server
 * Component, Route Handler, Server Action, or `generateMetadata` — anywhere
 * `next/headers` is available. Importing this from a Client Component will
 * fail, same as importing `next/headers` directly would.
 *
 * Everything exported here reads the request, so whichever route renders it
 * is dynamically rendered. That is intentional and cannot be avoided — the
 * User-Agent of a request does not exist at build time. Render these only in
 * the segments that genuinely need the real request; everywhere else, give
 * `<DeviceProvider>` a literal `variant` so the route stays static.
 */

const { createElement } = require('react')
const { headers } = require('next/headers')
const { defaultVariants, getMatcher, toDeviceInfo } = require('./lib/variants')
const { DeviceProvider } = require('./context')

/**
 * Resolve which variant the current request matches, using the same
 * `variants` rules passed to `withDeviceRoutes`. Pass the *same* `variants`
 * object to both so they can never drift out of sync — see the README.
 *
 * @param {{ variants?: object }} [options]
 * @returns {Promise<import('./context').DeviceInfo>}
 */
async function getDevice(options = {}) {
  const { variants = defaultVariants } = options
  const matcher = getMatcher(variants)
  const requestHeaders = await headers()
  return toDeviceInfo(matcher(requestHeaders.get('user-agent')))
}

/**
 * Async Server Component: reads the request's device and provides it to
 * every `useDevice()` below. The request-bound counterpart of rendering
 * `<DeviceProvider variant="...">` with a literal.
 *
 * Only the routes that render this become dynamic, so keep it out of shared
 * layouts. With Cache Components (PPR) enabled, wrap it in `<Suspense>` so
 * the rest of the route can still be prerendered as a static shell.
 *
 * @param {{ variants?: object, children?: import('react').ReactNode }} props
 */
async function DeviceBoundary({ variants, children }) {
  const device = await getDevice({ variants })
  return createElement(DeviceProvider, { variant: device.variant }, children)
}

module.exports = { getDevice, DeviceBoundary }
