'use strict'

/**
 * Builds a fixture app with the real `next build` and serves it through Next's
 * own production request handler. Where `stream.duplexPair` exists, requests go
 * over in-memory socket pairs, so the suites also run where binding ports is not
 * allowed; on older Node versions they use a short-lived local port instead.
 */

const fs = require('fs')
const path = require('path')
const http = require('http')
const { execFileSync } = require('child_process')
const { duplexPair } = require('stream') // Node >= 22.6; older versions fall back to a local port

const ROOT = path.resolve(__dirname, '../..')
const NEXT_BIN = require.resolve('next/dist/bin/next', { paths: [ROOT] })

const UA = {
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) Mobile/15E148 Safari/604.1',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  googlebotSmartphone:
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/120.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
}

/** @param {string} fixture  directory name under test/fixtures */
async function startApp(fixture) {
  const appDir = path.join(ROOT, 'test/fixtures', fixture)
  const distDir = path.join(appDir, '.next')

  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }
  execFileSync(process.execPath, [NEXT_BIN, 'build', appDir], { cwd: appDir, env, stdio: 'pipe' })
  const manifest = JSON.parse(fs.readFileSync(path.join(distDir, 'prerender-manifest.json'), 'utf8'))

  process.env.NEXT_TELEMETRY_DISABLED = '1'
  const next = require(require.resolve('next', { paths: [ROOT] }))
  const app = next({ dev: false, dir: appDir, quiet: true })
  await app.prepare()
  const handle = app.getRequestHandler()
  const server = http.createServer((req, res) => handle(req, res))

  let port = null
  if (typeof duplexPair !== 'function') {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    port = server.address().port
  }

  /** One request, over a fresh in-memory connection when the Node version allows it. */
  const request = (pathname, headers = {}) =>
    new Promise((resolve, reject) => {
      const options = { path: pathname, headers: { host: 'localhost', ...headers } }
      if (port) {
        Object.assign(options, { host: '127.0.0.1', port, agent: false })
      } else {
        const [client, serverSide] = duplexPair()
        server.emit('connection', serverSide)
        options.createConnection = () => client
      }
      const req = http.request(options, (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => (body += chunk))
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
      })
      req.on('error', reject)
      req.end()
    })

  return {
    request,
    manifest,
    distDir,
    isPrerendered: (route) => Object.hasOwn(manifest.routes, route),
    isNoStore: (res) => /no-store/.test(res.headers['cache-control'] || ''),
    close() {
      server.close()
      fs.rmSync(distDir, { recursive: true, force: true })
    },
  }
}

module.exports = { startApp, UA }
