import DeviceInfo from '../../components/device-info'

export default function Contact() {
  return (
    <>
      <h1>Base contact — shared by every device</h1>
      <DeviceInfo note="read from the request by <DeviceBoundary>" />
    </>
  )
}
