'use strict'

const path = require('path')
const { normalizeVariant, userAgentCondition } = require('./variants')
const { collectPages, isDirectory } = require('./scan')

// Parameter name used by collapsed rules. Unlikely to collide with a real one.
const COLLAPSE_PARAM = '__dr'

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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
 * Static rules go in `beforeFiles` so they win over the identically named base
 * page; dynamic ones go in `afterFiles` so real files are never swallowed.
 */
function buildRules(appDir, variants, pageExtensions, { collapse = true } = {}) {
  const beforeFiles = []
  const afterFiles = []
  const folders = []
  const pairs = []

  for (const [folder, input] of Object.entries(variants)) {
    const variant = normalizeVariant(input, folder)
    if (!variant) continue

    const dir = path.join(appDir, folder)
    if (!isDirectory(dir)) continue
    folders.push(folder)

    const has = userAgentCondition(variant.match)
    const missing = variant.exclude ? userAgentCondition(variant.exclude) : null
    const decorate = (rule) => (missing ? { ...rule, has, missing } : { ...rule, has })

    const staticPaths = []

    for (const page of collectPages(dir, pageExtensions)) {
      const source = '/' + page.segments.join('/')
      const destination = '/' + [folder, ...page.segments].join('/')
      pairs.push([source, destination])

      if (page.dynamic) {
        afterFiles.push(decorate({ source, destination }))
      } else if (collapse && page.segments.length > 0) {
        staticPaths.push(page.segments.join('/'))
      } else {
        // the index route, or collapsing turned off
        beforeFiles.push(decorate({ source, destination }))
      }
    }

    if (staticPaths.length === 1) {
      // an alternation of one is just a slower way to write a literal
      const only = staticPaths[0]
      beforeFiles.push(decorate({ source: `/${only}`, destination: `/${folder}/${only}` }))
    } else if (staticPaths.length > 1) {
      const pattern = staticPaths.map(escapeRegex).join('|')
      beforeFiles.push(
        decorate({
          source: `/:${COLLAPSE_PARAM}(${pattern})`,
          destination: `/${folder}/:${COLLAPSE_PARAM}`,
        })
      )
    }
  }

  return { beforeFiles, afterFiles, folders, pairs }
}

/** Redirect `/mobile/about` -> `/about` so variant paths are not indexed directly. */
function buildVariantRedirects(folders, permanent = false) {
  return folders.map((folder) => ({
    source: `/${folder}/:path*`,
    destination: '/:path*',
    permanent,
  }))
}

module.exports = { buildRules, buildVariantRedirects, COLLAPSE_PARAM }
