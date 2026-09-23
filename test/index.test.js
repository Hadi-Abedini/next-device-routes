'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const withDeviceRoutes = require('../index.js')
const { defaultVariants } = require('../index.js')
const { parseSegment, pageMatcher } = require('../lib/scan.js')
const { userAgentPattern, normalizeVariant } = require('../lib/variants.js')

/* ------------------------------ fixture ------------------------------ */

const PAGES = [
  'page.js',
  'about/page.js',
  'contact/page.js',
  'blog/[slug]/page.js',
  'mobile/page.js',
  'mobile/about/page.js',
  'mobile/blog/[slug]/page.js',
  'mobile/(shop)/cart/page.tsx',
  'mobile/docs/[[...parts]]/page.js',
  'mobile/files/[...path]/page.js',
  'mobile/ts/page.tsx',
  'mobile/mdx/page.mdx',
  'mobile/_components/page.js', // private folder, must be ignored
  'mobile/@modal/page.js', // parallel route, must be ignored
  'bot/about/page.js',
  'tablet/page.js',
]

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ndr-'))
for (const rel of PAGES) {
  const file = path.join(root, 'app', rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, 'export default function P(){return null}')
}

const build = (options = {}) => withDeviceRoutes({}, { cwd: root, ...options }).rewrites()

/** Expand collapsed alternation rules back into concrete source -> destination pairs. */
function expand(rules) {
  const out = []
  for (const rule of rules) {
    const m = /^\/:__dr\((.+)\)$/.exec(rule.source)
    if (!m) {
      out.push({ ...rule, source: rule.source, destination: rule.destination })
      continue
    }
    const prefix = rule.destination.replace(/\/:__dr$/, '')
    for (const p of m[1].split('|')) {
      out.push({ ...rule, source: `/${p}`, destination: `${prefix}/${p}` })
    }
  }
  return out
}
const find = (rules, source) => expand(rules).filter((r) => r.source === source)
const uaOf = (rule) => rule.has[0].value
const matches = (rule, ua) => {
  if (rule.missing && new RegExp(`^${rule.missing[0].value}$`).test(ua)) return false
  return new RegExp(`^${uaOf(rule)}$`).test(ua)
}

/* ------------------------------ segments ------------------------------ */

test('parseSegment translates App Router folder names', () => {
  assert.deepEqual(parseSegment('about'), { value: 'about', score: 0 })
  assert.deepEqual(parseSegment('[slug]'), { value: ':slug', score: 1 })
  assert.deepEqual(parseSegment('[...rest]'), { value: ':rest+', score: 2 })
  assert.deepEqual(parseSegment('[[...rest]]'), { value: ':rest*', score: 3 })
  assert.deepEqual(parseSegment('(marketing)'), { omit: true })
  assert.equal(parseSegment('_private'), null)
  assert.equal(parseSegment('@modal'), null)
  assert.equal(parseSegment('(.)photo'), null)
  assert.equal(parseSegment('(..)photo'), null)
})

/* ------------------------------ scanning ------------------------------ */

test('generates a rewrite for every variant page', async () => {
  const { beforeFiles, afterFiles } = await build()
  const all = expand([...beforeFiles, ...afterFiles])
  const pairs = all.map((r) => `${r.source} -> ${r.destination}`)

  assert.ok(pairs.includes('/ -> /mobile'))
  assert.ok(pairs.includes('/about -> /mobile/about'))
  assert.ok(pairs.includes('/blog/:slug -> /mobile/blog/:slug'))
  assert.ok(pairs.includes('/cart -> /mobile/cart'), 'route group must not add a segment')
  assert.ok(pairs.includes('/docs/:parts* -> /mobile/docs/:parts*'))
  assert.ok(pairs.includes('/files/:path+ -> /mobile/files/:path+'))
  assert.ok(pairs.includes('/about -> /bot/about'))
  assert.ok(pairs.includes('/ -> /tablet'))
})

