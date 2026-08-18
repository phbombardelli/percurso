import { DEG, add, fromAngle, scale, type Vec2 } from '@core/geometry/vec';
import type { ArcSegment, DubinsPath } from '@core/geometry/dubins';
import type { PathNode } from './types';

/**
 * Converte o caminho geométrico em nós do traçado, do jeito que o resto do
 * programa entende: Bézier cúbica com alças.
 *
 * O assistente entrega um traçado NORMAL, não um objeto especial. Quem
 * recebeu não gostou de uma volta? Arrasta o nó como em qualquer outro
 * traçado, e a distância recalcula sozinha. Fosse um objeto próprio,
 * seria uma caixa-preta.
 *
 * Arco não é Bézier, então cada arco vira uma sequência de pedaços de no
 * máximo `maxArcDeg`. O erro de uma cúbica contra o arco cai com a sexta
 * potência do ângulo do pedaço, então o padrão de 45 graus custa um nó a
 * mais numa meia-volta e derruba o desvio para menos de dois décimos de
 * milímetro no terreno — nada que um croqui enxergue.
 *
 * As retas também ganham alças, colineares e portanto ainda exatamente
 * retas, para que o nó da emenda possa ser liso: assim, arrastá-lo depois
 * não cria bico.
 */

interface Piece {
  from: Vec2;
  to: Vec2;
  /** Direção da tangente em cada ponta, em graus horários. */
  headingFrom: number;
  headingTo: number;
  /** Comprimento das alças, já em metros. */
  handleFrom: number;
  handleTo: number;
}

/** Alça que faz uma cúbica coincidir com o arco: 4/3 * tan(sweep/4). */
const arcHandle = (radius: number, sweepDeg: number) =>
  (4 / 3) * Math.tan((sweepDeg * DEG) / 4) * radius;

function arcPieces(seg: ArcSegment, maxArcDeg: number): Piece[] {
  const n = Math.max(1, Math.ceil(seg.sweep / maxArcDeg));
  const passo = seg.sweep / n;
  const turn = seg.hand === 'direita' ? 1 : -1;
  const alca = arcHandle(seg.radius, passo);

  const ponto = (i: number) => add(seg.center, scale(fromAngle(seg.startAngle + turn * passo * i), seg.radius));
  const tangente = (i: number) => seg.startAngle + turn * passo * i + turn * 90;

  const out: Piece[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push({
      from: ponto(i),
      to: ponto(i + 1),
      headingFrom: tangente(i),
      headingTo: tangente(i + 1),
      handleFrom: alca,
      handleTo: alca,
    });
  }
  return out;
}

export function nodesFromDubins(path: DubinsPath, maxArcDeg = 45): PathNode[] {
  const pieces: Piece[] = [];
  for (const seg of path.segments) {
    if (seg.length <= 1e-9) continue;
    if (seg.kind === 'arco') {
      pieces.push(...arcPieces(seg, maxArcDeg));
    } else {
      const heading = Math.atan2(seg.to.y - seg.from.y, seg.to.x - seg.from.x) / DEG;
      const terco = seg.length / 3;
      pieces.push({
        from: seg.from,
        to: seg.to,
        headingFrom: heading,
        headingTo: heading,
        handleFrom: terco,
        handleTo: terco,
      });
    }
  }
  if (pieces.length === 0) return [];

  const nodes: PathNode[] = [];
  pieces.forEach((piece, i) => {
    const anterior = pieces[i - 1];
    nodes.push({
      pos: piece.from,
      type: 'smooth',
      handleIn: anterior
        ? scale(fromAngle(anterior.headingTo), -anterior.handleTo)
        : null,
      handleOut: scale(fromAngle(piece.headingFrom), piece.handleFrom),
      anchor: null,
    });
  });

  const ultima = pieces[pieces.length - 1]!;
  nodes.push({
    pos: ultima.to,
    type: 'smooth',
    handleIn: scale(fromAngle(ultima.headingTo), -ultima.handleTo),
    handleOut: null,
    anchor: null,
  });

  return nodes;
}
