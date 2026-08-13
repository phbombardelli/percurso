import type { Vec2 } from '@core/geometry/vec';
import type { Meters, Millimeters, PageSetup } from '@core/scale/units';

/**
 * Modelo de dados do documento. Toda geometria em METROS; todo tamanho de
 * anotação (traço, corpo de texto, seta) em MILÍMETROS DE PAPEL.
 * Ver docs/DECISOES.md, decisões 1 e 3.
 */

export type ObjectId = string;

export type LayerId =
  | 'background'
  | 'arena'
  | 'paths'
  | 'obstacles'
  | 'ornaments'
  | 'annotations';

export const LAYER_ORDER: readonly LayerId[] = [
  'background',
  'arena',
  'paths',
  'obstacles',
  'ornaments',
  'annotations',
] as const;

export interface Layer {
  id: LayerId;
  label: string;
  visible: boolean;
  locked: boolean;
}

interface BaseObject {
  id: ObjectId;
  layer: LayerId;
  locked: boolean;
  visible: boolean;
  /** Ordem dentro da camada. */
  z: number;
}

/* ---------------------------------------------------------------- pista */

export type ArenaShape = 'rectangle' | 'polygon';
export type CornerStyle = 'square' | 'rounded' | 'chamfer';

export interface Arena extends BaseObject {
  kind: 'arena';
  shape: ArenaShape;
  /** Canto superior esquerdo, para shape 'rectangle'. */
  origin: Vec2;
  widthM: Meters;
  heightM: Meters;
  /** Vértices em metros, para shape 'polygon'. */
  points: Vec2[];
  corner: { style: CornerStyle; radiusM: Meters };
  /** Régua de metros impressa no perímetro, como nos croquis FEI. */
  perimeterRuler: {
    visible: boolean;
    stepM: Meters;
    labelEveryM: Meters;
    sides: { top: boolean; right: boolean; bottom: boolean; left: boolean };
  };
  style: { strokeMm: Millimeters; fill: string; stroke: string };
}

/* ----------------------------------------------------------- obstáculos */

export type ObstacleType =
  | 'vertical'
  | 'oxer'
  | 'triplice'
  | 'muro'
  | 'rio'
  | 'liverpool'
  | 'plano';

export interface ObstacleElement {
  /** Altura em metros. `null` = não informada. */
  height: Meters | null;
  label?: string;
}

export interface Obstacle extends BaseObject {
  kind: 'obstacle';
  type: ObstacleType;
  /** Centro geométrico do obstáculo. */
  pos: Vec2;
  /** Absoluta, em graus horários. Nunca acumulada. */
  rotation: number;
  /** Frente do obstáculo (largura da barra). */
  faceWidthM: Meters;
  /** Profundidade real, para oxer/tríplice/rio. `null` quando não se aplica. */
  spreadM: Meters | null;
  /** Texto livre: "7", "10", "" — numeração manual (§14). */
  number: string;
  letter: 'A' | 'B' | 'C' | '';
  elements: ObstacleElement[];
  arrow: { visible: boolean; reversed: boolean; lengthMm: Millimeters };
  /** Rótulo de alturas ao lado do obstáculo, como no croqui de referência. */
  heightLabel: { visible: boolean; offsetM: Vec2 };
  numberLabel: { visible: boolean; offsetM: Vec2 };
  note: string;
}

/* -------------------------------------------------------------- traçado */

export type NodeType = 'corner' | 'smooth';

export interface PathNode {
  pos: Vec2;
  type: NodeType;
  /** Alças relativas ao nó, em metros. `null` = segmento reto desse lado. */
  handleIn: Vec2 | null;
  handleOut: Vec2 | null;
  /** Vínculo opcional a um obstáculo: mover o obstáculo arrasta o nó. */
  anchor: { objectId: ObjectId; ref: 'takeoff' | 'landing' | 'center' } | null;
}

export type DashPreset = 'solid' | 'dashed' | 'dotted' | 'dashdot';

export interface DistanceLabel {
  visible: boolean;
  /** Deslocamento em relação ao ponto médio da perna, em metros. */
  offsetM: Vec2;
  decimals: number;
  color: string;
}

export interface CoursePath extends BaseObject {
  kind: 'path';
  nodes: PathNode[];
  /** Trechos medidos entre dois nós, cada um com seu rótulo de distância. */
  legs: { fromNode: number; toNode: number; label: DistanceLabel }[];
  style: { dash: DashPreset; strokeMm: Millimeters; color: string };
}

/* ------------------------------------------------------------ anotações */

export interface TextLabel extends BaseObject {
  kind: 'text';
  pos: Vec2;
  text: string;
  sizeMm: Millimeters;
  align: 'start' | 'middle' | 'end';
  rotation: number;
  color: string;
  bold: boolean;
}

export interface InfoBoxField {
  id: string;
  label: string;
  value: string;
  enabled: boolean;
}

export interface InfoBox extends BaseObject {
  kind: 'infobox';
  /** Posição em milímetros de papel: o quadro é anotação, não geometria. */
  posMm: Vec2;
  widthMm: Millimeters;
  columns: number;
  fields: InfoBoxField[];
  style: { sizeMm: Millimeters; borderMm: Millimeters };
}

export interface HeightTable extends BaseObject {
  kind: 'heighttable';
  posMm: Vec2;
  /** Número de colunas de elemento (varas) exibidas. */
  elementColumns: number;
  showSpread: boolean;
  showNote: boolean;
  style: { sizeMm: Millimeters; rowHeightMm: Millimeters };
}

/* -------------------------------------------------- fundo e ornamentos */

export interface BackgroundImage extends BaseObject {
  kind: 'image';
  assetId: string;
  /** Canto superior esquerdo, em metros. */
  origin: Vec2;
  /** Escala resultante da calibração: metros por pixel da imagem. */
  metersPerPixel: number;
  rotation: number;
  opacity: number;
  /** Registro da calibração feita, para poder revisar/refazer. */
  calibration: {
    pointA: Vec2;
    pointB: Vec2;
    knownDistanceM: Meters;
  } | null;
}

export type OrnamentType = 'arvore' | 'arbusto' | 'vaso' | 'cerca' | 'cronometro' | 'seta';

export interface Ornament extends BaseObject {
  kind: 'ornament';
  type: OrnamentType;
  pos: Vec2;
  rotation: number;
  sizeM: Meters;
  color: string;
}

/* ------------------------------------------------------------ documento */

export type SceneObject =
  | Arena
  | Obstacle
  | CoursePath
  | TextLabel
  | InfoBox
  | HeightTable
  | BackgroundImage
  | Ornament;

export type ObjectKind = SceneObject['kind'];

export interface GridSettings {
  visible: boolean;
  /** 0 = automático conforme o zoom. */
  stepM: Meters;
  subdivisions: number;
  snap: boolean;
  snapStepM: Meters;
  angleSnapDeg: number;
}

export interface DocumentMeta {
  title: string;
  competition: string;
  venue: string;
  date: string;
  designer: string;
  technicalDelegate: string;
}

export interface Asset {
  mime: string;
  /** Data URL completa. Embutida no arquivo do projeto. */
  dataUrl: string;
  width: number;
  height: number;
  name: string;
}

export interface CourseDocument {
  schemaVersion: number;
  meta: DocumentMeta;
  page: PageSetup;
  /** Onde o ponto (0,0) do modelo cai na página, em mm. */
  originMm: Vec2;
  grid: GridSettings;
  layers: Layer[];
  objects: SceneObject[];
  assets: Record<string, Asset>;
}

export const SCHEMA_VERSION = 1;
