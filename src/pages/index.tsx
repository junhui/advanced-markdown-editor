'use client'

import { useState } from 'react'
import AdvancedEditor from 'advanced-markdown-editor'

export default function Home() {
  const [content, setContent] = useState(`# Hello Markdown Editor

Try @jason.h or /Heading 2
`)

  return (
    <div style={{ padding: 24 }}>
      <h1>Advanced Markdown Editor Demo</h1>
      <AdvancedEditor value={content} onChange={setContent} format="markdown" height="600px" />
    </div>
  )
}
