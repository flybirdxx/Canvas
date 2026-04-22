import { useState, useMemo } from 'react';
import { History, ChevronRight, Eraser } from 'lucide-react';
import { useCanvasStore, HistorySnapshot } from '../store/useCanvasStore';

function formatTime(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function HistoryPanel() {
  const past = useCanvasStore(s => s.past);
  const future = useCanvasStore(s => s.future);
  const elements = useCanvasStore(s => s.elements);
  const connections = useCanvasStore(s => s.connections);
  const currentLabel = useCanvasStore(s => s.currentLabel);
  const currentTimestamp = useCanvasStore(s => s.currentTimestamp);
  const jumpToHistory = useCanvasStore(s => s.jumpToHistory);
  const clearHistory = useCanvasStore(s => s.clearHistory);

  const [isOpen, setIsOpen] = useState(false);

  const entries = useMemo(() => {
    const current: HistorySnapshot = {
      elements,
      connections,
      label: currentLabel,
      timestamp: currentTimestamp,
    };
    return [...past, current, ...future];
  }, [past, future, elements, connections, currentLabel, currentTimestamp]);

  const currentIdx = past.length;
  const totalChanges = past.length + future.length;

  return (
    <div className="absolute bottom-4 right-4 z-20 flex items-end gap-2">
      {isOpen && (
        <div className="bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-xl shadow-xl w-72 max-h-[50vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-2">
          <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-[12px] font-bold text-gray-700">历史记录</span>
              <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                {entries.length}
              </span>
            </div>
            <button
              onClick={() => {
                if (confirm('确定要清空历史记录吗？（画布内容不会变化）')) clearHistory();
              }}
              disabled={totalChanges === 0}
              className="p-1 rounded hover:bg-gray-200/60 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="清空历史记录"
            >
              <Eraser className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-y-auto custom-scrollbar flex-1">
            {entries.length === 0 && (
              <div className="p-6 text-center text-[11px] text-gray-400">暂无历史</div>
            )}
            {entries.map((entry, idx) => {
              const isCurrent = idx === currentIdx;
              const isFuture = idx > currentIdx;
              return (
                <button
                  key={`${entry.timestamp}-${idx}`}
                  onClick={() => jumpToHistory(idx)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 border-b border-gray-50 transition-colors ${
                    isCurrent
                      ? 'bg-blue-50/80 hover:bg-blue-50'
                      : isFuture
                        ? 'opacity-60 hover:bg-gray-50'
                        : 'hover:bg-gray-50'
                  }`}
                  title={`跳转到此步骤 · ${formatTime(entry.timestamp)}`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isCurrent ? 'bg-blue-500' : isFuture ? 'bg-gray-300' : 'bg-gray-400'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-[12px] truncate ${
                        isCurrent ? 'text-blue-700 font-semibold' : 'text-gray-700 font-medium'
                      }`}
                    >
                      {entry.label}
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      {formatTime(entry.timestamp)} · {entry.elements.length} 元素 · {entry.connections.length} 连线
                    </div>
                  </div>
                  {isCurrent && (
                    <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">当前</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(v => !v)}
        className={`flex items-center gap-2 px-3 py-2 backdrop-blur-md text-[11px] font-medium rounded-lg transition-colors border shadow-sm ${
          isOpen
            ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
            : 'bg-white/90 text-gray-700 border-gray-200/80 hover:bg-gray-50'
        }`}
        title="历史记录"
      >
        <History className="w-4 h-4" />
        <span>历史</span>
        <span
          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            isOpen ? 'bg-blue-500/40' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {currentIdx + 1}/{entries.length}
        </span>
        <ChevronRight
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
        />
      </button>
    </div>
  );
}
