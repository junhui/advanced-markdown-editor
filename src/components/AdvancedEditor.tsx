'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import MonacoEditor from '@monaco-editor/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const mentionList = ['jason.h', 'alice', 'bob', 'charlie', 'eve', 'david']
const slashCommands = [
  { label: 'Heading 1',  insert: '# '                                       },
  { label: 'Heading 2',  insert: '## '                                      },
  { label: 'Bold',       insert: '**bold**'                                 },
  { label: 'Italic',     insert: '*italic*'                                 },
  { label: 'Code block', insert: '```\n\n```'                               },
  { label: 'Table',      insert: '| Name | Age |\n|------|-----|\n|      |     |\n' },
]

export interface EditorProps {
  value: string
  onChange: (val: string) => void
  format: 'markdown' | 'other'
  height?: string
}

export default function AdvancedEditor({ value, onChange, format, height = '500px' }: EditorProps) {
  const [markdown, setMarkdown] = useState(value)
  const [mode, setMode] = useState<'edit' | 'preview' | 'both'>('both')
  const monacoRef   = useRef<any>(null)
  const disposable  = useRef<any>(null)

  useEffect(() => setMarkdown(value), [value])

  // Dispose completion provider on unmount
  useEffect(() => () => disposable.current?.dispose(), [])

  const handleEditorChange = (val?: string) => {
    const v = val || ''
    if (format === 'markdown') setMarkdown(v)
    onChange(v)
  }

  const handleEditorMount = (editor: any, monaco: any) => {
    monacoRef.current = editor

    // Register @ and / completion provider — replaces default suggestions
    disposable.current = monaco.languages.registerCompletionItemProvider('markdown', {
      triggerCharacters: ['@', '/'],
      provideCompletionItems: (model: any, position: any) => {
        const lineBefore = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        })

        // @mention
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
                insertText: `@${m} `,
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
  }

  const monacoOptions = {
    wordWrap: 'on'                as const,
    minimap:               { enabled: false },
    largeFileOptimizations: true,
    automaticLayout:        true,
    // Disable right-click context menu
    contextmenu:            false,
    // Disable all default suggestions; only @ and / trigger completions
    quickSuggestions:       false,
    suggestOnTriggerCharacters: true,
    wordBasedSuggestions:   'off' as const,
    parameterHints:        { enabled: false },
    snippetSuggestions:     'none' as const,
  }

  const previewHtml = useMemo(() => (
    <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 8, overflow: 'auto', height }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  ), [markdown, height])

  if (format === 'markdown') {
    const isBoth = mode === 'both'
    return (
      <div style={{ padding: 16 }}>
        {/* Mode switcher */}
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => setMode('edit')}>Edit</button>
          <button onClick={() => setMode('preview')}>Preview</button>
          <button onClick={() => setMode('both')}>Both</button>
        </div>

        {/* Editor + Preview panes */}
        <div style={{ display: 'flex', gap: 0 }}>
          {(mode === 'edit' || isBoth) && (
            <div style={{ width: isBoth ? '50%' : '100%', flexShrink: 0 }}>
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
              {previewHtml}
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
      options={{
        wordWrap: 'on',
        minimap: { enabled: false },
        largeFileOptimizations: true,
        contextmenu: false,
      }}
    />
  )
}
