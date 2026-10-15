export function generateStaticParams() {
  return [{ slug: 'hello' }]
}

export default async function MobilePost({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params
  return <h1>{`Mobile post: ${lang}/${slug}`}</h1>
}
