'use client'

/**
 * Client entry. Import from 'next-device-routes/context'.
 *
 * Written with React.createElement instead of JSX so the package ships
 * plain, already-valid JS with no build step. `'use client'` must stay the
 * very first line of this file for Next.js to treat it as a client boundary.
 */

const { createContext, useContext, createElement } = require('react')
const { toDeviceInfo } = require('./lib/variants')

const DeviceContext = createContext(undefined)

/**
 * Give it a literal `variant` wherever the device is already known when the
 * route is built — `variant={null}` in the root layout, `variant="mobile"` in
 * `app/mobile/layout` — and the route stays statically generated. Providers
 * nest; the closest one wins. Where only the real request can tell, render
 * `<DeviceBoundary>` from 'next-device-routes/server' in that segment instead.
 *
 * Only the small `variant` string crosses the server/client boundary; the
 * full DeviceInfo shape is rebuilt from it here, via the same `toDeviceInfo`
 * used by `getDevice()`, so the two can never disagree.
 *
 * @param {{ variant: string | null, children: import('react').ReactNode }} props
 */
function DeviceProvider({ variant = null, children }) {
  return createElement(DeviceContext.Provider, { value: toDeviceInfo(variant) }, children)
}

/**
 * @returns {import('./context').DeviceInfo}
 */
function useDevice() {
  const value = useContext(DeviceContext)
  if (value === undefined) {
    throw new Error(
      '[next-device-routes] useDevice() was called outside <DeviceProvider>. ' +
        'Wrap a layout above it with <DeviceProvider variant={...}> or <DeviceBoundary>.'
    )
  }
  return value
}

module.exports = { DeviceProvider, useDevice }
