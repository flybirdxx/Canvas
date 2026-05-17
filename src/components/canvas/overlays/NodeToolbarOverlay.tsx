import React from 'react';
import {
  Clipboard,
  Clapperboard,
  Combine,
  Copy,
  Crop,
  Download,
  Edit3,
  FileDown,
  FileText,
  ListChecks,
  Maximize2,
  Play,
  Scissors,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { CanvasElement, ElementType } from '@/types/canvas';
import { useCanvasStore } from '@/store/useCanvasStore';
import { getDragOffset, useDragOffsetsVersion } from '../dragOffsets';

export type NodeToolbarActionId =
  | 'group-selection'
  | 'edit-text'
  | 'screenwriting'
  | 'copy-text'
  | 'crop-image'
  | 'image-inpaint'
  | 'download-image'
  | 'preview-media'
  | 'download-media'
  | 'planning-generate'
  | 'omniscript-analyze'
  | 'file-download'
  | 'duplicate'
  | 'delete';

export interface NodeToolbarAction {
  id: NodeToolbarActionId;
  label: string;
  title: string;
  icon: React.ReactNode;
  run: (element: CanvasElement) => void;
}

const TOOLBAR_LABELS: Partial<Record<ElementType, string>> = {
  text: '文本快捷工具',
  image: '图片快捷工具',
  video: '视频快捷工具',
  audio: '音频快捷工具',
  planning: '企划快捷工具',
  file: '文件快捷工具',
  omniscript: 'OmniScript 快捷工具',
  sticky: '便签快捷工具',
  rectangle: '形状快捷工具',
  circle: '形状快捷工具',
};

const TOOLBAR_TOP_GAP_CANVAS = 8;

interface NodeToolbarOverlayProps {
  elements: CanvasElement[];
  selectedIds: string[];
  stageConfig: { x: number; y: number; scale: number };
}

export function getNodeToolbarActions(element: CanvasElement): NodeToolbarAction[] {
  const commonTail: NodeToolbarAction[] = [
    {
      id: 'duplicate',
      label: '复制',
      title: '复制节点',
      icon: <Copy className="w-4 h-4" />,
      run: duplicateElement,
    },
    {
      id: 'delete',
      label: '删除',
      title: '删除节点',
      icon: <Trash2 className="w-4 h-4" />,
      run: deleteElement,
    },
  ];

  switch (element.type) {
    case 'image':
      return [
        {
          id: 'crop-image',
          label: '裁剪',
          title: '裁剪图片区域',
          icon: <Crop className="w-4 h-4" />,
          run: startImageSelection,
        },
        {
          id: 'image-inpaint',
          label: '局部重绘',
          title: '框选区域后局部重绘',
          icon: <Scissors className="w-4 h-4" />,
          run: startImageSelection,
        },
        {
          id: 'download-image',
          label: '下载',
          title: '下载图片',
          icon: <Download className="w-4 h-4" />,
          run: downloadImage,
        },
        ...commonTail,
      ];
    case 'text':
      return [
        {
          id: 'edit-text',
          label: '编辑文本',
          title: '编辑文本节点',
          icon: <Edit3 className="w-4 h-4" />,
          run: editText,
        },
        {
          id: 'screenwriting',
          label: '剧本续写',
          title: '使用剧本优化续写提示',
          icon: <Sparkles className="w-4 h-4" />,
          run: openScreenwritingPreset,
        },
        {
          id: 'copy-text',
          label: '复制文本',
          title: '复制文本内容',
          icon: <Clipboard className="w-4 h-4" />,
          run: copyText,
        },
        ...commonTail,
      ];
    case 'video':
      return [
        {
          id: 'preview-media',
          label: '预览',
          title: '预览视频',
          icon: <Play className="w-4 h-4" />,
          run: previewMedia,
        },
        {
          id: 'download-media',
          label: '下载',
          title: '下载视频',
          icon: <Download className="w-4 h-4" />,
          run: downloadMedia,
        },
        ...commonTail,
      ];
    case 'audio':
      return [
        {
          id: 'preview-media',
          label: '播放',
          title: '播放音频',
          icon: <Play className="w-4 h-4" />,
          run: previewMedia,
        },
        {
          id: 'download-media',
          label: '下载',
          title: '下载音频',
          icon: <Download className="w-4 h-4" />,
          run: downloadMedia,
        },
        ...commonTail,
      ];
    case 'planning':
      return [
        {
          id: 'planning-generate',
          label: '规划',
          title: '运行当前企划节点的规划动作',
          icon: <ListChecks className="w-4 h-4" />,
          run: runPlanningAction,
        },
        ...commonTail,
      ];
    case 'omniscript':
      return [
        {
          id: 'omniscript-analyze',
          label: '分析',
          title: '运行 OmniScript 分析',
          icon: <Clapperboard className="w-4 h-4" />,
          run: runOmniScriptAction,
        },
        ...commonTail,
      ];
    case 'file':
      return [
        {
          id: 'file-download',
          label: '下载',
          title: '下载文件',
          icon: <FileDown className="w-4 h-4" />,
          run: downloadFile,
        },
        ...commonTail,
      ];
    case 'sticky':
      return [
        {
          id: 'edit-text',
          label: '编辑便签',
          title: '编辑便签',
          icon: <FileText className="w-4 h-4" />,
          run: editText,
        },
        ...commonTail,
      ];
    case 'rectangle':
    case 'circle':
      return [
        {
          id: 'edit-text',
          label: '样式',
          title: '编辑形状样式',
          icon: <Maximize2 className="w-4 h-4" />,
          run: noop,
        },
        ...commonTail,
      ];
    default:
      return commonTail;
  }
}

export function NodeToolbarOverlay({ elements, selectedIds, stageConfig }: NodeToolbarOverlayProps) {
  useDragOffsetsVersion();

  if (selectedIds.length >= 2) {
    const selected = elements.filter(item => selectedIds.includes(item.id));
    if (selected.length < 2) return null;
    const bounds = getElementsBounds(selected);
    const screenX = stageConfig.x + (bounds.x + bounds.width / 2) * stageConfig.scale;
    const screenY = stageConfig.y + (bounds.y - TOOLBAR_TOP_GAP_CANVAS) * stageConfig.scale;
    const actions: NodeToolbarAction[] = [
      {
        id: 'group-selection',
        label: '打组',
        title: '将选中的节点打组',
        icon: <Combine className="w-4 h-4" />,
        run: groupSelection,
      },
    ];

    return (
      <ToolbarShell
        label="多选快捷工具"
        screenX={screenX}
        screenY={screenY}
        actions={actions}
        element={selected[0]}
      />
    );
  }

  if (selectedIds.length !== 1) return null;

  const element = elements.find(item => item.id === selectedIds[0]);
  if (!element) return null;

  const actions = getNodeToolbarActions(element);
  if (actions.length === 0) return null;

  const offset = getDragOffset(element.id);
  const ddx = offset ? offset.dx : 0;
  const ddy = offset ? offset.dy : 0;
  const canvasX = element.x + element.width / 2;
  const canvasY = element.y - TOOLBAR_TOP_GAP_CANVAS;
  const screenX = stageConfig.x + (canvasX + ddx) * stageConfig.scale;
  const screenY = stageConfig.y + (canvasY + ddy) * stageConfig.scale;
  const label = TOOLBAR_LABELS[element.type] ?? '节点快捷工具';

  return (
    <ToolbarShell
      label={label}
      screenX={screenX}
      screenY={screenY}
      actions={actions}
      element={element}
    />
  );
}

function ToolbarShell({
  label,
  screenX,
  screenY,
  actions,
  element,
}: {
  label: string;
  screenX: number;
  screenY: number;
  actions: NodeToolbarAction[];
  element: CanvasElement;
}) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 28 }}
    >
      <div
        role="toolbar"
        aria-label={label}
        className="pointer-events-auto"
        style={{
          position: 'absolute',
          left: screenX,
          top: screenY,
          transform: 'translate(-50%, -100%)',
          transformOrigin: 'bottom center',
          display: 'flex',
          justifyContent: 'center',
        }}
        onMouseDown={event => event.stopPropagation()}
        onPointerDown={event => event.stopPropagation()}
        onWheel={event => event.stopPropagation()}
      >
        <div
          className="chip-paper flex items-center anim-pop"
          style={{
            gap: 2,
            padding: '5px 6px',
            borderRadius: 'var(--r-pill)',
            boxShadow: 'var(--shadow-ink-3)',
            background: 'color-mix(in oklch, var(--ink-0) 91%, transparent)',
            color: 'var(--bg-0)',
            border: '1px solid color-mix(in oklch, var(--bg-0) 16%, transparent)',
          }}
        >
          {actions.map(action => (
            <ToolbarButton
              key={action.id}
              action={action}
              element={element}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function getElementsBounds(elements: CanvasElement[]) {
  const minX = Math.min(...elements.map(element => element.x));
  const minY = Math.min(...elements.map(element => element.y));
  const maxX = Math.max(...elements.map(element => element.x + element.width));
  const maxY = Math.max(...elements.map(element => element.y + element.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function ToolbarButton({
  action,
  element,
}: {
  action: NodeToolbarAction;
  element: CanvasElement;
}) {
  return (
    <button
      type="button"
      aria-label={action.label}
      title={action.title}
      onClick={(event) => {
        event.stopPropagation();
        action.run(element);
      }}
      className="btn btn-ghost btn-icon"
      style={{
        width: 'auto',
        height: 30,
        padding: '0 8px',
        borderRadius: 'var(--r-md)',
        color: 'currentColor',
        gap: 4,
        fontSize: 11,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {React.cloneElement(action.icon as React.ReactElement<any>, { strokeWidth: 1.7 })}
      <span>{action.label}</span>
    </button>
  );
}

function startImageSelection(element: CanvasElement) {
  if (element.type !== 'image') return;
  useCanvasStore.getState().setInpaintMask({ elementId: element.id, rect: null });
}

function editText(element: CanvasElement) {
  if (element.type === 'text') {
    window.dispatchEvent(new CustomEvent('text:edit', { detail: { id: element.id } }));
  }
}

function openScreenwritingPreset(element: CanvasElement) {
  if (element.type !== 'text') return;
  window.dispatchEvent(new CustomEvent('node-toolbar:screenwriting', { detail: { id: element.id } }));
}

function copyText(element: CanvasElement) {
  if (element.type !== 'text' && element.type !== 'sticky') return;
  const text = element.type === 'text' || element.type === 'sticky' ? element.text : '';
  void navigator.clipboard?.writeText(text);
}

function previewMedia(element: CanvasElement) {
  if (element.type !== 'video' && element.type !== 'audio') return;
  if (element.src) window.open(element.src, '_blank', 'noopener,noreferrer');
}

function downloadImage(element: CanvasElement) {
  if (element.type !== 'image' || !element.src) return;
  downloadUrl(element.src, `${element.id}.png`);
}

function downloadMedia(element: CanvasElement) {
  if ((element.type !== 'video' && element.type !== 'audio') || !element.src) return;
  downloadUrl(element.src, `${element.id}.${element.type === 'video' ? 'mp4' : 'mp3'}`);
}

function downloadFile(element: CanvasElement) {
  const src = 'src' in element ? String(element.src || '') : '';
  if (!src) return;
  const name = 'name' in element && element.name ? String(element.name) : `${element.id}`;
  downloadUrl(src, name);
}

function downloadUrl(url: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function duplicateElement(element: CanvasElement) {
  const clone = {
    ...element,
    id: crypto.randomUUID(),
    x: element.x + 32,
    y: element.y + 32,
  } as CanvasElement;
  useCanvasStore.getState().addElement(clone);
  useCanvasStore.getState().setSelection([clone.id]);
}

function deleteElement(element: CanvasElement) {
  useCanvasStore.getState().deleteElements([element.id]);
}

function groupSelection() {
  useCanvasStore.getState().groupSelected();
}

function runPlanningAction(element: CanvasElement) {
  window.dispatchEvent(new CustomEvent('planning:run', { detail: { id: element.id } }));
}

function runOmniScriptAction(element: CanvasElement) {
  window.dispatchEvent(new CustomEvent('omniscript:run', { detail: { id: element.id } }));
}

function noop() {
  // Reserved for shape style editing once the style surface is extracted.
}
