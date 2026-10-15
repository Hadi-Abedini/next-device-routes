'use strict'

/**
 * A project whose routes all start at src/app/[lang]:
 *
 *   - the variant folders are found below `root` (and `tab` via its own `dir`)
 *   - every route, in every variant, is statically generated
 *   - the root layout knows the device without ever reading the request
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { startApp, UA } = require('./helpers')

let app

test.before(async () => {
  app = await startApp('lang-app')
})
test.after(() => app?.close())

const get = (route, ua) => app.request(route, { 'user-agent': UA[ua] })

test('every variant route is prerendered, so the whole site stays static', () => {
  for (const lang of ['en', 'fa']) {
    for (const route of ['', '/about', '/pricing', '/contact', '/mobile', '/mobile/about', '/mobile/pricing', '/tab', '/bot/about', '/blog/hello', '/mobile/blog/hello']) {
      assert.ok(app.isPrerendered(`/${lang}${route}`), `/${lang}${route} is not prerendered`)
    }
  }
  assert.ok(fs.existsSync(path.join(app.distDir, 'server/app/en/mobile/about.html')))
})

test('the rewrites pick the right variant under the [lang] prefix', async () => {
  const cases = [
    ['/en/about', 'desktop', /base about/],
    ['/en/about', 'iphone', /mobile about/],
    ['/fa/about', 'googlebot', /bot about/],
    ['/fa', 'iphone', /mobile home/],
    ['/fa', 'ipad', /tablet home/],
    ['/fa', 'desktop', /base home/],
    ['/en/blog/hello', 'iphone', /mobile post en\/hello/],
    ['/fa/blog/hello', 'desktop', /base post fa\/hello/],
  ]
  for (const [route, ua, expected] of cases) {
    const res = await get(route, ua)
    assert.equal(res.status, 200, `${route} as ${ua}`)
    assert.match(res.body, expected, `${route} as ${ua}`)
    assert.ok(!app.isNoStore(res), `${route} as ${ua} was served dynamically`)
  }
})

test('the device reaches Client Components from a root layout that never reads the request', async () => {
  const cases = [
    ['/en/about', 'desktop', 'base', false],
    ['/en/about', 'iphone', 'mobile', true],
    ['/fa', 'ipad', 'tablet', false], // custom folder name: [lang]/tab
    ['/en/about', 'googlebot', 'bot', false],
    ['/en/blog/hello', 'iphone', 'mobile', true], // dynamic variant route
  ]
  for (const [route, ua, variant, mobile] of cases) {
    const res = await get(route, ua)
    assert.match(res.body, new RegExp(`probe=${variant};mobile=${mobile}`), `${route} as ${ua}`)
    assert.ok(!app.isNoStore(res))
  }
})

test('a crawler never falls into the mobile variant', async () => {
  // bot/ has no pricing page; mobile/ has one. Googlebot's smartphone UA contains "Mobile".
  const crawler = await get('/en/pricing', 'googlebotSmartphone')
  assert.match(crawler.body, /base pricing/)
  assert.match(crawler.body, /probe=base/)

  // A phone, by contrast, is rewritten into mobile/pricing (a re-export of the base page).
  const phone = await get('/en/pricing', 'iphone')
  assert.match(phone.body, /probe=mobile/)

  const bot = await get('/en/about', 'googlebotSmartphone')
  assert.match(bot.body, /bot about/)
  assert.match(bot.body, /probe=bot/)
})

test('a route no variant has stays the base page for everyone', async () => {
  for (const ua of Object.keys(UA)) {
    const res = await get('/en/contact', ua)
    assert.match(res.body, /base contact/)
  }
})

test('variant URLs redirect back to the public URL, keeping the language', async () => {
  const res = await get('/en/mobile/about', 'desktop')
  assert.equal(res.status, 307)
  assert.equal(res.headers.location, '/en/about')
})

test('client-side navigations carry the rewritten route too', async () => {
  // Soft navigations fetch the RSC payload. Its segment tree must name the variant folder
  // (not the public URL), because that tree is what RouteDeviceProvider reads in the browser.
  const phone = await app.request('/en/about', { 'user-agent': UA.iphone, rsc: '1' })
  assert.equal(phone.status, 200)
  assert.match(phone.body, /\["mobile",\{"children"/)

  const desktop = await app.request('/en/about', { 'user-agent': UA.desktop, rsc: '1' })
  assert.equal(desktop.status, 200)
  assert.doesNotMatch(desktop.body, /\["mobile",\{"children"/)
  assert.match(desktop.body, /\["about",\{"children"/)
})

test('a base page re-exported into a variant stays static and sees that variant', async () => {
  // [lang]/mobile/pricing/page.js is `export { default } from '../../pricing/page'`.
  const phone = await get('/en/pricing', 'iphone')
  assert.match(phone.body, /base pricing/, 'it is the very same page as the base route')
  assert.match(phone.body, /probe=mobile;mobile=true/, 'but it knows it is rendered for a phone')
  assert.ok(!app.isNoStore(phone))
  assert.match((await get('/en/pricing', 'desktop')).body, /probe=base/)
})

test('only a route that reads the request is dynamic, even under [lang]', async () => {
  const expected = { desktop: 'base', iphone: 'mobile', ipad: 'tablet', googlebot: 'bot' }
  for (const [ua, variant] of Object.entries(expected)) {
    const res = await get('/en/live', ua)
    assert.match(res.body, new RegExp(`probe=${variant};`), ua)
    assert.ok(app.isNoStore(res), `/en/live as ${ua} should be rendered per request`)
  }
  // ...and its neighbours are untouched.
  assert.ok(!app.isNoStore(await get('/en/about', 'iphone')))
})
