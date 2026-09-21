import type { ReactNode } from 'react'

// Optional: a layout that wraps only the mobile variant.
export default function MobileLayout({ children }: { children: ReactNode }) {
  return <div data-variant="mobile">{children}</div>
}
