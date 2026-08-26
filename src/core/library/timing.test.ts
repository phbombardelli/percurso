import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { addObject } from '@core/commands/ops';
import { buildCourseRide } from '@core/assist/courseRide';
import { jumpHeading } from '@core/assist/ridePath';
import { createObstacle } from '@core/library/obstacles';
import { createDocument } from '@core/model/document';
import { createRectangleArena } from '@core/model/arena';
import { distance, fromAngle } from '@core/geometry/vec';
import type { Obstacle } from '@core/model/types';
import {
  clampTimingDistance,
  createTimingLine,
  placeTimingLine,
  syncTimingLines,
  TIMING_DISTANCE,
} from './timing';

const salto = (numero: string, x: number, y: number, rotation = 0): Obstacle => {
  const o = createObstacle('vertical', { x, y }, numero);
  o.rotation = rotation;
  return o;
};

describe('colocação da cruzada de tempo', () => {
  it('fica na distância pedida do obstáculo', () => {
    const o = salto('1', 40, 25);
    const p = placeTimingLine('start', o, 12);
    expect(distance(p.pos, o.pos)).toBeCloseTo(12, 9);
  });

  it('a partida fica ATRÁS e a chegada À FRENTE', () => {
    const o = salto('1', 40, 25); // salta para o norte: Y decrescente
    expect(placeTimingLine('start', o, 12).pos.y).toBeGreaterThan(o.pos.y);
    expect(placeTimingLine('finish', o, 12).pos.y).toBeLessThan(o.pos.y);
  });

  it('fica paralela à face e no eixo do salto', () => {
    const o = salto('1', 40, 25, 37);
    const p = placeTimingLine('start', o, 11);
    expect(p.rotation).toBe(o.rotation);

    // No eixo: o vetor do obstáculo à cruzada é a direção do salto.
    const eixo = fromAngle(jumpHeading(o));
    const dx = p.pos.x - o.pos.x;
    const dy = p.pos.y - o.pos.y;
    const foraDoEixo = Math.abs(dx * -eixo.y + dy * eixo.x);
    expect(foraDoEixo).toBeLessThan(1e-9);
  });

  it('acompanha a seta do obstáculo, para a passagem ter o mesmo sentido', () => {
    const o = salto('1', 40, 25);
    o.arrow.reversed = true;
    const p = placeTimingLine('start', o, 12);
    expect(p.arrow.reversed).toBe(true);
    // Invertido, o salto é para o sul: a partida vai para o norte.
    expect(p.pos.y).toBeLessThan(o.pos.y);
  });

  it('num oxer, mede da VARA e não do centro', () => {
    const oxer = createObstacle('oxer', { x: 40, y: 25 }, '1');
    const largura = oxer.spreadM!;
    expect(largura).toBeGreaterThan(0);

    // Partida a 12 m da vara de ENTRADA, que fica a meia largura do centro.
    const p = placeTimingLine('start', oxer, 12);
    expect(distance(p.pos, oxer.pos)).toBeCloseTo(12 + largura / 2, 9);

    // Chegada a 12 m da vara de SAÍDA, do outro lado.
    const c = placeTimingLine('finish', oxer, 12);
    expect(distance(c.pos, oxer.pos)).toBeCloseTo(12 + largura / 2, 9);
  });

  it('cada cruzada tem a sua distância', () => {
    const o = salto('1', 40, 25);
    expect(distance(placeTimingLine('start', o, 9.4).pos, o.pos)).toBeCloseTo(9.4, 9);
    expect(distance(placeTimingLine('finish', o, 14.7).pos, o.pos)).toBeCloseTo(14.7, 9);
  });

  it('aceita décimo de metro', () => {
    const o = salto('1', 40, 25);
    expect(distance(placeTimingLine('start', o, 10.3).pos, o.pos)).toBeCloseTo(10.3, 9);
    expect(clampTimingDistance(11.7)).toBe(11.7);
  });

  it('a distância é obrigada a ficar entre 9 e 15 m', () => {
    expect(clampTimingDistance(3)).toBe(TIMING_DISTANCE.min);
    expect(clampTimingDistance(40)).toBe(TIMING_DISTANCE.max);
    expect(clampTimingDistance(11)).toBe(11);

    const o = salto('1', 40, 25);
    expect(distance(placeTimingLine('start', o, 100).pos, o.pos)).toBeCloseTo(15, 9);
  });
});

describe('nunca há volta na cronometragem', () => {
  const percurso = (rot1: number, rot3: number) =>
    produce(createDocument(), (d) => {
      d.objects.length = 0;
      addObject(d, createRectangleArena({ x: 0, y: 0 }, 90, 55));
      const um = salto('1', 30, 45, rot1);
      const dois = salto('2', 65, 25, 90);
      const tres = salto('3', 30, 12, rot3);
      addObject(d, um);
      addObject(d, dois);
      addObject(d, tres);
      addObject(d, placeTimingLine('start', um, 12));
      addObject(d, placeTimingLine('finish', tres, 12));
    });

  it('a volta da partida ao 1 é reta, e a do último à chegada também', () => {
    const r = buildCourseRide(percurso(0, 180))!;
    const primeira = r.legs[0]!;
    const ultima = r.legs[r.legs.length - 1]!;

    expect(primeira.where).toBe('partida para 1');
    expect(primeira.turnDeg).toBeCloseTo(0, 6);
    expect(ultima.where).toBe('3 para chegada');
    expect(ultima.turnDeg).toBeCloseTo(0, 6);
  });

  it('e nunca vira curva para trás, seja qual for a orientação', () => {
    for (const rot of [0, 45, 90, 135, 180, 250, 315]) {
      const r = buildCourseRide(percurso(rot, rot))!;
      const cruzadas = [r.legs[0]!, r.legs[r.legs.length - 1]!];
      for (const perna of cruzadas) {
        expect(perna.lead).toEqual({ after: 0, before: 0 });
        expect(perna.turnDeg).toBeCloseTo(0, 6);
      }
    }
  });
});

