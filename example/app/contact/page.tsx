import DeviceInfo from '../components/device-info'

// No mobile/tablet/bot version exists, so every device gets this page —
// and DeviceInfo below is how it can still tell them apart if it needs to.
export default function Contact() {
  return (
    <>
      <h1>Base contact — shared by every device</h1>
      <DeviceInfo />
    </>
  )
}
