import { describe, expect, it } from 'vitest';
import { currentGaps, orderAlongLine } from '@core/commands/alignOps';
import type { Obstacle } from '@core/model/types';
import { montaPercurso, PERCURSOS } from './percursos';

/**
 * Confere a TRANSCRIÇÃO, não o modelo.
 *
 * As posições dos obstáculos saem de olhar a imagem do croqui, e erro de
 * leitura vira erro de calibração sem avisar. Os croquis oficiais
 * imprimem algumas distâncias entre obstáculos; se a transcrição
 * reproduz esses números, ela serve de base. Se não reproduz, calibrar em
 * cima dela seria calibrar no meu erro de régua.
 *
 * A folga de 40 cm é o que se consegue lendo pixels: cada obstáculo tem
 * uns 20 cm de incerteza de leitura, e são dois em cada distância.
 */
const FOLGA_M = 0.4;

describe.each(PERCURSOS)('transcrição de $nome', (percurso) => {
  const doc = montaPercurso(percurso);
  const saltos = doc.objects.filter((o): o is Obstacle => o.kind === 'obstacle');
  const rotulo = (o: Obstacle) => `${o.number}${o.letter}`;

  it('tem todos os obstáculos do croqui', () => {
    expect(saltos).toHaveLength(percurso.saltos.length);
  });

  it('cabe dentro da pista', () => {
    for (const o of saltos) {
      expect(o.pos.x).toBeGreaterThan(0);
      expect(o.pos.x).toBeLessThan(percurso.pista.largura);
      expect(o.pos.y).toBeGreaterThan(0);
      expect(o.pos.y).toBeLessThan(percurso.pista.altura);
    }
  });

  it.each(percurso.impressas)(
    'reproduz a distância impressa de $de a $para: $metros m',
    ({ de, para, metros }) => {
      const a = saltos.find((o) => rotulo(o) === de);
      const b = saltos.find((o) => rotulo(o) === para);
      expect(a, `obstáculo ${de} não encontrado`).toBeDefined();
      expect(b, `obstáculo ${para} não encontrado`).toBeDefined();

      // Vara a vara, como o croqui mede.
      const medida = currentGaps(orderAlongLine([a!, b!]))[0]!;
      expect(Math.abs(medida - metros), `medido ${medida.toFixed(2)} m`).toBeLessThan(FOLGA_M);
    },
  );
});
