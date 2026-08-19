import { fromAngle, scale, distance, type Vec2 } from '@core/geometry/vec';
import { nodesFromDubins } from '@core/model/pathFromDubins';
import { createPath } from '@core/model/path';
import type { CourseDocument, CoursePath, Obstacle, PathNode, TimingLine } from '@core/model/types';
import {
  DEFAULT_RIDE,
  entryPose,
  exitPose,
  fieldFrom,
  solveLeg,
  timingPose,
  type Field,
  type RideParams,
  type RideWarning,
} from './ridePath';

/**
 * O traçado do percurso inteiro: partida, obstáculos na ordem numerada,
 * chegada.
 *
 * O assistente NÃO inventa percurso — isso o §44 proíbe e não faria
 * sentido. Ele lê a numeração que já está lançada e desenha por cima a
 * linha que o cavaleiro faria.
 *
 * Uma observação que simplificou tudo: como cada obstáculo tem pose de
 * entrada e de saída fixas (perpendicular, centrada, com a reta do
 * parâmetro), as voltas NÃO se influenciam. A escolha de uma não muda o
 * ponto de partida da seguinte. Cheguei a planejar uma otimização da
 * sequência inteira; ela seria trabalho jogado fora.
 */

/** Um degrau do percurso: um obstáculo isolado ou uma combinação A/B/C. */
export interface RideStop {
  /** Elementos em ordem: um só, ou A, B, C de uma combinação. */
  elements: Obstacle[];
  label: string;
}

const letterRank = (letra: string) => (letra === '' ? 0 : letra.charCodeAt(0) - 64);

/**
 * Ordena os obstáculos pela numeração do croqui e agrupa as combinações.
 *
 * Obstáculo sem número fica de fora: o assistente não tem como saber onde
 * ele entra, e chutar seria pior que omitir.
 */
export function courseOrder(obstacles: Obstacle[]): RideStop[] {
  const numerados = obstacles
    .map((o) => ({ o, n: parseInt(o.number, 10) }))
    .filter((x): x is { o: Obstacle; n: number } => Number.isFinite(x.n))
    .sort((a, b) => a.n - b.n || letterRank(a.o.letter) - letterRank(b.o.letter));

  const stops: RideStop[] = [];
  for (const { o, n } of numerados) {
    const ultimo = stops[stops.length - 1];
    const combina = ultimo != null && parseInt(ultimo.elements[0]!.number, 10) === n && o.letter !== '';
    if (combina) {
      ultimo!.elements.push(o);
      ultimo!.label = `${n}${ultimo!.elements.map((e) => e.letter).join('')}`;
    } else {
      stops.push({ elements: [o], label: `${n}${o.letter}` });
    }
  }
  return stops;
}

/** Nós de um trecho reto, com alças colineares para a emenda ficar lisa. */
function straightNodes(from: Vec2, to: Vec2): PathNode[] {
  const comprimento = distance(from, to);
  if (comprimento < 1e-9) return [];
  const heading = Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);
  const alca = scale(fromAngle(heading), comprimento / 3);
  return [
    { pos: from, type: 'smooth', handleIn: null, handleOut: alca, anchor: null },
    { pos: to, type: 'smooth', handleIn: scale(alca, -1), handleOut: null, anchor: null },
  ];
}

/**
 * Emenda os pedaços num traçado só. O nó repetido da junta vira um nó
 * único que herda a alça de entrada de um lado e a de saída do outro —
 * é o que evita um bico onde a volta encontra a reta do salto.
 */
function joinNodes(pieces: PathNode[][]): PathNode[] {
  const out: PathNode[] = [];
  for (const piece of pieces) {
    if (piece.length === 0) continue;
    const anterior = out[out.length - 1];
    const primeiro = piece[0]!;
    if (anterior && distance(anterior.pos, primeiro.pos) < 1e-6) {
      anterior.handleOut = primeiro.handleOut;
      out.push(...piece.slice(1));
    } else {
      out.push(...piece);
    }
  }
  return out;
}

