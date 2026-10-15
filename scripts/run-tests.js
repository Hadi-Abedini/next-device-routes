'use strict'

/**
 * `node --test "test/*.test.js"` only expands the glob on Node >= 21; older
 * versions treat it as a literal file name. Listing the files ourselves works
 * on every Node version in `engines`.
 *
 *   node scripts/run-tests.js test
 *   node scripts/run-tests.js test/integration
 */

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const dir = path.resolve(__dirname, '..', process.argv[2] || 'test')
const files = fs
  .readdirSync(dir)
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => path.join(dir, name))

if (!files.length) {
  console.error(`No *.test.js files in ${dir}`)
  process.exit(1)
}

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' })
process.exit(result.status ?? 1)
