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

// ── Context menu types ────────────────────────────────────────────────────────

interface CtxMenu {
  x:          number
  y:          number
  lineIdx:    number   // 0-indexed line in document
  colIdx:     number   // 0-indexed column in table
  isHeader:   boolean
  isSep:      boolean
  isDataRow:  boolean
  tableStart: number
  tableEnd:   number
}

// ── Table helpers ─────────────────────────────────────────────────────────────

const isTableLine = (l: string) => l.trim().startsWith('|')
const isSepLine   = (l: string) => /^\|[\s\-:|]+\|/.test(l.trim())

function getTableBounds(lines: string[], lineIdx: number) {
  let start = lineIdx
  while (start > 0 && isTableLine(lines[start - 1])) start--
  let end = lineIdx
  while (end < lines.length - 1 && isTableLine(lines[end + 1])) end++
  return { start, end }
}

function colIndexAt(lineContent: string, monacoColumn: number) {
  const before = lineContent.slice(0, monacoColumn - 1)
  return Math.max(0, (before.match(/\|/g) ?? []).length - 1)
}

function formatTable(tableLines: string[]): string[] {
  const parseRow = (l: string) => l.split('|').slice(1, -1).map(c => c.trim())
  const dataLines = tableLines.filter((_, i) => i !== 1)
  const rows      = dataLines.map(parseRow)
  const colCount  = Math.max(...rows.map(r => r.length))
  const widths    = Array.from({ length: colCount }, (_, ci) =>
    Math.max(3, ...rows.map(r => (r[ci] ?? '').length))
  )
  return tableLines.map((line, i) =>
    i === 1
      ? '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |'
      : '| ' + parseRow(line).map((c, ci) => c.padEnd(widths[ci] ?? 0)).join(' | ') + ' |'
  )
}

// ── Context menu UI ───────────────────────────────────────────────────────────

const menuItemStyle: React.CSSProperties = {
  padding: '6px 14px', cursor: 'pointer', fontSize: 13,
  whiteSpace: 'nowrap', color: '#1a1a1a',
}
const menuDivStyle: React.CSSProperties = {
  height: 1, background: '#e5e7eb', margin: '3px 0',
}

