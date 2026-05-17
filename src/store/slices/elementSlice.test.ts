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

function makePlanning(id: string, x = 0, y = 0): CanvasElement {
  return {
    id,
    type: 'planning',
    kind: 'projectSeed',
    title: 'Project',
    body: 'Plan',
    x,
    y,
    width: 340,
    height: 260,
  };
}

function makeText(id: string, x = 0, y = 0): CanvasElement {
  return {
    id,
    type: 'text',
    text: 'Story',
    fontSize: 18,
    fontFamily: 'serif',
    fill: '#1f1a17',
    x,
    y,
    width: 320,
    height: 180,
  };
}

function makeSticky(id: string, x = 0, y = 0): CanvasElement {
  return {
    id,
    type: 'sticky',
    text: 'Note',
    fill: '#f5d47a',
    x,
    y,
    width: 220,
    height: 160,
  };
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

  it('creates a labeled project group from explicit element ids', () => {
    const store = createTestStore();
    store.getState().addElement(makePlanning('plan'));
    store.getState().addElement(makeText('story', 360, 0));
    store.getState().setSelection(['story']);

    store.getState().createGroupFromIds('project-1', ['plan', 'story'], '短剧项目');

    expect(store.getState().groups).toEqual([
      { id: 'project-1', childIds: ['plan', 'story'], label: '短剧项目' },
    ]);
    expect(store.getState().selectedIds).toEqual(['story']);
    expect(store.getState().past).toHaveLength(3);
    expect(store.getState().future).toEqual([]);
  });

  it('filters duplicate and missing ids before creating explicit groups', () => {
    const store = createTestStore();
    store.getState().addElement(makePlanning('plan'));
    store.getState().addElement(makeText('story', 360, 0));
    const pastLengthBeforeInvalidGroup = store.getState().past.length;

    store.getState().createGroupFromIds('project-1', ['plan', 'missing', 'plan'], '短剧项目');
    expect(store.getState().groups).toEqual([]);
    expect(store.getState().past).toHaveLength(pastLengthBeforeInvalidGroup);

    store.getState().createGroupFromIds('project-1', ['plan', 'missing', 'story', 'story'], '短剧项目');
    expect(store.getState().groups).toEqual([
      { id: 'project-1', childIds: ['plan', 'story'], label: '短剧项目' },
    ]);
  });
  it('does not push history for duplicate explicit group replacement', () => {
    const store = createTestStore();
    store.getState().addElement(makePlanning('plan'));
    store.getState().addElement(makeText('story', 360, 0));
    store.getState().createGroupFromIds('project-1', ['plan', 'story'], '短剧项目');
    const groups = store.getState().groups;
    const pastLength = store.getState().past.length;

    store.getState().createGroupFromIds('project-1', ['plan', 'story'], '短剧项目');

    expect(store.getState().groups).toEqual(groups);
    expect(store.getState().past).toHaveLength(pastLength);
  });

  it('does not push history when empty label normalizes to no label', () => {
    const store = createTestStore();
    store.getState().addElement(makePlanning('plan'));
    store.getState().addElement(makeText('story', 360, 0));
    store.getState().createGroupFromIds('project-1', ['plan', 'story']);
    const groups = store.getState().groups;
    const pastLength = store.getState().past.length;

    store.getState().createGroupFromIds('project-1', ['plan', 'story'], '');

    expect(store.getState().groups).toEqual(groups);
    expect(store.getState().past).toHaveLength(pastLength);
  });

  it('restores groups through undo and redo after creating explicit groups', () => {
    const store = createTestStore();
    store.getState().addElement(makePlanning('plan'));
    store.getState().addElement(makeText('story', 360, 0));
    store.getState().addElement(makeSticky('note', 720, 0));
    store.getState().addElement(makeImage('img', 1080, 0));
    store.getState().createGroupFromIds('existing', ['note', 'img'], 'Existing');

    store.getState().createGroupFromIds('project-1', ['plan', 'story'], 'Project');
    expect(store.getState().groups).toEqual([
      { id: 'existing', childIds: ['note', 'img'], label: 'Existing' },
      { id: 'project-1', childIds: ['plan', 'story'], label: 'Project' },
    ]);

    store.getState().undo();
    expect(store.getState().groups).toEqual([
      { id: 'existing', childIds: ['note', 'img'], label: 'Existing' },
    ]);

    store.getState().redo();
    expect(store.getState().groups).toEqual([
      { id: 'existing', childIds: ['note', 'img'], label: 'Existing' },
      { id: 'project-1', childIds: ['plan', 'story'], label: 'Project' },
    ]);
  });

  it('restores groups when jumping across history entries', () => {
    const store = createTestStore();
    store.getState().addElement(makePlanning('plan'));
    store.getState().addElement(makeText('story', 360, 0));
    store.getState().addElement(makeSticky('note', 720, 0));
    store.getState().addElement(makeImage('img', 1080, 0));
    const beforeGroupsIndex = store.getState().past.length;

    store.getState().createGroupFromIds('project-1', ['plan', 'story'], 'Project');
    const firstGroupIndex = store.getState().past.length;
    store.getState().createGroupFromIds('project-1', ['plan', 'note'], 'Project');
    const changedGroupIndex = store.getState().past.length;

    expect(store.getState().groups).toEqual([
      { id: 'project-1', childIds: ['plan', 'note'], label: 'Project' },
    ]);

    store.getState().jumpToHistory(beforeGroupsIndex);
    expect(store.getState().groups).toEqual([]);

    store.getState().jumpToHistory(firstGroupIndex);
    expect(store.getState().groups).toEqual([
      { id: 'project-1', childIds: ['plan', 'story'], label: 'Project' },
    ]);

    store.getState().jumpToHistory(changedGroupIndex);
    expect(store.getState().groups).toEqual([
      { id: 'project-1', childIds: ['plan', 'note'], label: 'Project' },
    ]);
  });

  it('moves explicit group ids out of other groups and removes undersized groups', () => {
    const store = createTestStore();
    store.getState().addElement(makePlanning('plan'));
    store.getState().addElement(makeText('story', 360, 0));
    store.getState().addElement(makeSticky('note', 720, 0));
    store.getState().addElement(makeImage('img', 1080, 0));
    store.setState({
      groups: [
        { id: 'old-survives', childIds: ['plan', 'story', 'note'], label: 'Old' },
        { id: 'old-removed', childIds: ['img', 'note'], label: 'Removed' },
      ],
    });

    store.getState().createGroupFromIds('project-1', ['plan', 'img'], 'Project');

    expect(store.getState().groups).toEqual([
      { id: 'old-survives', childIds: ['story', 'note'], label: 'Old' },
      { id: 'project-1', childIds: ['plan', 'img'], label: 'Project' },
    ]);
  });
}); 
