import type { NextPage } from "next";
import Head from "next/head";
import { useCallback, useState } from "react";
import dynamic from "next/dynamic";

// Dynamically import the editor to avoid SSR issues with textarea refs
const AdvancedEditor = dynamic(
  () => import("@/components/AdvancedEditor"),
  { ssr: false }
);

const DEMO_CONTENT = `# Advanced Markdown Editor

Welcome! This is a **live preview** editor. Edit the left pane and see the result instantly on the right.

## Features

- Real-time preview
- Toolbar with formatting shortcuts
- Keyboard shortcuts: **Ctrl+B** (bold), **Ctrl+I** (italic), **Ctrl+K** (link)
- Table support
- Word & character count

## Code Example

\`\`\`ts
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Table Example

| Name    | Type    | Required |
| ------- | ------- | -------- |
| value   | string  | Yes      |
| onChange| function| No       |
| height  | string  | No       |

## Blockquote

> The best editor is the one that gets out of your way.

---

Start editing to try it out!
`;

const IndexPage: NextPage = () => {
  const [savedContent, setSavedContent] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleChange = useCallback((_value: string) => {
    // Content updates are handled live; persist via handleSave if needed
  }, []);

  const handleSave = useCallback(() => {
    const ta = document.querySelector<HTMLTextAreaElement>(".editor-textarea");
    if (ta) setSavedContent(ta.value);
  }, []);

  return (
    <>
      <Head>
        <title>Advanced Markdown Editor</title>
        <meta name="description" content="A high-performance markdown editor built with Next.js" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <header
          style={{
            padding: "10px 24px",
            background: "#1d4ed8",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
            Advanced Markdown Editor
          </h1>
          <button
            onClick={handleSave}
            style={{
              padding: "6px 16px",
              background: "#fff",
              color: "#1d4ed8",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Save snapshot
          </button>
        </header>

        {/* Editor */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <AdvancedEditor
            initialValue={DEMO_CONTENT}
            placeholder="Write your markdown here…"
            onChange={handleChange}
            height="100%"
          />
        </div>

        {/* Saved snapshot banner */}
        {savedContent !== null && (
          <div
            style={{
              padding: "8px 24px",
              background: "#dcfce7",
              color: "#166534",
              fontSize: 13,
              borderTop: "1px solid #bbf7d0",
            }}
          >
            Snapshot saved — {savedContent.length} characters stored in state.
          </div>
        )}
      </main>
    </>
  );
};

export default IndexPage;
