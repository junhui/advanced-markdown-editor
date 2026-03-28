import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
  memo,
  useEffect,
} from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdvancedEditorProps {
  /** Initial markdown content */
  initialValue?: string;
  /** Placeholder shown in the write pane */
  placeholder?: string;
  /** Called whenever the content changes */
  onChange?: (value: string) => void;
  /** Height of the editor container (CSS value) */
  height?: string;
}

interface ToolbarAction {
  label: string;
  title: string;
  prefix: string;
  suffix: string;
  block?: boolean;
}

// ─── Toolbar Configuration ────────────────────────────────────────────────────

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { label: "B",  title: "Bold",          prefix: "**", suffix: "**" },
  { label: "I",  title: "Italic",        prefix: "_",  suffix: "_"  },
  { label: "S",  title: "Strikethrough", prefix: "~~", suffix: "~~" },
  { label: "`",  title: "Inline code",   prefix: "`",  suffix: "`"  },
];

const BLOCK_ACTIONS = [
  { label: "H1", title: "Heading 1",   prefix: "# ",   suffix: "" },
  { label: "H2", title: "Heading 2",   prefix: "## ",  suffix: "" },
  { label: "H3", title: "Heading 3",   prefix: "### ", suffix: "" },
  { label: ">",  title: "Blockquote",  prefix: "> ",   suffix: "" },
  { label: "—",  title: "Divider",     prefix: "\n---\n", suffix: "" },
];

// ─── Minimal Markdown → HTML Parser ──────────────────────────────────────────
// Handles: headings, bold, italic, strikethrough, inline code, code blocks,
// blockquotes, ordered / unordered lists, tables, horizontal rules, links,
// images, and paragraphs.

function parseMarkdown(md: string): string {
  if (!md.trim()) return "";

  let html = md;

  // Fenced code blocks
  html = html.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_m, _lang, code) =>
      `<pre><code>${escapeHtml(code.trim())}</code></pre>`
  );

  // Tables
  html = html.replace(
    /^\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/gm,
    (_m, header, body) => {
      const ths = header
        .split("|")
        .filter(Boolean)
        .map((c: string) => `<th>${c.trim()}</th>`)
        .join("");
      const rows = body
        .trim()
        .split("\n")
        .map((row: string) => {
          const tds = row
            .split("|")
            .filter(Boolean)
            .map((c: string) => `<td>${c.trim()}</td>`)
            .join("");
          return `<tr>${tds}</tr>`;
        })
        .join("");
      return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
    }
  );

  // Headings
  html = html.replace(/^###### (.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^##### (.+)$/gm,  "<h5>$1</h5>");
  html = html.replace(/^#### (.+)$/gm,   "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm,    "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm,     "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm,      "<h1>$1</h1>");

  // Horizontal rules
  html = html.replace(/^[-*_]{3,}\s*$/gm, "<hr />");

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

  // Unordered lists
  html = html.replace(/((?:^[-*+] .+\n?)+)/gm, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((l) => `<li>${l.replace(/^[-*+] /, "")}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((l) => `<li>${l.replace(/^\d+\. /, "")}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  });

  // Inline styles
  html = html.replace(/\*\*(.+?)\*\*/g,  "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g,       "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g,       "<em>$1</em>");
  html = html.replace(/_(.+?)_/g,         "<em>$1</em>");
  html = html.replace(/~~(.+?)~~/g,       "<del>$1</del>");
  html = html.replace(/`(.+?)`/g,         "<code>$1</code>");

  // Images (must come before links)
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" style="max-width:100%" />'
  );

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Paragraphs — wrap lines that aren't already block-level tags
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<(h[1-6]|ul|ol|li|pre|blockquote|table|hr|img)/.test(trimmed))
        return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");

  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

const Tooltip = memo(({ title, children }: { title: string; children: React.ReactNode }) => (
  <span className="tooltip-wrapper">
    {children}
    <span className="tooltip-content">{title}</span>
  </span>
));
Tooltip.displayName = "Tooltip";

// ─── Toolbar ─────────────────────────────────────────────────────────────────

interface ToolbarProps {
  onAction: (prefix: string, suffix: string, block?: boolean) => void;
  onInsertTable: () => void;
  onInsertLink: () => void;
}

