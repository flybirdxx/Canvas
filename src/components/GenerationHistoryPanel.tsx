import { useState } from 'react';
import { ImageIcon, Video, MapPin, X, Clock, History, ChevronDown } from 'lucide-react';
import { useGenerationHistoryStore, GenHistoryEntry } from '@/store/useGenerationHistoryStore';
import { useCanvasStore } from '@/store/useCanvasStore';

export function GenerationHistoryPanel() {
  const entries = useGenerationHistoryStore(s => s.entries);
  const removeEntry = useGenerationHistoryStore(s => s.removeEntry);
  const clearAll = useGenerationHistoryStore(s => s.clearAll);
  const setSelection = useCanvasStore(s => s.setSelection);
  const elements = useCanvasStore(s => s.elements);

  const [panelOpen, setPanelOpen] = useState(false);

  if (entries.length === 0) return null;

  return (
    <div
      className="z-30 pointer-events-auto select-none anim-fade-in"
      style={{
        position: 'absolute',
        bottom: 68,
        right: 200,
        width: panelOpen ? 280 : 'auto',
      }}
    >
      {/* Collapsed chip — just a hint */}
      {!panelOpen && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="chip-paper flex items-center gap-2 transition-colors"
          style={{
            padding: '6px 10px',
            boxShadow: 'var(--shadow-ink-2)',
            border: '1px solid var(--line-1)',
            borderRadius: 'var(--r-pill)',
            cursor: 'pointer',
            background: 'var(--bg-2)',
          }}
        >
          <History className="w-3.5 h-3.5" strokeWidth={1.8} style={{ color: 'var(--ink-2)' }} />
          <span className="serif" style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--ink-0)' }}>
            {entries.length} 条历史
          </span>
        </button>
      )}

      {/* Expanded panel */}
      {panelOpen && (
        <div
          className="chip-paper flex flex-col overflow-hidden"
          style={{ boxShadow: 'var(--shadow-ink-2)' }}
        >
          <div
            className="flex items-center justify-between"
            style={{ padding: '7px 12px', borderBottom: '1px solid var(--line-1)' }}
          >
            <span className="serif" style={{ fontSize: 12.5, fontWeight: 500 }}>
              生成历史
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={clearAll}
                className="btn btn-ghost"
                style={{ padding: '2px 6px', fontSize: 10 }}
              >
                清空
              </button>
              <button
                onClick={() => setPanelOpen(false)}
                className="btn btn-ghost btn-icon"
                style={{ width: 22, height: 22, padding: 0 }}
              >
                <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.6} />
              </button>
            </div>
          </div>
          <div className="paper-scroll overflow-y-auto flex-1 min-h-0" style={{ maxHeight: 220 }}>
            {entries.slice(0, 50).map((entry) => (
              <HistoryRow
                key={entry.id}
                entry={entry}
                onLocate={() => {
                  const live = elements.find(el => el.id === entry.elementId);
                  if (live) setSelection([entry.elementId]);
                }}
                onRemove={() => removeEntry(entry.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryRow({
  entry,
  onLocate,
  onRemove,
}: {
  entry: GenHistoryEntry;
  onLocate: () => void;
  onRemove: () => void;
}) {
  const timeStr = new Date(entry.createdAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const promptShort = entry.prompt
    ? entry.prompt.slice(0, 40) + (entry.prompt.length > 40 ? '…' : '')
    : '(空)';

  return (
    <div
      className="flex items-center gap-2 hairline-b"
      style={{ padding: '6px 10px', cursor: 'default' }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          overflow: 'hidden',
          background: 'var(--bg-3)',
          flexShrink: 0,
        }}
      >
        <img
          src={entry.thumbnailUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1" style={{ fontSize: 10, color: 'var(--ink-2)' }}>
          {entry.modality === 'video' ? (
            <Video className="w-2.5 h-2.5" />
          ) : (
            <ImageIcon className="w-2.5 h-2.5" />
          )}
          <span className="mono truncate" style={{ maxWidth: 80 }}>{entry.model || '—'}</span>
          <span>·</span>
          <Clock className="w-2.5 h-2.5" />
          <span>{timeStr}</span>
        </div>
        <div className="truncate" style={{ fontSize: 11, lineHeight: 1.3 }}>
          {promptShort}
        </div>
      </div>
      <button onClick={onLocate} className="btn btn-ghost btn-icon" style={{ width: 22, height: 22, padding: 0 }} title="定位节点">
        <MapPin className="w-3 h-3" />
      </button>
      <button onClick={onRemove} className="btn btn-ghost btn-icon" style={{ width: 22, height: 22, padding: 0 }} title="移除记录">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
