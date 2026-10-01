import { headers } from 'next/headers'
import { getDevice } from 'next-device-routes/server'

// Reads the device, yields to other in-flight requests, then reads again:
// both reads must still see this request's headers.
export default async function HeadersPage() {
  const before = await getDevice()
  const requestHeaders = await headers()
  const id = requestHeaders.get('x-test-id')
  await new Promise((resolve) => setTimeout(resolve, Number(requestHeaders.get('x-test-delay') || 0)))
  const after = await getDevice()
  const idAfter = (await headers()).get('x-test-id')

  return (
    <p id="result">
      {`id=${id};idAfter=${idAfter};before=${before.variant ?? 'base'};after=${after.variant ?? 'base'}`}
    </p>
  )
}
