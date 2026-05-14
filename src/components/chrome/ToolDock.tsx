import { useRef, useState, useCallback, useEffect } from 'react';
import { Type, Image as ImageIcon, Video, Music, StickyNote, FileUp, Square, Sparkles, Plus, Search, Layers, Clapperboard } from 'lucide-react';

const MENU_CLOSE_MS = 180;

export function ToolDock({ onCreate, onUploadFiles }: { onCreate: (t: string) => void; onUploadFiles?: (f: File[]) => void; activeTool?: string; onSetActiveTool?: (t: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);

  const openMenu = useCallback(() => {
    setMenuClosing(false);
    setMenuOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuClosing(true);
    setTimeout(() => {
      setMenuOpen(false);
      setMenuClosing(false);
    }, MENU_CLOSE_MS);
  }, []);

  const toggleMenu = useCallback(() => {
    if (menuOpen) closeMenu();
    else openMenu();
  }, [menuOpen, openMenu, closeMenu]);

  // Click-away: close menu when user clicks anywhere outside the menu panel.
  useEffect(() => {
    if (!menuOpen && !menuClosing) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      // Keep open if click is inside the menu panel itself
      if (menuRef.current?.contains(target)) return;
      // Keep open if click is on the toggle button
      if (target instanceof Element && target.closest?.('button[title="Add"]')) return;
      closeMenu();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen, menuClosing, closeMenu]);

  return (<>
    <div className="anim-fade-in" style={{ position:'absolute', bottom:28, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:4, padding:6, background:'var(--bg-2)', borderRadius:'99px', boxShadow:'var(--shadow-ink-2)', zIndex:30, pointerEvents:'auto' }}>
      {/* + Add button with popover */}
      <div style={{ position:'relative' }}>
        <button type="button" onClick={toggleMenu}
          style={{
            width:38, height:38,
            display:'flex', alignItems:'center', justifyContent:'center',
            border:'none', borderRadius:'50%',
            background: menuOpen ? 'var(--bg-3)' : 'transparent',
            color: 'var(--ink-0)',
            cursor:'pointer',
            transition: 'all 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            transform: menuOpen ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
          title="Add">
          <Plus style={{ width:20, height:20 }} strokeWidth={1.6} />
        </button>

        {(menuOpen || menuClosing) && (
          <>
            {/* Menu panel */}
            <div
              ref={menuRef}
              className={menuClosing ? 'anim-dock-menu-out' : 'anim-dock-menu-in'}
              style={{
                position:'absolute',
                bottom:'calc(100% + 12px)',
                left:0,
                width:260,
                padding:8,
                background:'var(--bg-2)',
                borderRadius:'12px',
                boxShadow:'var(--shadow-ink-3)',
                zIndex:50,
                display:'flex',
                flexDirection:'column',
                gap:6,
                transformOrigin: 'bottom left',
              }}
            >
              <div style={{ position:'relative' }}>
                <Search size={13} strokeWidth={1.6} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)' }} />
                <input placeholder="Search nodes & models" style={{ width:'100%', padding:'6px 10px 6px 28px', fontSize:11, borderRadius:'6px', border:'1px solid var(--line-1)', background:'var(--bg-1)', color:'var(--ink-0)', outline:'none', fontFamily:'inherit' }} />
              </div>
              <div className="meta" style={{ fontSize:9.5, padding:'0 4px', color:'var(--ink-3)' }}>ADD NODE</div>
              <Pick onClick={() => { onCreate('text'); closeMenu(); }} icon={<Type size={15} strokeWidth={1.6} />} label="Text" desc="Text / prompt / note" hotkey="T" />
              <Pick onClick={() => { onCreate('image'); closeMenu(); }} icon={<ImageIcon size={15} strokeWidth={1.6} />} label="Image" desc="Generate / upload" hotkey="I" />
              <Pick onClick={() => { onCreate('video'); closeMenu(); }} icon={<Video size={15} strokeWidth={1.6} />} label="Video" desc="Text/image to video" hotkey="V" />
              <Pick onClick={() => { onCreate('audio'); closeMenu(); }} icon={<Music size={15} strokeWidth={1.6} />} label="Audio" desc="Voice / BGM" hotkey="A" />
              <Pick onClick={() => { onCreate('omniscript'); closeMenu(); }} icon={<Clapperboard size={15} strokeWidth={1.6} />} label="OmniScript" desc="Video cover analysis" hotkey="O" />
              <Pick onClick={() => { onCreate('sticky'); closeMenu(); }} icon={<StickyNote size={15} strokeWidth={1.6} />} label="Sticky" desc="Quick note" hotkey="S" />
              <Pick onClick={() => { onCreate('rectangle'); closeMenu(); }} icon={<Square size={15} strokeWidth={1.6} />} label="Shape" desc="Rectangle / circle" hotkey="R" />
              <Pick onClick={() => { ref.current?.click(); closeMenu(); }} icon={<FileUp size={15} strokeWidth={1.6} />} label="File" desc="Any format" hotkey="U" />
              <div style={{ height:1, background:'var(--line-1)', margin:'2px 0' }} />
              <div className="meta" style={{ fontSize:9.5, padding:'0 4px', color:'var(--ink-3)' }}>TOOLS</div>
              <Pick icon={<Layers size={15} strokeWidth={1.6} />} label="Layer Editor" desc="Layer composition" hotkey="L" />
              <Pick icon={<Sparkles size={15} strokeWidth={1.6} />} label="AI Tools" desc="Generative features" />
            </div>
          </>
        )}
      </div>

      <div style={{ width:1, height:20, background:'var(--line-1)', margin:'0 4px' }} />

      <button type="button" onClick={()=>ref.current?.click()} title="Upload files" style={{ width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', border:'none', borderRadius:'50%', background:'transparent', color:'var(--ink-0)', cursor:'pointer', transition:'all 120ms ease' }}
        onMouseEnter={e => e.currentTarget.style.background='var(--bg-3)'}
        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
        <FileUp style={{ width:20, height:20 }} strokeWidth={1.6} />
      </button>
    </div>
    <input ref={ref} type="file" accept="*/*" multiple style={{ display:'none' }} onChange={e => { const fs = Array.from(e.target.files??[]); e.target.value=''; if(fs.length&&onUploadFiles) onUploadFiles(fs); }} />
  </>);
}

function Pick({ icon, label, desc, hotkey, onClick }: { icon: React.ReactNode; label: string; desc: string; hotkey?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 8px', borderRadius:'8px', border:'none', background:'transparent', cursor:'pointer', width:'100%', textAlign:'left', color:'var(--ink-0)', fontFamily:'inherit' }}
      onMouseEnter={e => { e.currentTarget.style.background='var(--bg-3)'; }}
      onMouseLeave={e => { e.currentTarget.style.background='transparent'; }}>
      <span style={{ color:'var(--ink-2)', display:'flex' }}>{icon}</span>
      <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:500 }}>{label}</div><div style={{ fontSize:10, color:'var(--ink-2)' }}>{desc}</div></div>
      {hotkey && <span style={{ fontSize:9.5, color:'var(--ink-3)', padding:'2px 5px', borderRadius:3, border:'1px solid var(--line-1)' }}>{hotkey}</span>}
    </button>
  );
}
