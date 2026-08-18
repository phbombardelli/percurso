import { describe, expect, it } from 'vitest';
import { dubinsShortest, poseAt, type Pose } from '@core/geometry/dubins';
import { distance } from '@core/geometry/vec';
import { createPath, pathLength, pointAtLength } from './path';
import { nodesFromDubins } from './pathFromDubins';

const pose = (x: number, y: number, heading: number): Pose => ({ pos: { x, y }, heading });

const cenas: [string, Pose, Pose, number][] = [
  ['volta larga à direita', pose(0, 0, 0), pose(30, 30, 90), 12],
  ['meia-volta colada', pose(0, 0, 0), pose(0, 24, 180), 12],
  ['diagonal com curva à esquerda', pose(-20, 15, 200), pose(35, -18, 20), 11],
  ['destino atrás', pose(0, 0, 0), pose(-45, 6, 180), 10],
  ['quase reto', pose(0, 0, 0), pose(60, 3, 2), 14],
];

describe('caminho geométrico virando traçado editável', () => {
  it.each(cenas)('%s: o comprimento bate com o do arco', (_nome, a, b, raio) => {
    const geo = dubinsShortest(a, b, raio)!;
    const traçado = createPath(nodesFromDubins(geo));
    // Menos de 1 mm de diferença num percurso inteiro é ordens de grandeza
    // abaixo do que qualquer croqui distingue.
    expect(pathLength(traçado)).toBeCloseTo(geo.length, 3);
  });

  it.each(cenas)('%s: a linha desenhada passa por onde o arco passa', (_nome, a, b, raio) => {
    const geo = dubinsShortest(a, b, raio)!;
    const traçado = createPath(nodesFromDubins(geo));
    let pior = 0;
    for (let i = 0; i <= 40; i += 1) {
      const s = (geo.length * i) / 40;
      pior = Math.max(pior, distance(poseAt(geo, s).pos, pointAtLength(traçado, s)));
    }
    // Meio milímetro no terreno; a 1:250 é meio micron no papel.
    expect(pior).toBeLessThan(0.0005);
  });

  it('começa e termina exatamente nas poses pedidas', () => {
    const a = pose(3, -7, 35);
    const b = pose(41, 22, 160);
    const nos = nodesFromDubins(dubinsShortest(a, b, 11)!);
    expect(distance(nos[0]!.pos, a.pos)).toBeLessThan(1e-9);
    expect(distance(nos[nos.length - 1]!.pos, b.pos)).toBeLessThan(1e-7);
    expect(nos[0]!.handleIn).toBeNull();
    expect(nos[nos.length - 1]!.handleOut).toBeNull();
  });

  it('todo nó do meio é liso e sem bico', () => {
    const nos = nodesFromDubins(dubinsShortest(pose(0, 0, 0), pose(30, 30, 90), 12)!);
    for (const no of nos.slice(1, -1)) {
      expect(no.type).toBe('smooth');
      const entra = no.handleIn!;
      const sai = no.handleOut!;
      // Colineares e opostas: a tangente atravessa o nó sem virar.
      const cruzado = entra.x * sai.y - entra.y * sai.x;
      expect(Math.abs(cruzado)).toBeLessThan(1e-9);
      expect(entra.x * sai.x + entra.y * sai.y).toBeLessThan(0);
    }
  });

  it('reta continua reta, com dois nós só', () => {
    const nos = nodesFromDubins(dubinsShortest(pose(0, 0, 0), pose(50, 0, 0), 12)!);
    expect(nos).toHaveLength(2);
    expect(pathLength(createPath(nos))).toBeCloseTo(50, 9);
  });

  it('pedaço menor aproxima melhor, como manda a teoria', () => {
    const geo = dubinsShortest(pose(0, 0, 0), pose(0, 24, 180), 12)!;
    const erro = (graus: number) =>
      Math.abs(pathLength(createPath(nodesFromDubins(geo, graus))) - geo.length);
    expect(erro(30)).toBeLessThan(erro(90));
  });
});
