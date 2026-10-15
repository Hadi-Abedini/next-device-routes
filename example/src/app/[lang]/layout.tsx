import type { ReactNode } from 'react'

// Prerender every language, for every variant. Without this, `[lang]` routes
// would be rendered on demand and nothing could be statically generated.
export function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'fa' }]
}

export default async function LangLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  return (
    <div lang={lang} dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      {children}
    </div>
  )
}
