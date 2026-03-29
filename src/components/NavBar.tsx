import Link from 'next/link'

const GITHUB_REPO  = 'https://github.com/junhui/advanced-markdown-editor'
const GITHUB_PAGES = 'https://junhui.github.io/advanced-markdown-editor'

export type NavPage = 'home' | 'markdown' | 'javascript' | 'docs'

const IconGitHub = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
  </svg>
)

const IconExternalLink = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1Z"/>
  </svg>
)

export default function NavBar({ active }: { active: NavPage }) {
  const navLink = (href: string, label: string, id: NavPage) => (
    <Link
      key={id}
      href={href}
      className={`demo-nav-link${active === id ? ' demo-nav-link--active' : ''}`}
    >
      {label}
    </Link>
  )

  return (
    <nav className="demo-nav">
      <Link href="/" className="demo-nav-logo">Advanced Markdown Editor</Link>

      <div className="demo-nav-links">
        {navLink('/',                'Home',        'home')}
        {navLink('/demo/markdown',   'Markdown',    'markdown')}
        {navLink('/demo/javascript', 'Code Editor', 'javascript')}
        {navLink('/docs',            'Docs',        'docs')}

        <div className="demo-nav-divider" />

        <a
          href={GITHUB_PAGES}
          target="_blank"
          rel="noreferrer"
          className="demo-nav-link demo-nav-external"
          title="Open live GitHub Pages demo"
        >
          Live Demo <IconExternalLink />
        </a>

        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noreferrer"
          className="demo-nav-link demo-nav-github"
          title="View source on GitHub"
        >
          <IconGitHub />
          GitHub
        </a>
      </div>
    </nav>
  )
}

export { GITHUB_REPO, GITHUB_PAGES }
