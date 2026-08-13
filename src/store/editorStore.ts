import { create } from 'zustand';
import type { Vec2 } from '@core/geometry/vec';
import type { ObjectId, OrnamentType, SceneObject } from '@core/model/types';
import type { Viewport } from '@core/scale/viewport';
import { ZOOM_ACTUAL_SIZE } from '@core/scale/viewport';

/**
 * Estado de edição. NÃO é salvo no arquivo e NÃO entra no histórico:
 * zoom, seleção e ferramenta ativa não são dados do croqui.
 */

export type Tool = 'select' | 'pan' | 'ornament';

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
}));
