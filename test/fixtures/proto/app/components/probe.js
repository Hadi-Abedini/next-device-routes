'use client'

import { useDevice } from 'next-device-routes/context'

export default function Probe() {
  const device = useDevice()
  return <p id="probe">{`probe=${device.variant ?? 'base'};mobile=${device.isMobile}`}</p>
}
