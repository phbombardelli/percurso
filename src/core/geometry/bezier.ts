import type { Vec2 } from './vec';
import { distance, lerp } from './vec';

/**
 * Curvas de Bézier cúbicas, em METROS.
 *
 * O comprimento de uma cúbica não tem forma fechada, então é calculado por
 * subdivisão adaptativa: enquanto o polígono de controle e a corda
 * discordarem mais que a tolerância, parte-se a curva ao meio. O erro cai
 * quadraticamente a cada nível, e a tolerância padrão de 0,1 mm é muito
 * abaixo do que qualquer croqui precisa — o §19 exige precisão de uso
 * profissional, e é aqui que ela se decide.
 */

export interface Cubic {
  p0: Vec2;
  p1: Vec2;
  p2: Vec2;
  p3: Vec2;
}

/** Tolerância padrão: 0,1 mm em metros. */
export const LENGTH_TOLERANCE_M = 0.0001;

const MAX_DEPTH = 24;

export function cubicPoint(c: Cubic, t: number): Vec2 {
  const a = lerp(c.p0, c.p1, t);
  const b = lerp(c.p1, c.p2, t);
  const d = lerp(c.p2, c.p3, t);
  const e = lerp(a, b, t);
  const f = lerp(b, d, t);
  return lerp(e, f, t);
}

/** Divide em duas cúbicas que, juntas, são exatamente a original. */
export function cubicSplit(c: Cubic, t = 0.5): [Cubic, Cubic] {
  const a = lerp(c.p0, c.p1, t);
  const b = lerp(c.p1, c.p2, t);
  const d = lerp(c.p2, c.p3, t);
  const e = lerp(a, b, t);
  const f = lerp(b, d, t);
  const g = lerp(e, f, t);
  return [
    { p0: c.p0, p1: a, p2: e, p3: g },
    { p0: g, p1: f, p2: d, p3: c.p3 },
  ];
}

/** Comprimento do arco, por subdivisão adaptativa. */
export function cubicLength(c: Cubic, tolerance = LENGTH_TOLERANCE_M): number {
  return lengthRec(c, tolerance, 0);
}

function lengthRec(c: Cubic, tolerance: number, depth: number): number {
  const chord = distance(c.p0, c.p3);
  const polygon =
    distance(c.p0, c.p1) + distance(c.p1, c.p2) + distance(c.p2, c.p3);

  // Corda e polígono de controle cercam o comprimento verdadeiro por baixo
  // e por cima. Quando se aproximam, a média já é melhor que a tolerância.
  if (polygon - chord <= tolerance || depth >= MAX_DEPTH) {
    return (chord + polygon) / 2;
  }
  const [a, b] = cubicSplit(c);
  return lengthRec(a, tolerance / 2, depth + 1) + lengthRec(b, tolerance / 2, depth + 1);
}

/**
 * Aproxima a curva por uma poligonal. A tolerância vale POR SEGMENTO, e o
 * desvio de cada um se acumula, então a poligonal subestima o arco — ela
 * serve para teste de clique e para procurar interferência, nunca para
 * medir. Quem mede é `cubicLength`, que divide a tolerância a cada nível
 * justamente para o erro total continuar limitado.
 */
export function flattenCubic(
  c: Cubic,
  tolerance = LENGTH_TOLERANCE_M * 10,
  out: Vec2[] = [],
  depth = 0,
): Vec2[] {
  if (out.length === 0) out.push(c.p0);
  const chord = distance(c.p0, c.p3);
  const polygon =
    distance(c.p0, c.p1) + distance(c.p1, c.p2) + distance(c.p2, c.p3);

  if (polygon - chord <= tolerance || depth >= MAX_DEPTH) {
    out.push(c.p3);
    return out;
  }
  const [a, b] = cubicSplit(c);
  flattenCubic(a, tolerance, out, depth + 1);
  flattenCubic(b, tolerance, out, depth + 1);
  return out;
}

/** `true` quando a cúbica é, de fato, um segmento reto. */
export const isStraight = (c: Cubic): boolean =>
  samePoint(c.p0, c.p1) && samePoint(c.p2, c.p3);

const samePoint = (a: Vec2, b: Vec2): boolean =>
  Math.abs(a.x - b.x) < 1e-12 && Math.abs(a.y - b.y) < 1e-12;

/** Ponto da curva mais próximo de `target`, com o parâmetro t e a distância. */
export function closestPointOnCubic(
  c: Cubic,
  target: Vec2,
  samples = 24,
): { t: number; point: Vec2; distance: number } {
  let melhor = { t: 0, point: c.p0, distance: distance(c.p0, target) };
  for (let i = 1; i <= samples; i += 1) {
    const t = i / samples;
    const point = cubicPoint(c, t);
    const d = distance(point, target);
    if (d < melhor.distance) melhor = { t, point, distance: d };
  }
  // Refina em torno do melhor palpite.
  let passo = 1 / samples;
  for (let iter = 0; iter < 20; iter += 1) {
    passo /= 2;
    for (const t of [melhor.t - passo, melhor.t + passo]) {
      if (t < 0 || t > 1) continue;
      const point = cubicPoint(c, t);
      const d = distance(point, target);
      if (d < melhor.distance) melhor = { t, point, distance: d };
    }
  }
  return melhor;
}
