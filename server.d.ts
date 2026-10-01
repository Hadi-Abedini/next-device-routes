import type { ReactElement, ReactNode } from 'react'
import type { DeviceInfo } from './context'

export interface GetDeviceOptions {
  /** The same `variants` object passed to `withDeviceRoutes`. Defaults to `defaultVariants`. */
  variants?: Record<string, import('./index').VariantInput>
}

export interface DeviceBoundaryProps extends GetDeviceOptions {
  children?: ReactNode
}

/**
 * Server-only. Call inside a Server Component, Route Handler, Server Action,
 * or `generateMetadata` — anywhere `next/headers` is available.
 * Reads request headers, so the route that calls it is dynamically rendered.
 */
export declare function getDevice(options?: GetDeviceOptions): Promise<DeviceInfo>

/**
 * Async Server Component. Resolves the request's device with `getDevice()` and
 * wraps `children` in `<DeviceProvider>`. Makes only the routes that render it
 * dynamic — keep it out of shared layouts.
 */
export declare function DeviceBoundary(props: DeviceBoundaryProps): Promise<ReactElement>
