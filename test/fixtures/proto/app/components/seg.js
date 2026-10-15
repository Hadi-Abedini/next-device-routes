'use client'
import { useSelectedLayoutSegments, usePathname } from 'next/navigation'
export default function Seg() {
  const segs = useSelectedLayoutSegments()
  return <p id="seg">{`segs=${segs.join('/')};path=${usePathname()}`}</p>
}
