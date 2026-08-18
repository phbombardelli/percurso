import { describe, expect, it } from 'vitest';
import { createObstacle } from '@core/library/obstacles';
import { createRectangleArena } from '@core/model/arena';
import { distance } from '@core/geometry/vec';
import { poseAt } from '@core/geometry/dubins';
import type { Obstacle } from '@core/model/types';
import {
  DEFAULT_RIDE,
  entryPose,
  exitPose,
  fieldFrom,
  insidePolygon,
  jumpHeading,
  obstacleFootprint,
  solveLeg,
} from './ridePath';

const vertical = (x: number, y: number, rotation: number, reversed = false): Obstacle => {
  const o = createObstacle('vertical', { x, y }, '1');
  o.rotation = rotation;
  o.arrow.reversed = reversed;
  return o;
};

const pista = createRectangleArena({ x: 0, y: 0 }, 80, 50);

describe('sentido do salto', () => {
  it('acompanha a seta que o croqui já mostra', () => {
    // Obstáculo sem rotação tem a barra deitada no eixo X e o salto sobe:
    // a seta padrão aponta para o Y negativo.
    expect(jumpHeading(vertical(40, 25, 0))).toBe(-90);
    expect(jumpHeading(vertical(40, 25, 0, true))).toBe(90);
    // Girar o obstáculo gira o salto junto, sem exceção.
    expect(jumpHeading(vertical(40, 25, 30))).toBe(-60);
  });

  it('a aproximação vem de trás e a saída fica na frente', () => {
    const o = vertical(40, 25, 0);
    const entra = entryPose(o, DEFAULT_RIDE);
    const sai = exitPose(o, DEFAULT_RIDE);
    // Salto para o norte (Y decrescente): chega-se por baixo e sai-se por cima.
    expect(entra.pos.y).toBeGreaterThan(o.pos.y);
    expect(sai.pos.y).toBeLessThan(o.pos.y);
    expect(entra.heading).toBe(sai.heading);
    // Ambas centradas na face, que é o que "saltar centrado" quer dizer.
    expect(entra.pos.x).toBeCloseTo(o.pos.x, 9);
    expect(sai.pos.x).toBeCloseTo(o.pos.x, 9);
  });

  it('a reta conta a partir do corpo, não do centro', () => {
    const oxer = createObstacle('oxer', { x: 40, y: 25 }, '2');
    const raso = vertical(40, 25, 0);
    // O oxer é mais fundo, então sua reta de aproximação começa mais longe
    // do centro — o cavalo precisa dos mesmos metros de reta, não do
    // mesmo ponto de partida.
    expect(distance(entryPose(oxer, DEFAULT_RIDE).pos, oxer.pos)).toBeGreaterThan(
      distance(entryPose(raso, DEFAULT_RIDE).pos, raso.pos),
    );
  });
});

describe('corpo do obstáculo', () => {
  it('o retângulo cobre o centro e não cobre quem está longe', () => {
    const o = vertical(40, 25, 0);
    const corpo = obstacleFootprint(o);
    expect(insidePolygon({ x: 40, y: 25 }, corpo)).toBe(true);
    expect(insidePolygon({ x: 40, y: 40 }, corpo)).toBe(false);
  });

  it('gira junto com o obstáculo', () => {
    const reto = obstacleFootprint(vertical(40, 25, 0));
    const virado = obstacleFootprint(vertical(40, 25, 90));
    // Um ponto na ponta da barra deitada sai de dentro quando ela levanta.
    const ponta = { x: 41.5, y: 25 };
    expect(insidePolygon(ponta, reto)).toBe(true);
    expect(insidePolygon(ponta, virado)).toBe(false);
  });
});

