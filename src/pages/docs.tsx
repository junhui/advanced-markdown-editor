import fs from 'fs'
import path from 'path'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import NavBar from '../components/NavBar'

export async function getStaticProps() {
  const readme = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf-8')
  return { props: { readme } }
}

export default function Docs({ readme }: { readme: string }) {
  return (
    <div className="demo-page">
      <NavBar active="docs" />
      <div className="demo-content">
        <div className="gh-markdown" style={{ maxWidth: 800 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{readme}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
