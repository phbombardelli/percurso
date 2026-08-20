import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { addObject } from '@core/commands/ops';
import { createObstacle } from '@core/library/obstacles';
import { createDocument } from '@core/model/document';
import { createRectangleArena } from '@core/model/arena';
import { createPath, createPathNode } from '@core/model/path';
import type { Vec2 } from '@core/geometry/vec';
import type { CourseDocument, Obstacle } from '@core/model/types';
import { crossingIsJump, findInterferences } from './interference';

const salto = (x: number, y: number, rot = 0, numero = '1'): Obstacle => {
  const o = createObstacle('vertical', { x, y }, numero);
  o.rotation = rot;
  return o;
};

const comPista = (recipe: (d: CourseDocument) => void): CourseDocument =>
  produce(createDocument(), (d) => {
    d.objects.length = 0;
    addObject(d, createRectangleArena({ x: 0, y: 0 }, 80, 50));
    recipe(d);
  });

const linha = (pontos: Vec2[]) => createPath(pontos.map((p) => createPathNode(p)));

describe('salto ou estorvo', () => {
  // Obstáculo em (40,25) sem rotação: a vara deita no eixo X e o salto
  // atravessa no eixo Y.
  const o = salto(40, 25);

  it('pelo meio e perpendicular é salto', () => {
    expect(crossingIsJump(o, { x: 40, y: 25 }, -90)).toBe(true);
    // O sentido não importa: saltar de trás para a frente é saltar.
    expect(crossingIsJump(o, { x: 40, y: 25 }, 90)).toBe(true);
  });

  it('de lado não é salto, mesmo bem no meio', () => {
    expect(crossingIsJump(o, { x: 40, y: 25 }, 0)).toBe(false);
  });

  it('pela ponta da vara não é salto, mesmo perpendicular', () => {
    // Vara de 3,5 m: a 1,6 m do centro já é ponta, não é meio.
    expect(crossingIsJump(o, { x: 41.6, y: 25 }, -90)).toBe(false);
  });

  it('um desvio pequeno ainda é salto: cavalo não chega com esquadro', () => {
    expect(crossingIsJump(o, { x: 40.3, y: 25 }, -70)).toBe(true);
  });
});

describe('interferências no documento', () => {
  it('percurso limpo não acusa nada', () => {
    const doc = comPista((d) => {
      addObject(d, salto(20, 25, 0, '1'));
      addObject(d, salto(60, 25, 0, '2'));
    });
    expect(findInterferences(doc)).toEqual([]);
  });

  it('acusa dois obstáculos montados um sobre o outro', () => {
    const doc = comPista((d) => {
      addObject(d, salto(30, 25, 0, '1'));
      addObject(d, salto(30.5, 25, 0, '2'));
    });
    const achados = findInterferences(doc);
    expect(achados).toHaveLength(1);
    expect(achados[0]!.kind).toBe('obstaculos-sobrepostos');
    expect(achados[0]!.message).toContain('se sobrepõem');
  });

  it('não acusa os elementos de uma combinação, que ficam perto de propósito', () => {
    const doc = comPista((d) => {
      const a = salto(30, 25, 0, '5');
      a.letter = 'A';
      const b = salto(30, 24.6, 0, '5');
      b.letter = 'B';
      addObject(d, a);
      addObject(d, b);
    });
    expect(findInterferences(doc)).toEqual([]);
  });

  it('acusa obstáculo pisando no alambrado', () => {
    // Sem rotação a vara deita no eixo X: a 79,5 m a ponta passa dos 80 m
    // da pista. Girado a 90 graus ele caberia, e o teste não provaria nada.
    const doc = comPista((d) => addObject(d, salto(79.5, 25, 0, '1')));
    const achados = findInterferences(doc);
    expect(achados.some((a) => a.kind === 'obstaculo-fora-da-pista')).toBe(true);
  });

  it('acusa o traçado que atravessa um obstáculo de lado', () => {
    const doc = comPista((d) => {
      addObject(d, salto(40, 25, 0, '1'));
      // Linha horizontal passando pelo meio: corta a vara no comprimento.
      addObject(d, linha([{ x: 10, y: 25 }, { x: 70, y: 25 }]));
    });
    const achados = findInterferences(doc);
    expect(achados).toHaveLength(1);
    expect(achados[0]!.kind).toBe('tracado-cruza-obstaculo');
    expect(achados[0]!.message).toContain('sem saltá-lo');
  });

  it('NÃO acusa o traçado que salta o obstáculo — que é o seu trabalho', () => {
    const doc = comPista((d) => {
      addObject(d, salto(40, 25, 0, '1'));
      // Linha vertical pelo meio: é exatamente o salto.
      addObject(d, linha([{ x: 40, y: 40 }, { x: 40, y: 10 }]));
    });
    expect(findInterferences(doc)).toEqual([]);
  });

  it('acusa o traçado que raspa a ponta da vara', () => {
    const doc = comPista((d) => {
      addObject(d, salto(40, 25, 0, '1'));
      // Perpendicular, mas passando pela extremidade: o cavalo bate.
      addObject(d, linha([{ x: 41.6, y: 40 }, { x: 41.6, y: 10 }]));
    });
    const achados = findInterferences(doc);
    expect(achados.some((a) => a.kind === 'tracado-cruza-obstaculo')).toBe(true);
  });

  it('obstáculo escondido não é acusado', () => {
    const doc = comPista((d) => {
      const a = salto(30, 25, 0, '1');
      const b = salto(30.5, 25, 0, '2');
      b.visible = false;
      addObject(d, a);
      addObject(d, b);
    });
    expect(findInterferences(doc)).toEqual([]);
  });

  it('cada achado aponta os objetos envolvidos, para a interface destacar', () => {
    const doc = comPista((d) => {
      addObject(d, salto(40, 25, 0, '1'));
      addObject(d, linha([{ x: 10, y: 25 }, { x: 70, y: 25 }]));
    });
    const achado = findInterferences(doc)[0]!;
    expect(achado.ids).toHaveLength(2);
    for (const id of achado.ids) {
      expect(doc.objects.some((o) => o.id === id)).toBe(true);
    }
  });
});