test('pages missing from a variant get no rewrite', async () => {
  const { beforeFiles, afterFiles } = await build()
  assert.equal(find([...beforeFiles, ...afterFiles], '/contact').length, 0, '/contact is base only')
})

test('private and parallel folders are ignored', async () => {
  const { beforeFiles, afterFiles } = await build()
  const dests = expand([...beforeFiles, ...afterFiles]).map((r) => r.destination)
  assert.ok(!dests.some((d) => d.includes('_components')))
  assert.ok(!dests.some((d) => d.includes('@modal')))
})

/* --------------------------- page extensions --------------------------- */

test('TypeScript and MDX pages are detected by default', async () => {
  const { beforeFiles } = await build()
  const pairs = expand(beforeFiles).map((r) => `${r.source} -> ${r.destination}`)
  assert.ok(pairs.includes('/ts -> /mobile/ts'), 'page.tsx must be picked up')
  assert.ok(pairs.includes('/mdx -> /mobile/mdx'), 'page.mdx must be picked up')
  assert.ok(pairs.includes('/cart -> /mobile/cart'), 'page.tsx inside a route group')
})

test('pageMatcher honours a custom pageExtensions list', () => {
  const dflt = pageMatcher()
  assert.ok(dflt.test('page.tsx') && dflt.test('page.ts') && dflt.test('page.js'))
  assert.ok(!dflt.test('page.mjs'))

  const scoped = pageMatcher(['page.tsx', 'page.ts'])
  assert.ok(scoped.test('page.page.tsx'), 'the page.tsx convention must work')
  assert.ok(!scoped.test('page.tsx'))

  const dotted = pageMatcher(['.mjs'])
  assert.ok(dotted.test('page.mjs'), 'a leading dot must be tolerated')
})

test('pageExtensions option narrows what is scanned', async () => {
  const { beforeFiles, afterFiles } = await build({ pageExtensions: ['tsx'] })
  const dests = expand([...beforeFiles, ...afterFiles]).map((r) => r.destination)
  assert.deepEqual(dests, ['/mobile/cart', '/mobile/ts'].sort(), 'only .tsx pages remain')
})

test('pageExtensions is inherited from nextConfig', async () => {
  const config = withDeviceRoutes({ pageExtensions: ['mdx'] }, { cwd: root })
  const { beforeFiles, afterFiles } = await config.rewrites()
  const dests = expand([...beforeFiles, ...afterFiles]).map((r) => r.destination)
  assert.deepEqual(dests, ['/mobile/mdx'])
})

/* ------------------------------ ordering ------------------------------ */

test('static rewrites run before files, dynamic ones after', async () => {
  const { beforeFiles, afterFiles } = await build()
  assert.ok(expand(beforeFiles).every((r) => !/:/.test(r.source)), 'beforeFiles must stay static')
  assert.ok(afterFiles.every((r) => /:/.test(r.source)), 'afterFiles must be dynamic only')
})

test('variant priority follows the key order of the variants object', async () => {
  const { beforeFiles } = await build()
  const roots = find(beforeFiles, '/').map((r) => r.destination)
  assert.deepEqual(roots, ['/tablet', '/mobile'], 'tablet is declared before mobile')
})

/* ------------------------------ matching ------------------------------ */

const UA = {
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) Version/16.0 Mobile/15E148 Safari/604.1',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  lowercase: 'mozilla/5.0 (linux; android 13) chrome/120 mobile safari/537.36',
}

test('User-Agent matching is case-insensitive and anchored-safe', () => {
  const re = new RegExp(`^${userAgentPattern(['iPhone', 'Mobi'])}$`)
  assert.ok(re.test(UA.iphone))
  assert.ok(re.test(UA.lowercase))
  assert.ok(!re.test(UA.desktop))
})

test('phones hit mobile, desktops hit nothing', async () => {
  const { beforeFiles } = await build()
  const mobileAbout = find(beforeFiles, '/about').find((r) => r.destination === '/mobile/about')
  assert.ok(matches(mobileAbout, UA.iphone))
  assert.ok(matches(mobileAbout, UA.android))
  assert.ok(!matches(mobileAbout, UA.desktop))
})

