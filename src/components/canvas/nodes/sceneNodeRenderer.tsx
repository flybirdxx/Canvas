/**
 * sceneNodeRenderer — OmniScript 风格行渲染器。
 *
 * 将 ScriptLine 渲染为富文本 JSX，支持：
 *   - 角色名加粗 + 颜色
 *   - 情绪 Emoji 标签
 *   - 完整 GFM Markdown（via react-markdown + remark-gfm）
 *   - 环境描述（blockquote）灰色斜体背景
 *   - 对白 / 动作 / 环境三种行类型视觉区分
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ScriptLine } from '@/types/canvas';

// ── Role color palette (deterministic by role name) ──────────────────

const ROLE_COLORS = [
  '#5B8DEF', // blue
  '#E85D75', // rose
  '#6ECB63', // green
  '#F5A623', // amber
  '#9254DE', // purple
  '#14B8A6', // teal
  '#F472B6', // pink
  '#6366F1', // indigo
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function roleColor(role: string): string {
  if (!role) return 'var(--ink-1)';
  return ROLE_COLORS[hashString(role) % ROLE_COLORS.length];
}

// ── react-markdown based renderer ────────────────────────────────────

/**
 * 使用 react-markdown 渲染 Markdown 文本（支持完整 GFM 规范）。
 * 覆写默认组件样式以匹配画布设计系统变量。
 */
export function MarkdownRenderer({ source, compact = false }: { source: string; compact?: boolean }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p style={{
            margin: compact ? '1px 0' : '2px 0',
            fontSize: compact ? 11.5 : 12,
            color: 'var(--ink-1)',
            lineHeight: 1.6,
          }}>
            {children}
          </p>
        ),
        strong: ({ children }) => (
          <strong style={{ fontWeight: 700, color: 'var(--ink-0)' }}>{children}</strong>
        ),
        em: ({ children }) => (
          <em style={{ fontStyle: 'italic', color: 'var(--ink-2)' }}>{children}</em>
        ),
        del: ({ children }) => (
          <del style={{ textDecoration: 'line-through', opacity: 0.6 }}>{children}</del>
        ),
        h1: ({ children }) => (
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-0)', lineHeight: 1.4, margin: '4px 0 2px' }}>
            {children}
          </div>
        ),
        h2: ({ children }) => (
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-0)', lineHeight: 1.4, margin: '3px 0 2px' }}>
            {children}
          </div>
        ),
        h3: ({ children }) => (
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-0)', lineHeight: 1.4, margin: '2px 0' }}>
            {children}
          </div>
        ),
        ul: ({ children }) => (
          <ul style={{ margin: '2px 0', paddingLeft: 16 }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ margin: '2px 0', paddingLeft: 16 }}>{children}</ol>
        ),
        li: ({ children }) => (
          <li style={{ fontSize: compact ? 11.5 : 12, color: 'var(--ink-1)', lineHeight: 1.5, marginBottom: 1 }}>
            {children}
          </li>
        ),
        blockquote: ({ children }) => (
          <div style={{
            fontSize: 11.5,
            color: 'var(--ink-2)',
            fontStyle: 'italic',
            lineHeight: 1.6,
            padding: '2px 8px',
            margin: '2px 0',
            background: 'color-mix(in srgb, var(--ink-3) 8%, transparent)',
            borderLeft: '2px solid var(--ink-3)',
            borderRadius: '0 var(--r-xs) var(--r-xs) 0',
          }}>
            {children}
          </div>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-');
          return isBlock ? (
            <pre style={{
              fontSize: 11,
              background: 'color-mix(in srgb, var(--ink-3) 10%, transparent)',
              borderRadius: 'var(--r-xs)',
              padding: '4px 8px',
              margin: '2px 0',
              overflowX: 'auto',
              fontFamily: 'ui-monospace, monospace',
            }}>
              <code>{children}</code>
            </pre>
          ) : (
            <code style={{
              fontSize: 11,
              background: 'color-mix(in srgb, var(--ink-3) 10%, transparent)',
              borderRadius: 3,
              padding: '0 3px',
              fontFamily: 'ui-monospace, monospace',
            }}>
              {children}
            </code>
          );
        },
        hr: () => (
          <hr style={{ border: 'none', borderTop: '1px solid var(--line-1)', margin: '4px 0' }} />
        ),
        a: ({ children, href }) => (
          <a href={href} style={{ color: 'var(--accent)', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {source}
    </ReactMarkdown>
  );
}

// ── Single line renderer ──────────────────────────────────────────────

interface RenderLineOptions {
  /** 是否显示行类型标签（精简模式可省略） */
  showTypeBadge?: boolean;
}

export function renderSceneLine(line: ScriptLine, opts: RenderLineOptions = {}): React.ReactNode {
  const { showTypeBadge = false } = opts;

  const isDialogue = line.lineType === 'dialogue';
  const isEnvironment = line.lineType === 'environment';

  // Blockquote marker detection (environment lines often use > prefix)
  const isBlockquote = line.content.startsWith('>');
  const displayContent = isBlockquote ? line.content.replace(/^>\s*/, '') : line.content;

  if (isEnvironment || isBlockquote) {
    // Environment / blockquote: gray italic background
    return (
      <div
        key={line.id}
        className="sl-env"
        style={{
          fontSize: 11.5,
          color: 'var(--ink-2)',
          fontStyle: 'italic',
          lineHeight: 1.6,
          padding: '3px 8px',
          margin: '1px 0',
          background: 'color-mix(in srgb, var(--ink-3) 8%, transparent)',
          borderLeft: '2px solid var(--ink-3)',
          borderRadius: '0 var(--r-xs) var(--r-xs) 0',
        }}
      >
        {showTypeBadge && (
          <span style={{ fontSize: 9, color: 'var(--ink-3)', marginRight: 6, fontWeight: 500 }}>
            🌤 环境
          </span>
        )}
        <MarkdownRenderer source={displayContent} compact />
      </div>
    );
  }

  if (isDialogue && line.role) {
    // Dialogue row: colored role + emotion emoji + markdown content
    return (
      <div
        key={line.id}
        className="sl-dialogue"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 6,
          fontSize: 12,
          lineHeight: 1.6,
          padding: '1px 0',
        }}
      >
        {showTypeBadge && (
          <span style={{ fontSize: 9, color: 'var(--ink-3)', flexShrink: 0, marginTop: 1 }}>💬</span>
        )}
        {line.emotionEmoji && (
          <span style={{ fontSize: 14, flexShrink: 0, opacity: 0.85 }} title={line.emotion}>
            {line.emotionEmoji}
          </span>
        )}
        <span
          style={{
            fontWeight: 700,
            color: roleColor(line.role),
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {line.role}
        </span>
        <span style={{ color: 'var(--ink-0)', flex: 1, minWidth: 0 }}>
          <MarkdownRenderer source={displayContent} compact />
        </span>
      </div>
    );
  }

  // Action or dialogue without role: plain text with markdown
  return (
    <div
      key={line.id}
      className="sl-action"
      style={{
        fontSize: 12,
        color: isDialogue ? 'var(--ink-0)' : 'var(--ink-1)',
        fontStyle: isDialogue ? 'normal' : 'italic',
        lineHeight: 1.6,
        padding: '1px 0',
      }}
    >
      {showTypeBadge && !isDialogue && (
        <span style={{ fontSize: 9, color: 'var(--ink-3)', marginRight: 6, fontWeight: 500 }}>
          🎬 动作
        </span>
      )}
      <MarkdownRenderer source={displayContent} compact />
    </div>
  );
}
