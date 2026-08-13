import { create } from 'zustand';
import type { Vec2 } from '@core/geometry/vec';
import type { ObjectId, OrnamentType, SceneObject } from '@core/model/types';
import type { Viewport } from '@core/scale/viewport';
import { ZOOM_ACTUAL_SIZE } from '@core/scale/viewport';

/**
 * Estado de edição. NÃO é salvo no arquivo e NÃO entra no histórico:
 * zoom, seleção e ferramenta ativa não são dados do croqui.
 */

export type Tool = 'select' | 'pan' | 'ornament' | 'arena-rect' | 'arena-polygon';

interface EditorState {
  tool: Tool;
  viewport: Viewport;
  selection: ObjectId[];
  /** Ponto do modelo sob o cursor, em metros. `null` fora do canvas. */
  cursorM: Vec2 | null;
  /** Snap temporariamente suspenso (tecla Alt). */
  snapSuspended: boolean;
  showPageFrame: boolean;
  /** Área de transferência do editor: cópias profundas, sem id. */
  clipboard: SceneObject[];
  /** Tipo de ornamento que a ferramenta de inserção vai criar. */
  ornamentType: OrnamentType;
  /**
   * Desenho em andamento (contorno da pista): vértices já fixados e o
   * ponto sob o cursor. Some ao concluir ou cancelar — nunca vira dado.
   */
  draft: { points: Vec2[]; cursor: Vec2 | null } | null;
  /** Modo de edição de vértices do contorno selecionado. */
  editingVertices: boolean;

  setTool: (tool: Tool) => void;
  setViewport: (vp: Viewport) => void;
  setSelection: (ids: ObjectId[]) => void;
  toggleSelection: (id: ObjectId) => void;
  clearSelection: () => void;
  setCursor: (p: Vec2 | null) => void;
  setSnapSuspended: (v: boolean) => void;
  togglePageFrame: () => void;
  setClipboard: (objs: SceneObject[]) => void;
  setOrnamentType: (t: OrnamentType) => void;
  startDraft: (first: Vec2) => void;
  addDraftPoint: (p: Vec2) => void;
  setDraftCursor: (p: Vec2 | null) => void;
  clearDraft: () => void;
  setEditingVertices: (v: boolean) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  tool: 'select',
  viewport: { centerMm: { x: 148, y: 105 }, zoom: ZOOM_ACTUAL_SIZE },
  selection: [],
  cursorM: null,
  snapSuspended: false,
  showPageFrame: true,
  clipboard: [],
  ornamentType: 'arvore',
  draft: null,
  editingVertices: false,

  setTool: (tool) => set({ tool }),
  setViewport: (viewport) => set({ viewport }),
  setSelection: (selection) => set({ selection }),
  toggleSelection: (id) =>
    set((s) => ({
      selection: s.selection.includes(id)
        ? s.selection.filter((x) => x !== id)
        : [...s.selection, id],
    })),
  clearSelection: () => set({ selection: [] }),
  setCursor: (cursorM) => set({ cursorM }),
  setSnapSuspended: (snapSuspended) => set({ snapSuspended }),
  togglePageFrame: () => set((s) => ({ showPageFrame: !s.showPageFrame })),
  setClipboard: (clipboard) => set({ clipboard }),
  setOrnamentType: (ornamentType) => set({ ornamentType }),
  startDraft: (first) => set({ draft: { points: [first], cursor: first } }),
  addDraftPoint: (p) =>
    set((s) => (s.draft ? { draft: { ...s.draft, points: [...s.draft.points, p] } } : {})),
  setDraftCursor: (cursor) => set((s) => (s.draft ? { draft: { ...s.draft, cursor } } : {})),
  clearDraft: () => set({ draft: null }),
  setEditingVertices: (editingVertices) => set({ editingVertices }),
}));