test('tablets are excluded from the mobile variant', async () => {
  const { beforeFiles } = await build()
  const mobileAbout = find(beforeFiles, '/about').find((r) => r.destination === '/mobile/about')
  const tabletRoot = find(beforeFiles, '/').find((r) => r.destination === '/tablet')

  assert.ok(matches(tabletRoot, UA.ipad), 'iPad matches the tablet variant')
  assert.ok(!matches(mobileAbout, UA.ipad), 'iPad must fall back to base, not mobile')
})

test('crawlers hit the bot variant', async () => {
  const { beforeFiles } = await build()
  const botAbout = find(beforeFiles, '/about').find((r) => r.destination === '/bot/about')
  assert.ok(matches(botAbout, UA.googlebot))
  assert.ok(!matches(botAbout, UA.desktop))
})

/* ----------------------------- collapsing ----------------------------- */

test('static routes of a variant collapse into a single rule', async () => {
  const { beforeFiles } = await build({ variants: { mobile: defaultVariants.mobile } })
  const collapsed = beforeFiles.filter((r) => r.source.startsWith('/:__dr('))
  assert.equal(collapsed.length, 1, 'one alternation rule per variant')
  assert.equal(collapsed[0].destination, '/mobile/:__dr')

  // rule count must not grow with the number of pages
  assert.ok(beforeFiles.length <= 2, `expected at most 2 rules, got ${beforeFiles.length}`)
})

test('collapsing preserves every route, including nested ones', async () => {
  const { beforeFiles } = await build({ variants: { mobile: defaultVariants.mobile } })
  const pairs = expand(beforeFiles).map((r) => `${r.source} -> ${r.destination}`)
  assert.ok(pairs.includes('/about -> /mobile/about'))
  assert.ok(pairs.includes('/cart -> /mobile/cart'))
  assert.ok(pairs.includes('/ts -> /mobile/ts'))
  assert.ok(pairs.includes('/ -> /mobile'), 'the index route keeps its own rule')
})

test('the collapsed pattern matches exactly the intended paths', async () => {
  const { beforeFiles } = await build({ variants: { mobile: defaultVariants.mobile } })
  const rule = beforeFiles.find((r) => r.source.startsWith('/:__dr('))
  const pattern = /^\/:__dr\((.+)\)$/.exec(rule.source)[1]
  const re = new RegExp(`^/(?:${pattern})$`)

  assert.ok(re.test('/about'))
  assert.ok(re.test('/cart'))
  assert.ok(!re.test('/contact'), 'base-only route must not match')
  assert.ok(!re.test('/abou'), 'partial must not match')
  assert.ok(!re.test('/about/extra'), 'deeper path must not match')
})

test('regex metacharacters in folder names are escaped', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ndr-esc-'))
  for (const rel of ['app/mobile/v1.2/page.js', 'app/mobile/a+b/page.js', 'app/mobile/plain/page.js']) {
    const file = path.join(dir, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, 'x')
  }
  const { beforeFiles } = await withDeviceRoutes({}, { cwd: dir }).rewrites()
  const rule = beforeFiles.find((r) => r.source.startsWith('/:__dr('))
  const pattern = /^\/:__dr\((.+)\)$/.exec(rule.source)[1]
  const re = new RegExp(`^/(?:${pattern})$`)

  assert.ok(re.test('/v1.2'))
  assert.ok(!re.test('/v1X2'), 'the dot must be escaped, not treated as any-char')
  assert.ok(re.test('/a+b'))
  fs.rmSync(dir, { recursive: true, force: true })
})

test('collapse can be turned off', async () => {
  const { beforeFiles } = await build({ collapse: false })
  assert.ok(!beforeFiles.some((r) => r.source.includes('__dr')))
  assert.ok(beforeFiles.length > 3, 'one rule per route when not collapsing')
  const pairs = beforeFiles.map((r) => `${r.source} -> ${r.destination}`)
  assert.ok(pairs.includes('/about -> /mobile/about'))
})

