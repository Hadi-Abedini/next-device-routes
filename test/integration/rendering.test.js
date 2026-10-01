'use strict'

/**
 * Builds test/fixtures/rendering-app with the real `next build`, then serves
 * it through Next's own production request handler. Covers what unit tests
 * cannot: which routes Next.js decides to prerender, and whether request data
 * stays per-request under concurrency.
 *
 * Requests go over in-memory socket pairs rather than a listening port, so
 * the suite also runs where binding ports is not allowed.
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const http = require('http')
const { execFileSync } = require('child_process')
const { duplexPair } = require('stream')

const ROOT = path.resolve(__dirname, '../..')
const APP_DIR = path.join(ROOT, 'test/fixtures/rendering-app')
const DIST_DIR = path.join(APP_DIR, '.next')
const NEXT_BIN = require.resolve('next/dist/bin/next', { paths: [ROOT] })

const UA = {
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) Mobile/15E148 Safari/604.1',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
}
const EXPECTED = { desktop: 'base', iphone: 'mobile', ipad: 'tablet', googlebot: 'bot' }

let server
let manifest

test.before(async () => {
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }
  execFileSync(process.execPath, [NEXT_BIN, 'build', APP_DIR], { cwd: APP_DIR, env, stdio: 'pipe' })
  manifest = JSON.parse(fs.readFileSync(path.join(DIST_DIR, 'prerender-manifest.json'), 'utf8'))

  process.env.NEXT_TELEMETRY_DISABLED = '1'
  const next = require(require.resolve('next', { paths: [ROOT] }))
  const app = next({ dev: false, dir: APP_DIR, quiet: true })
  await app.prepare()
  const handle = app.getRequestHandler()
  server = http.createServer((req, res) => handle(req, res))
})

test.after(() => {
  server?.close()
  fs.rmSync(DIST_DIR, { recursive: true, force: true })
})

/** One request over a fresh in-memory connection. */
function request(pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const [client, serverSide] = duplexPair()
    server.emit('connection', serverSide)
    const req = http.request(
      { path: pathname, headers: { host: 'localhost', ...headers }, createConnection: () => client },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => (body += chunk))
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
      }
    )
    req.on('error', reject)
    req.end()
  })
}

const isPrerendered = (route) => Object.hasOwn(manifest.routes, route)
const isNoStore = (res) => /no-store/.test(res.headers['cache-control'] || '')

/* ------------------------------ build-time classification ------------------------------ */

test('a completely static page is statically generated', async () => {
  assert.ok(isPrerendered('/static'), 'missing from prerender-manifest.json')
  assert.ok(fs.existsSync(path.join(DIST_DIR, 'server/app/static.html')), 'no prerendered HTML')

  const res = await request('/static', { 'user-agent': UA.desktop })
  assert.equal(res.status, 200)
  assert.match(res.body, /static page/)
  assert.ok(!isNoStore(res), `served as dynamic: ${res.headers['cache-control']}`)
})

test('a page that reads request headers is dynamically rendered', async () => {
  assert.ok(!isPrerendered('/headers'), '/headers was prerendered')
  assert.ok(!isPrerendered('/boundary'), '/boundary was prerendered')

  for (const route of ['/headers', '/boundary']) {
    const res = await request(route, { 'user-agent': UA.desktop })
    assert.equal(res.status, 200)
    assert.ok(isNoStore(res), `${route} not served per request: ${res.headers['cache-control']}`)
  }
})

test('static pages sharing the root layout are not converted to dynamic rendering', async () => {
  // Same root layout as /headers and /boundary; neither the provider there
  // nor the variant layout may opt these routes into dynamic rendering.
  for (const route of ['/shared', '/mobile/shared']) {
    assert.ok(isPrerendered(route), `${route} missing from prerender-manifest.json`)
  }

  const desktop = await request('/shared', { 'user-agent': UA.desktop })
  assert.match(desktop.body, /base shared page/)
  assert.match(desktop.body, /probe=base;mobile=false/)
  assert.ok(!isNoStore(desktop))

  // The rewrite selects the prerendered variant page; the variant layout's
  // literal provider supplies the device without reading the request.
  const phone = await request('/shared', { 'user-agent': UA.iphone })
  assert.match(phone.body, /mobile shared page/)
  assert.match(phone.body, /probe=mobile;mobile=true/)
  assert.ok(!isNoStore(phone))
})

/* ------------------------------ request-time values ------------------------------ */

test('request-specific values reach the components that need them', async () => {
  for (const [name, ua] of Object.entries(UA)) {
    const direct = await request('/headers', { 'user-agent': ua, 'x-test-id': name })
    assert.match(direct.body, new RegExp(`id=${name};idAfter=${name};before=${EXPECTED[name]};after=${EXPECTED[name]}`))

    // Through <DeviceBoundary> into a Client Component's useDevice().
    const boundary = await request('/boundary', { 'user-agent': ua })
    assert.match(boundary.body, new RegExp(`probe=${EXPECTED[name]};mobile=${name === 'iphone'}`))
  }
})

test('concurrent requests do not leak request data into each other', async () => {
  const names = Object.keys(UA)
  const jobs = Array.from({ length: 40 }, (_, i) => {
    const name = names[i % names.length]
    const id = `req-${i}`
    // Random delays interleave the renders between the two device reads.
    const delay = String(Math.floor(Math.random() * 40))
    const route = i % 2 ? '/headers' : '/boundary'
    return request(route, { 'user-agent': UA[name], 'x-test-id': id, 'x-test-delay': delay }).then(
      (res) => ({ res, name, id, route })
    )
  })

  for (const { res, name, id, route } of await Promise.all(jobs)) {
    assert.equal(res.status, 200)
    const variant = EXPECTED[name]
    if (route === '/headers') {
      assert.match(res.body, new RegExp(`id=${id};idAfter=${id};before=${variant};after=${variant}<`))
    } else {
      assert.match(res.body, new RegExp(`probe=${variant};`))
    }
  }
})
