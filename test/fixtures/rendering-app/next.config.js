// Self-reference: resolves to this checkout through the root package.json `exports`.
const { withDeviceRoutes } = require('next-device-routes')

module.exports = withDeviceRoutes({}, { cwd: __dirname })
