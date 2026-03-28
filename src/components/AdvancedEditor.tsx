'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import MonacoEditor from '@monaco-editor/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const mentionList = ['jason.h', 'alice', 'bob', 'charlie', 'eve', 'david']
const slashCommands = [
  { label: 'Heading 1', insert: '# ' },
  { label: 'Heading 2', insert: '## ' },
  { label: 'Bold', insert: '**bold**' },
  { label: 'Italic', insert: '*italic*' },
  { label: 'Code block', insert: '```\n\n```' },
  { label: 'Table', insert: '| Name | Age |\n|------|-----|\n|      |     |\n' },
]

interface EditorProps {
  value: string
  onChange: (val: string) => void
  format: 'markdown' | 'other'
  height?: string
}

export default function AdvancedEditor({ value, onChange, format, height = '500px' }: EditorProps) {
  const [markdown, setMarkdown] = useState(value)
  const [mode, setMode] = useState<'edit' | 'preview' | 'both'>('both')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [slashList, setSlashList] = useState<typeof slashCommands>([])
  const monacoRef = useRef<any>(null)

  useEffect(() => setMarkdown(value), [value])

  const handleEditorChange = (val?: string) => {
    const v = val || ''
    if (format === 'markdown') setMarkdown(v)
    onChange(v)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (format !== 'markdown') return
    const editor = monacoRef.current
    if (!editor) return
    const model = editor.getModel()
    const selection = editor.getSelection()
    if (!model || !selection) return
    const cursorPos = model.getOffsetAt(selection.getStartPosition())
    const textBefore = model.getValue().slice(0, cursorPos)

    // @mention
    const mentionMatch = textBefore.match(/@([\w.]*)$/)
    if (mentionMatch) {
      const keyword = mentionMatch[1]
      setSuggestions(mentionList.filter((m) => m.toLowerCase().startsWith(keyword.toLowerCase())))
      setSlashList([])
      return
    }

    // /slash
    const slashMatch = textBefore.match(/\/([\w]*)$/)
    if (slashMatch) {
      const keyword = slashMatch[1].toLowerCase()
      setSlashList(slashCommands.filter((c) => c.label.toLowerCase().includes(keyword)))
      setSuggestions([])
      return
    }

    setSuggestions([])
    setSlashList([])
  }

  const previewPane = useMemo(() => {
    return (
      <div
        style={{
          flex: 1,
          padding: 16,
          border: '1px solid #eee',
          borderRadius: 8,
          minHeight: 150,
          overflow: 'auto',
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    )
  }, [markdown])

  if (format === 'markdown') {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => setMode('edit')}>Edit</button>
          <button onClick={() => setMode('preview')}>Preview</button>
          <button onClick={() => setMode('both')}>Both</button>
        </div>

        <div style={{ display: 'flex', gap: 12, flexDirection: mode === 'both' ? 'row' : 'column' }}>
          {(mode === 'edit' || mode === 'both') && (
            <MonacoEditor
              height={height}
              defaultLanguage="markdown"
              value={markdown}
              onChange={handleEditorChange}
              onMount={(editor) => (monacoRef.current = editor)}
              onKeyDown={handleKeyDown}
              options={{
                wordWrap: 'on',
                minimap: { enabled: false },
                largeFileOptimizations: true,
                automaticLayout: true,
              }}
            />
          )}

          {(mode === 'preview' || mode === 'both') && previewPane}
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
      options={{ wordWrap: 'on', minimap: { enabled: false }, largeFileOptimizations: true }}
    />
  )
}
