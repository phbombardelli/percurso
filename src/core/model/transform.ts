import type { Vec2 } from '@core/geometry/vec';
import { rotate } from '@core/geometry/vec';
import { arenaPoints } from './arena';
import { paperToMeters } from '@core/scale/units';
import type { Meters, PrintScale } from '@core/scale/units';
import type { SceneObject } from './types';

/**
 * Acesso genérico a posição, rotação e envoltória de qualquer objeto da
 * cena. É a camada que permite que seleção, mover, girar e o painel de
 * propriedades funcionem para todos os tipos sem um `switch` espalhado
 * pela interface — cada fase nova só precisa ensinar o objeto novo aqui.
 *
 * Convenção: tudo em METROS. Objetos ancorados no papel (quadro técnico,
 * tabela) são convertidos pela escala de impressão na entrada e na saída.
 */

export interface Bounds {
  min: Vec2;
  max: Vec2;
}

/** Objetos posicionados em milímetros de papel, não em metros do terreno. */
export function isPaperAnchored(obj: SceneObject): boolean {
  return obj.kind === 'infobox' || obj.kind === 'heighttable';
}

export function getPosition(obj: SceneObject, printScale: PrintScale): Vec2 {
  switch (obj.kind) {
    case 'arena':
      return obj.shape === 'rectangle' ? obj.origin : polygonCentroid(obj.points);
    case 'image':
      return obj.origin;
    case 'path':
      return obj.nodes[0]?.pos ?? { x: 0, y: 0 };
    case 'infobox':
    case 'heighttable':
      return {
        x: paperToMeters(obj.posMm.x, printScale),
        y: paperToMeters(obj.posMm.y, printScale),
      };
    default:
      return obj.pos;
  }
}

export function translate(obj: SceneObject, deltaM: Vec2, printScale: PrintScale): void {
  switch (obj.kind) {
    case 'arena':
      obj.origin = add(obj.origin, deltaM);
      obj.points = obj.points.map((p) => add(p, deltaM));
      return;
    case 'image':
      obj.origin = add(obj.origin, deltaM);
      return;
    case 'path':
      for (const node of obj.nodes) node.pos = add(node.pos, deltaM);
      return;
    case 'infobox':
    case 'heighttable': {
      const k = 1000 / printScale;
      obj.posMm = { x: obj.posMm.x + deltaM.x * k, y: obj.posMm.y + deltaM.y * k };
      return;
    }
    default:
      obj.pos = add(obj.pos, deltaM);
  }
}

export function setPosition(obj: SceneObject, posM: Vec2, printScale: PrintScale): void {
  const current = getPosition(obj, printScale);
  translate(obj, { x: posM.x - current.x, y: posM.y - current.y }, printScale);
}

/** `null` quando o tipo não tem rotação própria (pista, quadros, traçado). */
export function getRotation(obj: SceneObject): number | null {
  switch (obj.kind) {
    case 'obstacle':
    case 'ornament':
    case 'text':
    case 'image':
      return obj.rotation;
    default:
      return null;
  }
}

export function setRotation(obj: SceneObject, degrees: number): void {
  switch (obj.kind) {
    case 'obstacle':
    case 'ornament':
    case 'text':
    case 'image':
      obj.rotation = degrees;
      return;
    default:
  }
}

/**
 * Gira o objeto em torno de um ponto arbitrário: a rotação de uma seleção
 * múltipla acontece em torno do centro da seleção, não de cada objeto.
 */
export function rotateAround(
  obj: SceneObject,
  pivotM: Vec2,
  deltaDeg: number,
  printScale: PrintScale,
): void {
  const pos = getPosition(obj, printScale);
  setPosition(obj, rotate(pos, deltaDeg, pivotM), printScale);
  const r = getRotation(obj);
  if (r !== null) setRotation(obj, r + deltaDeg);
}

/* ------------------------------------------------------------ envoltória */

