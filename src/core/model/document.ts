import type { Vec2 } from '@core/geometry/vec';
import { fitScale, pageSize, usableArea } from '@core/scale/units';
import { newId } from './ids';
import type {
  Arena,
  CourseDocument,
  Layer,
  LayerId,
  ObjectId,
  SceneObject,
} from './types';
import { LAYER_ORDER, SCHEMA_VERSION } from './types';

const LAYER_LABELS: Record<LayerId, string> = {
  background: 'Imagem de fundo',
  arena: 'Pista',
  paths: 'Traçados',
  obstacles: 'Obstáculos',
  ornaments: 'Ornamentação',
  annotations: 'Textos e quadros',
};

export function defaultLayers(): Layer[] {
  return LAYER_ORDER.map((id) => ({
    id,
    label: LAYER_LABELS[id],
    visible: true,
    locked: false,
  }));
}

export function createArena(widthM = 80, heightM = 40): Arena {
  return {
    id: newId('arena'),
    kind: 'arena',
    layer: 'arena',
    locked: false,
    visible: true,
    z: 0,
    shape: 'rectangle',
    origin: { x: 0, y: 0 },
    widthM,
    heightM,
    points: [],
    corner: { style: 'chamfer', radiusM: 4 },
    perimeterRuler: {
      visible: true,
      stepM: 5,
      labelEveryM: 5,
      sides: { top: true, right: true, bottom: true, left: true },
    },
    style: { strokeMm: 0.5, fill: '#ffffff', stroke: '#1a1a1a' },
  };
}

/** Documento novo: A3 paisagem, pista 80×40 centralizada na área útil. */
export function createDocument(): CourseDocument {
  const page = {
    format: 'A3' as const,
    widthMm: 297,
    heightMm: 420,
    orientation: 'landscape' as const,
    marginsMm: { top: 10, right: 10, bottom: 10, left: 10 },
    printScale: 250,
  };
  const arena = createArena();
  page.printScale = fitScaleForArena(arena, page);

  return {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      title: '',
      competition: '',
      venue: '',
      date: '',
      designer: '',
      technicalDelegate: '',
    },
    page,
    originMm: centerOriginMm(arena, page),
    grid: {
      visible: true,
      stepM: 0,
      subdivisions: 5,
      snap: true,
      snapStepM: 0.5,
      angleSnapDeg: 15,
    },
    layers: defaultLayers(),
    objects: [arena],
    assets: {},
  };
}

function fitScaleForArena(arena: Arena, page: CourseDocument['page']): number {
  const usable = usableArea(page);
  // Folga de 25% da altura reservada ao cabeçalho e ao quadro técnico.
  return fitScale(arena.widthM, arena.heightM, usable.widthMm, usable.heightMm * 0.75);
}

/** Posição em mm onde o modelo (0,0) deve cair para centralizar a pista. */
function centerOriginMm(arena: Arena, page: CourseDocument['page']): Vec2 {
  const usable = usableArea(page);
  const k = 1000 / page.printScale;
  const drawW = arena.widthM * k;
  const drawH = arena.heightM * k;
  return {
    x: usable.xMm + (usable.widthMm - drawW) / 2 - arena.origin.x * k,
    y: usable.yMm + (usable.heightMm - drawH) / 2 - arena.origin.y * k,
  };
}

/**
 * Recentraliza o desenho na área útil da página. Chamado explicitamente
 * pelo usuário — trocar de escala ou de formato não move o desenho sozinho.
 */
export function centerOnPage(doc: CourseDocument): void {
  const arena = firstArena(doc);
  if (!arena) return;
  doc.originMm = centerOriginMm(arena, doc.page);
}

/** Escala que faz a pista caber na página, já arredondada. */
export function fitScaleToPage(doc: CourseDocument): number {
  const arena = firstArena(doc);
  return arena ? fitScaleForArena(arena, doc.page) : doc.page.printScale;
}

export const pageRectMm = (doc: CourseDocument) => {
  const { widthMm, heightMm } = pageSize(doc.page);
  return { x: 0, y: 0, width: widthMm, height: heightMm };
};

export function findObject(doc: CourseDocument, id: ObjectId): SceneObject | undefined {
  return doc.objects.find((o) => o.id === id);
}

export function objectsOfLayer(doc: CourseDocument, layer: LayerId): SceneObject[] {
  return doc.objects.filter((o) => o.layer === layer).sort((a, b) => a.z - b.z);
}

export function firstArena(doc: CourseDocument): Arena | undefined {
  return doc.objects.find((o): o is Arena => o.kind === 'arena');
}

export function isLayerLocked(doc: CourseDocument, layer: LayerId): boolean {
  return doc.layers.find((l) => l.id === layer)?.locked ?? false;
}

export function isLayerVisible(doc: CourseDocument, layer: LayerId): boolean {
  return doc.layers.find((l) => l.id === layer)?.visible ?? true;
}
