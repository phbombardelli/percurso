import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { createObstacle } from '@core/library/obstacles';
import { createDocument } from '@core/model/document';
import { distance } from '@core/geometry/vec';
import type { CourseDocument, Obstacle, ObstacleType } from '@core/model/types';
import { addObject } from './ops';
import { alignCombination, currentGaps, orderAlongLine } from './alignOps';

const salto = (
  tipo: ObstacleType,
  x: number,
  y: number,
  numero: string,
  rotation = 0,
): Obstacle => {
  const o = createObstacle(tipo, { x, y }, numero);
  o.rotation = rotation;
  return o;
};

const cena = (...saltos: Obstacle[]): CourseDocument =>
  produce(createDocument(), (d) => {
    d.objects.length = 0;
    for (const s of saltos) addObject(d, s);
  });

const obstaculos = (doc: CourseDocument) =>
  doc.objects.filter((o): o is Obstacle => o.kind === 'obstacle');

const acha = (doc: CourseDocument, numero: string) =>
  obstaculos(doc).find((o) => o.number === numero)!;

describe('ordem na linha', () => {
  it('é a da numeração do percurso, não a da geometria', () => {
    // De propósito fora de lugar: 5b antes de 5a no terreno.
    const b = salto('vertical', 40, 40, '5');
    const a = salto('vertical', 40, 30, '5');
    const c = salto('vertical', 40, 20, '5');
    a.letter = 'A';
    b.letter = 'B';
    c.letter = 'C';
    expect(orderAlongLine([c, b, a]).map((o) => o.letter)).toEqual(['A', 'B', 'C']);
  });

  it('ordena por número antes de letra: 3b vem antes de 4', () => {
    const tresA = salto('vertical', 40, 20, '3');
    const tresB = salto('vertical', 40, 40, '3');
    const quatro = salto('vertical', 40, 30, '4');
    tresA.letter = 'A';
    tresB.letter = 'B';
    expect(orderAlongLine([quatro, tresB, tresA]).map((o) => `${o.number}${o.letter}`)).toEqual([
      '3A',
      '3B',
      '4',
    ]);
  });

  it('sem número, cai na geometria', () => {
    // Saltos para o norte (Y decrescente): o de maior Y vem primeiro.
    const a = salto('vertical', 40, 40, '');
    const b = salto('vertical', 40, 30, '');
    const c = salto('vertical', 40, 20, '');
    const ordem = orderAlongLine([c, a, b]);
    expect(ordem.map((o) => o.pos.y)).toEqual([40, 30, 20]);
  });

  it('sem número e com a seta invertida, a geometria se inverte junto', () => {
    const a = salto('vertical', 40, 40, '');
    const b = salto('vertical', 40, 30, '');
    a.arrow.reversed = true;
    b.arrow.reversed = true;
    expect(orderAlongLine([a, b])[0]!.pos.y).toBe(30);
  });
});

describe('medida do vão', () => {
  it('entre verticais, é a distância entre os centros', () => {
    const doc = cena(salto('vertical', 40, 40, '1'), salto('vertical', 40, 32.5, '2'));
    expect(currentGaps(orderAlongLine(obstaculos(doc)))[0]).toBeCloseTo(7.5, 9);
  });

  it('com oxer, desconta a largura dos DOIS saltos', () => {
    const oxer = salto('oxer', 40, 40, '1');
    const vertical = salto('vertical', 40, 30, '2');
    const largura = oxer.spreadM!;
    expect(largura).toBeGreaterThan(0);

    const vao = currentGaps(orderAlongLine([oxer, vertical]))[0]!;
    // Centros a 10 m; o vão livre é menor, pela meia largura do oxer.
    expect(vao).toBeCloseTo(10 - largura / 2, 9);
  });

  it('vão negativo denuncia corpos sobrepostos', () => {
    const doc = cena(salto('oxer', 40, 40, '1'), salto('oxer', 40, 39.5, '2'));
    expect(currentGaps(orderAlongLine(obstaculos(doc)))[0]).toBeLessThan(0);
  });
});

