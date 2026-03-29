'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import AdvancedEditor, { DEFAULT_MENTIONS, DEFAULT_SLASH_COMMANDS } from '../../components/AdvancedEditor'
import type { EditorAction, SlashCommand } from '../../components/AdvancedEditor'

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

// ── Icon SVGs for custom actions ──────────────────────────────────────────────

const IconSparkle = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
    <path d="M7.53 1.282a.5.5 0 0 1 .94 0l.478 1.306a5 5 0 0 0 2.942 2.942l1.305.478a.5.5 0 0 1 0 .94l-1.305.478a5 5 0 0 0-2.942 2.942l-.478 1.305a.5.5 0 0 1-.94 0l-.478-1.305a5 5 0 0 0-2.942-2.942L2.805 7.47a.5.5 0 0 1 0-.94l1.305-.478a5 5 0 0 0 2.942-2.942z"/>
  </svg>
)

const IconSort = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.5 2a.5.5 0 0 1 .5.5v8.793l1.146-1.147a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 1 1 .708-.708L3 11.293V2.5a.5.5 0 0 1 .5-.5m3.5 1a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5M7 7.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4A.5.5 0 0 1 7 7.5m1 3a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5"/>
  </svg>
)

// ── Mock "AI polish" — uppercases headings, trims trailing spaces ─────────────

async function mockAiPolish(content: string): Promise<string> {
  await new Promise(r => setTimeout(r, 1200)) // simulate network delay
  return content
    .split('\n')
    .map(line => {
      // Capitalize first letter after heading marker
      return line.replace(/^(#{1,6}\s+)(.+)/, (_, hashes, text) =>
        hashes + text.charAt(0).toUpperCase() + text.slice(1)
      ).trimEnd()
    })
    .join('\n')
}

// ── Mock "sort list items" — sorts bullet list items alphabetically ───────────

async function mockSortLists(content: string): Promise<string> {
  await new Promise(r => setTimeout(r, 800))
  const lines = content.split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    if (/^[-*+] /.test(lines[i])) {
      const block: string[] = []
      while (i < lines.length && /^[-*+] /.test(lines[i])) {
        block.push(lines[i++])
      }
      block.sort((a, b) => a.localeCompare(b))
      out.push(...block)
    } else {
      out.push(lines[i++])
    }
  }
  return out.join('\n')
}

// ── Mention modes ─────────────────────────────────────────────────────────────

type MentionMode = 'default' | 'custom-array' | 'async-fn'

const CUSTOM_MENTIONS = ['lee', 'morgan', 'sam', 'quinn', 'taylor', 'river']

async function asyncMentionResolver(query: string): Promise<string[]> {
  await new Promise(r => setTimeout(r, 200)) // simulate API
  const pool = ['aria', 'blaze', 'cedar', 'drift', 'ember', 'frost', 'grove', 'haze']
  return pool.filter(m => m.startsWith(query.toLowerCase()))
}

// ── Slash command modes ───────────────────────────────────────────────────────

type SlashMode = 'default' | 'custom'

const CUSTOM_SLASH: SlashCommand[] = [
  { label: 'Meeting notes',  insert: '## Meeting Notes\n\n**Date:** \n**Attendees:** \n\n### Agenda\n\n1. \n\n### Action Items\n\n- [ ] \n' },
  { label: 'Bug report',     insert: '## Bug Report\n\n**Summary:** \n**Steps to reproduce:**\n\n1. \n\n**Expected:** \n**Actual:** \n' },
  { label: 'Code review',    insert: '## Code Review\n\n**PR:** \n**Reviewer:** \n\n### Feedback\n\n#### Approved\n\n#### Needs changes\n\n' },
  { label: 'Horizontal rule', insert: '\n---\n'  },
  { label: 'Checklist',      insert: '- [ ] item 1\n- [ ] item 2\n- [ ] item 3\n' },
]

// ── Parameter display ─────────────────────────────────────────────────────────

