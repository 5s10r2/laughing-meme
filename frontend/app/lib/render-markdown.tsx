import React from "react";

/**
 * Lightweight inline-markdown renderer for chat text parts.
 *
 * Handles:
 *  - **bold**  →  <strong>
 *  - *italic*  →  <em>
 *  - `code`    →  <code>
 *  - [text](url) → <a>
 *  - Newlines are preserved via whitespace-pre-wrap on the parent.
 *
 * Does NOT handle block-level elements (headings, lists, tables).
 * Use a full markdown library if those are ever needed.
 */
export function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Regex: bold (**…**), italic (*…*), inline code (`…`), links ([…](…))
  // Order matters — bold before italic so ** is matched first
  const pattern =
    /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[([^\]]+)\]\(([^)]+)\))/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    // Push plain text before this match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // Bold: **text**
      nodes.push(
        <strong key={key++} className="font-semibold text-zinc-50">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // Italic: *text*
      nodes.push(
        <em key={key++} className="italic text-zinc-200">
          {match[4]}
        </em>
      );
    } else if (match[5]) {
      // Inline code: `text`
      nodes.push(
        <code
          key={key++}
          className="px-1 py-0.5 rounded bg-zinc-800 text-amber-300/80 text-[13px] font-mono"
        >
          {match[6]}
        </code>
      );
    } else if (match[7]) {
      // Link: [text](url)
      nodes.push(
        <a
          key={key++}
          href={match[9]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
        >
          {match[8]}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Push remaining plain text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
