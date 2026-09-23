'use strict'

/**
 * Server-only. Import from 'next-device-routes/server' inside a Server
 * Component, Route Handler, Server Action, or `generateMetadata` — anywhere
 * `next/headers` is available. Importing this from a Client Component will
 * fail, same as importing `next/headers` directly would.
 */

const { headers } = require('next/headers')
const { defaultVariants, compileMatcher, toDeviceInfo } = require('./lib/variants')

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
  const matcher = compileMatcher(variants)
  const requestHeaders = await headers()
  return toDeviceInfo(matcher(requestHeaders.get('user-agent')))
}

module.exports = { getDevice }
