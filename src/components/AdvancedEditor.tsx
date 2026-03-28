'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import MonacoEditor from '@monaco-editor/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export const mentionList   = ['jason.h', 'alice', 'bob', 'charlie', 'eve', 'david']
export const slashCommands = [
  { label: 'Heading 1',  insert: '# '        },
  { label: 'Heading 2',  insert: '## '       },
  { label: 'Heading 3',  insert: '### '      },
  { label: 'Bold',       insert: '**bold**'  },
  { label: 'Italic',     insert: '*italic*'  },
  { label: 'Code block', insert: '```\n\n```'},
  { label: 'Table',      insert: '| Header1 | Header2 |\n|---------|---------|\n|         |         |\n' },
]

type Mode = 'edit' | 'preview' | 'both'

export interface EditorProps {
  value:      string
  onChange:   (val: string) => void
  format:     'markdown' | 'other'
  height?:    string
  /** Monaco theme — e.g. 'vs-dark' | 'light' (default: 'light') */
  theme?:     string
  /** Extra CSS class applied to the outermost container */
  className?: string
  /** Monaco editor options — merged on top of defaults; passed values override defaults */
  options?:   Record<string, unknown>
}

// ── Default Monaco options ────────────────────────────────────────────────────

const DEFAULT_OPTIONS = {
  minimap:                    { enabled: false },
  wordWrap:                   'on'          as const,
  lineNumbers:                'off'         as const,
  glyphMargin:                false,
  folding:                    false,
  lineDecorationsWidth:       0,
  lineNumbersMinChars:        0,
  scrollBeyondLastLine:       false,
  quickSuggestions:           false,
  quickSuggestionsDelay:      0,
  suggestOnTriggerCharacters: true,
  wordBasedSuggestions:       'off'         as const,
  padding:                    { top: 10, bottom: 10 },
  renderLineHighlight:        'none'        as const,
  contextmenu:                false,
  fontSize:                   13,
  fontFamily:                 '"Fira Code", "JetBrains Mono", monospace',
  largeFileOptimizations:     true,
  automaticLayout:            true,
  parameterHints:             { enabled: false },
  snippetSuggestions:         'none'        as const,
}

// ── Context menu types ────────────────────────────────────────────────────────

type CtxMenu =
  | { kind: 'slash'; x: number; y: number; lineNumber: number; column: number }
  | { kind: 'table'; x: number; y: number; lineIdx: number; colIdx: number
      isHeader: boolean; isSep: boolean; isDataRow: boolean
      tableStart: number; tableEnd: number }

// ── Table helpers ─────────────────────────────────────────────────────────────

const isTableLine = (l: string) => l.trim().startsWith('|')
const isSepLine   = (l: string) => /^\|[\s\-:|]+\|/.test(l.trim())

function getTableBounds(lines: string[], i: number) {
  let start = i; while (start > 0 && isTableLine(lines[start - 1])) start--
  let end   = i; while (end < lines.length - 1 && isTableLine(lines[end + 1])) end++
  return { start, end }
}

function colIndexAt(line: string, monacoCol: number) {
  return Math.max(0, (line.slice(0, monacoCol - 1).match(/\|/g) ?? []).length - 1)
}

function formatTable(tableLines: string[]): string[] {
  const parse  = (l: string) => l.split('|').slice(1, -1).map(c => c.trim())
  const rows   = tableLines.filter((_, i) => i !== 1).map(parse)
  const cols   = Math.max(...rows.map(r => r.length))
  const widths = Array.from({ length: cols }, (_, ci) =>
    Math.max(3, ...rows.map(r => (r[ci] ?? '').length))
  )
  return tableLines.map((line, i) =>
    i === 1
      ? '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |'
      : '| ' + parse(line).map((c, ci) => c.padEnd(widths[ci] ?? 0)).join(' | ') + ' |'
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconEdit = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
    <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Zm-1.86 2.337L9.128 3.384 3.21 9.3a.249.249 0 0 0-.064.108l-.558 1.953 1.953-.558a.25.25 0 0 0 .108-.064Z"/>
  </svg>
)

const IconEye = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.83.88 9.576.43 8.898a1.62 1.62 0 0 1 0-1.798c.45-.677 1.367-1.931 2.637-3.022C4.33 2.992 6.019 2 8 2ZM1.679 7.932a.12.12 0 0 0 0 .136c.411.622 1.241 1.75 2.366 2.717C5.176 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.124-.967 1.954-2.096 2.366-2.717a.12.12 0 0 0 0-.136c-.412-.621-1.242-1.75-2.366-2.717C10.825 4.242 9.473 3.5 8 3.5c-1.473 0-2.824.742-3.955 1.715-1.124.967-1.954 2.096-2.366 2.717ZM8 10a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 10Z"/>
  </svg>
)

