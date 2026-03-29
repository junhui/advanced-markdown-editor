'use client'

import { useState, useMemo } from 'react'
import NavBar from '../../components/NavBar'
import AdvancedEditor from '../../components/AdvancedEditor'

// ── Code presets ──────────────────────────────────────────────────────────────

const PRESETS: Record<string, { language: string; code: string }> = {
  'JavaScript': {
    language: 'javascript',
    code: `// Advanced Markdown Editor — Usage Example
import { useState } from 'react'
import AdvancedEditor from 'advanced-markdown-editor'

export default function App() {
  const [content, setContent] = useState('# Hello World')

  return (
    <AdvancedEditor
      language="markdown"
      value={content}
      onChange={setContent}
      height="600px"
      theme="vs-dark"
      options={{ fontSize: 14, wordWrap: 'on' }}
    />
  )
}
`,
  },

  'TypeScript': {
    language: 'typescript',
    code: `import { useState } from 'react'
import AdvancedEditor, { EditorProps } from 'advanced-markdown-editor'

const editorConfig: Partial<EditorProps> = {
  height: '600px',
  theme: 'vs-dark',
  options: {
    fontSize: 14,
    wordWrap: 'on',
    lineNumbers: 'on',
  },
}

export default function App() {
  const [content, setContent] = useState<string>('# Hello World')

  const handleChange = (val: string) => {
    setContent(val)
    console.log('Content length:', val.length)
  }

  return (
    <AdvancedEditor
      language="markdown"
      value={content}
      onChange={handleChange}
      {...editorConfig}
    />
  )
}
`,
  },

  'JSON': {
    language: 'json',
    code: `{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {
    "advanced-markdown-editor": "latest",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
`,
  },

  'Python': {
    language: 'python',
    code: `"""Example: Processing markdown content with Python."""
from pathlib import Path
import re


def extract_mentions(markdown: str) -> list[str]:
    """Extract all @mention code spans from markdown text."""
    pattern = r'\`@(\\w[\\w.]*)\`'
    return re.findall(pattern, markdown)


def extract_headings(markdown: str) -> list[tuple[int, str]]:
    """Return list of (level, text) tuples for each heading."""
    results = []
    for line in markdown.splitlines():
        m = re.match(r'^(#{1,6})\\s+(.*)', line)
        if m:
            results.append((len(m.group(1)), m.group(2).strip()))
    return results


def extract_tables(markdown: str) -> list[list[list[str]]]:
    """Parse all markdown tables into lists of rows."""
    tables, current = [], []
    for line in markdown.splitlines():
        if line.strip().startswith('|'):
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            current.append(cells)
        elif current:
            tables.append(current)
            current = []
    if current:
        tables.append(current)
    return tables


if __name__ == '__main__':
    content = Path('README.md').read_text()
    print('Mentions:', extract_mentions(content))
    print('Headings:', extract_headings(content))
    print('Tables found:', len(extract_tables(content)))
`,
  },
}

// ── Parameter display ─────────────────────────────────────────────────────────

function buildPropsDisplay(
  preset: string, height: string, theme: string,
  fontSize: number, minimap: boolean, lineNumbers: boolean,
) {
  const lang = PRESETS[preset]?.language ?? 'javascript'
  return `<AdvancedEditor
  language="${lang}"
  value={content}
  onChange={setContent}
  height="${height}"
  theme="${theme}"
  options={{
    fontSize: ${fontSize},
    minimap: { enabled: ${minimap} },
    lineNumbers: "${lineNumbers ? 'on' : 'off'}",
  }}
/>`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JavaScriptDemo() {
  const [preset, setPreset]           = useState('JavaScript')
  const [content, setContent]         = useState(PRESETS['JavaScript'].code)
  const [theme, setTheme]             = useState('vs-dark')
  const [height, setHeight]           = useState('500px')
  const [fontSize, setFontSize]       = useState(13)
  const [minimap, setMinimap]         = useState(false)
  const [lineNumbers, setLineNumbers] = useState(true)

  const language = PRESETS[preset]?.language ?? 'javascript'

  const extraOptions = useMemo(() => ({
    fontSize,
    minimap:     { enabled: minimap },
    lineNumbers: lineNumbers ? 'on' : 'off',
  }), [fontSize, minimap, lineNumbers])

  const propsDisplay = buildPropsDisplay(preset, height, theme, fontSize, minimap, lineNumbers)

  return (
    <div className="demo-page">
      <NavBar active="javascript" />

      <div className="demo-content">
        <div className="demo-header">
          <h1>Code Editor Demo</h1>
          <p>
            Plain Monaco editor — set <code>language</code> to any Monaco-supported language ID.
            Non-markdown languages skip the preview pane, @mentions, and slash commands.
          </p>
        </div>

        {/* Controls */}
        <div className="demo-controls">
          <label className="demo-control">
            <span>Language</span>
            <select value={preset} onChange={e => {
              setPreset(e.target.value)
              setContent(PRESETS[e.target.value].code)
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
            <input type="checkbox" checked={minimap} onChange={e => setMinimap(e.target.checked)} />
            <span>Minimap</span>
          </label>

          <label className="demo-control demo-control--toggle">
            <input type="checkbox" checked={lineNumbers} onChange={e => setLineNumbers(e.target.checked)} />
            <span>Line numbers</span>
          </label>
        </div>

        {/* Editor */}
        <AdvancedEditor
          language={language}
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

        {/* Differences callout */}
        <div className="demo-callout">
          <strong>language=&quot;javascript&quot; vs language=&quot;markdown&quot;</strong>
          <ul>
            <li>No markdown preview pane or mode switcher</li>
            <li>No @mention or /slash completions</li>
            <li>No table editing context menu</li>
            <li>Full Monaco IntelliSense for the chosen language</li>
            <li>Minimap enabled by default (overridable via options)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
