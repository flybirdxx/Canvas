import { Undo2, Redo2, Layers, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useCanvasStore } from '@/store/useCanvasStore';

export function StatusBar() {
  const undo = useCanvasStore(s => s.undo);
  const redo = useCanvasStore(s => s.redo);
  const past = useCanvasStore(s => s.past);
  const future = useCanvasStore(s => s.future);
  const stageConfig = useCanvasStore(s => s.stageConfig);
  const setStageConfig = useCanvasStore(s => s.setStageConfig);
  const zoom = Math.round(stageConfig.scale * 100);

  return (
    <div className="anim-fade-in" style={{ position:'absolute', bottom:12, left:16, display:'flex', alignItems:'center', gap:4, zIndex:30, pointerEvents:'auto' }}>
      <CtrlBtn onClick={undo} disabled={past.length===0} title="Undo Ctrl+Z"><Undo2 strokeWidth={1.8} /></CtrlBtn>
      <CtrlBtn onClick={redo} disabled={future.length===0} title="Redo Ctrl+Y"><Redo2 strokeWidth={1.8} /></CtrlBtn>
      <CtrlBtn title="Layers"><Layers strokeWidth={1.8} /></CtrlBtn>
      <CtrlBtn onClick={() => setStageConfig({ scale: Math.max(0.1, stageConfig.scale / 1.2) })} title="Zoom out"><ZoomOut strokeWidth={1.8} /></CtrlBtn>
      <CtrlBtn onClick={() => setStageConfig({ scale: Math.min(5, stageConfig.scale * 1.2) })} title="Zoom in"><ZoomIn strokeWidth={1.8} /></CtrlBtn>
      <span style={{ fontSize:12, color:'var(--ink-2)', fontWeight:500, minWidth:34, textAlign:'center', fontVariantNumeric:'tabular-nums', fontFamily:'var(--font-mono)', userSelect:'none' }}>{zoom}%</span>
      <CtrlBtn onClick={() => setStageConfig({ scale: 1, x: 0, y: 0 })} title="Reset view (Home)"><RotateCcw strokeWidth={1.8} /></CtrlBtn>
    </div>
  );
}

function CtrlBtn({ children, onClick, disabled, title }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; title?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      style={{ width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', border:'none', background:'transparent', color: disabled?'var(--ink-3)':'var(--ink-2)', cursor: disabled?'not-allowed':'pointer', borderRadius:'var(--r-sm)', transition:'all 120ms ease' }}
      onMouseEnter={e => { if(!disabled){ e.currentTarget.style.background='rgba(0,0,0,0.04)'; e.currentTarget.style.color='var(--ink-0)'; }}}
      onMouseLeave={e => { if(!disabled){ e.currentTarget.style.background='transparent'; e.currentTarget.style.color= disabled?'var(--ink-3)':'var(--ink-2)'; }}}
    >{children}</button>
  );
}
