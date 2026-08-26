import { it } from 'vitest';
import { buildCourseRide } from '@core/assist/courseRide';
import { DEFAULT_RIDE } from '@core/assist/ridePath';
import { distance } from '@core/geometry/vec';
import { pathLength } from '@core/model/path';
import type { Obstacle } from '@core/model/types';
import { montaPercurso, WORLD_CHALLENGE_2020 } from './percursos';

/**
 * Onde estão os metros que sobram.
 *
 * A varredura mostrou que nenhum ajuste de parâmetro tira os 40% de
 * excesso: de 569 a 618 m, contra 420 oficiais. Quando nenhum parâmetro
 * explica o erro, o erro não é de parâmetro. Este relatório abre o total
 * por perna, ao lado da distância em linha reta entre os saltos, para
 * mostrar em quais voltas o excesso mora.
 */
it('abre o percurso perna a perna', () => {
  const p = WORLD_CHALLENGE_2020;
  const doc = montaPercurso(p);
  const r = buildCourseRide(doc, DEFAULT_RIDE)!;
  const saltos = doc.objects.filter((o): o is Obstacle => o.kind === 'obstacle');

  // Piso teórico: a soma das retas de centro a centro, na ordem do
  // percurso. Nenhum traçado pode ser menor que isto.
  let piso = 0;
  for (let i = 1; i < saltos.length; i += 1) piso += distance(saltos[i - 1]!.pos, saltos[i]!.pos);

  console.log(`\\noficial ${p.distanciaOficial} m`);
  console.log(`assistente ${pathLength(r.path).toFixed(1)} m`);
  console.log(`piso (retas de centro a centro) ${piso.toFixed(1)} m\\n`);

  for (const l of r.legs) {
    console.log(
      `${l.where.padEnd(20)} giro ${l.turnDeg.toFixed(0).padStart(4)}deg  ` +
        `raio ${(l.minRadiusM === Infinity ? 999 : l.minRadiusM).toFixed(1).padStart(5)}  ` +
        `reta extra ${l.lead.after}/${l.lead.before}`,
    );
  }
});
