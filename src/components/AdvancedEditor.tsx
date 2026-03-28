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

// ── Markdown segment parser ───────────────────────────────────────────────────

type Segment =
  | { type: 'text';  content: string }
  | { type: 'table'; lines: string[]; startLine: number }

function splitSegments(md: string): Segment[] {
  const lines    = md.split('\n')
  const segments: Segment[] = []
  let i          = 0
  let textStart  = 0

  const flushText = (end: number) => {
    const content = lines.slice(textStart, end).join('\n')
    if (content.trim()) segments.push({ type: 'text', content })
  }

  while (i < lines.length) {
    const isTableRow  = (l: string) => l.trim().startsWith('|')
    const isSeparator = (l: string) => /^\|[-:\s|]+\|/.test(l.trim())

    if (isTableRow(lines[i]) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      flushText(i)
      const startLine = i
      while (i < lines.length && isTableRow(lines[i])) i++
      segments.push({ type: 'table', lines: lines.slice(startLine, i), startLine })
      textStart = i
    } else {
      i++
    }
  }
  flushText(lines.length)
  return segments
}

// ── Interactive table rendered in preview pane ────────────────────────────────

const btnStyle: React.CSSProperties = {
  padding: '1px 5px', fontSize: 11, lineHeight: 1,
  background: '#fff', border: '1px solid #ccc', borderRadius: 3,
  cursor: 'pointer', color: '#555',
}

interface TableOps {
  addColumn:    (colIdx: number, startLine: number, endLine: number) => void
  deleteColumn: (colIdx: number, startLine: number, endLine: number) => void
  addRow:       (lineIdx: number) => void
  deleteRow:    (lineIdx: number) => void
}

