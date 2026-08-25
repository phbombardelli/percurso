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
import { clampTimingDistance, placeTimingLine, TIMING_DISTANCE } from './timing';

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
