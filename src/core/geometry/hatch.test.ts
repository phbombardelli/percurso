import { describe, expect, it } from 'vitest';
import { hatchSegments, longestEdgeAngle, polygonCentroid } from './hatch';

const retangulo = [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 6 },
  { x: 0, y: 6 },
];

describe('hachura das construções (decisão 54)', () => {
  it('degraus horizontais num retângulo: um a cada passo, de borda a borda', () => {
    const linhas = hatchSegments(retangulo, 0, 1);
    expect(linhas).toHaveLength(6);
    for (const [a, b] of linhas) {
      expect(Math.min(a.x, b.x)).toBeCloseTo(0, 6);
      expect(Math.max(a.x, b.x)).toBeCloseTo(20, 6);
    }
  });

  it('nenhuma linha sai do contorno, mesmo inclinada', () => {
    for (const [a, b] of hatchSegments(retangulo, 45, 1.2)) {
      for (const p of [a, b]) {
        expect(p.x).toBeGreaterThanOrEqual(-1e-9);
        expect(p.x).toBeLessThanOrEqual(20 + 1e-9);
        expect(p.y).toBeGreaterThanOrEqual(-1e-9);
        expect(p.y).toBeLessThanOrEqual(6 + 1e-9);
      }
    }
  });

  it('contorno em L não ganha linha atravessando o vão', () => {
    const L = [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 },
      { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 },
    ];
    for (const [a, b] of hatchSegments(L, 0, 1)) {
      if (a.y > 4) expect(Math.max(a.x, b.x)).toBeLessThanOrEqual(4 + 1e-9);
    }
  });

  it('aresta mais longa e centro do retângulo', () => {
    expect(Math.abs(longestEdgeAngle(retangulo)) % 180).toBeCloseTo(0, 6);
    const c = polygonCentroid(retangulo);
    expect(c.x).toBeCloseTo(10, 6);
    expect(c.y).toBeCloseTo(3, 6);
  });
});