function InteractiveTable({ tableLines, startLine, ops }: {
  tableLines: string[]
  startLine:  number
  ops:        TableOps
}) {
  const [hoveredCol, setHoveredCol] = useState<number | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  const parseRow = (line: string) => line.split('|').slice(1, -1).map(c => c.trim())
  const headers  = parseRow(tableLines[0])
  const dataRows = tableLines.slice(2).map(parseRow)
  const endLine  = startLine + tableLines.length - 1

  const thStyle: React.CSSProperties = {
    border: '1px solid #d1d5db', padding: '6px 10px',
    background: '#f3f4f6', fontWeight: 600,
    position: 'relative', userSelect: 'none',
  }
  const tdStyle: React.CSSProperties = {
    border: '1px solid #d1d5db', padding: '6px 10px',
    position: 'relative',
  }

  return (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: 14 }}>
        <thead>
          <tr>
            {headers.map((h, colIdx) => (
              <th
                key={colIdx}
                style={thStyle}
                onMouseEnter={() => setHoveredCol(colIdx)}
                onMouseLeave={() => setHoveredCol(null)}
              >
                {h}
                {hoveredCol === colIdx && (
                  <div style={{ position: 'absolute', top: 2, right: 2, display: 'flex', gap: 2, zIndex: 10 }}>
                    <button style={btnStyle} title="Add column after" onClick={() => ops.addColumn(colIdx, startLine, endLine)}>+col</button>
                    <button style={btnStyle} title="Delete this column" onClick={() => ops.deleteColumn(colIdx, startLine, endLine)}>−col</button>
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, rowIdx) => {
            const lineIdx = startLine + 2 + rowIdx // +header +separator
            return (
              <tr
                key={rowIdx}
                style={{ background: rowIdx % 2 === 0 ? '#fff' : '#f9fafb' }}
                onMouseEnter={() => setHoveredRow(rowIdx)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {row.map((cell, colIdx) => (
                  <td key={colIdx} style={tdStyle}>{cell}</td>
                ))}
                {/* Row controls appear as an extra cell on hover */}
                <td style={{ ...tdStyle, border: 'none', padding: '0 4px', whiteSpace: 'nowrap', background: 'transparent' }}>
                  {hoveredRow === rowIdx && (
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button style={btnStyle} title="Add row below" onClick={() => ops.addRow(lineIdx)}>+row</button>
                      <button style={btnStyle} title="Delete this row" onClick={() => ops.deleteRow(lineIdx)}>−row</button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main editor component ─────────────────────────────────────────────────────

export default function AdvancedEditor({ value, onChange, format, height = '500px' }: EditorProps) {
  const [markdown, setMarkdown] = useState(value)
  const [mode, setMode]         = useState<Mode>('both')
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

    // Register custom completion provider for @ and / only
    disposable.current = monaco.languages.registerCompletionItemProvider('markdown', {
      triggerCharacters: ['@', '/'],
      provideCompletionItems: (model: any, position: any) => {
        const lineBefore = model.getValueInRange({
          startLineNumber: position.lineNumber, startColumn: 1,
          endLineNumber:   position.lineNumber, endColumn: position.column,
        })

        // @mention → inserts `@name`
        const mentionMatch = lineBefore.match(/@([\w.]*)$/)
        if (mentionMatch) {
          const range = {
            startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
            startColumn: position.column - mentionMatch[0].length, endColumn: position.column,
          }
          return {
            suggestions: mentionList
              .filter(m => m.toLowerCase().startsWith(mentionMatch[1].toLowerCase()))
              .map(m => ({
                label: `@${m}`,
                kind:  monaco.languages.CompletionItemKind.User,
                insertText: `\`@${m}\` `,
                range,
              })),
          }
        }

        // /slash command
        const slashMatch = lineBefore.match(/\/([\w]*)$/)
        if (slashMatch) {
          const range = {
            startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
            startColumn: position.column - slashMatch[0].length, endColumn: position.column,
          }
          return {
            suggestions: slashCommands
              .filter(c => c.label.toLowerCase().includes(slashMatch[1].toLowerCase()))
              .map(c => ({
                label: c.label,
                kind:  monaco.languages.CompletionItemKind.Snippet,
                insertText: c.insert,
                range,
              })),
          }
        }

        return { suggestions: [] }
      },
    })

    // Force-trigger suggest on '/' — Monaco markdown mode doesn't fire triggerCharacters for it
    editor.onDidChangeModelContent((e: any) => {
      if (e.isFlush) return
      const text = e.changes[0]?.text ?? ''
      if (text.includes('/')) {
        setTimeout(() => editor.trigger('keyboard', 'editor.action.triggerSuggest', {}), 50)
      }
    })
  }

  // ── Table operations (operate on raw markdown via Monaco model) ───────────

  const getModel = () => monacoRef.current?.getModel()

  const addColumn = useCallback((colIdx: number, startLine: number, endLine: number) => {
    const model = getModel(); if (!model) return
    const lines = model.getValue().split('\n')
    for (let i = startLine; i <= endLine; i++) {
      if (!lines[i].includes('|')) continue
      const cells = lines[i].split('|')
      cells.splice(colIdx + 2, 0, i === startLine + 1 ? '---' : '   ')
      lines[i] = cells.join('|')
    }
    model.setValue(lines.join('\n'))
  }, [])

  const deleteColumn = useCallback((colIdx: number, startLine: number, endLine: number) => {
    const model = getModel(); if (!model) return
    const lines = model.getValue().split('\n')
    for (let i = startLine; i <= endLine; i++) {
      if (!lines[i].includes('|')) continue
      const cells = lines[i].split('|')
      if (cells.length > 3) cells.splice(colIdx + 1, 1)
      lines[i] = cells.join('|')
    }
    model.setValue(lines.join('\n'))
  }, [])

  const addRow = useCallback((lineIdx: number) => {
    const model = getModel(); if (!model) return
    const lines   = model.getValue().split('\n')
    const newLine = '| ' + lines[lineIdx].split('|').slice(1, -1).map(() => '   ').join(' | ') + ' |'
    lines.splice(lineIdx + 1, 0, newLine)
    model.setValue(lines.join('\n'))
  }, [])

  const deleteRow = useCallback((lineIdx: number) => {
    const model = getModel(); if (!model) return
    const lines = model.getValue().split('\n')
    if (lineIdx < 2 || lineIdx >= lines.length) return
    lines.splice(lineIdx, 1)
    model.setValue(lines.join('\n'))
  }, [])

  const tableOps: TableOps = { addColumn, deleteColumn, addRow, deleteRow }

  // ── Monaco options ────────────────────────────────────────────────────────

  const monacoOptions = {
    wordWrap:                   'on'   as const,
    minimap:                    { enabled: false },
    largeFileOptimizations:     true,
    automaticLayout:            true,
    contextmenu:                false,
    quickSuggestions:           false,
    suggestOnTriggerCharacters: true,
    wordBasedSuggestions:       'off'  as const,
    parameterHints:             { enabled: false },
    snippetSuggestions:         'none' as const,
  }

  // ── Preview with interactive tables ──────────────────────────────────────

  const previewContent = useMemo(() => {
    const segments = splitSegments(markdown)
    return (
      <div style={{ padding: 16, height, overflow: 'auto', border: '1px solid #eee', borderRadius: 8 }}>
        {segments.map((seg, idx) =>
          seg.type === 'text' ? (
            <ReactMarkdown key={idx} remarkPlugins={[remarkGfm]}>{seg.content}</ReactMarkdown>
          ) : (
            <InteractiveTable key={idx} tableLines={seg.lines} startLine={seg.startLine} ops={tableOps} />
          )
        )}
      </div>
    )
  }, [markdown, height, tableOps])

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

        <div style={{ display: 'flex', gap: 0 }}>
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
              {previewContent}
            </div>
          )}
        </div>
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
