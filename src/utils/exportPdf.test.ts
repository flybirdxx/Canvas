import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanningElement } from '@/types/canvas';
import { useCanvasStore } from '@/store/useCanvasStore';
import { exportAsCustomPdf, exportViewportAsPdf } from './exportPdf';
import { getStage } from './stageRegistry';

const { MockPdf, pdfInstances } = vi.hoisted(() => {
  class MockPdf {
    addImage = vi.fn();
    save = vi.fn();
    setTextColor = vi.fn();
    setFontSize = vi.fn();
    splitTextToSize = vi.fn((text: string) => [text]);
    text = vi.fn();
    addFileToVFS = vi.fn();
    addFont = vi.fn();
    setFont = vi.fn();

    constructor() {
      pdfInstances.push(this);
    }
  }

  const pdfInstances: MockPdf[] = [];
  return { MockPdf, pdfInstances };
});

vi.mock('jspdf', () => ({
  jsPDF: MockPdf,
}));

vi.mock('./stageRegistry', () => ({
  getStage: vi.fn(),
}));

function makeStage() {
  return {
    width: vi.fn(() => 800),
    height: vi.fn(() => 600),
    toDataURL: vi.fn(() => 'data:image/png;base64,stage'),
  };
}

function makePlanningNode(overrides: Partial<PlanningElement> = {}): PlanningElement {
  return {
    id: 'planning-1',
    type: 'planning',
    kind: 'plot',
    title: '剧情节点',
    body: '主角发现红色怀表。',
    x: 100,
    y: 80,
    width: 360,
    height: 260,
    outputs: [{ id: 'plan-out', type: 'text', label: 'Plan' }],
    requirements: [
      {
        id: 'req-confirmed',
        title: '红色怀表',
        materialType: 'prop',
        description: '红色旧怀表特写',
        status: 'confirmed',
      },
    ],
    ...overrides,
  };
}

describe('exportPdf planning text layer', () => {
  beforeEach(() => {
    pdfInstances.length = 0;
    vi.mocked(getStage).mockReturnValue(makeStage() as any);
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    useCanvasStore.setState({
      elements: [makePlanningNode()],
      selectedIds: [],
      connections: [],
      stageConfig: { x: 0, y: 0, scale: 1 },
    });
  });

  it('draws planning text when exporting the current viewport PDF', async () => {
    await expect(exportViewportAsPdf()).resolves.toBe(true);

    expect(pdfInstances).toHaveLength(1);
    expect(pdfInstances[0].text).toHaveBeenCalledWith(
      expect.stringContaining('剧情节点'),
      expect.any(Number),
      expect.any(Number),
      expect.any(Object),
    );
  });

  it('draws planning text when exporting custom PDFs', async () => {
    await expect(exportAsCustomPdf('a4')).resolves.toBe(true);

    expect(pdfInstances).toHaveLength(1);
    expect(pdfInstances[0].text).toHaveBeenCalledWith(
      expect.stringContaining('剧情节点'),
      expect.any(Number),
      expect.any(Number),
      expect.any(Object),
    );
  });
});
