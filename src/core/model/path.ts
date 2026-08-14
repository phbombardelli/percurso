import type { Cubic } from '@core/geometry/bezier';
import { closestPointOnCubic, cubicLength, cubicPoint, flattenCubic } from '@core/geometry/bezier';
import { add, distance, type Vec2 } from '@core/geometry/vec';
import { newId } from '@core/model/ids';
import type { CoursePath, PathNode } from './types';

/**
 * Geometria do traçado.
 *
 * O comprimento medido é sempre o do traçado EFETIVAMENTE desenhado, nunca
 * a distância em linha reta entre os obstáculos (§19). É a diferença entre
 * dizer 24,50 m e dizer 27,80 m, e a segunda é a que o desenhador precisa.
 */

export function createPathNode(pos: Vec2, type: PathNode['type'] = 'corner'): PathNode {
  return { pos, type, handleIn: null, handleOut: null, anchor: null };
}

export function createPath(nodes: PathNode[]): CoursePath {
  return {
    id: newId('pth'),
    kind: 'path',
    layer: 'paths',
    locked: false,
    visible: true,
    z: 0,
    nodes,
    legs: legsFor(nodes.length),
    style: { dash: 'dashed', strokeMm: 0.4, color: '#333333' },
  };
}

/** Um trecho medido por par de nós consecutivos. */
export function legsFor(nodeCount: number): CoursePath['legs'] {
  return Array.from({ length: Math.max(0, nodeCount - 1) }, (_, i) => ({
    fromNode: i,
    toNode: i + 1,
    label: {
      visible: true,
      offsetM: { x: 0, y: -1.2 },
      decimals: 2,
      color: '#d32020',
    },
  }));
}

/**
 * Cúbica de um trecho. Alça ausente vira ponto de controle sobre o próprio
 * nó, o que degenera a cúbica em reta — e o comprimento sai exato.
 */
export function segmentAt(path: CoursePath, index: number): Cubic | null {
  const a = path.nodes[index];
  const b = path.nodes[index + 1];
  if (!a || !b) return null;
  return {
    p0: a.pos,
    p1: a.handleOut ? add(a.pos, a.handleOut) : a.pos,
    p2: b.handleIn ? add(b.pos, b.handleIn) : b.pos,
    p3: b.pos,
  };
}

export function segments(path: CoursePath): Cubic[] {
  const out: Cubic[] = [];
  for (let i = 0; i < path.nodes.length - 1; i += 1) {
    const seg = segmentAt(path, i);
    if (seg) out.push(seg);
  }
  return out;
}

/** Comprimento de um trecho, em metros. */
export function legLength(path: CoursePath, index: number): number {
  const seg = segmentAt(path, index);
  return seg ? cubicLength(seg) : 0;
}

/** Comprimento total do traçado desenhado. */
export function pathLength(path: CoursePath): number {
  return segments(path).reduce((total, seg) => total + cubicLength(seg), 0);
}

/**
 * Distância em linha reta entre as pontas do trecho. Só existe para
 * comparação: não é o que o croqui mostra.
 */
export function legStraightDistance(path: CoursePath, index: number): number {
  const a = path.nodes[index];
  const b = path.nodes[index + 1];
  return a && b ? distance(a.pos, b.pos) : 0;
}

/** Ponto médio do trecho, onde o rótulo de distância se ancora. */
export function legMidpoint(path: CoursePath, index: number): Vec2 {
  const seg = segmentAt(path, index);
  return seg ? cubicPoint(seg, 0.5) : { x: 0, y: 0 };
}

/** Caminho SVG, com `project` levando de metros ao espaço de saída. */
export function pathD(path: CoursePath, project: (p: Vec2) => Vec2): string {
  if (path.nodes.length === 0) return '';
  const primeiro = project(path.nodes[0]!.pos);
  const partes = [`M ${fmt(primeiro)}`];

  for (let i = 0; i < path.nodes.length - 1; i += 1) {
    const seg = segmentAt(path, i)!;
    partes.push(
      `C ${fmt(project(seg.p1))} ${fmt(project(seg.p2))} ${fmt(project(seg.p3))}`,
    );
  }
  return partes.join(' ');
}

/** Poligonal do traçado inteiro — teste de clique e interferência. */
export function flattenPath(path: CoursePath, toleranceM = 0.01): Vec2[] {
  const pontos: Vec2[] = [];
  for (const seg of segments(path)) {
    const parcial = flattenCubic(seg, toleranceM);
    if (pontos.length === 0) pontos.push(...parcial);
    else pontos.push(...parcial.slice(1));
  }
  return pontos;
}

/** Trecho mais próximo de um ponto — usado para clicar no traçado. */
export function closestOnPath(
  path: CoursePath,
  target: Vec2,
): { legIndex: number; point: Vec2; distance: number } | null {
  let melhor: { legIndex: number; point: Vec2; distance: number } | null = null;
  segments(path).forEach((seg, i) => {
    const p = closestPointOnCubic(seg, target);
    if (!melhor || p.distance < melhor.distance) {
      melhor = { legIndex: i, point: p.point, distance: p.distance };
    }
  });
  return melhor;
}

/** Distância formatada como no croqui: vírgula decimal. */
export function formatDistance(meters: number, decimals = 2): string {
  return meters.toFixed(decimals).replace('.', ',');
}

const fmt = (p: Vec2): string => `${round(p.x)} ${round(p.y)}`;
const round = (v: number): number => Math.round(v * 1000) / 1000;
