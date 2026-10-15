export function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'fa' }]
}

export default function LangLayout({ children }) {
  return children
}
