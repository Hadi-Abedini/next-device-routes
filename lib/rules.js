'use strict'

const path = require('path')
const { normalizeVariant, userAgentCondition } = require('./variants')
const { collectPages, isDirectory } = require('./scan')

/**
 * Turn variant folders into Next.js rewrite rules.
 *
 * Static routes go into `beforeFiles` so they take priority over the identically
 * named base page. Dynamic routes go into `afterFiles` so that real files
 * (`public/`, `/_next/*`) are never swallowed by a catch-all.
 *
 * @returns {{ beforeFiles: object[], afterFiles: object[], folders: string[], pairs: [string,string][] }}
 */
function buildRules(appDir, variants, pageExtensions) {
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

    for (const page of collectPages(dir, pageExtensions)) {
      const source = '/' + page.segments.join('/')
      const destination = '/' + [folder, ...page.segments].join('/')

      const rule = { source, destination, has }
      if (missing) rule.missing = missing

      ;(page.dynamic ? afterFiles : beforeFiles).push(rule)
      pairs.push([source, destination])
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

module.exports = { buildRules, buildVariantRedirects }
