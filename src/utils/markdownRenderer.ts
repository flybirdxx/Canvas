/**
 * Minimal Markdown-to-HTML renderer for text node display.
 * No external dependencies — handles the most common formatting patterns
 * that LLMs produce: headings, bold, italic, inline code, code blocks,
 * and line breaks.
 */
export function renderMarkdown(md: string): string {
  if (!md) return '';

  // Phase 1: extract and protect code blocks
  const codeBlocks: string[] = [];
  let processed = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_full, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<pre style="background:var(--bg-1);border-radius:6px;padding:10px;overflow-x:auto;font-size:0.875em;line-height:1.5;margin:8px 0;"><code>${escapeHtml(code.trimEnd())}</code></pre>`,
    );
    return `\x00CODEBLOCK${idx}\x00`;
  });

  // Phase 2: inline formatting (order matters — bold before italic)
  // Bold: **text**
  processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text* (but not inside words)
  processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code: `code`
  processed = processed.replace(/`([^`]+)`/g, '<code style="background:var(--bg-1);padding:1px 5px;border-radius:3px;font-size:0.9em;">$1</code>');

  // Phase 3: headings (must be at line start)
  processed = processed.replace(/^### (.+)$/gm, '<h4 style="margin:8px 0 4px;font-size:1em;font-weight:600;">$1</h4>');
  processed = processed.replace(/^## (.+)$/gm, '<h3 style="margin:10px 0 4px;font-size:1.1em;font-weight:700;">$1</h3>');
  processed = processed.replace(/^# (.+)$/gm, '<h2 style="margin:12px 0 6px;font-size:1.2em;font-weight:800;">$1</h2>');

  // Phase 4: horizontal rules
  processed = processed.replace(/^(---|\*\*\*)$/gm, '<hr style="border:none;border-top:1px solid var(--line-1);margin:10px 0;">');

  // Phase 5: paragraphs — split on double-newline, wrap in <p>
  const paragraphs = processed.split(/\n\n+/);
  processed = paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      // Don't wrap block-level elements (headings, hrs, pre/code blocks)
      if (
        /^<(h[2-4]|hr|pre|div|blockquote|ul|ol|li|table)/.test(trimmed) ||
        /^\x00CODEBLOCK\d+\x00$/.test(trimmed)
      ) {
        return trimmed;
      }
      // Single newlines become <br>
      const withBreaks = trimmed.replace(/\n/g, '<br>');
      return `<p style="margin:0 0 6px;">${withBreaks}</p>`;
    })
    .join('\n');

  // Phase 6: restore code blocks
  processed = processed.replace(/\x00CODEBLOCK(\d+)\x00/g, (_full, idx) => {
    return codeBlocks[Number(idx)] ?? '';
  });

  return processed;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
