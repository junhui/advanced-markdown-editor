# Advanced Markdown Editor (React)

A **Markdown-first, feature-rich React editor**, optimized for **large Markdown files and tables**, with:

- Markdown editing with live preview
- Monaco Editor fallback for non-Markdown formats
- @mention suggestions
- /slash commands
- Table editing (rows, columns, headers)
- Paste images (Base64, no size restriction)
- Performance optimizations for big files
- Dual mode: Edit / Preview / Both

---

## Features

| Feature                       | Description |
|-------------------------------|-------------|
| Markdown Editing               | Full Markdown support including tables, headings, code blocks |
| Live Preview                   | Render Markdown in real-time alongside editor |
| @mention                       | Type `@` to trigger suggestion dropdown |
| /slash Commands                | Type `/` to insert headings, bold, italics, tables, etc. |
| Table Editing                  | Add/delete rows and columns, resize columns, edit cells inline |
| Paste Images                   | Automatically convert to Base64, no size restriction |
| Large File Optimization        | Memoized preview + Monaco `largeFileOptimizations` |
| Non-Markdown Formats           | Fallback to Monaco Editor for JS, JSON, etc. |
| Tooltip Hints                  | Hover table headers/rows to show operation shortcuts |
| Modes                          | Edit / Preview / Both |

---

## Installation

```bash
npm install @junhuih/advanced-markdown-editor
```

Dependencies:
- `@monaco-editor/react`
- `react-markdown`
- `remark-gfm`
- `react-window` (optional, table virtualization)

---

## Usage

```tsx
import { useState } from 'react'
import { AdvancedEditor } from '@junhuih/advanced-markdown-editor'

export default function App() {
  const [content, setContent] = useState('# Hello Advanced Markdown Editor\nTry @jason.h or /Heading 2')

  return (
    <div style={{ padding: 24 }}>
      <AdvancedEditor value={content} onChange={setContent} format="markdown" height="600px" />
    </div>
  )
}
```

- `format="markdown"` → Markdown-first mode
- `format="other"` → Monaco fallback for other formats

---

## Modes

- **Edit** → Markdown editing only
- **Preview** → Markdown preview only
- **Both** → Split-screen edit + preview

---

## Performance Optimization

Large files and tables handled using:
- Monaco `largeFileOptimizations`
- `useMemo` for Markdown preview
- Ready for table virtualization using `react-window`
- Paste images unrestricted via Base64
- Optimized event handling for @mention and /slash suggestions

---

## Limitations

- Desktop-focused (not optimized for mobile)
- Very large Base64 images may increase document size
- Single-user only (no collaborative editing)
- Markdown-first, not fully WYSIWYG
- Table virtualization optional; recommended for extremely large tables

---

## GitHub Actions: Auto Build & Publish

This project includes an automatic npm publish workflow:
- Workflow path: `.github/workflows/publish.yml`
- Trigger: push to `main` branch
- Steps:
  1. Checkout repository
  2. Setup Node.js
  3. Install dependencies
  4. Build TypeScript (`tsc --declaration --outDir dist`)
  5. Publish to npm using `NODE_AUTH_TOKEN` (stored as GitHub Secret)

Every push to `main` automatically updates the npm package.

---

## License

MIT License