export function getBounds(obj: SceneObject, printScale: PrintScale): Bounds {
  switch (obj.kind) {
    case 'arena':
      return boundsOf(arenaPoints(obj));
    case 'obstacle': {
      const halfW = obj.faceWidthM / 2;
      const halfD = Math.max(obj.spreadM ?? 0, 0.6) / 2;
      const corners = [
        { x: -halfW, y: -halfD },
        { x: halfW, y: -halfD },
        { x: halfW, y: halfD },
        { x: -halfW, y: halfD },
      ].map((c) => add(rotate(c, obj.rotation), obj.pos));
      return boundsOf(corners);
    }
    case 'ornament': {
      const h = obj.sizeM / 2;
      return {
        min: { x: obj.pos.x - h, y: obj.pos.y - h },
        max: { x: obj.pos.x + h, y: obj.pos.y + h },
      };
    }
    case 'path':
      return boundsOf(obj.nodes.map((n) => n.pos));
    case 'text': {
      // Aproximação: 0,55 de largura média por caractere no corpo do texto.
      const h = paperToMeters(obj.sizeMm, printScale);
      const w = h * 0.55 * Math.max(1, obj.text.length);
      const dx = obj.align === 'middle' ? -w / 2 : obj.align === 'end' ? -w : 0;
      return {
        min: { x: obj.pos.x + dx, y: obj.pos.y - h },
        max: { x: obj.pos.x + dx + w, y: obj.pos.y + h * 0.25 },
      };
    }
    case 'image': {
      const size = paperToMeters(1, printScale); // placeholder até a fase 6
      return {
        min: obj.origin,
        max: { x: obj.origin.x + size, y: obj.origin.y + size },
      };
    }
    case 'infobox': {
      const pos = getPosition(obj, printScale);
      const w = paperToMeters(obj.widthMm, printScale);
      const h = paperToMeters(Math.max(10, obj.fields.length * 5), printScale);
      return { min: pos, max: { x: pos.x + w, y: pos.y + h } };
    }
    case 'heighttable': {
      const pos = getPosition(obj, printScale);
      const w = paperToMeters(90, printScale);
      const h = paperToMeters(30, printScale);
      return { min: pos, max: { x: pos.x + w, y: pos.y + h } };
    }
  }
}

export function unionBounds(list: Bounds[]): Bounds | null {
  if (list.length === 0) return null;
  const first = list[0]!;
  let { min, max } = { min: { ...first.min }, max: { ...first.max } };
  for (const b of list.slice(1)) {
    min = { x: Math.min(min.x, b.min.x), y: Math.min(min.y, b.min.y) };
    max = { x: Math.max(max.x, b.max.x), y: Math.max(max.y, b.max.y) };
  }
  return { min, max };
}

export const boundsCenter = (b: Bounds): Vec2 => ({
  x: (b.min.x + b.max.x) / 2,
  y: (b.min.y + b.max.y) / 2,
});

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return !(a.max.x < b.min.x || a.min.x > b.max.x || a.max.y < b.min.y || a.min.y > b.max.y);
}

/**
 * `inner` está inteiramente dentro de `outer`.
 * O laço de seleção usa contenção, não interseção: por interseção, a pista
 * — que cobre toda a área de trabalho — entraria em qualquer laço desenhado
 * sobre ela.
 */
export function boundsContains(outer: Bounds, inner: Bounds): boolean {
  return (
    inner.min.x >= outer.min.x &&
    inner.min.y >= outer.min.y &&
    inner.max.x <= outer.max.x &&
    inner.max.y <= outer.max.y
  );
}

export function boundsContainsPoint(b: Bounds, p: Vec2, tolerance: Meters = 0): boolean {
  return (
    p.x >= b.min.x - tolerance &&
    p.x <= b.max.x + tolerance &&
    p.y >= b.min.y - tolerance &&
    p.y <= b.max.y + tolerance
  );
}

/* ---------------------------------------------------------------- apoio */

const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });

function boundsOf(points: Vec2[]): Bounds {
  if (points.length === 0) return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    min: { x: Math.min(...xs), y: Math.min(...ys) },
    max: { x: Math.max(...xs), y: Math.max(...ys) },
  };
}

function polygonCentroid(points: Vec2[]): Vec2 {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce((acc, p) => add(acc, p), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}
