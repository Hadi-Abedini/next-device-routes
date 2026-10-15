'use strict'

/**
 * Variant definitions and User-Agent matching.
 *
 * Next.js matches `has` / `missing` values with a case-sensitive RegExp that it
 * anchors itself (`^value$`), so every token has to be expanded into a
 * case-insensitive character class and wrapped with `.*`.
 */

// Shared so `mobile` can exclude them: most tablet UAs also contain "Mobile".
const TABLET_TOKENS = ['iPad', 'Tablet', 'Kindle', 'Silk', 'PlayBook']

const CRAWLER_TOKENS = [
  // search engines
  'Googlebot', 'Google-InspectionTool', 'Storebot-Google', 'AdsBot-Google',
  'bingbot', 'BingPreview', 'Slurp', 'DuckDuckBot', 'Baiduspider', 'YandexBot',
  'Sogou', 'Sosospider', 'Exabot', 'Applebot', 'PetalBot', 'SeznamBot',
  // social / link previews
  'facebookexternalhit', 'Facebot', 'Twitterbot', 'LinkedInBot', 'Pinterestbot', 'pinterest.com/bot',
  'Slackbot', 'TelegramBot', 'WhatsApp/', 'Discordbot', 'redditbot', 'Embedly',
  // AI crawlers
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web',
  'PerplexityBot', 'Bytespider', 'Amazonbot', 'Applebot-Extended',
  // generic — deliberately specific: a bare "spider" would also match e.g. "Spiderman"
  'crawler', 'crawling', 'spider/',
]

const MOBILE_TOKENS = [
  'Mobi', 'iPhone', 'iPod', 'Android', 'Windows Phone', 'BlackBerry', 'BB10',
  'Opera Mini', 'IEMobile', 'webOS',
]

/**
 * Default variants. Key = folder name inside `app/`.
 * Object order is priority: the first variant whose rule matches wins.
 */
const defaultVariants = {
  bot: { match: CRAWLER_TOKENS },
  tablet: { match: TABLET_TOKENS },
  mobile: { match: MOBILE_TOKENS, exclude: TABLET_TOKENS },
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')

/** Expand a literal into a case-insensitive pattern: `iPad` -> `[iI][pP][aA][dD]`. */
const caseInsensitive = (token) =>
  Array.from(String(token))
    .map((ch) => (/[a-z]/i.test(ch) ? `[${ch.toLowerCase()}${ch.toUpperCase()}]` : escapeRegex(ch)))
    .join('')

/** `(?:[iI][pP]...|...)` — the case-insensitive alternation of a token list. */
const alternation = (tokens) => `(?:${tokens.map(caseInsensitive).join('|')})`

/** Build the value Next.js compares the whole User-Agent header against. */
function userAgentPattern(tokens) {
  return `.*${alternation(tokens)}.*`
}

/**
 * Pattern that matches exactly the User-Agents a normalized variant applies to:
 * `match` hits and `exclude` does not. Lookaheads keep it a single anchored
 * expression, so it can be used as a `has` or a `missing` value alike.
 */
function userAgentAppliesPattern({ match, exclude }) {
  if (!exclude) return userAgentPattern(match)
  return `(?=.*${alternation(match)})(?!.*${alternation(exclude)}).*`
}

/** Build a Next.js route condition array for the User-Agent header. */
function userAgentCondition(tokens) {
  return [{ type: 'header', key: 'user-agent', value: userAgentPattern(tokens) }]
}

/**
 * Accepts `['iPad']`, `{ match, exclude, dir }`, `false` or `null`.
 * Returns a normalized variant, or null when the variant is disabled/invalid.
 */
function normalizeVariant(input, folder) {
  if (input === false || input == null) return null

  const variant = Array.isArray(input) ? { match: input } : input
  const match = variant && variant.match

  if (!Array.isArray(match) || match.length === 0) {
    throw new TypeError(
      `[next-device-routes] variant "${folder}" needs a non-empty "match" array of User-Agent tokens.`
    )
  }

  const { dir } = variant
  if (dir != null && (typeof dir !== 'string' || !dir.trim())) {
    throw new TypeError(`[next-device-routes] variant "${folder}": "dir" must be a non-empty string.`)
  }

  const exclude = Array.isArray(variant.exclude) && variant.exclude.length ? variant.exclude : null
  return { match, exclude, dir: dir ? dir.trim() : null }
}

/**
 * Compile `variants` into a plain-JS matcher for runtime use (the `getDevice()`
 * server function). This is a separate, simpler code path from
 * `userAgentCondition`: Next.js rewrites need an anchored, flag-less RegExp
 * (hence the character-class trick above), but a normal `RegExp` with the `i`
 * flag is all a runtime `.test()` call needs.
 *
 * @returns {(userAgent: string | null | undefined) => string | null}
 */
function compileMatcher(variants) {
  const compiled = []
  for (const [name, input] of Object.entries(variants)) {
    const variant = normalizeVariant(input, name)
    if (!variant) continue
    compiled.push({
      name,
      match: new RegExp(variant.match.map(escapeRegex).join('|'), 'i'),
      exclude: variant.exclude ? new RegExp(variant.exclude.map(escapeRegex).join('|'), 'i') : null,
    })
  }

  return function matchVariant(userAgent) {
    if (!userAgent) return null
    for (const v of compiled) {
      if (v.match.test(userAgent) && !(v.exclude && v.exclude.test(userAgent))) return v.name
    }
    return null
  }
}

// Compiled rules only — never anything derived from a request — so sharing
// these across requests is safe. Two levels: the `variants` object itself (the
// normal case: one module-level object), then its JSON, so a literal written
// inline in a layout (`variants={{ ... }}`, a fresh object per render) does not
// recompile on every request either.
const matcherCache = new WeakMap()
const matcherByContent = new Map()
const MAX_CONTENT_ENTRIES = 50

/** `compileMatcher`, compiled once per `variants` object / content. */
function getMatcher(variants) {
  let matcher = matcherCache.get(variants)
  if (matcher) return matcher

  let key = null
  try {
    key = JSON.stringify(variants)
  } catch {
    // not serializable — fall back to identity-only caching
  }

  if (key !== null) matcher = matcherByContent.get(key)
  if (!matcher) {
    matcher = compileMatcher(variants)
    if (key !== null) {
      if (matcherByContent.size >= MAX_CONTENT_ENTRIES) {
        matcherByContent.delete(matcherByContent.keys().next().value)
      }
      matcherByContent.set(key, matcher)
    }
  }
  matcherCache.set(variants, matcher)
  return matcher
}

/**
 * Shared shape returned by `getDevice()` (server) and `useDevice()` (client),
 * so the two are always in sync — one function, required by both bundles.
 * `isMobile` / `isTablet` / `isBot` are convenience flags for the default
 * variant names; for a custom variant, compare `variant` directly.
 */
function toDeviceInfo(variant) {
  return {
    variant: variant ?? null,
    isMobile: variant === 'mobile',
    isTablet: variant === 'tablet',
    isBot: variant === 'bot',
    isBase: variant == null,
  }
}

module.exports = {
  defaultVariants,
  TABLET_TOKENS,
  CRAWLER_TOKENS,
  MOBILE_TOKENS,
  normalizeVariant,
  userAgentPattern,
  userAgentAppliesPattern,
  userAgentCondition,
  compileMatcher,
  getMatcher,
  toDeviceInfo,
}