test('collapsed and uncollapsed output cover the same routes', async () => {
  const a = await build()
  const b = await build({ collapse: false })
  const norm = (r) => expand([...r.beforeFiles, ...r.afterFiles])
    .map((x) => `${x.source} -> ${x.destination}`)
    .sort()
  assert.deepEqual(norm(a), norm(b))
})

/* ------------------------------ options ------------------------------ */

test('custom variants replace the defaults', async () => {
  const { beforeFiles, afterFiles } = await build({ variants: { bot: ['Googlebot'] } })
  const dests = expand([...beforeFiles, ...afterFiles]).map((r) => r.destination)
  assert.ok(dests.every((d) => d.startsWith('/bot/')))
})

test('a variant can be disabled with false', async () => {
  const { beforeFiles, afterFiles } = await build({
    variants: { ...defaultVariants, mobile: false },
  })
  const dests = expand([...beforeFiles, ...afterFiles]).map((d) => d.destination)
  assert.ok(!dests.some((d) => d.startsWith('/mobile')))
})

test('an invalid variant throws a helpful error', () => {
  assert.throws(() => normalizeVariant({ match: [] }, 'mobile'), /non-empty "match" array/)
})

test('missing app directory degrades gracefully', async () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'ndr-empty-'))
  const { beforeFiles, afterFiles } = await withDeviceRoutes({}, { cwd: empty }).rewrites()
  assert.deepEqual(beforeFiles, [])
  assert.deepEqual(afterFiles, [])
})

/* --------------------------- user config --------------------------- */

test('user rewrites in array form are preserved', async () => {
  const config = withDeviceRoutes(
    { async rewrites() { return [{ source: '/old', destination: '/about' }] } },
    { cwd: root }
  )
  const { afterFiles } = await config.rewrites()
  assert.ok(afterFiles.some((r) => r.source === '/old'))
})

test('user rewrites in object form are preserved', async () => {
  const config = withDeviceRoutes(
    {
      async rewrites() {
        return {
          beforeFiles: [{ source: '/b', destination: '/x' }],
          afterFiles: [{ source: '/a', destination: '/y' }],
          fallback: [{ source: '/f', destination: '/z' }],
        }
      },
    },
    { cwd: root }
  )
  const { beforeFiles, afterFiles, fallback } = await config.rewrites()
  assert.ok(beforeFiles.some((r) => r.source === '/b'))
  assert.ok(afterFiles.some((r) => r.source === '/a'))
  assert.deepEqual(fallback, [{ source: '/f', destination: '/z' }])
})

test('other next config keys pass through untouched', () => {
  const config = withDeviceRoutes({ reactStrictMode: true, images: { domains: ['a.com'] } }, { cwd: root })
  assert.equal(config.reactStrictMode, true)
  assert.deepEqual(config.images, { domains: ['a.com'] })
})

test('a function-shaped next config stays a function', async () => {
  const config = withDeviceRoutes(() => ({ reactStrictMode: true }), { cwd: root })
  assert.equal(typeof config, 'function')
  const resolved = await config('phase-production-build', {})
  assert.equal(resolved.reactStrictMode, true)
  assert.equal(typeof resolved.rewrites, 'function')
})

test('redirectVariantPaths emits one redirect per variant folder', async () => {
  const config = withDeviceRoutes({}, { cwd: root, redirectVariantPaths: true })
  const redirects = await config.redirects()
  const sources = redirects.map((r) => r.source)
  assert.deepEqual(sources.sort(), ['/bot/:path*', '/mobile/:path*', '/tablet/:path*'])
  assert.ok(redirects.every((r) => r.permanent === false))
})

test('redirects are skipped by default and user redirects survive', async () => {
  const config = withDeviceRoutes(
    { async redirects() { return [{ source: '/x', destination: '/y', permanent: true }] } },
    { cwd: root }
  )
  assert.deepEqual(await config.redirects(), [{ source: '/x', destination: '/y', permanent: true }])
})

test.after(() => fs.rmSync(root, { recursive: true, force: true }))
