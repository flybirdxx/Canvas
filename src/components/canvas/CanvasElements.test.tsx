import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanningElement } from '@/types/canvas';
import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasElements } from './CanvasElements';

vi.mock('react-konva', () => ({
  Group: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  Rect: () => null,
}));

vi.mock('react-konva-utils', () => ({
  Html: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./nodes', () => ({
  ImageNode: () => null,
  TextNode: () => null,
  ShapeNode: () => null,
  StickyNode: () => null,
  MediaNode: () => null,
  AIGeneratingNode: () => null,
  FileNode: () => null,
  OmniScriptNode: () => null,
  PlanningNode: ({ el }: { el: PlanningElement }) => (
    <div data-testid="planning-node">{el.title}</div>
  ),
  PortOverlay: () => null,
  SelectionHandles: () => null,
  RunningPulse: () => null,
}));

const snapCallbacks = {
  onDragMove: vi.fn(),
  onDragEnd: vi.fn(),
  onResizeMove: vi.fn(),
  onResize: vi.fn(),
  onResizeEnd: vi.fn(),
  computeDragSnap: vi.fn(),
};

function makePlanningNode(overrides: Partial<PlanningElement> = {}): PlanningElement {
  return {
    id: 'planning-node-1',
    type: 'planning',
    kind: 'projectSeed',
    title: '项目种子',
    body: '一句想法：',
    x: 0,
    y: 0,
    width: 340,
    height: 260,
    ...overrides,
  };
}

describe('CanvasElements', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      elements: [],
      connections: [],
      groups: [],
      selectedIds: [],
      activeTool: 'select',
      drawingConnection: null,
    });
  });

  it('renders planning elements with PlanningNode content', () => {
    useCanvasStore.setState({
      elements: [makePlanningNode()],
      selectedIds: ['planning-node-1'],
    });

    render(<CanvasElements guideLines={[]} snapCallbacks={snapCallbacks} />);

    expect(screen.getByTestId('planning-node')).toHaveTextContent('项目种子');
  });
});
