import { useRef, useState } from 'react';
import {
  Plus, Search, Type, Image as ImageIcon, Video, Music, Layers,
  Square, Circle, StickyNote, FileUp,
} from 'lucide-react';

/**
 * ToolDock — left-anchored vertical paper strip.
 *
 * Primary affordance is the circular "+" chip which expands a rich
 * node-picker popover on hover. Secondary row has quick primitives
 * (rectangle, circle, sticky) as tiny ink chips.
 *
 * No ghost / no neon. A strip of paper with hairline divider, soft
 * lift. Hover turns the slot to a warm paper-2. Active state uses
 * the accent-soft background.
 */
export function ToolDock({
  onCreate,
  onUploadFiles,
}: {
  onCreate: (type: string) => void;
  /**
   * 通用文件上传入口的回调。和 `onCreate` 分开是因为：这条通路不创建空
   * 节点再等用户喂数据，而是先挑文件、读完内容后才一次性落地成 FileElement
   * —— 所以它的 payload 不是一个 type 字符串，而是已经到手的 File 数组。
   */
  onUploadFiles?: (files: File[]) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 打开 OS 文件对话框。必须同步触发 `input.click()`（不能 await 任何东西），
   * 否则部分浏览器会把异步调用识别为"非用户手势"而拒绝打开对话框。
   */
  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className="chip-paper anim-fade-in z-30 pointer-events-auto"
      style={{
        position: 'absolute',
        left: 16,
        top: '50%',
        transform: 'translateY(-50%)',
        padding: 6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        borderRadius: 'var(--r-xl)',
      }}
    >
      {/* Primary add button */}
      <div
        className="relative"
        onMouseEnter={() => setMenuOpen(true)}
        onMouseLeave={() => setMenuOpen(false)}
      >
        <button
          className="flex items-center justify-center transition-all"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--ink-0)',
            color: 'var(--bg-0)',
            boxShadow: 'var(--shadow-ink-2)',
            border: '1px solid var(--ink-0)',
            cursor: 'pointer',
          }}
          title="添加节点"
        >
          <Plus
            className="w-5 h-5 transition-transform"
            strokeWidth={2.2}
            style={{ transform: menuOpen ? 'rotate(45deg)' : 'rotate(0)' }}
          />
        </button>

        {/* Popover bridge — invisible, keeps hover alive */}
        {menuOpen && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '100%',
              top: 0,
              width: 24,
              height: '100%',
            }}
          />
        )}

        {menuOpen && (
          <div
            className="chip-paper anim-pop"
            style={{
              position: 'absolute',
              left: 'calc(100% + 16px)',
              top: 0,
              width: 280,
              padding: 10,
              borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-ink-3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              zIndex: 50,
            }}
          >
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search
                className="w-3.5 h-3.5"
                strokeWidth={1.6}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--ink-3)',
                }}
              />
              <input
                type="text"
                placeholder="搜索节点与模型"
                className="input-paper"
                style={{ width: '100%', padding: '7px 10px 7px 30px', fontSize: 12 }}
              />
            </div>

            {/* Add Node section */}
            <div>
              <SectionLabel>添加节点</SectionLabel>
              <div className="flex flex-col gap-0.5 mt-1.5">
                <PickerItem
                  icon={<Type />}
                  title="Text"
                  desc="文本 · 提示词 · 说明"
                  hotkey="T"
                  onClick={() => onCreate('text')}
                />
                <PickerItem
                  icon={<ImageIcon />}
                  title="Image"
                  desc="生图 · 图生图 · 上传"
                  hotkey="I"
                  onClick={() => onCreate('image')}
                />
                <PickerItem
                  icon={<Video />}
                  title="Video"
                  desc="文/图生视频（占位）"
                  hotkey="V"
                  onClick={() => onCreate('video')}
                />
                <PickerItem
                  icon={<Music />}
                  title="Audio"
                  desc="配音 · BGM（占位）"
                  hotkey="A"
                  onClick={() => onCreate('audio')}
                />
                <PickerItem
                  icon={<FileUp />}
                  title="File"
                  desc="任意格式 · 附件"
                  hotkey="U"
                  onClick={openFilePicker}
                />
              </div>
            </div>

            <div className="rule-ink" />

            {/* Utilities */}
            <div>
              <SectionLabel>辅助</SectionLabel>
              <div className="flex flex-col gap-0.5 mt-1.5">
                <PickerItem
                  icon={<Layers />}
                  title="Layer Editor"
                  desc="图层合成"
                  hotkey="L"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        aria-hidden="true"
        style={{ width: 22, height: 1, background: 'var(--line-1)', margin: '2px 0' }}
      />

      {/* Secondary primitives */}
      <DockBtn label="矩形" onClick={() => onCreate('rectangle')}>
        <Square className="w-4 h-4" strokeWidth={1.6} />
      </DockBtn>
      <DockBtn label="圆形" onClick={() => onCreate('circle')}>
        <Circle className="w-4 h-4" strokeWidth={1.6} />
      </DockBtn>
      <DockBtn label="便签" onClick={() => onCreate('sticky')}>
        <StickyNote className="w-4 h-4" strokeWidth={1.6} />
      </DockBtn>

      {/*
        通用文件上传通道 —— 故意不走 image/video/audio 分流，accept 设为
        星斜杠星（任意格式）。`multiple` 允许一次选多份。读完内容后交由
        App.handleUploadFiles 组装成 FileElement。value 清空是为了让用户
        同一个文件能被连续选两次。
      */}
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length > 0 && onUploadFiles) {
            onUploadFiles(files);
          }
        }}
      />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="meta"
      style={{
        fontSize: 9.5,
        padding: '0 4px',
        color: 'var(--ink-3)',
      }}
    >
      {children}
    </div>
  );
}

function DockBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative group flex items-center justify-center transition-colors"
      style={{
        width: 32,
        height: 32,
        borderRadius: 'var(--r-sm)',
        color: 'var(--ink-1)',
        background: 'transparent',
        border: '1px solid transparent',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-2)';
        e.currentTarget.style.borderColor = 'var(--line-1)';
        e.currentTarget.style.color = 'var(--ink-0)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'transparent';
        e.currentTarget.style.color = 'var(--ink-1)';
      }}
    >
      {children}
      <span
        className="group-hover:opacity-100 opacity-0 pointer-events-none transition-opacity"
        style={{
          position: 'absolute',
          left: 'calc(100% + 10px)',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'var(--ink-0)',
          color: 'var(--bg-0)',
          fontSize: 10.5,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.04em',
          padding: '3px 7px',
          borderRadius: 'var(--r-sm)',
          whiteSpace: 'nowrap',
          boxShadow: 'var(--shadow-ink-1)',
          zIndex: 40,
        }}
      >
        {label}
      </span>
    </button>
  );
}

function PickerItem({
  icon,
  title,
  desc,
  hotkey,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  hotkey?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2.5 cursor-pointer transition-colors"
      style={{
        padding: '7px 8px',
        borderRadius: 'var(--r-sm)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: 28,
          height: 28,
          borderRadius: 'var(--r-sm)',
          background: 'var(--bg-3)',
          border: '1px solid var(--line-1)',
          color: 'var(--ink-1)',
        }}
      >
        <div className="w-[15px] h-[15px] [&>svg]:w-full [&>svg]:h-full [&>svg]:stroke-[1.6]">
          {icon}
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            lineHeight: 1.25,
            color: 'var(--ink-0)',
          }}
        >
          {title}
        </span>
        <span
          className="serif-it"
          style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.3 }}
        >
          {desc}
        </span>
      </div>
      {hotkey && (
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--ink-3)',
            padding: '2px 5px',
            border: '1px solid var(--line-1)',
            borderRadius: 4,
            background: 'var(--bg-2)',
          }}
        >
          {hotkey}
        </span>
      )}
    </div>
  );
}
