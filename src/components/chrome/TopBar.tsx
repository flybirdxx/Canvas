import { ChevronDown, FileText, Download, Settings, MessageCircle, Play, BookOpen, LayoutGrid, LayoutPanelLeft } from 'lucide-react';

export function TopBar({ onOpenSettings, onOpenTemplates, onRun, onCreateScript, onToggleView, viewMode }: {
  onOpenSettings: () => void;
  onOpenTemplates: () => void;
  onRun?: () => void;
  onCreateScript?: () => void;
  onToggleView?: () => void;
  viewMode?: 'canvas' | 'storyboard';
}) {
  return (<>
    <div className="anim-fade-in" style={{ position:'absolute', top:20, left:20, display:'flex', alignItems:'center', gap:10, zIndex:30, pointerEvents:'auto' }}>
      <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--ink-0)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent-fg)' }} />
      </div>
      <span style={{ fontSize:14, fontWeight:500, color:'var(--ink-0)' }}>Untitled</span>
      <FileText size={16} strokeWidth={1.6} style={{ color:'var(--ink-2)' }} />
      <ChevronDown size={14} strokeWidth={2} style={{ color:'var(--ink-2)' }} />
    </div>
    <div className="anim-fade-in" style={{ position:'absolute', top:16, right:20, display:'flex', alignItems:'center', gap:10, zIndex:30, pointerEvents:'auto' }}>
      {onCreateScript && (
        <button
          onClick={onCreateScript}
          title="创建剧本节点"
          style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'var(--bg-2)', border:'none', borderRadius:'99px', boxShadow:'var(--shadow-ink-1)', cursor:'pointer', fontSize:13, fontWeight:500, color:'var(--ink-0)', fontFamily:'inherit' }}
        >
          <BookOpen size={15} strokeWidth={1.6} style={{ color:'var(--ink-2)' }} />
          <span style={{ color:'var(--ink-2)' }}>剧本</span>
        </button>
      )}
      {onToggleView && (
        <div style={{ display:'flex', alignItems:'center', gap:2, padding:'4px', background:'var(--bg-2)', borderRadius:'99px', boxShadow:'var(--shadow-ink-1)' }}>
          <button
            onClick={onToggleView}
            title="画布视图 (Ctrl+Shift+V)"
            style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', background: viewMode === 'canvas' ? 'var(--accent)' : 'transparent', border:'none', borderRadius:'99px', cursor:'pointer', fontSize:12, fontWeight:500, color: viewMode === 'canvas' ? 'var(--accent-fg)' : 'var(--ink-2)', fontFamily:'inherit', transition:'all 150ms ease' }}
          >
            <LayoutGrid size={14} strokeWidth={1.6} />
            画布
          </button>
          <button
            onClick={onToggleView}
            title="分镜视图 (Ctrl+Shift+V)"
            style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', background: viewMode === 'storyboard' ? 'var(--accent)' : 'transparent', border:'none', borderRadius:'99px', cursor:'pointer', fontSize:12, fontWeight:500, color: viewMode === 'storyboard' ? 'var(--accent-fg)' : 'var(--ink-2)', fontFamily:'inherit', transition:'all 150ms ease' }}
          >
            <LayoutPanelLeft size={14} strokeWidth={1.6} />
            分镜
          </button>
        </div>
      )}
      {onRun && (
        <button
          onClick={onRun}
          title="运行选中子图"
          style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'var(--accent)', border:'none', borderRadius:'99px', boxShadow:'var(--shadow-ink-1)', cursor:'pointer', fontSize:13, fontWeight:500, color:'var(--accent-fg)', fontFamily:'inherit' }}
        >
          <Play size={15} strokeWidth={1.6} style={{ color:'var(--accent-fg)' }} />
          <span>运行</span>
        </button>
      )}
      <button onClick={onOpenSettings} title="Export" style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'var(--bg-2)', border:'none', borderRadius:'99px', boxShadow:'var(--shadow-ink-1)', cursor:'pointer', fontSize:13, fontWeight:500, color:'var(--ink-0)', fontFamily:'inherit' }}>
        <Download size={15} strokeWidth={1.6} style={{ color:'var(--ink-2)' }} />
        <span style={{ color:'var(--ink-2)' }}>Export</span>
      </button>
      <button onClick={onOpenSettings} title="Settings" style={{ width:34, height:34, borderRadius:'50%', background:'var(--signal)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', color:'#FFF', cursor:'pointer', boxShadow:'var(--shadow-ink-1)' }}><Settings size={16} strokeWidth={1.6} /></button>
      <button onClick={onOpenTemplates} title="Chat" style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'var(--accent)', border:'none', borderRadius:'99px', boxShadow:'var(--shadow-ink-1)', cursor:'pointer', fontSize:13, fontWeight:500, color:'var(--accent-fg)', fontFamily:'inherit' }}>
        <MessageCircle size={15} strokeWidth={1.6} />Chat
      </button>
    </div>
  </>);
}
