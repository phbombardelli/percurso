import type { Vec2 } from '@core/geometry/vec';
import { distance } from '@core/geometry/vec';
import { rectanglePoints } from '@core/geometry/outline';
import { newId } from '@core/model/ids';
import type { Arena } from './types';

/**
 * Geometria da pista. Uma única fonte para o contorno: o renderizador, a
 * envoltória, o teste de clique e o cálculo de área precisam concordar, e
 * concordam por usarem esta função.
 */
export function arenaPoints(arena: Arena): Vec2[] {
  return arena.shape === 'rectangle'
    ? rectanglePoints(arena.origin, arena.widthM, arena.heightM)
    : arena.points;
}

/** Perímetro do contorno, ignorando o tratamento dos cantos. */
export function arenaPerimeter(arena: Arena): number {
  const pts = arenaPoints(arena);
  if (pts.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < pts.length; i += 1) {
    total += distance(pts[i]!, pts[(i + 1) % pts.length]!);
  }
  return total;
}

/** Área pela fórmula do polígono (shoelace). Sempre positiva. */
export function arenaArea(arena: Arena): number {
  const pts = arenaPoints(arena);
  if (pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Dimensões da caixa envolvente — o que a régua de perímetro usa. */
export function arenaExtent(arena: Arena): { widthM: number; heightM: number; origin: Vec2 } {
  if (arena.shape === 'rectangle') {
    return { widthM: arena.widthM, heightM: arena.heightM, origin: arena.origin };
  }
  const pts = arena.points;
  if (pts.length === 0) return { widthM: 0, heightM: 0, origin: { x: 0, y: 0 } };
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const origin = { x: Math.min(...xs), y: Math.min(...ys) };
  return {
    origin,
    widthM: Math.max(...xs) - origin.x,
    heightM: Math.max(...ys) - origin.y,
  };
}

/* ------------------------------------------------------------ fábricas */

const baseArena = (): Omit<Arena, 'shape' | 'origin' | 'widthM' | 'heightM' | 'points'> => ({
  id: newId('arena'),
  kind: 'arena',
  layer: 'arena',
  locked: false,
  visible: true,
  scope: 'pista',
  z: 0,
  corner: { style: 'chamfer', radiusM: 4 },
  perimeterRuler: {
    visible: true,
    stepM: 5,
    labelEveryM: 5,
    sides: { top: true, right: true, bottom: true, left: true },
  },
  style: { strokeMm: 0.5, fill: '#ffffff', stroke: '#1a1a1a' },
});

export function createRectangleArena(origin: Vec2, widthM: number, heightM: number): Arena {
  return {
    ...baseArena(),
    shape: 'rectangle',
    origin,
    widthM,
    heightM,
    points: [],
  };
}

export function createPolygonArena(points: Vec2[]): Arena {
  return {
    ...baseArena(),
    shape: 'polygon',
    origin: { x: 0, y: 0 },
    widthM: 0,
    heightM: 0,
    points,
    // Contorno irregular quase nunca quer canto tratado.
    corner: { style: 'square', radiusM: 0 },
  };
}

/**
 * Converte para polígono materializando os quatro vértices. O caminho de
 * volta não existe: um polígono editado não tem como virar retângulo sem
 * jogar fora o desenho do usuário.
 */
export function toPolygon(arena: Arena): void {
  if (arena.shape === 'polygon') return;
  arena.points = rectanglePoints(arena.origin, arena.widthM, arena.heightM);
  arena.shape = 'polygon';
}
