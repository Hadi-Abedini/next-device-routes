import type { NextConfig } from 'next'

export interface Variant {
  /** Substrings looked up case-insensitively inside the User-Agent header. */
  match: string[]
  /** If the User-Agent also contains one of these, the variant is skipped. */
  exclude?: string[]
  /**
   * Folder of this variant, relative to the app directory. Overrides `root` and the
   * variant's name for this one variant, e.g. `'[lang]/m'` or `'(site)/tablet'`.
   *
   * Every folder except the last is part of the URL (`[lang]` becomes `:lang`);
   * the last one is a static folder that only exists in the rewrite destination.
   */
  dir?: string
}

/** `['iPad']` is shorthand for `{ match: ['iPad'] }`. `false` disables a variant. */
export type VariantInput = string[] | Variant | false | null

export interface DeviceRoutesOptions {
  /**
   * Map of folder name inside `app/` to its User-Agent rule.
   * Key order is priority — the first matching variant wins.
   * A variant that is matched first also wins when a lower-priority variant would match
   * the same User-Agent, whether or not it has a page for the route.
   * Replaces the defaults entirely; spread `defaultVariants` to extend them.
   */
  variants?: Record<string, VariantInput>
  /** App Router directory relative to the project root. Default: `app`, then `src/app`. */
  appDir?: string
  /**
   * Default folder, relative to `appDir`, that holds the variant folders — set it when
   * your routes start below the app root, e.g. `'[lang]'` for `app/[lang]/mobile/...`.
   * A variant's own `dir` takes precedence. Default: none (`app/mobile`).
   */
  root?: string
  /**
   * Page file extensions to look for, without the leading dot.
   * Defaults to `nextConfig.pageExtensions`, then `['tsx', 'ts', 'jsx', 'js', 'mdx', 'md']`.
   */
  pageExtensions?: string[]
  /** Redirect `/mobile/:path*` to `/:path*` (`/en/mobile/...` to `/en/...` under a prefix) so variant URLs are not indexed. Default: false. */
  redirectVariantPaths?: boolean
  /** Use 308 instead of 307 for those redirects. Default: false. */
  permanentRedirects?: boolean
  /** Project root used to resolve `appDir`. Default: `process.cwd()`. */
  cwd?: string
  /** Log where each variant is looked up and every generated rewrite. Default: false. */
  debug?: boolean
}

/** The function form `next.config` may export, as Next.js calls it. */
export type NextConfigFn = (
  phase: string,
  context: { defaultConfig: NextConfig }
) => NextConfig | Promise<NextConfig>

export declare const defaultVariants: Record<string, Variant>

/** The User-Agent tokens behind the default `bot`, `tablet` and `mobile` variants, for building your own. */
export declare const CRAWLER_TOKENS: readonly string[]
export declare const TABLET_TOKENS: readonly string[]
export declare const MOBILE_TOKENS: readonly string[]

/** Wraps a plain `next.config` object. */
export declare function withDeviceRoutes(
  nextConfig?: NextConfig,
  options?: DeviceRoutesOptions
): NextConfig

/** Wraps a function-shaped `next.config`, preserving the function form. */
export declare function withDeviceRoutes(
  nextConfig: NextConfigFn,
  options?: DeviceRoutesOptions
): (phase: string, context?: { defaultConfig: NextConfig }) => Promise<NextConfig>

export default withDeviceRoutes
