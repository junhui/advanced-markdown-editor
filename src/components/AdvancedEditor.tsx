'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import MonacoEditor from '@monaco-editor/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export const mentionList = ['jason.h', 'alice', 'bob', 'charlie', 'eve', 'david']
export const slashCommands = [
  { label: 'Heading 1',  insert: '# '                                                              },
  { label: 'Heading 2',  insert: '## '                                                             },
  { label: 'Heading 3',  insert: '### '                                                            },
  { label: 'Bold',       insert: '**bold**'                                                        },
  { label: 'Italic',     insert: '*italic*'                                                        },
  { label: 'Code block', insert: '```\n\n```'                                                      },
  { label: 'Table',      insert: '| Header1 | Header2 |\n|---------|---------|\n|         |         |\n' },
]

type Mode = 'edit' | 'preview' | 'both'

export interface EditorProps {
  value: string
  onChange: (val: string) => void
  format: 'markdown' | 'other'
  height?: string
}

export default function AdvancedEditor({ value, onChange, format, height = '500px' }: EditorProps) {
  const [markdown, setMarkdown]           = useState(value)
  const [mode, setMode]                   = useState<Mode>('both')
  const [hoveredHeader, setHoveredHeader] = useState<number | null>(null)
  const [hoveredRow, setHoveredRow]       = useState<number | null>(null)
  const [colWidths, setColWidths]         = useState<number[]>([])
  const [editingCell, setEditingCell]     = useState<{ row: number; col: number } | null>(null)
  const [cellValue, setCellValue]         = useState('')

  const monacoRef  = useRef<any>(null)
  const disposable = useRef<any>(null)

  useEffect(() => setMarkdown(value), [value])
  useEffect(() => () => disposable.current?.dispose(), [])

  // Initialize column widths whenever markdown changes
  useEffect(() => {
    if (format !== 'markdown') return
    const lines = monacoRef.current?.getModel()?.getValue().split('\n') || markdown.split('\n')
    const firstTableLine = lines.find((l: string) => l.includes('|'))
    if (firstTableLine) {
      const cols = firstTableLine.split('|').length - 2
      setColWidths((prev) => (prev.length === cols ? prev : Array(cols).fill(100)))
    }
  }, [format, markdown])

  const handleEditorChange = (val?: string) => {
    const v = val || ''
    if (format === 'markdown') setMarkdown(v)
    onChange(v)
  }

  // Paste image → Base64 inline
  const handlePaste = (e: React.ClipboardEvent) => {
    if (format !== 'markdown') return
    const items = e.clipboardData.items
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (!file) continue
        const reader = new FileReader()
        reader.onload = () => {
          const editor = monacoRef.current
          if (!editor) return
          const selection = editor.getSelection()!
          editor.executeEdits('', [
            { range: selection, text: `![pasted_image](${reader.result})`, forceMoveMarkers: true },
          ])
        }
        reader.readAsDataURL(file)
        e.preventDefault()
        break
      }
    }
  }

  const handleEditorMount = (editor: any, monaco: any) => {
    monacoRef.current = editor

    // Custom completion provider for @ and / — all default suggestions disabled
    disposable.current = monaco.languages.registerCompletionItemProvider('markdown', {
      triggerCharacters: ['@', '/'],
      provideCompletionItems: (model: any, position: any) => {
        const lineBefore = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        })

        // @mention → inserts <mention:name>
        const mentionMatch = lineBefore.match(/@([\w.]*)$/)
        if (mentionMatch) {
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - mentionMatch[0].length,
            endColumn: position.column,
          }
          return {
            suggestions: mentionList
              .filter(m => m.toLowerCase().startsWith(mentionMatch[1].toLowerCase()))
              .map(m => ({
                label: `@${m}`,
                kind: monaco.languages.CompletionItemKind.User,
                insertText: `<mention:${m}> `,
                range,
              })),
          }
        }

        // /slash command
        const slashMatch = lineBefore.match(/\/([\w]*)$/)
        if (slashMatch) {
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - slashMatch[0].length,
            endColumn: position.column,
          }
          return {
            suggestions: slashCommands
              .filter(c => c.label.toLowerCase().includes(slashMatch[1].toLowerCase()))
              .map(c => ({
                label: c.label,
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: c.insert,
                range,
              })),
          }
        }

        return { suggestions: [] }
      },
    })

    // Monaco markdown mode doesn't reliably fire triggerCharacters for '/'.
    // Manually trigger the suggest widget when '/' is typed.
    editor.onDidChangeModelContent((e: any) => {
      if (e.changes[0]?.text === '/') {
        setTimeout(() => editor.trigger('keyboard', 'editor.action.triggerSuggest', {}), 50)
      }
    })
  }

  // ── Table operations ──────────────────────────────────────────────────────

  const getModel = () => monacoRef.current?.getModel()

  const addColumn = (colIndex: number) => {
    const model = getModel(); if (!model) return
    const newLines = model.getValue().split('\n').map((line: string) => {
      if (!line.includes('|')) return line
      const cells = line.split('|')
      cells.splice(colIndex + 1, 0, ' ')
      return cells.join('|')
    })
    model.setValue(newLines.join('\n'))
  }

  const deleteColumn = (colIndex: number) => {
    const model = getModel(); if (!model) return
    const newLines = model.getValue().split('\n').map((line: string) => {
      if (!line.includes('|')) return line
      const cells = line.split('|')
      if (cells.length > 2) cells.splice(colIndex + 1, 1)
      return cells.join('|')
    })
    model.setValue(newLines.join('\n'))
  }

  const addRow = (rowIndex: number) => {
    const model = getModel(); if (!model) return
    const lines = model.getValue().split('\n')
    if (rowIndex >= lines.length || !lines[rowIndex].includes('|')) return
    const newLine = '| ' + lines[rowIndex].split('|').slice(1, -1).map(() => ' ').join(' | ') + ' |'
    lines.splice(rowIndex + 1, 0, newLine)
    model.setValue(lines.join('\n'))
  }

  const deleteRow = (rowIndex: number) => {
    const model = getModel(); if (!model) return
    const lines = model.getValue().split('\n')
    if (rowIndex < 2 || rowIndex >= lines.length) return
    lines.splice(rowIndex, 1)
    model.setValue(lines.join('\n'))
  }

  const startDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault()
    const startX     = e.clientX
    const startWidth = colWidths[index]
    const onMouseMove = (ev: MouseEvent) => {
      setColWidths(prev => {
        const w = [...prev]
        w[index] = Math.max(50, startWidth + ev.clientX - startX)
        return w
      })
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const handleCellClick = (row: number, col: number, val: string) => {
    setEditingCell({ row, col })
    setCellValue(val)
  }

  const saveCellValue = () => {
    if (!editingCell) return
    const model = getModel(); if (!model) return
    const lines = model.getValue().split('\n')
    const cells = lines[editingCell.row].split('|')
    cells[editingCell.col + 1] = cellValue
    lines[editingCell.row] = cells.join('|')
    model.setValue(lines.join('\n'))
    setEditingCell(null)
  }

  // ── Monaco editor options ─────────────────────────────────────────────────

  const monacoOptions = {
    wordWrap:                   'on' as const,
    minimap:                    { enabled: false },
    largeFileOptimizations:     true,
    automaticLayout:            true,
    contextmenu:                false,       // disable right-click menu
    quickSuggestions:           false,       // disable default suggestions
    suggestOnTriggerCharacters: true,        // keep @ and / triggers
    wordBasedSuggestions:       'off' as const,
    parameterHints:             { enabled: false },
    snippetSuggestions:         'none' as const,
  }

  // Memoize preview to avoid re-rendering on every keystroke
  const previewPane = useMemo(() => (
    <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 8, minHeight: 150, overflow: 'auto', height }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  ), [markdown, height])

  // ── Render ────────────────────────────────────────────────────────────────

  if (format === 'markdown') {
    const lines  = markdown.split('\n')
    const isBoth = mode === 'both'

    return (
      <div style={{ padding: 16 }}>
        {/* Mode switcher */}
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => setMode('edit')}>Edit</button>
          <button onClick={() => setMode('preview')}>Preview</button>
          <button onClick={() => setMode('both')}>Both</button>
        </div>

        <div style={{ display: 'flex', gap: 0 }}>
          {/* ── Edit pane ── */}
          {(mode === 'edit' || isBoth) && (
            <div style={{ width: isBoth ? '50%' : '100%', flexShrink: 0, position: 'relative' }} onPaste={handlePaste}>
              <MonacoEditor
                height={height}
                width="100%"
                defaultLanguage="markdown"
                value={markdown}
                onChange={handleEditorChange}
                onMount={handleEditorMount}
                options={monacoOptions}
              />

              {/* Column resize handles */}
              {colWidths.map((w, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute', top: 0, height: '100%',
                    left: colWidths.slice(0, i).reduce((a, b) => a + b, 0),
                    width: w, borderRight: '2px solid #ddd',
                    cursor: 'col-resize', zIndex: 60,
                  }}
                  onMouseDown={(e) => startDrag(i, e)}
                />
              ))}

              {/* Cell overlays — hover tooltips + inline editing */}
              {lines.map((line, rowIndex) => {
                if (!line.includes('|')) return null
                const cells = line.split('|').slice(1, -1)
                return cells.map((cell, colIndex) => {
                  const isHeader  = rowIndex === 0
                  const left      = colWidths.slice(0, colIndex).reduce((a, b) => a + b, 0)
                  const top       = rowIndex * 24
                  const width     = colWidths[colIndex] || 100
                  const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex

                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      style={{ position: 'absolute', top, left, width, height: 24, border: '1px solid transparent', cursor: 'text' }}
                      onMouseEnter={() => { isHeader ? setHoveredHeader(colIndex) : colIndex === 0 && setHoveredRow(rowIndex) }}
                      onMouseLeave={() => { isHeader ? setHoveredHeader(null)    : colIndex === 0 && setHoveredRow(null) }}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          style={{ width: '100%', height: '100%', padding: 0, margin: 0, border: '1px solid #333' }}
                          value={cellValue}
                          onChange={(e) => setCellValue(e.target.value)}
                          onBlur={saveCellValue}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') saveCellValue() }}
                        />
                      ) : (
                        <span onClick={() => handleCellClick(rowIndex, colIndex, cell)}>{cell}</span>
                      )}

                      {/* Header tooltip + add/remove column buttons */}
                      {hoveredHeader === colIndex && isHeader && (
                        <div>
                          <div style={{ position: 'absolute', top: -36, left: 0, background: '#333', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 12, whiteSpace: 'nowrap', zIndex: 100 }}>
                            + Add Column | - Remove Column | Double-click to rename
                          </div>
                          <div style={{ position: 'absolute', top: -24, left: 0, display: 'flex', gap: 4 }}>
                            <button onClick={() => addColumn(colIndex)}>+</button>
                            <button onClick={() => deleteColumn(colIndex)}>-</button>
                          </div>
                        </div>
                      )}

                      {/* Row tooltip + add/remove row buttons */}
                      {hoveredRow === rowIndex && colIndex === 0 && (
                        <div>
                          <div style={{ position: 'absolute', top: -36, left: 0, background: '#333', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 12, whiteSpace: 'nowrap', zIndex: 100 }}>
                            + Add Row | - Remove Row
                          </div>
                          <div style={{ position: 'absolute', top: -24, left: 0, display: 'flex', gap: 4 }}>
                            <button onClick={() => addRow(rowIndex)}>+</button>
                            <button onClick={() => deleteRow(rowIndex)}>-</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              })}
            </div>
          )}

          {/* ── Preview pane ── */}
          {(mode === 'preview' || isBoth) && (
            <div style={{ width: isBoth ? '50%' : '100%', flexShrink: 0 }}>
              {previewPane}
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
  const [content, setContent] = useState<string>(
`# Markdown Demo

Hello @jason.h, try /Heading 2

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
        <h2>Raw Markdown Content:</h2>
        <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, maxHeight: 300, overflow: 'auto' }}>
          {content}
        </pre>
      </div>

      <div style={{ marginTop: 24 }}>
        <h2>Available @mentions:</h2>
        <p>{mentionList.join(', ')}</p>
        <h2>Available /slash commands:</h2>
        <ul>
          {slashCommands.map((cmd) => (
            <li key={cmd.label}>
              <strong>{cmd.label}</strong>: {cmd.insert.replace(/\n/g, '\\n')}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
