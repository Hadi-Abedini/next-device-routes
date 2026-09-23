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
 * Render once near the root — typically in the root layout, right after
 * `const device = await getDevice()`. Only the small `variant` string
 * crosses the server/client boundary; the full DeviceInfo shape is rebuilt
 * from it here, via the same `toDeviceInfo` used by `getDevice()`, so the two
 * can never disagree.
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
        'Wrap your root layout with <DeviceProvider variant={...}> first.'
    )
  }
  return value
}

module.exports = { DeviceProvider, useDevice }