function buildPropsDisplay(
  height: string, theme: string, fontSize: number,
  wordWrap: boolean, lineNumbers: boolean,
  mentionMode: MentionMode, slashMode: SlashMode,
  showActions: boolean,
) {
  const mentionProp =
    mentionMode === 'default'      ? '' :
    mentionMode === 'custom-array' ? `\n  mentions={['lee','morgan','sam','quinn','taylor','river']}` :
                                     `\n  mentions={asyncMentionResolver}`
  const slashProp  = slashMode === 'custom' ? '\n  slashCommands={CUSTOM_SLASH_COMMANDS}' : ''
  const actionsProp = showActions  ? '\n  actions={[aiPolishAction, sortListsAction]}' : ''

  return `<AdvancedEditor
  language="markdown"
  value={content}
  onChange={setContent}
  height="${height}"
  theme="${theme}"
  options={{
    fontSize: ${fontSize},
    wordWrap: "${wordWrap ? 'on' : 'off'}",
    lineNumbers: "${lineNumbers ? 'on' : 'off'}",
  }}${mentionProp}${slashProp}${actionsProp}
/>`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarkdownDemo() {
  const [preset, setPreset]             = useState('With table')
  const [content, setContent]           = useState(PRESETS['With table'])
  const [theme, setTheme]               = useState('light')
  const [height, setHeight]             = useState('500px')
  const [fontSize, setFontSize]         = useState(13)
  const [wordWrap, setWordWrap]         = useState(true)
  const [lineNumbers, setLineNumbers]   = useState(false)
  const [mentionMode, setMentionMode]   = useState<MentionMode>('default')
  const [slashMode, setSlashMode]       = useState<SlashMode>('default')
  const [showActions, setShowActions]   = useState(true)

  const extraOptions = useMemo(() => ({
    fontSize,
    wordWrap:    wordWrap    ? 'on' : 'off',
    lineNumbers: lineNumbers ? 'on' : 'off',
  }), [fontSize, wordWrap, lineNumbers])

  const mentionsProp = useMemo(() => {
    if (mentionMode === 'custom-array') return CUSTOM_MENTIONS
    if (mentionMode === 'async-fn')     return asyncMentionResolver
    return undefined // use default
  }, [mentionMode])

  const slashCommandsProp = useMemo(() => {
    if (slashMode === 'custom') return CUSTOM_SLASH
    return undefined // use default
  }, [slashMode])

  const actions = useMemo((): EditorAction[] => {
    if (!showActions) return []
    return [
      { icon: <IconSparkle />, name: 'AI Polish (mock)', event: mockAiPolish   },
      { icon: <IconSort />,    name: 'Sort lists',        event: mockSortLists  },
    ]
  }, [showActions])

  const propsDisplay = buildPropsDisplay(
    height, theme, fontSize, wordWrap, lineNumbers,
    mentionMode, slashMode, showActions,
  )

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

          <label className="demo-control">
            <span>Mentions</span>
            <select value={mentionMode} onChange={e => setMentionMode(e.target.value as MentionMode)}>
              <option value="default">Default list</option>
              <option value="custom-array">Custom array</option>
              <option value="async-fn">Async resolver</option>
            </select>
          </label>

          <label className="demo-control">
            <span>Slash cmds</span>
            <select value={slashMode} onChange={e => setSlashMode(e.target.value as SlashMode)}>
              <option value="default">Default</option>
              <option value="custom">Custom (meeting/bug/review)</option>
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

          <label className="demo-control demo-control--toggle">
            <input type="checkbox" checked={showActions} onChange={e => setShowActions(e.target.checked)} />
            <span>Action buttons</span>
          </label>
        </div>

        {/* Editor */}
        <AdvancedEditor
          language="markdown"
          value={content}
          onChange={setContent}
          height={height}
          theme={theme}
          options={extraOptions}
          mentions={mentionsProp}
          slashCommands={slashCommandsProp}
          actions={actions}
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
          <div className="demo-hint"><strong>Right-click table</strong> — add / remove rows &amp; cols</div>
          <div className="demo-hint"><strong>Paste image</strong> — embeds as Base64</div>
          {showActions && <div className="demo-hint"><strong>✦ / ↕</strong> — toolbar actions (mock async)</div>}
        </div>
      </div>
    </div>
  )
}
