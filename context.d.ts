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
  /** Pass `(await getDevice()).variant` from a Server Component. */
  variant: string | null
  children: ReactNode
}

/** Wrap the root layout's children so descendant Client Components can call `useDevice()`. */
export declare function DeviceProvider(props: DeviceProviderProps): ReactElement

/** Must be called under a `<DeviceProvider>`; throws otherwise. */
export declare function useDevice(): DeviceInfo
