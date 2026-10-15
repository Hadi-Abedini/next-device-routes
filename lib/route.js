'use strict'

/**
 * Route-based device detection — the static-friendly counterpart of `getDevice()`.
 *
 * `withDeviceRoutes` rewrites a request to a variant folder *before* rendering,
 * so the route Next.js renders is the variant's: its layout segments are
 * `['mobile', 'about']`, not `['about']`, even though the browser URL is
 * `/about`. Reading those segments tells a component which variant it is part
 * of without touching the request, so nothing becomes dynamic.
 *
 * Client-safe on purpose (no Node built-ins): it ships in the client bundle.
 */

const DEFAULT_ROUTE_VARIANTS = { bot: 'bot', tablet: 'tablet', mobile: 'mobile' }

/**
 * Accepts `['mobile']`, `{ mobile: 'm' }` or `{ mobile: { segment: 'm', depth: 1 } }`.
 * Key order is priority, like `variants` in `withDeviceRoutes`.
 *
 * @returns {{ name: string, segment: string, depth: number | null }[]}
 */
function normalizeRouteVariants(variants = DEFAULT_ROUTE_VARIANTS) {
  const entries = Array.isArray(variants)
    ? variants.map((name) => [name, name])
    : Object.entries(variants)

  const out = []
  for (const [name, value] of entries) {
    if (value === false || value == null) continue
    const spec = typeof value === 'string' ? { segment: value } : value
    out.push({
      name,
      segment: (spec && spec.segment) || name,
      depth: spec && Number.isInteger(spec.depth) ? spec.depth : null,
    })
  }
  return out
}

/**
 * @param {string[] | null | undefined} segments  `useSelectedLayoutSegments()` of the calling layout
 * @param {ReturnType<typeof normalizeRouteVariants>} variants
 * @param {number} depth  how many segments sit between that layout and the variant folders
 * @returns {string | null}  the variant's name, or null for the base route
 */
function detectRouteVariant(segments, variants, depth = 0) {
  if (!Array.isArray(segments)) return null
  for (const { name, segment, depth: own } of variants) {
    if (segments[own ?? depth] === segment) return name
  }
  return null
}

module.exports = { DEFAULT_ROUTE_VARIANTS, normalizeRouteVariants, detectRouteVariant }
