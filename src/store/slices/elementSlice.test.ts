// Store slice tests - element CRUD, history undo/redo, connections 
  
import { describe, it, expect } from 'vitest'; 
import { create } from 'zustand'; 
import { createElementSlice } from './elementSlice';  
import { createHistorySlice } from './historySlice';  
import { createConnectionSlice } from './connectionSlice';  
import { createUISlice } from './uiSlice'; 
  
import type { CanvasElement } from '@/types/canvas'; 
  
function makeImage(id: string, x = 0, y = 0): CanvasElement {  
  return { id, type: 'image', x, y, width: 400, height: 400, src: '' };  
} 
  
function createTestStore() {  
  return create<any>()((...args) => ({  
    ...createElementSlice(...args),  
    ...createHistorySlice(...args),  
    ...createConnectionSlice(...args),  
    ...createUISlice(...args),  
  }));  
} 
  
describe('elementSlice', () => { 
  it('should add an element and push undo entry', () => {  
    const store = createTestStore();  
    const el = makeImage('img1');  
    store.getState().addElement(el);  
    const s = store.getState();  
    expect(s.elements).toHaveLength(1);  
    expect(s.elements[0].id).toBe('img1');  
    expect(s.past).toHaveLength(1); // one undo entry  
    expect(s.future).toHaveLength(0);  
  }); 
  
  it('should undo addElement', () => {  
    const store = createTestStore();  
    store.getState().addElement(makeImage('img1'));  
    store.getState().undo();  
    expect(store.getState().elements).toHaveLength(0);  
    expect(store.getState().future).toHaveLength(1);  
  }); 
  
  it('should redo after undo', () => {  
    const store = createTestStore();  
    store.getState().addElement(makeImage('img1'));  
    store.getState().undo();  
    store.getState().redo();  
    expect(store.getState().elements).toHaveLength(1);  
    expect(store.getState().elements[0].id).toBe('img1');  
  }); 
  
  it('should delete elements', () => {  
    const store = createTestStore();  
    store.getState().addElement(makeImage('img1'));  
    store.getState().addElement(makeImage('img2',100,0));  
    store.getState().deleteElements(['img1']);  
    const s = store.getState();  
    expect(s.elements).toHaveLength(1);  
    expect(s.elements[0].id).toBe('img2');  
  }); 
  
  it('should add default ports for image elements', () => {  
    const store = createTestStore();  
    store.getState().addElement({ id: 'img1', type: 'image', x: 0, y: 0, width: 400, height: 400, src: '' });  
    const el = store.getState().elements[0];  
    expect(el.inputs).toBeDefined();  
    expect(el.inputs!.length).toBeGreaterThan(0);  
    expect(el.inputs!.some(p => p.type === 'text')).toBe(true);  
    expect(el.outputs).toBeDefined();  
    expect(el.outputs!.some(p => p.type === 'image')).toBe(true);  
  });  

  it('preserves planning draft metadata when adding image elements', () => {
    const store = createTestStore();
    const draftImage: CanvasElement = {
      id: 'img-draft-1',
      type: 'image',
      x: 0,
      y: 0,
      width: 400,
      height: 400,
      src: '',
      planningDraft: {
        sourcePlanningId: 'plan1',
        sourceRequirementId: 'req1',
        projectId: 'project1',
        status: 'pendingReview',
      },
    };

    store.getState().addElement(draftImage);

    const el = store.getState().elements[0];
    expect(el.planningDraft).toEqual({
      sourcePlanningId: 'plan1',
      sourceRequirementId: 'req1',
      projectId: 'project1',
      status: 'pendingReview',
    });
  });

  it('adds default ports to planning nodes', () => {
    const store = createTestStore();

    store.getState().addElement({
      id: 'plan1',
      type: 'planning',
      kind: 'projectSeed',
      title: '项目种子',
      body: '一句想法',
      x: 0,
      y: 0,
      width: 340,
      height: 260,
    });

    const node = store.getState().elements.find(el => el.id === 'plan1');
    expect(node?.inputs?.map(port => port.label)).toEqual(['Context']);
    expect(node?.outputs?.map(port => port.label)).toEqual(['Plan']);
  });
}); 
