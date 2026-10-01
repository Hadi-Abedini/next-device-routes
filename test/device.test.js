'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const { compileMatcher, getMatcher, toDeviceInfo, defaultVariants } = require('../lib/variants.js')
const { DeviceProvider, useDevice } = require('../context.js')
const { getDevice, DeviceBoundary } = require('../server.js')

const UA = {
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) Mobile/15E148 Safari/604.1',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  // the mobile-crawling Googlebot UA: overlaps both the bot and mobile token lists
  googlebotMobile:
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
}

/** renderToStaticMarkup HTML-escapes quotes; undo that before matching JSON in the output. */
const unescape = (html) => html.replace(/&quot;/g, '"')

/* ------------------------------ compileMatcher ------------------------------ */

test('compileMatcher resolves the right variant, in priority order', () => {
  const match = compileMatcher(defaultVariants)
  assert.equal(match(UA.iphone), 'mobile')
  assert.equal(match(UA.ipad), 'tablet')
  assert.equal(match(UA.googlebot), 'bot')
  assert.equal(match(UA.desktop), null)
})

test('compileMatcher applies exclude before matching', () => {
  // an iPad UA contains "Mobile", but the default mobile variant excludes tablets
  const match = compileMatcher({ mobile: defaultVariants.mobile })
  assert.equal(match(UA.ipad), null)
})

test('compileMatcher is case-insensitive', () => {
  const match = compileMatcher({ mobile: ['iPhone'] })
  assert.equal(match('mozilla/5.0 (iphone) mobile'), 'mobile')
})

test('compileMatcher handles a missing or empty User-Agent', () => {
  const match = compileMatcher(defaultVariants)
  assert.equal(match(null), null)
  assert.equal(match(undefined), null)
  assert.equal(match(''), null)
})

test('compileMatcher respects key order as priority', () => {
  // The mobile-crawling Googlebot UA matches both `bot` and `mobile` tokens —
  // whichever variant is declared first in the object must win.
  const first = compileMatcher({ bot: defaultVariants.bot, mobile: defaultVariants.mobile })
  assert.equal(first(UA.googlebotMobile), 'bot')

  const reordered = compileMatcher({ mobile: defaultVariants.mobile, bot: defaultVariants.bot })
  assert.equal(reordered(UA.googlebotMobile), 'mobile')
})

test('getMatcher compiles once per variants object', () => {
  assert.equal(getMatcher(defaultVariants), getMatcher(defaultVariants))

  const custom = { tv: ['Tizen'] }
  assert.notEqual(getMatcher(custom), getMatcher(defaultVariants))
  assert.equal(getMatcher(custom)('SmartTV Tizen'), 'tv')
})

test('a shared matcher keeps no state between calls', async () => {
  // The cached matcher is reused across requests, so interleaved calls with
  // different User-Agents must each get their own answer.
  const match = getMatcher(defaultVariants)
  const inputs = Array.from({ length: 50 }, (_, i) => Object.values(UA)[i % 4])
  const results = await Promise.all(
    inputs.map(async (ua) => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 5))
      return [ua, match(ua)]
    })
  )
  for (const [ua, variant] of results) assert.equal(variant, compileMatcher(defaultVariants)(ua))
})

/* ------------------------------ toDeviceInfo ------------------------------ */

test('toDeviceInfo sets convenience flags for default variant names', () => {
  assert.deepEqual(toDeviceInfo('mobile'), {
    variant: 'mobile', isMobile: true, isTablet: false, isBot: false, isBase: false,
  })
  assert.deepEqual(toDeviceInfo('tablet'), {
    variant: 'tablet', isMobile: false, isTablet: true, isBot: false, isBase: false,
  })
  assert.deepEqual(toDeviceInfo('bot'), {
    variant: 'bot', isMobile: false, isTablet: false, isBot: true, isBase: false,
  })
})

test('toDeviceInfo treats null/undefined as the base route', () => {
  assert.deepEqual(toDeviceInfo(null), {
    variant: null, isMobile: false, isTablet: false, isBot: false, isBase: true,
  })
  assert.equal(toDeviceInfo(undefined).isBase, true)
})

test('toDeviceInfo does not set a convenience flag for a custom variant', () => {
  const info = toDeviceInfo('tv')
  assert.equal(info.variant, 'tv')
  assert.equal(info.isMobile, false)
  assert.equal(info.isBase, false, 'a matched custom variant is not the base route')
})

/* ------------------------------ DeviceProvider / useDevice ------------------------------ */

function Probe() {
  const device = useDevice()
  return React.createElement('span', null, JSON.stringify(device))
}

test('useDevice reads the value DeviceProvider was given', () => {
  const html = unescape(
    renderToStaticMarkup(
      React.createElement(DeviceProvider, { variant: 'mobile' }, React.createElement(Probe))
    )
  )
  assert.match(html, /"variant":"mobile"/)
  assert.match(html, /"isMobile":true/)
})

test('useDevice reflects a null variant as the base route', () => {
  const html = unescape(
    renderToStaticMarkup(
      React.createElement(DeviceProvider, { variant: null }, React.createElement(Probe))
    )
  )
  assert.match(html, /"isBase":true/)
})

test('useDevice throws with a clear message outside DeviceProvider', () => {
  assert.throws(
    () => renderToStaticMarkup(React.createElement(Probe)),
    /useDevice\(\) was called outside <DeviceProvider>/
  )
})

test('the closest DeviceProvider wins', () => {
  // A root layout provides `null`; a variant layout overrides it with a literal.
  const html = unescape(
    renderToStaticMarkup(
      React.createElement(
        DeviceProvider,
        { variant: null },
        React.createElement(DeviceProvider, { variant: 'mobile' }, React.createElement(Probe))
      )
    )
  )
  assert.match(html, /"variant":"mobile"/)
})

test('DeviceProvider defaults variant to null when omitted', () => {
  const html = unescape(
    renderToStaticMarkup(React.createElement(DeviceProvider, null, React.createElement(Probe)))
  )
  assert.match(html, /"variant":null/)
})

/* ------------------------------ getDevice() wiring ------------------------------ */

test('getDevice() delegates to the real next/headers()', async () => {
  // Outside an actual Next.js request, next/headers() throws a specific,
  // recognizable error. Seeing that exact error here — rather than a
  // "module not found" or a silent wrong value — is what proves this
  // package calls the real API correctly; full request-handling behavior is
  // covered by the example app under a running `next start` server.
  await assert.rejects(() => getDevice(), /called outside a request scope/)
})

test('DeviceBoundary reads the request through getDevice()', async () => {
  // Request-time behavior is covered by test/integration/rendering.test.js.
  await assert.rejects(() => DeviceBoundary({ children: null }), /called outside a request scope/)
})