export interface RideProblem {
  /** Onde o problema aparece: "3 para 4", "partida para 1". */
  where: string;
  warning: RideWarning;
}

export interface RideResult {
  path: CoursePath;
  problems: RideProblem[];
  /** Degraus percorridos, na ordem, para o relatório na interface. */
  stops: string[];
}

/**
 * Monta o traçado do percurso inteiro.
 *
 * Devolve `null` só quando não há o que traçar — menos de dois degraus.
 * Fora isso sempre entrega, com os problemas anotados: a volta impossível
 * precisa aparecer desenhada para o desenhador ver onde está o aperto.
 */
export function buildCourseRide(
  doc: CourseDocument,
  params: RideParams = DEFAULT_RIDE,
): RideResult | null {
  const obstacles = doc.objects.filter((o): o is Obstacle => o.kind === 'obstacle');
  const timings = doc.objects.filter((o): o is TimingLine => o.kind === 'timing');
  const arena = doc.objects.find((o) => o.kind === 'arena') ?? null;
  const field: Field = fieldFrom(arena?.kind === 'arena' ? arena : null, obstacles);

  const stops = courseOrder(obstacles);
  const partida = timings.find((t) => t.role === 'start') ?? null;
  const chegada = timings.find((t) => t.role === 'finish') ?? null;

  // Cada degrau contribui com um par entrada/saída; partida e chegada são
  // cruzadas retas, igual a qualquer outro.
  const portoes: { label: string; entry: ReturnType<typeof entryPose>; exit: ReturnType<typeof exitPose>; middle: PathNode[] }[] = [];

  if (partida) {
    portoes.push({
      label: 'partida',
      entry: timingPose(partida, params, 'antes', field),
      exit: timingPose(partida, params, 'depois', field),
      middle: [],
    });
  }

  for (const stop of stops) {
    const primeiro = stop.elements[0]!;
    const ultimo = stop.elements[stop.elements.length - 1]!;
    // Dentro da combinação a linha é reta obrigatória, sem volta nenhuma:
    // é o que todo croqui mostra, e o que o cavalo faz.
    const meio: PathNode[] = [];
    for (let i = 0; i < stop.elements.length - 1; i += 1) {
      meio.push(
        ...straightNodes(
          exitPose(stop.elements[i]!, params, field).pos,
          entryPose(stop.elements[i + 1]!, params, field).pos,
        ),
      );
    }
    portoes.push({
      label: stop.label,
      entry: entryPose(primeiro, params, field),
      exit: exitPose(ultimo, params, field),
      middle: meio,
    });
  }

  if (chegada) {
    portoes.push({
      label: 'chegada',
      entry: timingPose(chegada, params, 'antes', field),
      exit: timingPose(chegada, params, 'depois', field),
      middle: [],
    });
  }

  if (portoes.length < 2) return null;

  const pieces: PathNode[][] = [];
  const problems: RideProblem[] = [];

  portoes.forEach((portao, i) => {
    // O salto em si: da aproximação à saída, sempre reto.
    if (portao.middle.length > 0) {
      pieces.push(straightNodes(portao.entry.pos, portao.middle[0]!.pos));
      pieces.push(portao.middle);
      pieces.push(straightNodes(portao.middle[portao.middle.length - 1]!.pos, portao.exit.pos));
    } else {
      pieces.push(straightNodes(portao.entry.pos, portao.exit.pos));
    }

    const proximo = portoes[i + 1];
    if (!proximo) return;

    const solucao = solveLeg(portao.exit, proximo.entry, field, params);
    if (!solucao) return;
    pieces.push(nodesFromDubins(solucao.path));
    for (const warning of solucao.warnings) {
      problems.push({ where: `${portao.label} para ${proximo.label}`, warning });
    }
  });

  const nodes = joinNodes(pieces);
  if (nodes.length < 2) return null;

  return {
    path: createPath(nodes),
    problems,
    stops: portoes.map((p) => p.label),
  };
}