describe('alinhar a combinação', () => {
  it('aplica a distância pedida, medida de vara a vara', () => {
    const doc = cena(salto('vertical', 40, 40, '1'), salto('vertical', 43, 31, '2'));
    const alinhado = produce(doc, (d) => {
      alignCombination(d, obstaculos(d).map((o) => o.id), [7.5]);
    });
    expect(currentGaps(orderAlongLine(obstaculos(alinhado)))[0]).toBeCloseTo(7.5, 9);
  });

  it('num oxer, a distância pedida é o vão livre, não a de centro a centro', () => {
    const oxer = salto('oxer', 40, 40, '1');
    const largura = oxer.spreadM!;
    const doc = cena(oxer, salto('vertical', 41, 30, '2'));

    const alinhado = produce(doc, (d) => {
      alignCombination(d, obstaculos(d).map((o) => o.id), [7.5]);
    });
    const um = acha(alinhado, '1');
    const dois = acha(alinhado, '2');

    expect(currentGaps([um, dois])[0]).toBeCloseTo(7.5, 9);
    // De centro a centro dá meia largura a mais: é a diferença que o
    // desenhador erraria medindo pelo desenho em vez de pelas varas.
    expect(distance(um.pos, dois.pos)).toBeCloseTo(7.5 + largura / 2, 9);
  });

  it('o primeiro não se mexe: alinhar acerta os outros em relação a ele', () => {
    const doc = cena(salto('vertical', 40, 40, '1'), salto('vertical', 43, 31, '2'));
    const antes = acha(doc, '1').pos;
    const alinhado = produce(doc, (d) => {
      alignCombination(d, obstaculos(d).map((o) => o.id), [7.5]);
    });
    expect(acha(alinhado, '1').pos).toEqual(antes);
  });

  it('todos ficam no mesmo eixo e com a mesma inclinação', () => {
    const doc = cena(
      salto('vertical', 40, 40, '1', 30),
      salto('vertical', 46, 28, '2', 75),
      salto('vertical', 50, 18, '3', 10),
    );
    const alinhado = produce(doc, (d) => {
      alignCombination(d, obstaculos(d).map((o) => o.id), [7.5, 10.8]);
    });
    const [um, dois, tres] = orderAlongLine(obstaculos(alinhado));

    expect(dois!.rotation).toBe(30);
    expect(tres!.rotation).toBe(30);
    // Colineares: o produto vetorial dos dois passos é nulo.
    const p1 = { x: dois!.pos.x - um!.pos.x, y: dois!.pos.y - um!.pos.y };
    const p2 = { x: tres!.pos.x - dois!.pos.x, y: tres!.pos.y - dois!.pos.y };
    expect(Math.abs(p1.x * p2.y - p1.y * p2.x)).toBeLessThan(1e-9);
  });

  it('triplo: as duas distâncias saem exatas', () => {
    const doc = cena(
      salto('oxer', 40, 40, '5', 0),
      salto('vertical', 41, 31, '5', 0),
      salto('oxer', 39, 20, '5', 0),
    );
    const alinhado = produce(doc, (d) => {
      alignCombination(d, obstaculos(d).map((o) => o.id), [7.6, 10.9]);
    });
    const vaos = currentGaps(orderAlongLine(obstaculos(alinhado)));
    expect(vaos[0]).toBeCloseTo(7.6, 9);
    expect(vaos[1]).toBeCloseTo(10.9, 9);
  });

  it('com um só obstáculo, não faz nada', () => {
    const doc = cena(salto('vertical', 40, 40, '1'));
    const antes = acha(doc, '1').pos;
    const depois = produce(doc, (d) => {
      alignCombination(d, obstaculos(d).map((o) => o.id), []);
    });
    expect(acha(depois, '1').pos).toEqual(antes);
  });
});
