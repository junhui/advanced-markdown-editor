import Link from 'next/link'
import NavBar from '../components/NavBar'
import { GITHUB_REPO, GITHUB_PAGES } from '../components/NavBar'

const features = [
  { title: '@Mentions',       desc: 'Type @ to trigger a suggestion list of team members.'                       },
  { title: '/Slash Commands', desc: 'Type / to quickly insert headings, tables, code blocks, and more.'          },
  { title: 'Table Editing',   desc: 'Right-click any table line to add/delete rows & columns, or auto-format.'   },
  { title: 'Split Preview',   desc: 'Edit and preview side-by-side with synchronized scrolling in both panes.'   },
  { title: 'Image Paste',     desc: 'Paste clipboard images directly — they are embedded as Base64 data URLs.'   },
  { title: 'Configurable',    desc: 'Pass Monaco options, theme, className, and language props as needed.'        },
]

export default function Home() {
  return (
    <div className="home-page">
      <NavBar active="home" />

      <div className="home-content">
        <div className="home-hero">
          <h1>Advanced Markdown Editor</h1>
          <p>
            A powerful, feature-rich markdown editor built on Monaco with @mentions,
            /slash commands, table controls, split preview, and more.
          </p>
          <div className="home-install">
            <code>npm install advanced-markdown-editor</code>
          </div>
          <div className="home-hero-links">
            <Link href="/demo/markdown"   className="btn btn-primary">Markdown Demo</Link>
            <Link href="/demo/javascript" className="btn btn-secondary">Code Editor Demo</Link>
            <a href={GITHUB_PAGES} target="_blank" rel="noreferrer" className="btn btn-secondary">Live Demo ↗</a>
            <a href={GITHUB_REPO}  target="_blank" rel="noreferrer" className="btn btn-secondary">GitHub ↗</a>
          </div>
        </div>

        <div className="home-demos">
          <Link href="/demo/markdown" className="home-card">
            <div className="home-card-icon">📝</div>
            <div>
              <div className="home-card-title">Markdown Demo</div>
              <div className="home-card-desc">
                Full markdown editing with @mentions, /slash commands, GitHub-style preview,
                table editing via right-click, and clipboard image paste.
              </div>
            </div>
          </Link>
          <Link href="/demo/javascript" className="home-card">
            <div className="home-card-icon">💻</div>
            <div>
              <div className="home-card-title">Code Editor Demo</div>
              <div className="home-card-desc">
                Plain code editor mode supporting JavaScript, TypeScript, JSON, Python,
                and any other Monaco-supported language.
              </div>
            </div>
          </Link>
        </div>

        <div className="home-features">
          <h2>Features</h2>
          <div className="home-features-grid">
            {features.map(({ title, desc }) => (
              <div key={title} className="home-feature">
                <div className="home-feature-title">{title}</div>
                <div className="home-feature-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="home-usage">
          <h2>Quick Start</h2>
          <pre className="home-code">{`import { useState } from 'react'
import AdvancedEditor from 'advanced-markdown-editor'
import 'advanced-markdown-editor/dist/styles.css'

export default function App() {
  const [content, setContent] = useState('# Hello World')

  return (
    <AdvancedEditor
      language="markdown"
      value={content}
      onChange={setContent}
      height="500px"
      theme="light"
      options={{ fontSize: 14, wordWrap: 'on' }}
    />
  )
}`}</pre>
        </div>
      </div>
    </div>
  )
}