const Toolbar = memo(({ onAction, onInsertTable, onInsertLink }: ToolbarProps) => (
  <div className="editor-toolbar">
    {TOOLBAR_ACTIONS.map((a) => (
      <Tooltip key={a.label} title={a.title}>
        <button
          className="toolbar-btn"
          onMouseDown={(e) => {
            e.preventDefault();
            onAction(a.prefix, a.suffix);
          }}
        >
          {a.label}
        </button>
      </Tooltip>
    ))}

    <div className="toolbar-divider" />

    {BLOCK_ACTIONS.map((a) => (
      <Tooltip key={a.label} title={a.title}>
        <button
          className="toolbar-btn"
          onMouseDown={(e) => {
            e.preventDefault();
            onAction(a.prefix, a.suffix, true);
          }}
        >
          {a.label}
        </button>
      </Tooltip>
    ))}

    <div className="toolbar-divider" />

    <Tooltip title="Insert link">
      <button className="toolbar-btn" onMouseDown={(e) => { e.preventDefault(); onInsertLink(); }}>
        🔗
      </button>
    </Tooltip>

    <Tooltip title="Insert table">
      <button className="toolbar-btn" onMouseDown={(e) => { e.preventDefault(); onInsertTable(); }}>
        ⊞
      </button>
    </Tooltip>
  </div>
));
Toolbar.displayName = "Toolbar";

// ─── Preview ─────────────────────────────────────────────────────────────────

const Preview = memo(({ html }: { html: string }) => (
  <div
    className="editor-preview"
    // Safe: html is generated by our own parseMarkdown() — no user-supplied raw HTML
    dangerouslySetInnerHTML={{ __html: html || "<p style='color:#bbb'>Nothing to preview yet…</p>" }}
  />
));
Preview.displayName = "Preview";

// ─── Main Component ───────────────────────────────────────────────────────────

export const AdvancedEditor = memo(function AdvancedEditor({
  initialValue = "",
  placeholder = "Write your markdown here…",
  onChange,
  height = "100vh",
}: AdvancedEditorProps) {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Word / character counts
  const stats = useMemo(() => {
    const chars = value.length;
    const words = value.trim() ? value.trim().split(/\s+/).length : 0;
    return { chars, words };
  }, [value]);

  // Parsed HTML — only recomputed when value changes
  const previewHtml = useMemo(() => parseMarkdown(value), [value]);

  // Notify parent
  useEffect(() => {
    onChange?.(value);
  }, [value, onChange]);

  // ── Handlers ──

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
    },
    []
  );

  /** Wrap current selection with prefix/suffix, or insert at cursor */
  const handleToolbarAction = useCallback(
    (prefix: string, suffix: string, block = false) => {
      const ta = textareaRef.current;
      if (!ta) return;

      const { selectionStart: start, selectionEnd: end, value: v } = ta;
      const selected = v.slice(start, end);

      let inserted: string;
      let cursorOffset: number;

      if (block) {
        inserted = `${prefix}${selected}${suffix}`;
        cursorOffset = prefix.length;
      } else {
        inserted = `${prefix}${selected}${suffix}`;
        cursorOffset = prefix.length;
      }

      const next = v.slice(0, start) + inserted + v.slice(end);
      setValue(next);

      // Restore focus and selection after state update
      requestAnimationFrame(() => {
        ta.focus();
        const newCursor = selected
          ? start + inserted.length
          : start + cursorOffset;
        ta.setSelectionRange(newCursor, newCursor);
      });
    },
    []
  );

  const handleInsertTable = useCallback(() => {
    const template =
      "\n| Column 1 | Column 2 | Column 3 |\n| -------- | -------- | -------- |\n| Cell     | Cell     | Cell     |\n";
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, value: v } = ta;
    const next = v.slice(0, start) + template + v.slice(start);
    setValue(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + template.length, start + template.length);
    });
  }, []);

  const handleInsertLink = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value: v } = ta;
    const selected = v.slice(start, end) || "link text";
    const snippet = `[${selected}](https://example.com)`;
    const next = v.slice(0, start) + snippet + v.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  }, []);

  // ── Keyboard shortcuts (Ctrl/Cmd + B / I / K) ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      if (e.key === "b") {
        e.preventDefault();
        handleToolbarAction("**", "**");
      } else if (e.key === "i") {
        e.preventDefault();
        handleToolbarAction("_", "_");
      } else if (e.key === "k") {
        e.preventDefault();
        handleInsertLink();
      }
    },
    [handleToolbarAction, handleInsertLink]
  );

  return (
    <div className="editor-container" style={{ height }}>
      <Toolbar
        onAction={handleToolbarAction}
        onInsertTable={handleInsertTable}
        onInsertLink={handleInsertLink}
      />

      <div className="editor-body">
        {/* Write pane */}
        <div className="editor-write-pane">
          <div className="editor-pane-label">Markdown</div>
          <textarea
            ref={textareaRef}
            className="editor-textarea"
            value={value}
            placeholder={placeholder}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            spellCheck={false}
          />
        </div>

        {/* Preview pane */}
        <div className="editor-preview-pane">
          <div className="editor-pane-label">Preview</div>
          <Preview html={previewHtml} />
        </div>
      </div>

      <div className="editor-statusbar">
        <span>{stats.words} words</span>
        <span>{stats.chars} characters</span>
      </div>
    </div>
  );
});

export default AdvancedEditor;
