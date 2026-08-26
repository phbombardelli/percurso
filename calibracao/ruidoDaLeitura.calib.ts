import { it } from 'vitest';
import { produce } from 'immer';
import { buildCourseRide } from '@core/assist/courseRide';
import { DEFAULT_RIDE } from '@core/assist/ridePath';
import { pathLength } from '@core/model/path';
import type { Obstacle } from '@core/model/types';
import { montaPercurso, WORLD_CHALLENGE_2020 } from './percursos';

/**
 * Quanto a MINHA leitura contamina a medida.
 *
 * As posições dos obstáculos foram conferidas contra as distâncias
 * impressas, mas as INCLINAÇÕES não: elas saem de olhar a imagem, e erro
 * de inclinação fabrica geometria impossível — dois saltos quase
 * paralelos viram quase perpendiculares com 15 graus de engano.
 *
 * Este relatório sacode as inclinações dentro do erro plausível de
 * leitura e mostra o espalhamento do total. Se o espalhamento for da
 * ordem do erro que se quer explicar, a calibração com dados lidos a olho
 * não conclui nada, e insistir seria fingir precisão.
 */
function aleatorio(semente: number) {
  let s = semente;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

it('sacode as inclinações e mede o espalhamento', () => {
  const p = WORLD_CHALLENGE_2020;
  const base = montaPercurso(p);
  const medida = (doc: ReturnType<typeof montaPercurso>) => {
    const r = buildCourseRide(doc, DEFAULT_RIDE);
    return r ? pathLength(r.path) : 0;
  };

  console.log(`\\noficial ${p.distanciaOficial} m, transcrição fiel ${medida(base).toFixed(1)} m`);

  for (const desvio of [5, 10, 15]) {
    const rnd = aleatorio(20260826 + desvio);
    const totais: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      const doc = produce(base, (d) => {
        for (const o of d.objects) {
          if (o.kind === 'obstacle') (o as Obstacle).rotation += (rnd() * 2 - 1) * desvio;
        }
      });
      totais.push(medida(doc));
    }
    totais.sort((a, b) => a - b);
    const media = totais.reduce((s, v) => s + v, 0) / totais.length;
    console.log(
      `inclinações +-${desvio}deg: de ${totais[0]!.toFixed(0)} a ${totais[totais.length - 1]!.toFixed(0)} m, ` +
        `média ${media.toFixed(0)} m (espalhamento ${(totais[totais.length - 1]! - totais[0]!).toFixed(0)} m)`,
    );
  }
}, 600_000);
