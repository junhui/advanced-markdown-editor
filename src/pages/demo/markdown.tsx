'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import AdvancedEditor from '../../components/AdvancedEditor'

// ── Content presets ───────────────────────────────────────────────────────────

const PRESETS: Record<string, string> = {
  'Basic example': `# Hello World

Hello \`@jason.h\`, try typing **/Heading 2** or press @ to mention someone.

## Features

- @mention with \`@name\` code-span format
- /slash commands for quick insertion
- Right-click table cells to edit structure
- Paste clipboard images as Base64

> Try switching between **Edit**, **Preview**, and **Split** modes using the icons in the top-right corner.
`,

  'With table': `# Project Status

| Task | Owner | Status | Priority |
|------|-------|--------|----------|
| Setup | \`@alice\` | Done | High |
| API | \`@bob\` | In progress | High |
| Tests | \`@charlie\` | Pending | Medium |
| Docs | \`@eve\` | Pending | Low |

Right-click any table line to add or remove columns and rows, or format the table automatically.
`,

  'Long content': `# Advanced Markdown Editor

A powerful markdown editor built on Monaco.

## Syntax Support

### Bold and Italic

**Bold text**, *italic text*, and ***both***.

### Code

Inline \`code\` and code blocks:

\`\`\`javascript
const greet = (name) => \`Hello, \${name}!\`
console.log(greet('World'))
\`\`\`

### Blockquote

> This is a blockquote with some text inside it.
> It can span multiple lines.

### Lists

1. First item
2. Second item
   - Nested item
   - Another nested
3. Third item

### Links and Images

[Visit GitHub](https://github.com)

---

End of document.
`,
}

// ── Parameter display ─────────────────────────────────────────────────────────

function buildPropsDisplay(
  height: string, theme: string,
  fontSize: number, wordWrap: boolean, lineNumbers: boolean,
) {
  return `<AdvancedEditor
  format="markdown"
  value={content}
  onChange={setContent}
  height="${height}"
  theme="${theme}"
  options={{
    fontSize: ${fontSize},
    wordWrap: "${wordWrap ? 'on' : 'off'}",
    lineNumbers: "${lineNumbers ? 'on' : 'off'}",
  }}
/>`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarkdownDemo() {
  const [preset, setPreset]           = useState('With table')
  const [content, setContent]         = useState(PRESETS['With table'])
  const [theme, setTheme]             = useState('light')
  const [height, setHeight]           = useState('500px')
  const [fontSize, setFontSize]       = useState(13)
  const [wordWrap, setWordWrap]       = useState(true)
  const [lineNumbers, setLineNumbers] = useState(false)

  const extraOptions = useMemo(() => ({
    fontSize,
    wordWrap:    wordWrap    ? 'on'  : 'off',
    lineNumbers: lineNumbers ? 'on'  : 'off',
  }), [fontSize, wordWrap, lineNumbers])

  const propsDisplay = buildPropsDisplay(height, theme, fontSize, wordWrap, lineNumbers)

  return (
    <div className="demo-page">
      <nav className="demo-nav">
        <Link href="/" className="demo-nav-logo">Advanced Markdown Editor</Link>
        <div className="demo-nav-links">
          <Link href="/"                className="demo-nav-link">Home</Link>
          <Link href="/demo/markdown"   className="demo-nav-link demo-nav-link--active">Markdown</Link>
          <Link href="/demo/javascript" className="demo-nav-link">Code Editor</Link>
        </div>
      </nav>

      <div className="demo-content">
        <div className="demo-header">
          <h1>Markdown Editor Demo</h1>
          <p>
            Full-featured markdown editing with @mentions, /slash commands,
            table controls via right-click, synchronized split preview, and image paste.
          </p>
        </div>

        {/* Controls */}
        <div className="demo-controls">
          <label className="demo-control">
            <span>Content</span>
            <select value={preset} onChange={e => {
              setPreset(e.target.value)
              setContent(PRESETS[e.target.value])
            }}>
              {Object.keys(PRESETS).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>

          <label className="demo-control">
            <span>Theme</span>
            <select value={theme} onChange={e => setTheme(e.target.value)}>
              <option value="light">Light</option>
              <option value="vs-dark">Dark</option>
            </select>
          </label>

          <label className="demo-control">
            <span>Height</span>
            <select value={height} onChange={e => setHeight(e.target.value)}>
              <option value="400px">400 px</option>
              <option value="500px">500 px</option>
              <option value="600px">600 px</option>
              <option value="800px">800 px</option>
            </select>
          </label>

          <label className="demo-control">
            <span>Font size</span>
            <select value={fontSize} onChange={e => setFontSize(Number(e.target.value))}>
              <option value={12}>12</option>
              <option value={13}>13</option>
              <option value={15}>15</option>
              <option value={17}>17</option>
            </select>
          </label>

          <label className="demo-control demo-control--toggle">
            <input type="checkbox" checked={wordWrap} onChange={e => setWordWrap(e.target.checked)} />
            <span>Word wrap</span>
          </label>

          <label className="demo-control demo-control--toggle">
            <input type="checkbox" checked={lineNumbers} onChange={e => setLineNumbers(e.target.checked)} />
            <span>Line numbers</span>
          </label>
        </div>

        {/* Editor */}
        <AdvancedEditor
          format="markdown"
          value={content}
          onChange={setContent}
          height={height}
          theme={theme}
          options={extraOptions}
        />

        {/* Parameter display */}
        <div className="demo-params">
          <div className="demo-params-header">
            <span className="demo-params-title">Props passed to editor</span>
            <span className="demo-params-hint">Change controls above to see props update live</span>
          </div>
          <pre className="demo-params-code">{propsDisplay}</pre>
        </div>

        {/* Hints */}
        <div className="demo-hints">
          <div className="demo-hint"><strong>@</strong> — mention suggestions</div>
          <div className="demo-hint"><strong>/</strong> — slash command menu</div>
          <div className="demo-hint"><strong>Right-click table</strong> — add / remove rows & cols</div>
          <div className="demo-hint"><strong>Paste image</strong> — embeds as Base64</div>
        </div>
      </div>
    </div>
  )
}
