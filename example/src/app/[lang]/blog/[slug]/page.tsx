export function generateStaticParams() {
  return [{ slug: 'hello' }]
}

export default async function Post({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params
  return <h1>{`Base post: ${lang}/${slug}`}</h1>
}
