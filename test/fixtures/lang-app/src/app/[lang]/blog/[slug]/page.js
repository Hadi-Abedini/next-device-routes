import Probe from '../../../components/probe'

export function generateStaticParams() {
  return [{ slug: 'hello' }]
}

export default async function Post({ params }) {
  const { lang, slug } = await params
  return (
    <>
      <h1>{`base post ${lang}/${slug}`}</h1>
      <Probe />
    </>
  )
}
