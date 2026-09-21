'use strict'

const fs = require('fs')
const path = require('path')

const DEFAULT_PAGE_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js', 'mdx', 'md']

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')

/**
 * Build the matcher for page files.
 * Honours Next's `pageExtensions`, including the `page.tsx` convention where an
 * extension already contains a dot (e.g. `['page.tsx']` -> `page.page.tsx`).
 */
function pageMatcher(extensions = DEFAULT_PAGE_EXTENSIONS) {
  const list = (Array.isArray(extensions) && extensions.length ? extensions : DEFAULT_PAGE_EXTENSIONS)
    .map((ext) => String(ext).replace(/^\./, ''))
    .filter(Boolean)
  return new RegExp(`^page\\.(?:${list.map(escapeRegex).join('|')})$`)
}

const PAGE_FILE = pageMatcher()

const isDirectory = (p) => {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

/** Locate the App Router directory. */
function findAppDir(cwd, override) {
  const candidates = override ? [override] : ['app', 'src/app']
  for (const candidate of candidates) {
    const full = path.resolve(cwd, candidate)
    if (isDirectory(full)) return full
  }
  return null
}

/**
 * Translate an App Router folder name into a rewrite path segment.
 *
 *   about          -> { value: 'about',    score: 0 }
 *   [slug]         -> { value: ':slug',    score: 1 }
 *   [...rest]      -> { value: ':rest+',   score: 2 }
 *   [[...rest]]    -> { value: ':rest*',   score: 3 }
 *   (marketing)    -> { omit: true }              route group, no URL segment
 *   _private / @slot / (.)intercept -> null       not a routable folder
 */
function parseSegment(name) {
  if (name.startsWith('_') || name.startsWith('@')) return null
  if (/^\(\.{1,3}\)/.test(name)) return null // (.) (..) (...) intercepting routes
  if (/^\(.+\)$/.test(name)) return { omit: true }

  let m
  if ((m = /^\[\[\.\.\.(.+)\]\]$/.exec(name))) return { value: `:${m[1]}*`, score: 3 }
  if ((m = /^\[\.\.\.(.+)\]$/.exec(name))) return { value: `:${m[1]}+`, score: 2 }
  if ((m = /^\[(.+)\]$/.exec(name))) return { value: `:${m[1]}`, score: 1 }

  return { value: name, score: 0 }
}

/**
 * Collect every `page.*` under `root`.
 * @returns {{ segments: string[], scores: number[], dynamic: boolean }[]}
 */
function collectPages(root, extensions) {
  const isPage = extensions ? pageMatcher(extensions) : PAGE_FILE
  const pages = []

  const walk = (dir, segments, scores) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.isFile()) {
        if (isPage.test(entry.name)) {
          pages.push({ segments, scores, dynamic: scores.some((s) => s > 0) })
        }
        continue
      }
      if (!entry.isDirectory()) continue

      const segment = parseSegment(entry.name)
      if (!segment) continue

      const next = path.join(dir, entry.name)
      if (segment.omit) walk(next, segments, scores)
      else walk(next, [...segments, segment.value], [...scores, segment.score])
    }
  }

  walk(root, [], [])
  return pages.sort(bySpecificity)
}

/** Static segments before dynamic ones, catch-alls last — mirrors Next's own precedence. */
function bySpecificity(a, b) {
  const len = Math.max(a.scores.length, b.scores.length)
  for (let i = 0; i < len; i++) {
    const diff = (a.scores[i] || 0) - (b.scores[i] || 0)
    if (diff !== 0) return diff
  }
  return a.segments.length - b.segments.length
}

module.exports = {
  findAppDir,
  collectPages,
  parseSegment,
  isDirectory,
  pageMatcher,
  PAGE_FILE,
  DEFAULT_PAGE_EXTENSIONS,
}
