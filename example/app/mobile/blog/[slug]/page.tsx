export default async function MobilePost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <h1>Mobile post: {slug}</h1>
}
