import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NodeToolbarOverlay, getNodeToolbarActions } from './NodeToolbarOverlay';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { ImageElement, PlanningElement, TextElement } from '@/types/canvas';

const stageConfig = { x: 10, y: 20, scale: 1 };

function makeTextNode(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: 'text-1',
    type: 'text',
    x: 100,
    y: 120,
    width: 300,
    height: 180,
    text: '剧情节点',
    prompt: '续写这场戏',
    fontSize: 14,
    fontFamily: 'var(--font-serif)',
    fill: '#26211c',
    ...overrides,
  };
}

function makeImageNode(overrides: Partial<ImageElement> = {}): ImageElement {
  return {
    id: 'image-1',
    type: 'image',
    x: 100,
    y: 120,
    width: 320,
    height: 240,
    src: 'data:image/png;base64,abc',
    prompt: '雪夜旧仓库',
    ...overrides,
  };
}

function makePlanningNode(overrides: Partial<PlanningElement> = {}): PlanningElement {
  return {
    id: 'planning-1',
    type: 'planning',
    kind: 'projectSeed',
    title: '项目种子',
    body: '女主在雪夜发现真相',
    x: 100,
    y: 120,
    width: 360,
    height: 260,
    ...overrides,
  };
}

describe('NodeToolbarOverlay', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      elements: [],
      selectedIds: [],
      connections: [],
      groups: [],
      past: [],
      future: [],
      currentLabel: '初始状态',
      currentTimestamp: 0,
      _coalesceKey: undefined,
      _coalesceAt: undefined,
      inpaintMask: null,
    } as Partial<ReturnType<typeof useCanvasStore.getState>>);
  });

  it('shows image-only tools without leaking crop to text nodes', () => {
    const text = makeTextNode();
    const image = makeImageNode();

    expect(getNodeToolbarActions(image).map(action => action.label)).toContain('裁剪');
    expect(getNodeToolbarActions(text).map(action => action.label)).not.toContain('裁剪');

    render(
      <NodeToolbarOverlay
        elements={[text]}
        selectedIds={[text.id]}
        stageConfig={stageConfig}
      />,
    );

    expect(screen.getByRole('toolbar', { name: '文本快捷工具' })).toBeInTheDocument();
    expect(screen.queryByText('文本节点')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '裁剪' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '编辑文本' })).toBeInTheDocument();
  });

  it('renders crop for image nodes and starts an image edit selection', () => {
    const image = makeImageNode();
    useCanvasStore.setState({ elements: [image], selectedIds: [image.id] });

    render(
      <NodeToolbarOverlay
        elements={[image]}
        selectedIds={[image.id]}
        stageConfig={stageConfig}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '裁剪' }));

    expect(useCanvasStore.getState().inpaintMask).toEqual({
      elementId: image.id,
      rect: null,
    });
  });

  it('shows only multi-selection tools when two or more nodes are selected', () => {
    const text = makeTextNode();
    const image = makeImageNode();
    useCanvasStore.setState({ elements: [text, image], selectedIds: [text.id, image.id] });

    render(
      <NodeToolbarOverlay
        elements={[text, image]}
        selectedIds={[text.id, image.id]}
        stageConfig={stageConfig}
      />,
    );

    expect(screen.getByRole('toolbar', { name: '多选快捷工具' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打组' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '裁剪' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '剧本续写' })).not.toBeInTheDocument();
  });

  it('creates a group from the multi-selection toolbar', () => {
    const text = makeTextNode();
    const image = makeImageNode();
    useCanvasStore.setState({ elements: [text, image], selectedIds: [text.id, image.id] });

    render(
      <NodeToolbarOverlay
        elements={[text, image]}
        selectedIds={[text.id, image.id]}
        stageConfig={stageConfig}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '打组' }));

    expect(useCanvasStore.getState().groups).toHaveLength(1);
    expect(useCanvasStore.getState().groups[0].childIds).toEqual([text.id, image.id]);
  });

  it('dispatches edit events for text nodes', () => {
    const text = makeTextNode();
    const listener = vi.fn();
    window.addEventListener('text:edit', listener);

    render(
      <NodeToolbarOverlay
        elements={[text]}
        selectedIds={[text.id]}
        stageConfig={stageConfig}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '编辑文本' }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({
      detail: { id: text.id },
    });

    window.removeEventListener('text:edit', listener);
  });

  it('uses planning-specific actions without image tools', () => {
    const planning = makePlanningNode();

    render(
      <NodeToolbarOverlay
        elements={[planning]}
        selectedIds={[planning.id]}
        stageConfig={stageConfig}
      />,
    );

    expect(screen.getByRole('toolbar', { name: '企划快捷工具' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '规划' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '裁剪' })).not.toBeInTheDocument();
  });

  it('dispatches screenwriting events for text nodes', () => {
    const text = makeTextNode();
    const listener = vi.fn();
    window.addEventListener('node-toolbar:screenwriting', listener);

    render(
      <NodeToolbarOverlay
        elements={[text]}
        selectedIds={[text.id]}
        stageConfig={stageConfig}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '剧本续写' }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({
      detail: { id: text.id },
    });

    window.removeEventListener('node-toolbar:screenwriting', listener);
  });

  it('anchors the toolbar wrapper to the selected node top center without a node-width spacer', () => {
    const text = makeTextNode({ x: 100, y: 120, width: 300, height: 180 });

    render(
      <NodeToolbarOverlay
        elements={[text]}
        selectedIds={[text.id]}
        stageConfig={stageConfig}
      />,
    );

    const toolbar = screen.getByRole('toolbar', { name: '文本快捷工具' });

    expect(toolbar).toHaveStyle({
      left: `${stageConfig.x + (text.x + text.width / 2) * stageConfig.scale}px`,
      top: `${stageConfig.y + (text.y - 8) * stageConfig.scale}px`,
      transform: 'translate(-50%, -100%)',
    });
    expect(toolbar).not.toHaveClass('anim-pop');
    expect(toolbar).not.toHaveStyle({ minWidth: `${text.width}px` });
  });

  it('does not render a node type label inside the compact toolbar', () => {
    const text = makeTextNode();

    render(
      <NodeToolbarOverlay
        elements={[text]}
        selectedIds={[text.id]}
        stageConfig={stageConfig}
      />,
    );

    expect(screen.queryByText('文本节点')).not.toBeInTheDocument();
    expect(screen.queryByText('图片节点')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '编辑文本' })).toBeInTheDocument();
  });

  it('renders visible function names for toolbar actions', () => {
    const text = makeTextNode();

    render(
      <NodeToolbarOverlay
        elements={[text]}
        selectedIds={[text.id]}
        stageConfig={stageConfig}
      />,
    );

    expect(screen.getByText('编辑文本')).toBeInTheDocument();
    expect(screen.getByText('剧本续写')).toBeInTheDocument();
    expect(screen.getByText('复制文本')).toBeInTheDocument();
    expect(screen.getByText('删除')).toBeInTheDocument();
  });
});
