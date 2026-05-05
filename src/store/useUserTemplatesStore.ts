import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CanvasTemplate } from '../data/templates';

interface UserTemplatesState {
  templates: CanvasTemplate[];
  saveTemplate: (tpl: CanvasTemplate) => void;
  deleteTemplate: (id: string) => void;
  listTemplates: () => CanvasTemplate[];
}

export const useUserTemplatesStore = create<UserTemplatesState>()(
  persist(
    (set, get) => ({
      templates: [],

      saveTemplate: (tpl: CanvasTemplate) => {
        set(state => ({
          templates: [...state.templates, tpl],
        }));
      },

      deleteTemplate: (id: string) => {
        set(state => ({
          templates: state.templates.filter(t => t.id !== id),
        }));
      },

      listTemplates: () => get().templates,
    }),
    {
      name: 'ai-canvas-user-templates',
      version: 0,
    },
  ),
);
