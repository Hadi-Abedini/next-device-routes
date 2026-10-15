import type { ReactElement, ReactNode } from 'react'

export interface DeviceInfo {
  /** The matched variant's folder name, or `null` when the base route served the request. */
  variant: string | null
  /** Convenience flag for the default `mobile` variant name. */
  isMobile: boolean
  /** Convenience flag for the default `tablet` variant name. */
  isTablet: boolean
  /** Convenience flag for the default `bot` variant name. */
  isBot: boolean
  /** True when no variant matched, i.e. the base route rendered the page. */
  isBase: boolean
}

export interface DeviceProviderProps {
  /**
   * A literal known at build time (`null` in the root layout, `'mobile'` in
   * `app/mobile/layout`) keeps the route static. Use `<DeviceBoundary>` from
   * `next-device-routes/server` where only the request can tell.
   */
  variant?: string | null
  children: ReactNode
}

/** `['mobile']`, `{ mobile: 'm' }` or `{ mobile: { segment: 'm', depth: 1 } }`; key order is priority. */
export type RouteVariants =
  | string[]
  | Record<string, string | false | null | { segment?: string; depth?: number }>

export interface RouteDeviceProviderProps {
  /** Variant folder names in priority order. Default: `bot`, `tablet`, `mobile`. */
  variants?: RouteVariants
  /**
   * Route segments between this layout and the variant folders. `0` (default) when the
   * variant folders are direct children of this layout; `1` for a root layout above `[lang]/`.
   */
  depth?: number
  children: ReactNode
}

/** Provide a device to descendant Client Components that call `useDevice()`. The closest provider wins. */
export declare function DeviceProvider(props: DeviceProviderProps): ReactElement

/**
 * Provides the device by reading which variant folder the router rendered — no request read,
 * so the route stays statically generated. Place it in a shared (root) layout.
 */
export declare function RouteDeviceProvider(props: RouteDeviceProviderProps): ReactElement

/** Must be called under a `<DeviceProvider>`; throws otherwise. */
export declare function useDevice(): DeviceInfo
