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
  'Sogou', 'Exabot', 'Applebot', 'PetalBot', 'SeznamBot',
  // social / link previews
  'facebookexternalhit', 'Facebot', 'Twitterbot', 'LinkedInBot', 'Pinterest',
  'Slackbot', 'TelegramBot', 'WhatsApp', 'Discordbot', 'redditbot', 'Embedly',
  // AI crawlers
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web',
  'PerplexityBot', 'Bytespider', 'Amazonbot', 'Applebot-Extended',
  // generic
  'crawler', 'spider', 'crawling',
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

/** Build the value Next.js compares the whole User-Agent header against. */
function userAgentPattern(tokens) {
  return `.*(?:${tokens.map(caseInsensitive).join('|')}).*`
}

/** Build a Next.js route condition array for the User-Agent header. */
function userAgentCondition(tokens) {
  return [{ type: 'header', key: 'user-agent', value: userAgentPattern(tokens) }]
}

/**
 * Accepts `['iPad']`, `{ match: [...], exclude: [...] }`, `false` or `null`.
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

  const exclude = Array.isArray(variant.exclude) && variant.exclude.length ? variant.exclude : null
  return { match, exclude }
}

module.exports = {
  defaultVariants,
  TABLET_TOKENS,
  CRAWLER_TOKENS,
  MOBILE_TOKENS,
  normalizeVariant,
  userAgentPattern,
  userAgentCondition,
}