describe('a cruzada acompanha o obstáculo', () => {
  const cena = () =>
    produce(createDocument(), (d) => {
      d.objects.length = 0;
      addObject(d, createRectangleArena({ x: 0, y: 0 }, 90, 55));
      const um = salto('1', 40, 40);
      addObject(d, um);
      addObject(d, placeTimingLine('start', um, 12));
    });

  const partida = (doc: ReturnType<typeof cena>) =>
    doc.objects.find((o) => o.kind === 'timing')!;
  const obstaculo = (doc: ReturnType<typeof cena>) =>
    doc.objects.find((o): o is Obstacle => o.kind === 'obstacle')!;

  it('segue quando o obstáculo é movido', () => {
    const antes = cena();
    const depois = produce(antes, (d) => {
      obstaculo(d).pos = { x: 60, y: 20 };
      syncTimingLines(d);
    });
    const linha = partida(depois);
    expect(linha.kind === 'timing' && distance(linha.pos, { x: 60, y: 20 })).toBeCloseTo(12, 9);
  });

  it('segue quando o obstáculo é girado', () => {
    const depois = produce(cena(), (d) => {
      obstaculo(d).rotation = 55;
      syncTimingLines(d);
    });
    const linha = partida(depois);
    expect(linha.kind === 'timing' && linha.rotation).toBe(55);
  });

  it('perde o vínculo, sem sumir, quando o obstáculo é apagado', () => {
    const depois = produce(cena(), (d) => {
      d.objects = d.objects.filter((o) => o.kind !== 'obstacle');
      syncTimingLines(d);
    });
    const linha = partida(depois);
    expect(linha.kind === 'timing' && linha.anchor).toBeNull();
  });

  it('mudar a distância move a linha', () => {
    const depois = produce(cena(), (d) => {
      const l = partida(d);
      if (l.kind === 'timing' && l.anchor) l.anchor.distanceM = 15;
      syncTimingLines(d);
    });
    const linha = partida(depois);
    expect(linha.kind === 'timing' && distance(linha.pos, { x: 40, y: 40 })).toBeCloseTo(15, 9);
  });
});

describe('cruzada sem vínculo é adotada', () => {
  /**
   * O caso que apareceu na prova real: linhas colocadas antes de a cruzada
   * aprender a seguir. Ficavam iguais às outras na tela e não andavam
   * quando o obstáculo se movia — armadilha silenciosa.
   */
  const solta = () =>
    produce(createDocument(), (d) => {
      d.objects.length = 0;
      addObject(d, createRectangleArena({ x: 0, y: 0 }, 90, 55));
      addObject(d, salto('1', 40, 40));
      addObject(d, salto('2', 70, 20, 90));
      const linha = createTimingLine('start', { x: 40, y: 52 });
      linha.anchor = null;
      addObject(d, linha);
    });

  const partida = (doc: ReturnType<typeof solta>) =>
    doc.objects.find((o) => o.kind === 'timing')!;

  it('adota o primeiro obstáculo, com a distância que já tinha', () => {
    const depois = produce(solta(), (d) => syncTimingLines(d));
    const linha = partida(depois);
    expect(linha.kind === 'timing' && linha.anchor?.distanceM).toBeCloseTo(12, 6);
  });

  it('e a partir daí acompanha, que era o que não acontecia', () => {
    const depois = produce(solta(), (d) => {
      syncTimingLines(d);
      const o = d.objects.find((x): x is Obstacle => x.kind === 'obstacle' && x.number === '1')!;
      o.pos = { x: 15, y: 15 };
      syncTimingLines(d);
    });
    const linha = partida(depois);
    expect(linha.kind === 'timing' && distance(linha.pos, { x: 15, y: 15 })).toBeCloseTo(12, 6);
  });

  it('a chegada adota o ÚLTIMO obstáculo, não o primeiro', () => {
    const doc = produce(solta(), (d) => {
      const c = createTimingLine('finish', { x: 70, y: 8 });
      c.anchor = null;
      addObject(d, c);
      syncTimingLines(d);
    });
    const chegada = doc.objects.find((o) => o.kind === 'timing' && o.role === 'finish')!;
    const dois = doc.objects.find((o): o is Obstacle => o.kind === 'obstacle' && o.number === '2')!;
    expect(chegada.kind === 'timing' && chegada.anchor?.obstacleId).toBe(dois.id);
  });

  it('sem obstáculo numerado, fica solta mesmo', () => {
    const doc = produce(createDocument(), (d) => {
      d.objects.length = 0;
      const l = createTimingLine('start', { x: 10, y: 10 });
      l.anchor = null;
      addObject(d, l);
      syncTimingLines(d);
    });
    const linha = doc.objects.find((o) => o.kind === 'timing')!;
    expect(linha.kind === 'timing' && linha.anchor).toBeNull();
  });
});
