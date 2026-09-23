import type { DeviceInfo } from './context'

export interface GetDeviceOptions {
  /** The same `variants` object passed to `withDeviceRoutes`. Defaults to `defaultVariants`. */
  variants?: Record<string, import('./index').VariantInput>
}

/**
 * Server-only. Call inside a Server Component, Route Handler, Server Action,
 * or `generateMetadata` — anywhere `next/headers` is available.
 */
export declare function getDevice(options?: GetDeviceOptions): Promise<DeviceInfo>