describe('escolher a volta', () => {
  it('dois saltos alinhados dão linha reta, sem volta nenhuma', () => {
    const a = vertical(40, 40, 0);
    const b = vertical(40, 15, 0);
    const sol = solveLeg(exitPose(a, DEFAULT_RIDE), entryPose(b, DEFAULT_RIDE), fieldFrom(pista, [a, b]))!;
    expect(sol.warnings).toEqual([]);
    expect(sol.path.segments).toHaveLength(1);
    expect(sol.path.segments[0]!.kind).toBe('reta');
  });

  it('recusa a volta que sairia da pista e escolhe outra', () => {
    // Salto encostado no alambrado da esquerda: a volta mais curta é uma
    // laçada que estouraria a cerca.
    const a = vertical(8, 22, 90);
    const b = vertical(45, 25, 0);
    const campo = fieldFrom(pista, [a, b]);
    const saida = exitPose(a, DEFAULT_RIDE, campo);
    const chegada = entryPose(b, DEFAULT_RIDE, campo);

    const sol = solveLeg(saida, chegada, campo)!;
    expect(sol.warnings).toEqual([]);

    // Sem pista, a escolha é outra e mais curta: prova de que foi a pista
    // que mandou na decisão, e não o acaso.
    const semPista = solveLeg(saida, chegada, { outline: null, blockers: [] })!;
    expect(semPista.path.word).not.toBe(sol.path.word);
    expect(semPista.path.length).toBeLessThan(sol.path.length);
  });

  it('desvia de um obstáculo plantado no meio da volta', () => {
    // Um salta para o norte e o outro para o sul: a volta entre eles é a
    // curva ampla e limpa que qualquer croqui mostra.
    const a = vertical(20, 35, 0);
    const b = vertical(60, 35, 180);
    // Pista grande, para que exista alternativa: numa pista apertada o
    // desvio simplesmente não caberia, e o teste não estaria medindo a
    // escolha do assistente, mas a falta de espaço.
    const grande = createRectangleArena({ x: 0, y: 0 }, 100, 70);
    const campoLimpo = fieldFrom(grande, [a, b]);
    const saida = exitPose(a, DEFAULT_RIDE, campoLimpo);
    const chegada = entryPose(b, DEFAULT_RIDE, campoLimpo);
    const semEstorvo = solveLeg(saida, chegada, campoLimpo)!;
    expect(semEstorvo.warnings).toEqual([]);

    // O estorvo é plantado exatamente no meio da volta escolhida, para o
    // teste não depender de eu ter adivinhado por onde ela passa.
    const meio = poseAt(semEstorvo.path, semEstorvo.path.length / 2);
    const atravessado = vertical(meio.pos.x, meio.pos.y, meio.heading);
    atravessado.faceWidthM = 10;

    const comEstorvo = solveLeg(saida, chegada, fieldFrom(grande, [a, b, atravessado]))!;
    expect(comEstorvo.warnings).toEqual([]);
    expect(comEstorvo.path.length).toBeGreaterThan(semEstorvo.path.length);
  });

  it('sem saída limpa, entrega mesmo assim e avisa', () => {
    // Pista minúscula: não cabe volta nenhuma com raio de 11 m.
    const apertada = createRectangleArena({ x: 0, y: 0 }, 20, 14);
    const a = vertical(10, 4, 0);
    const b = vertical(10, 10, 180);
    const campo = fieldFrom(apertada, [a, b]);
    const sol = solveLeg(exitPose(a, DEFAULT_RIDE, campo), entryPose(b, DEFAULT_RIDE, campo), campo)!;
    expect(sol.path).toBeTruthy();
    expect(sol.warnings.length).toBeGreaterThan(0);
  });

  it('a volta escolhida nunca fecha mais que o raio mínimo', () => {
    const a = vertical(25, 35, 0);
    const b = vertical(55, 20, 120);
    const sol = solveLeg(exitPose(a, DEFAULT_RIDE), entryPose(b, DEFAULT_RIDE), fieldFrom(pista, [a, b]))!;
    for (const seg of sol.path.segments) {
      if (seg.kind === 'arco') expect(seg.radius).toBeGreaterThanOrEqual(DEFAULT_RIDE.minRadiusM - 1e-9);
    }
  });

  it('raio maior alonga o percurso, como na pista de verdade', () => {
    const a = vertical(25, 35, 0);
    const b = vertical(55, 20, 120);
    const campo = fieldFrom(pista, [a, b]);
    const curto = solveLeg(exitPose(a, DEFAULT_RIDE), entryPose(b, DEFAULT_RIDE), campo, {
      ...DEFAULT_RIDE,
      minRadiusM: 8,
    })!;
    const largo = solveLeg(exitPose(a, DEFAULT_RIDE), entryPose(b, DEFAULT_RIDE), campo, {
      ...DEFAULT_RIDE,
      minRadiusM: 15,
    })!;
    expect(largo.path.length).toBeGreaterThan(curto.path.length);
  });

  it('encurta a reta em vez de furar o alambrado', () => {
    // Obstáculo saltado contra a cerca: os 8 m de saída não cabem.
    const contraACerca = vertical(40, 6, 0);
    const campo = fieldFrom(pista, [contraACerca]);
    const solto = exitPose(contraACerca, DEFAULT_RIDE);
    const cabendo = exitPose(contraACerca, DEFAULT_RIDE, campo);
    expect(insidePolygon(solto.pos, campo.outline!)).toBe(false);
    expect(insidePolygon(cabendo.pos, campo.outline!)).toBe(true);
    // A direção não muda: encurtar a reta não entorta a chegada ao salto.
    expect(cabendo.heading).toBe(solto.heading);
    expect(distance(cabendo.pos, contraACerca.pos)).toBeLessThan(
      distance(solto.pos, contraACerca.pos),
    );
  });
});
