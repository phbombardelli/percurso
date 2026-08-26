import { add, fromAngle, scale, type Vec2 } from '@core/geometry/vec';
import { jumpHeading } from '@core/assist/ridePath';
import type { CourseDocument, ObjectId, Obstacle } from '@core/model/types';

/**
 * Combinações e linhas retas.
 *
 * A distância entre dois saltos NÃO se mede de centro a centro: mede-se da
 * VARA DE SAÍDA do anterior até a VARA DE ENTRADA do seguinte. É o vão que
 * o cavalo tem para galopar, e é o número que o traçador escreve no
 * croqui. Num oxer de 1,60 m de largura, medir pelo centro erraria 1,60 m
 * numa distância de 7,50 — mais de uma passada inteira.
 *
 * Alinhar é a outra metade: os elementos ficam no mesmo eixo, com a mesma
 * inclinação. Combinação torta não existe — se os elementos não estão em
 * linha, não são uma combinação, são dois obstáculos próximos.
 */

/** Meia largura do salto: as varas, sem paraflanco. */
const meiaVara = (o: Obstacle): number => (o.spreadM ?? 0) / 2;

/**
 * Ordena os obstáculos na ordem em que o cavalo os encontra.
 *
 * A ordem é a da NUMERAÇÃO: 1, 2, 3a, 3b, 4, 5a, 5b, 5c. É o percurso que
 * define quem vem antes, e não a geometria.
 *
 * A primeira versão ordenava pela projeção no eixo do salto, o que dava
 * na mesma quando os elementos já estavam em linha — e dava resultado
 * confuso justamente quando não estavam, que é quando a ferramenta é
 * usada. Obstáculo torto ou fora do lugar aparecia na ordem errada, e o
 * campo "5b - 5a" não quer dizer nada.
 *
 * Obstáculo sem número vai para o fim, ordenado pela projeção: aí não há
 * numeração a respeitar, e a geometria é o que sobra.
 */
export function orderAlongLine(obstacles: Obstacle[]): Obstacle[] {
  const primeiro = obstacles[0];
  if (!primeiro) return [];
  const dir = fromAngle(jumpHeading(primeiro));
  const projeta = (o: Obstacle) => o.pos.x * dir.x + o.pos.y * dir.y;

  const numeroDe = (o: Obstacle) => {
    const n = parseInt(o.number, 10);
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  };
  const letraDe = (o: Obstacle) => (o.letter === '' ? 0 : o.letter.charCodeAt(0));

  return [...obstacles].sort(
    (a, b) =>
      numeroDe(a) - numeroDe(b) || letraDe(a) - letraDe(b) || projeta(a) - projeta(b),
  );
}

/**
 * Distâncias atuais entre elementos consecutivos, de vara a vara.
 *
 * Negativa quer dizer que os corpos se sobrepõem — o que é informação, não
 * erro: mostra ao desenhador que os dois estão montados um por cima do
 * outro.
 */
export function currentGaps(ordered: Obstacle[]): number[] {
  const primeiro = ordered[0];
  if (!primeiro) return [];
  const dir = fromAngle(jumpHeading(primeiro));
  const projeta = (o: Obstacle) => o.pos.x * dir.x + o.pos.y * dir.y;

  const vaos: number[] = [];
  for (let i = 1; i < ordered.length; i += 1) {
    const antes = ordered[i - 1]!;
    const depois = ordered[i]!;
    vaos.push(projeta(depois) - projeta(antes) - meiaVara(antes) - meiaVara(depois));
  }
  return vaos;
}

/**
 * Põe os elementos em linha, nas distâncias pedidas.
 *
 * O primeiro não se mexe: alinhar é acertar os outros em relação a ele. Se
 * o primeiro também se movesse, cada aplicação da ferramenta arrastaria a
 * combinação inteira pela pista, e o desenhador perderia o lugar que
 * escolheu para ela.
 *
 * Todos ganham a inclinação do primeiro, e todos ficam no eixo do salto
 * dele: mesma direção, sem desvio lateral.
 */
export function alignCombination(
  doc: CourseDocument,
  ids: ObjectId[],
  gapsM: number[],
): void {
  const selecionados = ids
    .map((id) => doc.objects.find((o) => o.id === id))
    .filter((o): o is Obstacle => o?.kind === 'obstacle');
  if (selecionados.length < 2) return;

  const ordenados = orderAlongLine(selecionados);
  const base = ordenados[0]!;
  const dir = fromAngle(jumpHeading(base));

  let cursor: Vec2 = base.pos;
  for (let i = 1; i < ordenados.length; i += 1) {
    const antes = ordenados[i - 1]!;
    const atual = ordenados[i]!;
    const vao = gapsM[i - 1] ?? 0;

    // Do centro do anterior ao centro deste: meia largura de cada um mais
    // o vão livre entre as varas.
    const passo = meiaVara(antes) + vao + meiaVara(atual);
    cursor = add(cursor, scale(dir, passo));

    atual.pos = cursor;
    atual.rotation = base.rotation;
    // A seta acompanha: elementos de uma linha são saltados no mesmo sentido.
    atual.arrow.reversed = base.arrow.reversed;
  }
}
