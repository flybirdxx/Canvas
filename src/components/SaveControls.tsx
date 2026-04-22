import { useState, useEffect } from 'react';
import { Trash, Cloud, CloudOff } from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';

function formatTimeAgo(ts: number | null): string {
  if (!ts) return '尚未保存';
  const diff = Date.now() - ts;
  if (diff < 5_000) return '已自动保存';
  if (diff < 60_000) return `${Math.floor(diff / 1000)} 秒前已保存`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前已保存`;
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} 已保存`;
}

export function SaveControls() {
  const clearCanvas = useCanvasStore(s => s.clearCanvas);
  const lastSavedAt = useCanvasStore(s => s.lastSavedAt);
  const elementsCount = useCanvasStore(s => s.elements.length);

  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const handleClear = () => {
    if (elementsCount === 0) return;
    if (confirm('确定要清空当前画布吗？（此操作可通过撤销恢复）')) {
      clearCanvas();
    }
  };

  const saved = lastSavedAt !== null;

  return (
    <div className="flex items-center gap-2">
      <div
        className="hidden md:flex items-center gap-1.5 px-2.5 py-2 bg-white/90 backdrop-blur-md rounded-lg border border-gray-200/80 shadow-sm text-[10px] text-gray-500"
        title={saved ? '画布状态已自动保存在浏览器本地，下次打开会自动恢复' : '尚无保存记录'}
      >
        {saved ? (
          <Cloud className="w-3 h-3 text-green-600" />
        ) : (
          <CloudOff className="w-3 h-3 text-gray-400" />
        )}
        <span className={saved ? 'text-gray-600' : 'text-gray-400'}>
          {formatTimeAgo(lastSavedAt)}
        </span>
      </div>

      <button
        onClick={handleClear}
        disabled={elementsCount === 0}
        className="flex items-center justify-center p-2 bg-white/90 backdrop-blur-md text-gray-600 hover:text-red-600 shadow-sm border border-gray-200/80 rounded-lg transition-colors hover:bg-red-50 disabled:opacity-40 disabled:hover:text-gray-600 disabled:hover:bg-white/90"
        title="清空画布"
      >
        <Trash className="w-4 h-4" />
      </button>
    </div>
  );
}
