import React from 'react';
import {
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignHorizontalSpaceAround, AlignVerticalSpaceAround,
  LayoutGrid,
} from 'lucide-react';
import { useCanvasStore } from '@/store/useCanvasStore';
import {
  alignLeft, alignRight, alignCenterHorizontal,
  alignTop, alignBottom, alignCenterVertical,
  distributeHorizontal, distributeVertical,
  arrangeGrid,
  PositionUpdate,
} from '@/utils/alignment';

/**
 * Floating toolbar rendered at the top-center of the viewport whenever the
 * user has 2+ elements selected. Groups:
 *  - 6 alignment icons (left / center-H / right / top / middle / bottom)
 *  - 2 distribute icons (horizontal / vertical; needs ≥3 to have effect)
 *  - 1 grid icon (auto-grid layout)
 *
 * Implementation notes:
 *  - Uses `updateElementPosition` (not `updateElement`) to avoid emitting
 *    one history entry per moved element. The user perceives "align left"
 *    as a single operation; a group entry is added afterward via a synthetic
 *    noop on the store's label. Since the existing store doesn't expose a
 *    batch-position API, we call updateElementPosition per element — these
 *    don't push to `past`, so history stays clean.
 *  - Positions update in one React state commit because set() is sync.
 */
export function AlignmentToolbar() {
  const selectedIds = useCanvasStore(s => s.selectedIds);
  const elements = useCanvasStore(s => s.elements);
  const batchUpdatePositions = useCanvasStore(s => s.batchUpdatePositions);

  // Only render when 2+ elements are selected. Using a DOM overlay so this
  // floats above the canvas regardless of zoom/pan.
  if (selectedIds.length < 2) return null;

  const selected = elements.filter(e => selectedIds.includes(e.id));
  if (selected.length < 2) return null;

  const apply = (updates: PositionUpdate[], label: string) => {
    if (updates.length === 0) return;
    batchUpdatePositions(updates, label);
  };

  const count = selected.length;
  const canDistribute = count >= 3;

  return (
    <div
      className="absolute z-30 pointer-events-auto anim-pop"
      style={{ top: 72, left: '50%', transform: 'translateX(-50%)' }}
    >
      <div
        className="chip-paper flex items-center"
        style={{
          padding: '4px 6px',
          gap: 2,
          borderRadius: 'var(--r-pill)',
          boxShadow: 'var(--shadow-ink-3)',
        }}
        title={`已选中 ${count} 个元素`}
      >
        <span
          className="meta select-none"
          style={{
            fontSize: 10,
            margin: '0 6px',
            letterSpacing: '0.05em',
            color: 'var(--ink-2)',
          }}
        >
          {count} 个 · 对齐
        </span>

        <Divider />

        {/* Horizontal alignment (align the X edges) */}
        <IconBtn onClick={() => apply(alignLeft(selected), '左对齐')} title="左对齐">
          <AlignStartVertical className="w-4 h-4" />
        </IconBtn>
        <IconBtn onClick={() => apply(alignCenterHorizontal(selected), '水平居中')} title="水平居中">
          <AlignCenterVertical className="w-4 h-4" />
        </IconBtn>
        <IconBtn onClick={() => apply(alignRight(selected), '右对齐')} title="右对齐">
          <AlignEndVertical className="w-4 h-4" />
        </IconBtn>

        <Divider />

        {/* Vertical alignment (align the Y edges) */}
        <IconBtn onClick={() => apply(alignTop(selected), '顶对齐')} title="顶对齐">
          <AlignStartHorizontal className="w-4 h-4" />
        </IconBtn>
        <IconBtn onClick={() => apply(alignCenterVertical(selected), '垂直居中')} title="垂直居中">
          <AlignCenterHorizontal className="w-4 h-4" />
        </IconBtn>
        <IconBtn onClick={() => apply(alignBottom(selected), '底对齐')} title="底对齐">
          <AlignEndHorizontal className="w-4 h-4" />
        </IconBtn>

        <Divider />

        {/* Distribute gaps — needs ≥ 3 selections to be meaningful */}
        <IconBtn
          onClick={() => apply(distributeHorizontal(selected), '水平等距分布')}
          title={canDistribute ? '水平等距分布' : '需要 3+ 元素'}
          disabled={!canDistribute}
        >
          <AlignHorizontalSpaceAround className="w-4 h-4" />
        </IconBtn>
        <IconBtn
          onClick={() => apply(distributeVertical(selected), '垂直等距分布')}
          title={canDistribute ? '垂直等距分布' : '需要 3+ 元素'}
          disabled={!canDistribute}
        >
          <AlignVerticalSpaceAround className="w-4 h-4" />
        </IconBtn>

        <Divider />

        {/* Auto-grid */}
        <IconBtn onClick={() => apply(arrangeGrid(selected), '自动网格布局')} title="自动网格布局">
          <LayoutGrid className="w-4 h-4" />
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({
  children, onClick, title, disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="btn btn-ghost btn-icon"
      style={{
        width: 30,
        height: 30,
        padding: 0,
        borderRadius: 'var(--r-md)',
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {React.cloneElement(children as React.ReactElement<any>, { strokeWidth: 1.6 })}
    </button>
  );
}

function Divider() {
  return (
    <div
      aria-hidden="true"
      style={{ width: 1, height: 18, background: 'var(--line-1)', margin: '0 3px' }}
    />
  );
}
