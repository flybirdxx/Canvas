import { useMemo, useRef, useState } from 'react';
import {
  FolderOpen,
  ChevronLeft,
  Heart,
  Upload,
  Clock,
  Trash2,
  Plus,
  Search,
  Sparkles,
  ImageIcon,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAssetLibraryStore, AssetEntry } from '../store/useAssetLibraryStore';
import { useCanvasStore } from '../store/useCanvasStore';

type Tab = 'recent' | 'favorites' | 'upload';

export function AssetLibraryPanel() {
  const assets = useAssetLibraryStore(s => s.assets);
  const removeAsset = useAssetLibraryStore(s => s.removeAsset);
  const toggleFavorite = useAssetLibraryStore(s => s.toggleFavorite);
  const addAsset = useAssetLibraryStore(s => s.addAsset);
  const clearAll = useAssetLibraryStore(s => s.clearAll);

  const stageConfig = useCanvasStore(s => s.stageConfig);
  const addElement = useCanvasStore(s => s.addElement);
  const setSelection = useCanvasStore(s => s.setSelection);

  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('recent');
  const [query, setQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const byTab = tab === 'favorites' ? assets.filter(a => a.favorited) : assets;
    const q = query.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.prompt?.toLowerCase().includes(q) ?? false),
    );
  }, [assets, tab, query]);

  const placeAssetAtCenter = (asset: AssetEntry) => {
    const defaults =
      asset.kind === 'image' ? { w: 400, h: 300 } :
      asset.kind === 'video' ? { w: 400, h: 300 } :
                                { w: 300, h: 80 };
    const width = asset.width ?? defaults.w;
    const height = asset.height ?? defaults.h;

    const centerX = (window.innerWidth / 2 - stageConfig.x) / stageConfig.scale;
    const centerY = (window.innerHeight / 2 - stageConfig.y) / stageConfig.scale;

    const id = uuidv4();
    addElement({
      id,
      type: asset.kind,
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
      src: asset.src,
      prompt: asset.prompt,
    } as any);
    setSelection([id]);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const kind: AssetEntry['kind'] | null =
        file.type.startsWith('image/') ? 'image' :
        file.type.startsWith('video/') ? 'video' :
        file.type.startsWith('audio/') ? 'audio' : null;
      if (!kind) continue;

      if (kind !== 'image') {
        alert('暂只支持将图片加入资源库，视频/音频请直接拖到画布。');
        continue;
      }

      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const src = reader.result as string;
          const img = new Image();
          img.onload = () => {
            addAsset({
              kind: 'image',
              src,
              name: file.name || '上传图像',
              width: img.width,
              height: img.height,
              source: 'uploaded',
            });
            resolve();
          };
          img.onerror = () => resolve();
          img.src = src;
        };
        reader.onerror = () => resolve();
        reader.readAsDataURL(file);
      });
    }
  };

  return (
    <div
      className="absolute z-20 flex items-end gap-2 anim-fade-in"
      style={{ bottom: 68, left: 16 }}
    >
      <button
        onClick={() => setIsOpen(v => !v)}
        className={isOpen ? 'btn btn-primary' : 'btn btn-ghost'}
        style={{
          padding: '6px 10px',
          fontSize: 11,
          borderRadius: 'var(--r-md)',
          gap: 6,
          ...(isOpen ? {} : { background: 'var(--bg-0)', border: '1px solid var(--line-1)', boxShadow: 'var(--shadow-ink-1)' }),
        }}
        title="资源库"
      >
        <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.6} />
        <span style={{ fontWeight: 500 }}>素材</span>
        <span
          className="mono"
          style={{
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 'var(--r-sm)',
            background: isOpen ? 'color-mix(in oklch, white 20%, transparent)' : 'var(--bg-2)',
            color: isOpen ? 'var(--accent-fg)' : 'var(--ink-2)',
          }}
        >
          {assets.length}
        </span>
        <ChevronLeft
          className="w-3 h-3 transition-transform"
          strokeWidth={1.8}
          style={{ transform: isOpen ? 'rotate(-90deg)' : 'rotate(180deg)' }}
        />
      </button>

      {isOpen && (
        <div
          className="chip-paper flex flex-col overflow-hidden"
          style={{ width: 320, maxHeight: '60vh', boxShadow: 'var(--shadow-ink-2)' }}
        >
          <div
            className="hairline-b flex items-center justify-between"
            style={{ padding: '9px 12px', background: 'var(--bg-2)' }}
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />
              <span className="serif" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-0)' }}>
                资源库
              </span>
            </div>
            <button
              onClick={() => {
                if (confirm('确定要清空资源库吗？收藏也会被删除。')) clearAll();
              }}
              disabled={assets.length === 0}
              className="btn btn-ghost btn-icon"
              style={{ width: 24, height: 24, padding: 0, opacity: assets.length === 0 ? 0.3 : 1 }}
              title="清空资源库"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.6} />
            </button>
          </div>

          <div
            className="hairline-b flex items-center"
            style={{ padding: '6px 10px 0 10px', gap: 2 }}
          >
            <TabButton active={tab === 'recent'} onClick={() => setTab('recent')} icon={<Clock className="w-3 h-3" strokeWidth={1.6} />}>
              最近
            </TabButton>
            <TabButton active={tab === 'favorites'} onClick={() => setTab('favorites')} icon={<Heart className="w-3 h-3" strokeWidth={1.6} />}>
              收藏
            </TabButton>
            <TabButton active={tab === 'upload'} onClick={() => setTab('upload')} icon={<Upload className="w-3 h-3" strokeWidth={1.6} />}>
              上传
            </TabButton>
          </div>

          {tab !== 'upload' && (
            <div className="hairline-b" style={{ padding: 8 }}>
              <div className="relative">
                <Search
                  className="absolute"
                  style={{
                    width: 13,
                    height: 13,
                    color: 'var(--ink-3)',
                    left: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                  strokeWidth={1.6}
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索名称或提示词..."
                  className="input-paper"
                  style={{ fontSize: 11.5, paddingLeft: 26, paddingTop: 5, paddingBottom: 5 }}
                />
              </div>
            </div>
          )}

          <div className="flex-1 paper-scroll overflow-y-auto">
            {tab === 'upload' ? (
              <div className="flex flex-col" style={{ padding: 16, gap: 12 }}>
                <div
                  className="flex flex-col items-center gap-2 transition-colors cursor-pointer"
                  style={{
                    border: '1.5px dashed var(--line-2)',
                    borderRadius: 'var(--r-md)',
                    padding: 24,
                    background: 'var(--bg-1)',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.background = 'color-mix(in oklch, var(--accent) 6%, var(--bg-1))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--line-2)';
                    e.currentTarget.style.background = 'var(--bg-1)';
                  }}
                >
                  <Upload className="w-6 h-6" strokeWidth={1.6} style={{ color: 'var(--ink-3)' }} />
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--ink-2)',
                      textAlign: 'center',
                      lineHeight: 1.6,
                    }}
                  >
                    点击选择图片 或把文件拖到这里
                    <br />
                    <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                      视频 / 音频请直接拖到画布
                    </span>
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                />
                <p style={{ fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                  上传后会出现在"最近"里。图片以 Data URL 形式存在本地，无需联网。
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div
                style={{
                  padding: 32,
                  textAlign: 'center',
                  fontSize: 11,
                  color: 'var(--ink-3)',
                }}
              >
                {query ? '没有匹配的素材' : tab === 'favorites' ? '还没有收藏的素材' : '资源库为空，生成或上传后会自动入库'}
              </div>
            ) : (
              <div className="grid grid-cols-3" style={{ padding: 8, gap: 6 }}>
                {filtered.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    onPlace={() => placeAssetAtCenter(asset)}
                    onToggleFavorite={() => toggleFavorite(asset.id)}
                    onRemove={() => removeAsset(asset.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 transition-colors"
      style={{
        padding: '5px 8px 7px 8px',
        fontSize: 11,
        fontWeight: 500,
        color: active ? 'var(--accent)' : 'var(--ink-2)',
        borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
        background: 'transparent',
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function AssetCard({
  asset,
  onPlace,
  onToggleFavorite,
  onRemove,
}: {
  asset: AssetEntry;
  onPlace: () => void;
  onToggleFavorite: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="group relative aspect-square overflow-hidden cursor-grab active:cursor-grabbing transition-all"
      style={{
        borderRadius: 'var(--r-sm)',
        border: '1px solid var(--line-1)',
        background: 'var(--bg-2)',
        boxShadow: 'var(--shadow-ink-1)',
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-canvas-asset', asset.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.boxShadow = 'var(--shadow-ink-2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--line-1)';
        e.currentTarget.style.boxShadow = 'var(--shadow-ink-1)';
      }}
      title={asset.name + (asset.prompt ? `\n\n${asset.prompt}` : '')}
    >
      {asset.kind === 'image' ? (
        <img src={asset.src} alt={asset.name} className="w-full h-full object-cover pointer-events-none" />
      ) : asset.kind === 'video' ? (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: 'var(--ink-0)', color: 'var(--bg-0)', fontSize: 11 }}
        >
          🎥
        </div>
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            background: 'color-mix(in oklch, var(--port-audio) 18%, var(--bg-1))',
            color: 'var(--port-audio)',
            fontSize: 11,
          }}
        >
          🎵
        </div>
      )}

      {/* Source badge */}
      <div
        className="absolute flex items-center gap-0.5"
        style={{
          top: 4,
          left: 4,
          fontSize: 9,
          fontWeight: 600,
          padding: '1px 5px',
          borderRadius: 'var(--r-sm)',
          background: 'color-mix(in oklch, var(--ink-0) 55%, transparent)',
          color: 'var(--bg-0)',
          backdropFilter: 'blur(4px)',
        }}
      >
        {asset.source === 'generated' ? (
          <>
            <Sparkles className="w-2.5 h-2.5" strokeWidth={1.8} />
            AI
          </>
        ) : (
          <>
            <ImageIcon className="w-2.5 h-2.5" strokeWidth={1.8} />
            本地
          </>
        )}
      </div>

      {/* Favorite button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className="absolute transition-colors"
        style={{
          top: 4,
          right: 4,
          padding: 4,
          borderRadius: 'var(--r-sm)',
          backdropFilter: 'blur(4px)',
          background: asset.favorited
            ? 'var(--danger)'
            : 'color-mix(in oklch, var(--ink-0) 40%, transparent)',
          color: asset.favorited ? 'var(--accent-fg)' : 'color-mix(in oklch, white 80%, transparent)',
          opacity: asset.favorited ? 1 : 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => {
          if (!asset.favorited) e.currentTarget.style.opacity = '0';
        }}
        title={asset.favorited ? '取消收藏' : '收藏'}
      >
        <Heart className="w-3 h-3" strokeWidth={1.8} fill={asset.favorited ? 'currentColor' : 'none'} />
      </button>

      {/* Hover overlay */}
      <div
        className="absolute flex items-center justify-between transition-opacity opacity-0 group-hover:opacity-100"
        style={{
          left: 0,
          right: 0,
          bottom: 0,
          padding: 4,
          gap: 4,
          background: 'linear-gradient(to top, color-mix(in oklch, var(--ink-0) 75%, transparent), transparent)',
        }}
      >
        <button
          type="button"
          onClick={onPlace}
          className="btn btn-primary"
          style={{ padding: '2px 7px', fontSize: 10, borderRadius: 'var(--r-sm)', gap: 3 }}
          title="放入画布中央"
        >
          <Plus className="w-2.5 h-2.5" strokeWidth={2.2} />
          放入画布
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('删除该素材？')) onRemove();
          }}
          className="transition-colors"
          style={{
            padding: 3,
            borderRadius: 'var(--r-sm)',
            background: 'transparent',
            color: 'color-mix(in oklch, white 80%, transparent)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--danger)';
            e.currentTarget.style.color = 'var(--accent-fg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'color-mix(in oklch, white 80%, transparent)';
          }}
          title="删除"
        >
          <Trash2 className="w-2.5 h-2.5" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
