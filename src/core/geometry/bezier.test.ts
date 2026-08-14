import { describe, expect, it } from 'vitest';
import {
  closestPointOnCubic,
  cubicLength,
  cubicPoint,
  cubicSplit,
  flattenCubic,
  isStraight,
  type Cubic,
} from './bezier';
import { distance } from './vec';

/** Comprimento por força bruta, para conferir o algoritmo adaptativo. */
function bruteLength(c: Cubic, steps = 200_000): number {
  let total = 0;
  let anterior = cubicPoint(c, 0);
  for (let i = 1; i <= steps; i += 1) {
    const atual = cubicPoint(c, i / steps);
    total += distance(anterior, atual);
    anterior = atual;
  }
  return total;
}

const reta: Cubic = {
  p0: { x: 0, y: 0 },
  p1: { x: 0, y: 0 },
  p2: { x: 30, y: 40 },
  p3: { x: 30, y: 40 },
};

const curva: Cubic = {
  p0: { x: 0, y: 0 },
  p1: { x: 10, y: 0 },
  p2: { x: 20, y: 10 },
  p3: { x: 20, y: 25 },
};

describe('comprimento', () => {
  it('segmento reto sai exato', () => {
    // Cúbica degenerada: os controles caem sobre as pontas.
    expect(cubicLength(reta)).toBeCloseTo(50, 9);
    expect(isStraight({ p0: reta.p0, p1: reta.p0, p2: reta.p3, p3: reta.p3 })).toBe(true);
  });

  it('bate com a força bruta dentro de um décimo de milímetro', () => {
    const referencia = bruteLength(curva);
    expect(Math.abs(cubicLength(curva) - referencia)).toBeLessThan(0.0001);
  });

  it('curva fechada, quase um laço, também bate', () => {
    const laco: Cubic = {
      p0: { x: 0, y: 0 },
      p1: { x: 40, y: 0 },
      p2: { x: -40, y: 20 },
      p3: { x: 0, y: 20 },
    };
    expect(Math.abs(cubicLength(laco) - bruteLength(laco))).toBeLessThan(0.0005);
  });

  it('quarto de círculo aproximado bate com o arco teórico', () => {
    // Constante clássica: alça de 0,5523·r aproxima o arco com erro < 0,03%.
    const r = 10;
    const c = 0.5522847498;
    const quarto: Cubic = {
      p0: { x: r, y: 0 },
      p1: { x: r, y: r * c },
      p2: { x: r * c, y: r },
      p3: { x: 0, y: r },
    };
    const arco = (Math.PI * r) / 2;
    expect(cubicLength(quarto)).toBeCloseTo(arco, 2);
  });

  it('o comprimento nunca é menor que a corda nem maior que o polígono', () => {
    const comprimento = cubicLength(curva);
    const corda = distance(curva.p0, curva.p3);
    const poligono =
      distance(curva.p0, curva.p1) +
      distance(curva.p1, curva.p2) +
      distance(curva.p2, curva.p3);
    expect(comprimento).toBeGreaterThanOrEqual(corda);
    expect(comprimento).toBeLessThanOrEqual(poligono);
  });

  it('a curva é mais longa que a reta entre as mesmas pontas', () => {
    expect(cubicLength(curva)).toBeGreaterThan(distance(curva.p0, curva.p3));
  });
});

describe('divisão', () => {
  it('as duas metades somam o total', () => {
    const [a, b] = cubicSplit(curva);
    expect(cubicLength(a) + cubicLength(b)).toBeCloseTo(cubicLength(curva), 6);
  });

  it('as metades se encontram no ponto do meio', () => {
    const [a, b] = cubicSplit(curva, 0.5);
    expect(a.p3).toEqual(b.p0);
    expect(a.p3.x).toBeCloseTo(cubicPoint(curva, 0.5).x, 12);
  });

  it('divide em qualquer parâmetro, não só na metade', () => {
    const [a, b] = cubicSplit(curva, 0.25);
    expect(cubicLength(a) + cubicLength(b)).toBeCloseTo(cubicLength(curva), 6);
    expect(a.p3.y).toBeCloseTo(cubicPoint(curva, 0.25).y, 12);
  });
});

describe('poligonal', () => {
  it('começa e termina nas pontas da curva', () => {
    const pontos = flattenCubic(curva);
    expect(pontos[0]).toEqual(curva.p0);
    expect(pontos[pontos.length - 1]).toEqual(curva.p3);
  });

  it('a poligonal SUBESTIMA a curva, e por isso não serve para medir', () => {
    const comprimentoDa = (tol: number) => {
      const pontos = flattenCubic(curva, tol);
      let total = 0;
      for (let i = 1; i < pontos.length; i += 1) total += distance(pontos[i - 1]!, pontos[i]!);
      return total;
    };
    const curvo = cubicLength(curva);
    // Corda sempre corta caminho: a poligonal nunca passa do arco.
    expect(comprimentoDa(0.0001)).toBeLessThanOrEqual(curvo);
    // Apertar a tolerância aproxima, mas o erro por segmento se acumula —
    // é por isso que quem mede é cubicLength, não a poligonal.
    expect(curvo - comprimentoDa(0.00001)).toBeLessThan(curvo - comprimentoDa(0.01));
  });

  it('tolerância mais frouxa gera menos pontos', () => {
    expect(flattenCubic(curva, 0.5).length).toBeLessThan(flattenCubic(curva, 0.001).length);
  });
});

describe('ponto mais próximo', () => {
  it('encontra a ponta quando o alvo está além dela', () => {
    const r = closestPointOnCubic(curva, { x: -50, y: -50 });
    expect(r.t).toBeCloseTo(0, 3);
  });

  it('encontra um ponto interno para um alvo ao lado da curva', () => {
    const meio = cubicPoint(curva, 0.5);
    const r = closestPointOnCubic(curva, { x: meio.x + 0.4, y: meio.y + 0.4 });
    expect(r.t).toBeGreaterThan(0.3);
    expect(r.t).toBeLessThan(0.7);
    expect(r.distance).toBeLessThan(0.7);
  });
});
