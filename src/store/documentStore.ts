import { create } from 'zustand';
import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer';
import type { CourseDocument } from '@core/model/types';
import { createDocument } from '@core/model/document';

enablePatches();

interface HistoryEntry {
  label: string;
  /** Chave de coalescência: entradas seguidas com a mesma chave viram uma só. */
  mergeKey: string | null;
  redo: Patch[];
  undo: Patch[];
}

const HISTORY_LIMIT = 200;

interface DocumentState {
  doc: CourseDocument;
  past: HistoryEntry[];
  future: HistoryEntry[];
  dirty: boolean;
  fileName: string | null;

  /** Única porta de entrada para mutar o documento. */
  apply: (label: string, recipe: (draft: CourseDocument) => void, mergeKey?: string) => void;
  /** Mutação sem histórico — só para carregar/trocar o documento inteiro. */
  replace: (doc: CourseDocument, fileName?: string | null) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  markSaved: (fileName?: string | null) => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  doc: createDocument(),
  past: [],
  future: [],
  dirty: false,
  fileName: null,

  apply: (label, recipe, mergeKey) => {
    const state = get();
    const [nextDoc, redo, undo] = produceWithPatches(state.doc, recipe);
    if (redo.length === 0) return;

    const last = state.past[state.past.length - 1];
    const canMerge = mergeKey != null && last != null && last.mergeKey === mergeKey;

    const entry: HistoryEntry = canMerge
      ? {
          label,
          mergeKey,
          // Refazer acumula na ordem; desfazer acumula na ordem inversa.
          redo: [...last!.redo, ...redo],
          undo: [...undo, ...last!.undo],
        }
      : { label, mergeKey: mergeKey ?? null, redo, undo };

    const past = canMerge ? state.past.slice(0, -1) : state.past;
    past.push(entry);
    if (past.length > HISTORY_LIMIT) past.shift();

    set({ doc: nextDoc, past, future: [], dirty: true });
  },

  replace: (doc, fileName = null) =>
    set({ doc, past: [], future: [], dirty: false, fileName }),

  undo: () => {
    const { past, future, doc } = get();
    const entry = past[past.length - 1];
    if (!entry) return;
    set({
      doc: applyPatches(doc, entry.undo),
      past: past.slice(0, -1),
      future: [...future, entry],
      dirty: true,
    });
  },

  redo: () => {
    const { past, future, doc } = get();
    const entry = future[future.length - 1];
    if (!entry) return;
    set({
      doc: applyPatches(doc, entry.redo),
      past: [...past, entry],
      future: future.slice(0, -1),
      dirty: true,
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  markSaved: (fileName) =>
    set((s) => ({ dirty: false, fileName: fileName === undefined ? s.fileName : fileName })),
}));
