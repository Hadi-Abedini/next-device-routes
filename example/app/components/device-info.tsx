'use client'

import { useDevice } from 'next-device-routes/context'

/**
 * A Client Component reading the device that the root layout resolved.
 * Used on `/contact`, which has no dedicated mobile/tablet/bot page — the
 * route itself can't tell devices apart, so this is exactly where the hook
 * earns its keep.
 */
export default function DeviceInfo() {
  const device = useDevice()
  return (
    <p>
      Rendered by the base route. Detected variant: <code>{device.variant ?? 'none (desktop)'}</code>
      {device.isMobile && ' — a mobile-specific page could exist for this route but does not.'}
      {device.isTablet && ' — a tablet-specific page could exist for this route but does not.'}
      {device.isBot && ' — a bot-specific page could exist for this route but does not.'}
    </p>
  )
}
