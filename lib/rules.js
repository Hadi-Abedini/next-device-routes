'use strict'

const path = require('path')
const {
  normalizeVariant,
  userAgentCondition,
  userAgentAppliesPattern,
} = require('./variants')
const { collectPages, isDirectory, parseSegment } = require('./scan')

// Parameter name used by collapsed rules. Unlikely to collide with a real one.
const COLLAPSE_PARAM = '__dr'

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toUrl = (...segments) => '/' + segments.filter(Boolean).join('/')

/**
 * Where a variant lives, and how that maps onto URLs.
 *
 * A variant folder is `<appDir>/<dir>`; `dir` defaults to `<root>/<name>` (or
 * just `<name>`). Every folder of `dir` except the last is a *prefix* that is
 * part of the URL — `[lang]/mobile` has the prefix `:lang`. The last folder is
 * the variant's own URL segment: it appears in the rewrite destination only.
 *
 *   dir '[lang]/mobile'  ->  /:lang/about  =>  /:lang/mobile/about
 *   dir 'mobile'         ->  /about        =>  /mobile/about
 *
 * @returns {{ rel: string, folder: string, prefixSegments: string[], prefixScores: number[] }}
 */
function resolveVariantPath(name, variant, root = '') {
  const raw = variant.dir || (root ? `${root}/${name}` : name)
  const parts = String(raw)
    .split(/[\\/]+/)
    .filter((part) => part && part !== '.')

  if (!parts.length || parts.includes('..')) {
    throw new TypeError(
      `[next-device-routes] variant "${name}": "${raw}" is not a valid folder path inside the app directory.`
    )
  }

  const folder = parts[parts.length - 1]
  const last = parseSegment(folder)
  if (!last || last.omit || last.score !== 0) {
    throw new TypeError(
      `[next-device-routes] variant "${name}": the last folder of "${raw}" must be a plain static folder ` +
        `(it becomes a URL segment), not "${folder}".`
    )
  }

  const prefix = []
  for (const part of parts.slice(0, -1)) {
    const segment = parseSegment(part)
    if (!segment) {
      throw new TypeError(
        `[next-device-routes] variant "${name}": "${part}" in "${raw}" is not a routable folder.`
      )
    }
    if (!segment.omit) prefix.push(segment)
  }

  return {
    rel: parts.join('/'),
    folder,
    prefixSegments: prefix.map((s) => s.value),
    prefixScores: prefix.map((s) => s.score),
  }
}

/**
 * Turn variant folders into Next.js rewrite rules.
 *
 * Every rewrite is tested against every incoming request, so the number of rules
 * — not the number of pages — is what costs time at runtime. All static routes of
 * a variant are therefore collapsed into a single alternation rule:
 *
 *   source: '/:__dr(about|blog/post|pricing)'  ->  '/mobile/:__dr'
 *
 * Dynamic routes keep their own rule, since their parameters must pass through.
 *
 * Variants are mutually exclusive: a rule only applies when no variant with a
 * higher priority applies to the same User-Agent (`missing`). That keeps the
 * outcome identical to `getDevice()` — e.g. Googlebot's smartphone crawler,
 * whose UA also contains "Mobile", is a `bot`, never a `mobile` that merely
 * lacks a bot page — and makes the order of the rules irrelevant.
 *
 * Static rules go in `beforeFiles` so they win over the identically named base
 * page; dynamic ones go in `afterFiles` so real files are never swallowed. A
 * variant under a dynamic prefix (`[lang]/mobile`) has no static rules: all of
 * its routes are dynamic ones, and `afterFiles` already runs before them.
 *
 * @returns {{
 *   beforeFiles: object[], afterFiles: object[],
 *   folders: string[], pairs: string[][],
 *   found: { name: string, rel: string, folder: string, prefixSegments: string[] }[],
 *   searched: { name: string, rel: string, exists: boolean }[],
 * }}
 */
function buildRules(appDir, variants, pageExtensions, { collapse = true, root = '' } = {}) {
  const beforeFiles = []
  const afterFiles = []
  const folders = []
  const pairs = []
  const found = []
  const searched = []

  const configured = []
  for (const [name, input] of Object.entries(variants)) {
    const variant = normalizeVariant(input, name)
    if (variant) configured.push({ name, ...variant })
  }

  configured.forEach((variant, index) => {
    const location = resolveVariantPath(variant.name, variant, root)
    const dir = path.join(appDir, location.rel)
    const exists = isDirectory(dir)
    searched.push({ name: variant.name, rel: location.rel, exists })
    if (!exists) return

    folders.push(location.rel)
    found.push({ name: variant.name, ...location })

    const has = userAgentCondition(variant.match)
    const missing = [
      ...(variant.exclude ? userAgentCondition(variant.exclude) : []),
      // Higher-priority variants win outright, whether or not they have a folder.
      ...configured.slice(0, index).map((higher) => ({
        type: 'header',
        key: 'user-agent',
        value: userAgentAppliesPattern(higher),
      })),
    ]
    const decorate = (rule) => (missing.length ? { ...rule, has, missing } : { ...rule, has })

    const { prefixSegments, prefixScores, folder } = location
    const prefixDynamic = prefixScores.some((score) => score > 0)
    const staticTarget = prefixDynamic ? afterFiles : beforeFiles

    const staticRules = []
    const dynamicRules = []
    const staticPaths = []

    for (const page of collectPages(dir, pageExtensions)) {
      const source = toUrl(...prefixSegments, ...page.segments)
      const destination = toUrl(...prefixSegments, folder, ...page.segments)
      pairs.push([source, destination])

      if (page.dynamic) {
        dynamicRules.push(decorate({ source, destination }))
      } else if (collapse && page.segments.length > 0) {
        staticPaths.push(page.segments.join('/'))
      } else {
        // the index route, or collapsing turned off
        staticRules.push(decorate({ source, destination }))
      }
    }

    if (staticPaths.length === 1) {
      // an alternation of one is just a slower way to write a literal
      const only = staticPaths[0]
      staticRules.push(
        decorate({
          source: toUrl(...prefixSegments, only),
          destination: toUrl(...prefixSegments, folder, only),
        })
      )
    } else if (staticPaths.length > 1) {
      const pattern = staticPaths.map(escapeRegex).join('|')
      staticRules.push(
        decorate({
          source: toUrl(...prefixSegments, `:${COLLAPSE_PARAM}(${pattern})`),
          destination: toUrl(...prefixSegments, folder, `:${COLLAPSE_PARAM}`),
        })
      )
    }

    staticTarget.push(...staticRules)
    afterFiles.push(...dynamicRules)
  })

  return { beforeFiles, afterFiles, folders, pairs, found, searched }
}

/**
 * Redirect `/mobile/about` -> `/about` so variant paths are not indexed directly.
 * With a prefix, `/en/mobile/about` -> `/en/about`.
 *
 * @param {{ prefixSegments: string[], folder: string }[]} found `buildRules().found`
 */
function buildVariantRedirects(found, permanent = false) {
  return found.map(({ prefixSegments, folder }) => {
    // The catch-all must not shadow a prefix parameter of the same name.
    const param = prefixSegments.some((s) => s.startsWith(':path')) ? '__path' : 'path'
    return {
      source: toUrl(...prefixSegments, folder, `:${param}*`),
      destination: toUrl(...prefixSegments, `:${param}*`),
      permanent,
    }
  })
}

module.exports = { buildRules, buildVariantRedirects, resolveVariantPath, COLLAPSE_PARAM }