const IconColumns = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
    <path d="M1 2.75C1 2.336 1.336 2 1.75 2H7a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75ZM1 5.25C1 4.836 1.336 4.5 1.75 4.5H7a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 5.25ZM1 7.75C1 7.336 1.336 7 1.75 7H7a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 7.75ZM1 10.25C1 9.836 1.336 9.5 1.75 9.5H7a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 10.25ZM9 2.75C9 2.336 9.336 2 9.75 2h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 9 2.75ZM9 5.25C9 4.836 9.336 4.5 9.75 4.5h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 9 5.25ZM9 7.75C9 7.336 9.336 7 9.75 7h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 9 7.75ZM9 10.25C9 9.836 9.336 9.5 9.75 9.5h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 9 10.25Z"/>
  </svg>
)

// ── Mode toolbar ──────────────────────────────────────────────────────────────

function ModeBar({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const btn = (m: Mode, label: string, icon: React.ReactNode) => {
    const active = mode === m
    return (
      <div key={m} className="tb-tip-host">
        <button
          onClick={() => onChange(m)}
          style={{
            width: 30, height: 30, border: 'none', borderRadius: 6, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: active ? '#dbeafe' : 'transparent',
            color:      active ? '#1d4ed8' : '#57606a',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f3f4f6' }}
          onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
        >
          {icon}
        </button>
        <span className="tb-tip">{label}</span>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
      padding: '6px 12px', gap: 2,
      background: '#f6f8fa', borderBottom: '1px solid #d0d7de',
      borderRadius: '6px 6px 0 0',
    }}>
      {btn('edit',    'Edit',    <IconEdit />)}
      {btn('preview', 'Preview', <IconEye />)}
      {btn('both',    'Split',   <IconColumns />)}
    </div>
  )
}

// ── Context menu ──────────────────────────────────────────────────────────────

const menuItemStyle: React.CSSProperties = {
  padding: '6px 14px', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', color: '#1f2328',
}
const menuDivStyle:   React.CSSProperties = { height: 1, background: '#e5e7eb', margin: '3px 0' }
const menuLabelStyle: React.CSSProperties = {
  padding: '4px 14px 2px', fontSize: 11, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

function MenuItem({ label, action, onAction }: { label: string; action: string; onAction: (a: string) => void }) {
  return (
    <div style={menuItemStyle}
      onMouseDown={e => { e.stopPropagation(); onAction(action) }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >{label}</div>
  )
}

function ContextMenu({ menu, onAction, onClose }: {
  menu: CtxMenu; onAction: (a: string) => void; onClose: () => void
}) {
  useEffect(() => {
    const h = () => onClose()
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [onClose])

  const act = (label: string, action: string) => (
    <MenuItem key={action} label={label} action={action}
      onAction={a => { onAction(a); onClose() }} />
  )

  const box = (content: React.ReactNode) => (
    <div
      style={{
        position: 'fixed', top: menu.y, left: menu.x, zIndex: 9999,
        background: '#fff', border: '1px solid #d1d5db', borderRadius: 6,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 190, padding: '4px 0',
      }}
      onMouseDown={e => e.stopPropagation()}
    >{content}</div>
  )

  if (menu.kind === 'slash') return box(<>
    <div style={menuLabelStyle}>Insert</div>
    {slashCommands.map(c => act(c.label, `slash:${c.label}`))}
  </>)

  return box(<>
    <div style={menuLabelStyle}>Column</div>
    {act('Add column to the left',  'col-add-left')}
    {act('Add column to the right', 'col-add-right')}
    {act('Delete column',           'col-delete')}
    {menu.isDataRow && <><div style={menuDivStyle} /><div style={menuLabelStyle}>Row</div></>}
    {menu.isDataRow && act('Add row above', 'row-add-above')}
    {menu.isDataRow && act('Add row below', 'row-add-below')}
    {menu.isDataRow && act('Delete row',    'row-delete')}
    <div style={menuDivStyle} />
    {act('Format / align table', 'format')}
  </>)
}

// ── Main editor ───────────────────────────────────────────────────────────────

export default function AdvancedEditor({
  value, onChange, format,
  height = '500px', theme = 'light', className = '', options = {},
}: EditorProps) {
  const [markdown, setMarkdown] = useState(value)
  const [mode, setMode]         = useState<Mode>('both')
  const [ctxMenu, setCtxMenu]   = useState<CtxMenu | null>(null)

  const monacoRef    = useRef<any>(null)
  const monacoApiRef = useRef<any>(null)
  const disposable   = useRef<any>(null)
  const previewRef   = useRef<HTMLDivElement>(null)
  const modeRef      = useRef<Mode>('both')
  const scrollSync   = useRef(false)

  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => setMarkdown(value), [value])
  useEffect(() => () => disposable.current?.dispose(), [])

  const handleEditorChange = (val?: string) => {
    const v = val || ''
    if (format === 'markdown') setMarkdown(v)
    onChange(v)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    if (format !== 'markdown') return
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile(); if (!file) continue
        const reader = new FileReader()
        reader.onload = () => {
          const editor = monacoRef.current; if (!editor) return
          const sel = editor.getSelection()!
          editor.executeEdits('', [{ range: sel, text: `![pasted_image](${reader.result})`, forceMoveMarkers: true }])
        }
        reader.readAsDataURL(file); e.preventDefault(); break
      }
    }
  }

  const handleEditorMount = (editor: any, monaco: any) => {
    monacoRef.current    = editor
    monacoApiRef.current = monaco

    // ── Completions ───────────────────────────────────────────────────────
    disposable.current = monaco.languages.registerCompletionItemProvider('markdown', {
      triggerCharacters: ['@', '/'],
      provideCompletionItems: (model: any, position: any) => {
        const before = model.getValueInRange({
          startLineNumber: position.lineNumber, startColumn: 1,
          endLineNumber:   position.lineNumber, endColumn: position.column,
        })
        const mMatch = before.match(/@([\w.]*)$/)
        if (mMatch) {
          const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
            startColumn: position.column - mMatch[0].length, endColumn: position.column }
          return { suggestions: mentionList
            .filter(m => m.toLowerCase().startsWith(mMatch[1].toLowerCase()))
            .map(m => ({ label: `@${m}`, kind: monaco.languages.CompletionItemKind.User, insertText: `\`@${m}\` `, range })) }
        }
        const sMatch = before.match(/\/([\w]*)$/)
        if (sMatch) {
          const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
            startColumn: position.column - sMatch[0].length, endColumn: position.column }
          return { suggestions: slashCommands
            .filter(c => c.label.toLowerCase().includes(sMatch[1].toLowerCase()))
            .map(c => ({ label: c.label, kind: monaco.languages.CompletionItemKind.Snippet, insertText: c.insert, range })) }
        }
        return { suggestions: [] }
      },
    })

    // ── Slash key trigger ─────────────────────────────────────────────────
    editor.onKeyDown((e: any) => {
      if (e.browserEvent?.key === '/') {
        setTimeout(() => editor.trigger('keyboard', 'editor.action.triggerSuggest', {}), 50)
      }
    })

    // ── Right-click context menu ──────────────────────────────────────────
    editor.onContextMenu((e: any) => {
      const position = e.target?.position; if (!position) return
      e.event.preventDefault(); e.event.stopPropagation()
      const model   = editor.getModel()
      const lines   = model.getValue().split('\n')
      const lineIdx = position.lineNumber - 1

      if (isTableLine(lines[lineIdx] ?? '')) {
        const { start, end } = getTableBounds(lines, lineIdx)
        const isHeader  = lineIdx === start
        const isSep     = isSepLine(lines[lineIdx])
        setCtxMenu({ kind: 'table',
          x: e.event.browserEvent.clientX, y: e.event.browserEvent.clientY,
          lineIdx, colIdx: colIndexAt(lines[lineIdx], position.column),
          isHeader, isSep, isDataRow: !isHeader && !isSep,
          tableStart: start, tableEnd: end })
      } else {
        setCtxMenu({ kind: 'slash',
          x: e.event.browserEvent.clientX, y: e.event.browserEvent.clientY,
          lineNumber: position.lineNumber, column: position.column })
      }
    })

    // ── Scroll sync: editor → preview ─────────────────────────────────────
    editor.onDidScrollChange((e: any) => {
      if (modeRef.current !== 'both' || scrollSync.current) return
      const preview = previewRef.current; if (!preview) return
      const maxEditor = editor.getScrollHeight() - editor.getLayoutInfo().height
      if (maxEditor <= 0) return
      const ratio = e.scrollTop / maxEditor
      scrollSync.current = true
      preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight)
      requestAnimationFrame(() => { scrollSync.current = false })
    })
  }

  // Preview scroll → editor sync
  const handlePreviewScroll = useCallback(() => {
    if (modeRef.current !== 'both' || scrollSync.current) return
    const preview = previewRef.current; if (!preview) return
    const editor  = monacoRef.current;  if (!editor)  return
    const maxPreview = preview.scrollHeight - preview.clientHeight
    if (maxPreview <= 0) return
    const ratio     = preview.scrollTop / maxPreview
    const maxEditor = editor.getScrollHeight() - editor.getLayoutInfo().height
    scrollSync.current = true
    editor.setScrollTop(ratio * maxEditor)
    requestAnimationFrame(() => { scrollSync.current = false })
  }, [])

  // ── Table / slash action handler ──────────────────────────────────────────

  const handleAction = useCallback((action: string) => {
    const editor = monacoRef.current; if (!editor) return
    const monaco = monacoApiRef.current
    const model  = editor.getModel(); if (!model) return

    if (action.startsWith('slash:')) {
      const cmd = slashCommands.find(c => c.label === action.slice(6)); if (!cmd) return
      const pos = editor.getPosition(); if (!pos) return
      editor.executeEdits('', [{ range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column), text: cmd.insert }])
      editor.focus(); return
    }

    if (!ctxMenu || ctxMenu.kind !== 'table') return
    const lines = model.getValue().split('\n')
    const { lineIdx, colIdx, tableStart, tableEnd } = ctxMenu

    const applyToTable = (fn: (cells: string[], i: number) => string[]) => {
      for (let i = tableStart; i <= tableEnd; i++) {
        if (!isTableLine(lines[i])) continue
        lines[i] = fn(lines[i].split('|'), i).join('|')
      }
    }

    switch (action) {
      case 'col-add-left':
        applyToTable((c, i) => { c.splice(colIdx + 1, 0, i === tableStart + 1 ? '---' : '   '); return c }); break
      case 'col-add-right':
        applyToTable((c, i) => { c.splice(colIdx + 2, 0, i === tableStart + 1 ? '---' : '   '); return c }); break
      case 'col-delete':
        applyToTable(c => { if (c.length > 3) c.splice(colIdx + 1, 1); return c }); break
      case 'row-add-above': {
        const b = '| ' + lines[lineIdx].split('|').slice(1,-1).map(()=>'   ').join(' | ') + ' |'
        lines.splice(lineIdx, 0, b); break }
      case 'row-add-below': {
        const b = '| ' + lines[lineIdx].split('|').slice(1,-1).map(()=>'   ').join(' | ') + ' |'
        lines.splice(lineIdx + 1, 0, b); break }
      case 'row-delete':
        if (lineIdx > tableStart + 1) lines.splice(lineIdx, 1); break
      case 'format': {
        const fmt = formatTable(lines.slice(tableStart, tableEnd + 1))
        lines.splice(tableStart, tableEnd - tableStart + 1, ...fmt); break }
    }
    model.setValue(lines.join('\n'))
  }, [ctxMenu])

  // ── Merged Monaco options ─────────────────────────────────────────────────

  const mergedOptions = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [options])

  // ── Preview pane ──────────────────────────────────────────────────────────

  const previewPane = useMemo(() => (
    <div
      ref={previewRef}
      className="gh-markdown"
      onScroll={handlePreviewScroll}
      style={{ padding: '16px 24px', height, overflow: 'auto', borderLeft: '1px solid #d0d7de' }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  ), [markdown, height, handlePreviewScroll])

  // ── Render ────────────────────────────────────────────────────────────────

  if (format === 'markdown') {
    const isBoth = mode === 'both'
    return (
      <div
        className={className}
        style={{ border: '1px solid #d0d7de', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <ModeBar mode={mode} onChange={setMode} />

        <div style={{ display: 'flex', flex: 1 }}>
          {(mode === 'edit' || isBoth) && (
            <div style={{ width: isBoth ? '50%' : '100%', flexShrink: 0 }} onPaste={handlePaste}>
              <MonacoEditor
                height={height}
                width="100%"
                language="markdown"
                theme={theme}
                value={markdown}
                onChange={handleEditorChange}
                onMount={handleEditorMount}
                options={mergedOptions}
              />
            </div>
          )}

          {(mode === 'preview' || isBoth) && (
            <div style={{ width: isBoth ? '50%' : '100%', flexShrink: 0 }}>
              {previewPane}
            </div>
          )}
        </div>

        {ctxMenu && (
          <ContextMenu menu={ctxMenu} onAction={handleAction} onClose={() => setCtxMenu(null)} />
        )}
      </div>
    )
  }

  return (
    <div className={className}>
      <MonacoEditor
        height={height}
        language="javascript"
        theme={theme}
        value={value}
        onChange={handleEditorChange}
        options={{ ...DEFAULT_OPTIONS, ...options }}
      />
    </div>
  )
}

// ── Demo page ─────────────────────────────────────────────────────────────────

export function EditorDemoPage() {
  const [content, setContent] = useState(
`# Markdown Demo

Hello \`@jason.h\`, try /Heading 2

## Table Example

| Name | Age |
|------|-----|
| Alice | 23 |
| Bob | 30 |

Paste an image here or try @mention someone.`
  )
  return (
    <div style={{ padding: 24 }}>
      <h1>Advanced Markdown Editor Demo</h1>
      <AdvancedEditor value={content} onChange={setContent} format="markdown" height="500px" />
      <div style={{ marginTop: 24 }}>
        <h2>Raw Markdown:</h2>
        <pre style={{ background: '#f6f8fa', padding: 16, borderRadius: 6, maxHeight: 300, overflow: 'auto', fontSize: 13 }}>{content}</pre>
      </div>
    </div>
  )
}
