import { describe, expect, it } from 'vitest';
import { createObstacle } from '@core/library/obstacles';
import { createRectangleArena } from '@core/model/arena';
import { createPath, flattenPath } from '@core/model/path';
import { distance } from '@core/geometry/vec';
import type { Obstacle } from '@core/model/types';
import { DEFAULT_RIDE, entryPose, exitPose, fieldFrom } from './ridePath';
import { legCandidates, solveLegCurve, turnOfPoints } from './legCurve';

const salto = (numero: string, x: number, y: number, rotation: number): Obstacle => {
  const o = createObstacle('vertical', { x, y }, numero);
  o.rotation = rotation;
  return o;
};

const pista = createRectangleArena({ x: 0, y: 0 }, 90, 55);

function volta(a: Obstacle, b: Obstacle) {
  const campo = fieldFrom(pista, [a, b]);
  const de = exitPose(a, DEFAULT_RIDE, campo);
  const para = entryPose(b, DEFAULT_RIDE, campo);
  const s = solveLegCurve(de, para, campo, DEFAULT_RIDE);
  return {
    ...s,
    vaoM: distance(de.pos, para.pos),
    giroDeg: turnOfPoints(flattenPath(createPath(s.nodes), 0.05)),
  };
}

describe('curva para trás', () => {
  /**
   * A cena que quebrou o assistente na prova real: o 5 é saltado para
   * leste e o 6 fica logo ao lado, saltado para o norte. Entre a saída de
   * um e a entrada do outro sobram menos de 4 m, com 90 graus de diferença
   * de direção — não existe ligação curta possível.
   *
   * A saída do cavaleiro é seguir em frente, dar a volta por fora e voltar
   * numa aproximação bem mais longa. É a curva para trás.
   */
  const cinco = salto('5', 40, 40, 90);
  const seis = salto('6', 52, 32, 0);

  it('a cena é mesmo impossível de ligar curto', () => {
    const v = volta(cinco, seis);
    expect(v.vaoM).toBeLessThan(5);
  });

  it('resolve alongando a reta, não espremendo a curva', () => {
    const v = volta(cinco, seis);
    // Alongou de algum lado: é isso que cria o espaço da volta.
    expect(Math.max(v.lead.after, v.lead.before)).toBeGreaterThan(0);
    expect(v.warnings).toEqual([]);
  });

  it('a volta resultante é galopável e gira mais de meia volta', () => {
    const v = volta(cinco, seis);
    expect(v.minRadiusM).toBeGreaterThanOrEqual(DEFAULT_RIDE.tightRadiusM);
    // Curva para trás gira muito por definição — proibir volta grande
    // proibia justamente a única saída possível aqui.
    expect(v.giroDeg).toBeGreaterThan(180);
  });

  it('e não troca de mão à toa no caminho', () => {
    expect(volta(cinco, seis).inflections).toBeLessThanOrEqual(1);
  });
});

describe('a volta grande só aparece quando é preciso', () => {
  it('dois saltos alinhados continuam ligados por reta', () => {
    const v = volta(salto('1', 20, 40, 0), salto('2', 20, 12, 0));
    expect(v.giroDeg).toBeLessThan(5);
    expect(v.lead).toEqual({ after: 0, before: 0 });
  });

  it('uma curva mansa não vira laçada', () => {
    // Saltos afastados, com virada suave entre eles: giro pequeno.
    const v = volta(salto('1', 20, 45, 0), salto('2', 60, 20, 45));
    expect(v.giroDeg).toBeLessThan(180);
    expect(v.warnings).toEqual([]);
  });

  it('a meia-volta larga gira o esperado, sem exagero', () => {
    // Um salta para o norte, o outro para o sul, bem afastados.
    const v = volta(salto('1', 25, 40, 0), salto('2', 60, 40, 180));
    expect(v.giroDeg).toBeGreaterThan(120);
    expect(v.giroDeg).toBeLessThan(260);
    expect(v.warnings).toEqual([]);
  });
});

describe('opções da pernada', () => {
  const opcoes = (a: Obstacle, b: Obstacle) => {
    const campo = fieldFrom(pista, [a, b]);
    return legCandidates(
      exitPose(a, DEFAULT_RIDE, campo),
      entryPose(b, DEFAULT_RIDE, campo),
      campo,
      DEFAULT_RIDE,
    );
  };

  it('numa reta absoluta, oferece uma opção só', () => {
    // Dois saltos alinhados e no mesmo sentido: não há o que escolher.
    const lista = opcoes(salto('1', 40, 45, 0), salto('2', 40, 15, 0));
    expect(lista).toHaveLength(1);
    expect(lista[0]!.turnDeg).toBeLessThan(5);
  });

  it('numa volta de verdade, oferece caminhos diferentes', () => {
    const lista = opcoes(salto('1', 25, 40, 0), salto('2', 60, 40, 180));
    expect(lista.length).toBeGreaterThan(1);

    // E são ideias diferentes, não a mesma curva com meio grau a mais.
    const formas = new Set(
      lista.map((c) => `${c.inflections}|${Math.round(c.turnDeg / 45)}|${c.lead.after > 0}`),
    );
    expect(formas.size).toBeGreaterThan(1);
  });

  it('a primeira da lista é a que o assistente escolheria sozinho', () => {
    const a = salto('1', 25, 40, 0);
    const b = salto('2', 60, 40, 180);
    const campo = fieldFrom(pista, [a, b]);
    const de = exitPose(a, DEFAULT_RIDE, campo);
    const para = entryPose(b, DEFAULT_RIDE, campo);

    const sozinho = solveLegCurve(de, para, campo, DEFAULT_RIDE);
    const primeira = legCandidates(de, para, campo, DEFAULT_RIDE)[0]!;
    expect(primeira.turnDeg).toBeCloseTo(sozinho.turnDeg, 6);
  });

  it('não devolve uma lista enorme de variações do mesmo desenho', () => {
    const lista = opcoes(salto('1', 20, 45, 0), salto('2', 60, 20, 45));
    expect(lista.length).toBeLessThanOrEqual(6);
  });

  it('oferece a curva para trás quando ela é a saída', () => {
    // A cena do 5 para o 6: colados e virados para lados diferentes.
    const lista = opcoes(salto('5', 40, 40, 90), salto('6', 52, 32, 0));
    expect(lista.some((c) => c.lead.after > 0 || c.lead.before > 0)).toBe(true);
  });
});