function ContextMenu({ menu, onAction, onClose }: {
  menu:     CtxMenu
  onAction: (action: string) => void
  onClose:  () => void
}) {
  useEffect(() => {
    const handler = () => onClose()
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])

  const item = (label: string, action: string) => (
    <div
      key={action}
      style={menuItemStyle}
      onMouseDown={(e) => { e.stopPropagation(); onAction(action); onClose() }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {label}
    </div>
  )

  return (
    <div
      style={{
        position: 'fixed', top: menu.y, left: menu.x, zIndex: 9999,
        background: '#fff', border: '1px solid #d1d5db',
        borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        minWidth: 180, padding: '4px 0',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Column actions — always show when in a table */}
      {item('Add column to the left',  'col-add-left')}
      {item('Add column to the right', 'col-add-right')}
      {item('Delete column',           'col-delete')}
      <div style={menuDivStyle} />
      {/* Row actions — only for data rows */}
      {(menu.isDataRow) && item('Add row above', 'row-add-above')}
      {(menu.isDataRow) && item('Add row below', 'row-add-below')}
      {(menu.isDataRow) && item('Delete row',    'row-delete')}
      {menu.isDataRow && <div style={menuDivStyle} />}
      {item('Format / align table', 'format')}
    </div>
  )
}

// ── Main editor component ─────────────────────────────────────────────────────

export default function AdvancedEditor({ value, onChange, format, height = '500px' }: EditorProps) {
  const [markdown, setMarkdown] = useState(value)
  const [mode, setMode]         = useState<Mode>('both')
  const [ctxMenu, setCtxMenu]   = useState<CtxMenu | null>(null)

  const monacoRef  = useRef<any>(null)
  const disposable = useRef<any>(null)

  useEffect(() => setMarkdown(value), [value])
  useEffect(() => () => disposable.current?.dispose(), [])

  const handleEditorChange = (val?: string) => {
    const v = val || ''
    if (format === 'markdown') setMarkdown(v)
    onChange(v)
  }

  // Paste image → Base64 inline
  const handlePaste = (e: React.ClipboardEvent) => {
    if (format !== 'markdown') return
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (!file) continue
        const reader = new FileReader()
        reader.onload = () => {
          const editor = monacoRef.current
          if (!editor) return
          const sel = editor.getSelection()!
          editor.executeEdits('', [{ range: sel, text: `![pasted_image](${reader.result})`, forceMoveMarkers: true }])
        }
        reader.readAsDataURL(file)
        e.preventDefault()
        break
      }
    }
  }

  const handleEditorMount = (editor: any, monaco: any) => {
    monacoRef.current = editor

    // ── Completions: @ mention + /slash only ──────────────────────────────
    disposable.current = monaco.languages.registerCompletionItemProvider('markdown', {
      triggerCharacters: ['@', '/'],
      provideCompletionItems: (model: any, position: any) => {
        const lineBefore = model.getValueInRange({
          startLineNumber: position.lineNumber, startColumn: 1,
          endLineNumber:   position.lineNumber, endColumn: position.column,
        })

        const mentionMatch = lineBefore.match(/@([\w.]*)$/)
        if (mentionMatch) {
          const range = {
            startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
            startColumn: position.column - mentionMatch[0].length, endColumn: position.column,
          }
          return {
            suggestions: mentionList
              .filter(m => m.toLowerCase().startsWith(mentionMatch[1].toLowerCase()))
              .map(m => ({ label: `@${m}`, kind: monaco.languages.CompletionItemKind.User, insertText: `\`@${m}\` `, range })),
          }
        }

        const slashMatch = lineBefore.match(/\/([\w]*)$/)
        if (slashMatch) {
          const range = {
            startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
            startColumn: position.column - slashMatch[0].length, endColumn: position.column,
          }
          return {
            suggestions: slashCommands
              .filter(c => c.label.toLowerCase().includes(slashMatch[1].toLowerCase()))
              .map(c => ({ label: c.label, kind: monaco.languages.CompletionItemKind.Snippet, insertText: c.insert, range })),
          }
        }

        return { suggestions: [] }
      },
    })

    // ── Slash trigger fix: use editor.onKeyDown ───────────────────────────
    editor.onKeyDown((e: any) => {
      if (e.browserEvent?.key === '/') {
        setTimeout(() => editor.trigger('keyboard', 'editor.action.triggerSuggest', {}), 50)
      }
    })

    // ── Custom right-click context menu for table operations ──────────────
    editor.onContextMenu((e: any) => {
      const position = e.target?.position
      if (!position) return
      e.event.preventDefault()
      e.event.stopPropagation()

      const model   = editor.getModel()
      const lines   = model.getValue().split('\n')
      const lineIdx = position.lineNumber - 1

      if (!isTableLine(lines[lineIdx] ?? '')) return

      const { start, end } = getTableBounds(lines, lineIdx)
      const isHeader  = lineIdx === start
      const isSep     = isSepLine(lines[lineIdx])
      const isDataRow = !isHeader && !isSep

      setCtxMenu({
        x: e.event.browserEvent.clientX,
        y: e.event.browserEvent.clientY,
        lineIdx,
        colIdx:     colIndexAt(lines[lineIdx], position.column),
        isHeader,
        isSep,
        isDataRow,
        tableStart: start,
        tableEnd:   end,
      })
    })
  }

  // ── Table operations ──────────────────────────────────────────────────────

  const getModel = () => monacoRef.current?.getModel()

  const handleTableAction = useCallback((action: string) => {
    if (!ctxMenu) return
    const model = getModel(); if (!model) return
    const lines = model.getValue().split('\n')
    const { lineIdx, colIdx, tableStart, tableEnd } = ctxMenu

    const applyToTable = (fn: (cells: string[], lineI: number) => string[]) => {
      for (let i = tableStart; i <= tableEnd; i++) {
        if (!isTableLine(lines[i])) continue
        const cells = lines[i].split('|')
        lines[i] = fn(cells, i).join('|')
      }
    }

    switch (action) {
      case 'col-add-left':
        applyToTable((cells, i) => {
          cells.splice(colIdx + 1, 0, i === tableStart + 1 ? '---' : '   ')
          return cells
        })
        break

      case 'col-add-right':
        applyToTable((cells, i) => {
          cells.splice(colIdx + 2, 0, i === tableStart + 1 ? '---' : '   ')
          return cells
        })
        break

      case 'col-delete':
        applyToTable((cells) => {
          if (cells.length > 3) cells.splice(colIdx + 1, 1)
          return cells
        })
        break

      case 'row-add-above': {
        const ref   = lines[lineIdx].split('|').slice(1, -1)
        const blank = '| ' + ref.map(() => '   ').join(' | ') + ' |'
        lines.splice(lineIdx, 0, blank)
        break
      }

      case 'row-add-below': {
        const ref   = lines[lineIdx].split('|').slice(1, -1)
        const blank = '| ' + ref.map(() => '   ').join(' | ') + ' |'
        lines.splice(lineIdx + 1, 0, blank)
        break
      }

      case 'row-delete':
        if (lineIdx > tableStart + 1) lines.splice(lineIdx, 1)
        break

      case 'format': {
        const tableLines    = lines.slice(tableStart, tableEnd + 1)
        const formatted     = formatTable(tableLines)
        lines.splice(tableStart, tableEnd - tableStart + 1, ...formatted)
        break
      }
    }

    model.setValue(lines.join('\n'))
  }, [ctxMenu])

  // ── Monaco options ────────────────────────────────────────────────────────

  const monacoOptions = {
    wordWrap:                   'on'  as const,
    minimap:                    { enabled: false },
    largeFileOptimizations:     true,
    automaticLayout:            true,
    contextmenu:                false,
    quickSuggestions:           false,
    suggestOnTriggerCharacters: true,
    wordBasedSuggestions:       'off' as const,
    parameterHints:             { enabled: false },
    snippetSuggestions:         'none' as const,
  }

  // ── Preview pane ──────────────────────────────────────────────────────────

  const previewPane = useMemo(() => (
    <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 8, height, overflow: 'auto' }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  ), [markdown, height])

  // ── Render ────────────────────────────────────────────────────────────────

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
              <MonacoEditor
                height={height}
                width="100%"
                defaultLanguage="markdown"
                value={markdown}
                onChange={handleEditorChange}
                onMount={handleEditorMount}
                options={monacoOptions}
              />
            </div>
          )}

          {(mode === 'preview' || isBoth) && (
            <div style={{ width: isBoth ? '50%' : '100%', flexShrink: 0 }}>
              {previewPane}
            </div>
          )}
        </div>

        {/* Custom context menu */}
        {ctxMenu && (
          <ContextMenu
            menu={ctxMenu}
            onAction={handleTableAction}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </div>
    )
  }

  return (
    <MonacoEditor
      height={height}
      defaultLanguage="javascript"
      value={value}
      onChange={handleEditorChange}
      options={{ wordWrap: 'on', minimap: { enabled: false }, largeFileOptimizations: true, contextmenu: false }}
    />
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
        <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, maxHeight: 300, overflow: 'auto' }}>
          {content}
        </pre>
      </div>

      <div style={{ marginTop: 24 }}>
        <h2>Available @mentions:</h2>
        <p>{mentionList.join(', ')}</p>
        <h2>Available /slash commands:</h2>
        <ul>
          {slashCommands.map(cmd => (
            <li key={cmd.label}><strong>{cmd.label}</strong>: {cmd.insert.replace(/\n/g, '\\n')}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
