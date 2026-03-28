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
  value: string
  onChange: (val: string) => void
  format: 'markdown' | 'other'
  height?: string
}

// ── Context menu ──────────────────────────────────────────────────────────────

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

function colIndexAt(lineContent: string, monacoCol: number) {
  return Math.max(0, (lineContent.slice(0, monacoCol - 1).match(/\|/g) ?? []).length - 1)
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

// ── Context menu component ────────────────────────────────────────────────────

const itemStyle: React.CSSProperties = {
  padding: '6px 14px', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
}
const divStyle: React.CSSProperties = { height: 1, background: '#e5e7eb', margin: '3px 0' }
const labelStyle: React.CSSProperties = {
  padding: '4px 14px 2px', fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em',
}

function MenuItem({ label, action, onAction }: { label: string; action: string; onAction: (a: string) => void }) {
  return (
    <div
      style={itemStyle}
      onMouseDown={e => { e.stopPropagation(); onAction(action) }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >{label}</div>
  )
}

function ContextMenu({ menu, onAction, onClose }: { menu: CtxMenu; onAction: (a: string) => void; onClose: () => void }) {
  useEffect(() => {
    const h = () => onClose()
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [onClose])

  const wrap = (content: React.ReactNode) => (
    <div
      style={{ position: 'fixed', top: menu.y, left: menu.x, zIndex: 9999,
        background: '#fff', border: '1px solid #d1d5db', borderRadius: 6,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 190, padding: '4px 0' }}
      onMouseDown={e => e.stopPropagation()}
    >{content}</div>
  )

  const act = (label: string, action: string) => (
    <MenuItem key={action} label={label} action={action} onAction={a => { onAction(a); onClose() }} />
  )

  if (menu.kind === 'slash') {
    return wrap(<>
      <div style={labelStyle}>Insert</div>
      {slashCommands.map(c => act(c.label, `slash:${c.label}`))}
    </>)
  }

  return wrap(<>
    <div style={labelStyle}>Column</div>
    {act('Add column to the left',  'col-add-left')}
    {act('Add column to the right', 'col-add-right')}
    {act('Delete column',           'col-delete')}
    {menu.isDataRow && <><div style={divStyle} /><div style={labelStyle}>Row</div></>}
    {menu.isDataRow && act('Add row above', 'row-add-above')}
    {menu.isDataRow && act('Add row below', 'row-add-below')}
    {menu.isDataRow && act('Delete row',    'row-delete')}
    <div style={divStyle} />
    {act('Format / align table', 'format')}
  </>)
}

// ── Main editor ───────────────────────────────────────────────────────────────

export default function AdvancedEditor({ value, onChange, format, height = '500px' }: EditorProps) {
  const [markdown, setMarkdown] = useState(value)
  const [mode, setMode]         = useState<Mode>('both')
  const [ctxMenu, setCtxMenu]   = useState<CtxMenu | null>(null)

  const monacoRef    = useRef<any>(null)
  const monacoApiRef = useRef<any>(null)
  const disposable   = useRef<any>(null)

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

    // Custom completion provider — @ mention + /slash only
    disposable.current = monaco.languages.registerCompletionItemProvider('markdown', {
      triggerCharacters: ['@', '/'],
      provideCompletionItems: (model: any, position: any) => {
        const lineBefore = model.getValueInRange({
          startLineNumber: position.lineNumber, startColumn: 1,
          endLineNumber:   position.lineNumber, endColumn: position.column,
        })
        const mentionMatch = lineBefore.match(/@([\w.]*)$/)
        if (mentionMatch) {
          const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
            startColumn: position.column - mentionMatch[0].length, endColumn: position.column }
          return { suggestions: mentionList
            .filter(m => m.toLowerCase().startsWith(mentionMatch[1].toLowerCase()))
            .map(m => ({ label: `@${m}`, kind: monaco.languages.CompletionItemKind.User, insertText: `\`@${m}\` `, range })) }
        }
        const slashMatch = lineBefore.match(/\/([\w]*)$/)
        if (slashMatch) {
          const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
            startColumn: position.column - slashMatch[0].length, endColumn: position.column }
          return { suggestions: slashCommands
            .filter(c => c.label.toLowerCase().includes(slashMatch[1].toLowerCase()))
            .map(c => ({ label: c.label, kind: monaco.languages.CompletionItemKind.Snippet, insertText: c.insert, range })) }
        }
        return { suggestions: [] }
      },
    })

    // Slash trigger via onKeyDown (more reliable than onDidChangeModelContent)
    editor.onKeyDown((e: any) => {
      if (e.browserEvent?.key === '/') {
        setTimeout(() => editor.trigger('keyboard', 'editor.action.triggerSuggest', {}), 50)
      }
    })

    // Right-click context menu
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
        const isDataRow = !isHeader && !isSep
        setCtxMenu({ kind: 'table', x: e.event.browserEvent.clientX, y: e.event.browserEvent.clientY,
          lineIdx, colIdx: colIndexAt(lines[lineIdx], position.column),
          isHeader, isSep, isDataRow, tableStart: start, tableEnd: end })
      } else {
        // Not a table — show slash command insert menu
        setCtxMenu({ kind: 'slash', x: e.event.browserEvent.clientX, y: e.event.browserEvent.clientY,
          lineNumber: position.lineNumber, column: position.column })
      }
    })
  }

  // ── Action handler ────────────────────────────────────────────────────────

  const handleAction = useCallback((action: string) => {
    const editor = monacoRef.current; if (!editor) return
    const monaco = monacoApiRef.current
    const model  = editor.getModel(); if (!model) return

    // Slash insert from context menu
    if (action.startsWith('slash:')) {
      const cmd = slashCommands.find(c => c.label === action.slice(6)); if (!cmd) return
      const pos   = editor.getPosition(); if (!pos) return
      const range = new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column)
      editor.executeEdits('', [{ range, text: cmd.insert }])
      editor.focus(); return
    }

    // Table actions
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
        applyToTable((cells, i) => { cells.splice(colIdx + 1, 0, i === tableStart + 1 ? '---' : '   '); return cells }); break
      case 'col-add-right':
        applyToTable((cells, i) => { cells.splice(colIdx + 2, 0, i === tableStart + 1 ? '---' : '   '); return cells }); break
      case 'col-delete':
        applyToTable((cells) => { if (cells.length > 3) cells.splice(colIdx + 1, 1); return cells }); break
      case 'row-add-above': {
        const blank = '| ' + lines[lineIdx].split('|').slice(1, -1).map(() => '   ').join(' | ') + ' |'
        lines.splice(lineIdx, 0, blank); break
      }
      case 'row-add-below': {
        const blank = '| ' + lines[lineIdx].split('|').slice(1, -1).map(() => '   ').join(' | ') + ' |'
        lines.splice(lineIdx + 1, 0, blank); break
      }
      case 'row-delete':
        if (lineIdx > tableStart + 1) lines.splice(lineIdx, 1); break
      case 'format': {
        const formatted = formatTable(lines.slice(tableStart, tableEnd + 1))
        lines.splice(tableStart, tableEnd - tableStart + 1, ...formatted); break
      }
    }

    model.setValue(lines.join('\n'))
  }, [ctxMenu])

  // ── Options ───────────────────────────────────────────────────────────────

  const monacoOptions = {
    wordWrap: 'on' as const, minimap: { enabled: false },
    largeFileOptimizations: true, automaticLayout: true,
    contextmenu: false, quickSuggestions: false,
    suggestOnTriggerCharacters: true, wordBasedSuggestions: 'off' as const,
    parameterHints: { enabled: false }, snippetSuggestions: 'none' as const,
  }

  const previewPane = useMemo(() => (
    <div className="gh-markdown" style={{ padding: '16px 24px', height, overflow: 'auto', border: '1px solid #d0d7de', borderRadius: 6 }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  ), [markdown, height])

  if (format === 'markdown') {
    const isBoth = mode === 'both'
    return (
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => setMode('edit')}>Edit</button>
          <button onClick={() => setMode('preview')}>Preview</button>
          <button onClick={() => setMode('both')}>Both</button>
        </div>
        <div style={{ display: 'flex' }}>
          {(mode === 'edit' || isBoth) && (
            <div style={{ width: isBoth ? '50%' : '100%', flexShrink: 0 }} onPaste={handlePaste}>
              <MonacoEditor height={height} width="100%" defaultLanguage="markdown"
                value={markdown} onChange={handleEditorChange}
                onMount={handleEditorMount} options={monacoOptions} />
            </div>
          )}
          {(mode === 'preview' || isBoth) && (
            <div style={{ width: isBoth ? '50%' : '100%', flexShrink: 0 }}>{previewPane}</div>
          )}
        </div>
        {ctxMenu && <ContextMenu menu={ctxMenu} onAction={handleAction} onClose={() => setCtxMenu(null)} />}
      </div>
    )
  }

  return (
    <MonacoEditor height={height} defaultLanguage="javascript" value={value}
      onChange={handleEditorChange}
      options={{ wordWrap: 'on', minimap: { enabled: false }, largeFileOptimizations: true, contextmenu: false }} />
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
      <AdvancedEditor value={content} onChange={setContent} format="markdown" height="600px" />
      <div style={{ marginTop: 24 }}>
        <h2>Raw Markdown:</h2>
        <pre style={{ background: '#f6f8fa', padding: 16, borderRadius: 6, maxHeight: 300, overflow: 'auto', fontSize: 13 }}>{content}</pre>
      </div>
    </div>
  )
}
