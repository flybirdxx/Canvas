import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanningElement } from '@/types/canvas';
import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasElements } from './CanvasElements';

const konvaMockState = vi.hoisted(() => ({
  groups: [] as any[],
}));

vi.mock('react-konva', () => ({
  Group: (props: any) => {
    konvaMockState.groups.push(props);
    return <div data-testid={props.id ? `konva-group-${props.id}` : undefined}>{props.children}</div>;
  },
  Line: () => null,
  Rect: () => null,
  Text: () => null,
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

function makeTextNode() {
  return {
    id: 'story-node-1',
    type: 'text' as const,
    title: 'Story',
    text: 'Story',
    fontSize: 14,
    fontFamily: 'serif',
    fill: '#1f1a17',
    x: 260,
    y: 80,
    width: 200,
    height: 120,
  };
}

describe('CanvasElements', () => {
  beforeEach(() => {
    konvaMockState.groups = [];
    vi.clearAllMocks();
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

  it('does not crash when persisted data contains an unsupported legacy element type', () => {
    useCanvasStore.setState({
      elements: [
        {
          ...makeTextNode(),
          id: 'legacy-script-1',
          type: 'script',
        } as any,
      ],
      selectedIds: [],
    });

    expect(() => render(<CanvasElements guideLines={[]} snapCallbacks={snapCallbacks} />)).not.toThrow();
  });

  it('clamps grouped node drag positions inside the group frame', () => {
    const planning = makePlanningNode();
    const story = makeTextNode();
    const position = vi.fn();
    useCanvasStore.setState({
      elements: [planning, story],
      groups: [
        {
          id: 'project-1',
          childIds: [planning.id, story.id],
          frame: { x: 0, y: 0, width: 400, height: 300 },
        },
      ],
      selectedIds: [planning.id],
    });

    render(<CanvasElements guideLines={[]} snapCallbacks={snapCallbacks} />);

    const planningGroup = konvaMockState.groups.find(props => props.id === planning.id);
    planningGroup.onDragMove({
      target: {
        id: () => planning.id,
        x: () => 500,
        y: () => 500,
        position,
      },
    });

    expect(position).toHaveBeenCalledWith({ x: 60, y: 40 });
    expect(snapCallbacks.onDragMove).toHaveBeenCalledWith(
      planning.id,
      60,
      40,
      planning.x,
      planning.y,
      planning.width,
      planning.height,
    );
  });
});
