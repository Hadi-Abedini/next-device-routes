'use client'

/**
 * Client entry. Import from 'next-device-routes/context'.
 *
 * Written with React.createElement instead of JSX so the package ships
 * plain, already-valid JS with no build step. `'use client'` must stay the
 * very first line of this file for Next.js to treat it as a client boundary.
 */

const { createContext, useContext, useMemo, createElement } = require('react')
const { useSelectedLayoutSegments } = require('next/navigation')
const { toDeviceInfo } = require('./lib/variants')
const { normalizeRouteVariants, detectRouteVariant } = require('./lib/route')

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
  const value = useMemo(() => toDeviceInfo(variant), [variant])
  return createElement(DeviceContext.Provider, { value }, children)
}

/**
 * Provides the device from the *route* being rendered — no `headers()`, no
 * literal to keep in sync, and the route stays statically generated.
 *
 * `withDeviceRoutes` rewrites a phone's `/about` to `app/mobile/about` before
 * rendering, and the router's layout segments reflect that rewritten tree. So a
 * single provider in a shared layout can tell which variant it is part of:
 *
 *   // app/layout.tsx, or app/[lang]/layout.tsx when variants live in [lang]/
 *   <RouteDeviceProvider>{children}</RouteDeviceProvider>
 *
 * Props:
 *   variants  Which folder names are variants, in priority order: `['mobile']`,
 *             `{ mobile: 'm' }` or `{ mobile: { segment: 'm', depth: 1 } }`.
 *             Defaults to `bot`, `tablet`, `mobile`. Use the folder name as it
 *             appears in the URL tree — the last folder of the variant's `dir`.
 *   depth     Number of route segments between this layout and the variant
 *             folders. `0` (default) when the variant folders are direct
 *             children of the layout rendering this; `1` for a root layout that
 *             sits above `[lang]/` when variants live in `[lang]/mobile`.
 *
 * Only a Client Component can read the result (`useDevice()`); a Server
 * Component in a shared layout cannot know the variant without the request —
 * move device-dependent UI into a Client Component, or into the variant's own layout.
 *
 * @param {{ variants?: string[] | Record<string, string | { segment?: string, depth?: number }>, depth?: number, children: import('react').ReactNode }} props
 */
function RouteDeviceProvider({ variants, depth = 0, children }) {
  const segments = useSelectedLayoutSegments()
  const variant = detectRouteVariant(segments, normalizeRouteVariants(variants), depth)
  const value = useMemo(() => toDeviceInfo(variant), [variant])
  return createElement(DeviceContext.Provider, { value }, children)
}

/**
 * @returns {import('./context').DeviceInfo}
 */
function useDevice() {
  const value = useContext(DeviceContext)
  if (value === undefined) {
    throw new Error(
      '[next-device-routes] useDevice() was called outside <DeviceProvider>. ' +
        'Wrap a layout above it with <RouteDeviceProvider>, <DeviceProvider variant={...}> or <DeviceBoundary>.'
    )
  }
  return value
}

module.exports = { DeviceProvider, RouteDeviceProvider, useDevice }
