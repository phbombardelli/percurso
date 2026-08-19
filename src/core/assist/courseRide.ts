import { add, fromAngle, scale, distance, type Vec2 } from '@core/geometry/vec';
import type { Pose } from '@core/geometry/dubins';
import { solveLegCurve, type CurveWarning, type LegShape } from './legCurve';
import { createPath } from '@core/model/path';
import type { CourseDocument, CoursePath, Obstacle, PathNode, TimingLine } from '@core/model/types';
import {
  DEFAULT_RIDE,
  entryPose,
  exitPose,
  fieldFrom,
  timingPose,
  type Field,
  type RideParams,
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
  warning: CurveWarning;
}

/** Uma volta resolvida, para conferência. */
export interface RideLeg {
  where: string;
  /** Ponto mais fechado da volta: é ele que diz se dá para galopar. */
  minRadiusM: number;
  /** Trocas de mão da linha. Zero é o normal; uma é um S de verdade. */
  inflections: number;
  shape: LegShape;
}

export interface RideResult {
  path: CoursePath;
  problems: RideProblem[];
  /** Degraus percorridos, na ordem, para o relatório na interface. */
  stops: string[];
  legs: RideLeg[];
}

/** Um degrau qualquer do percurso: cruzada de tempo ou salto. */
type Gate =
  | { label: string; kind: 'timing'; line: TimingLine }
  | { label: string; kind: 'obstacle'; elements: Obstacle[] };

/**
 * Quanto de reta cabe entre dois pontos, sem as duas retas se atropelarem.
 *
 * Este é o conserto do defeito mais feio do primeiro assistente. Partida e
 * obstáculo 1 costumam ficar a menos de 16 m um do outro; com 8 m de reta
 * de cada lado, o ponto de CHEGADA nascia atrás do ponto de PARTIDA, e a
 * única forma de voltar respeitando o raio mínimo era dar uma volta
 * completa. O croqui saía cheio de laçadas onde o cavaleiro passa reto.
 *
 * Um terço do vão para cada lado deixa sempre um terço de folga no meio,
 * que é onde a curva, se houver, acontece.
 */
export const straightBudget = (gap: number, pedido: number): number =>
  Math.max(0, Math.min(pedido, gap / 3));

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
  const arena = doc.objects.find((o) => o.kind === 'arena');
  const field: Field = fieldFrom(arena?.kind === 'arena' ? arena : null, obstacles);

  const partida = timings.find((t) => t.role === 'start');
  const chegada = timings.find((t) => t.role === 'finish');

  const gates: Gate[] = [];
  if (partida) gates.push({ label: 'partida', kind: 'timing', line: partida });
  for (const stop of courseOrder(obstacles)) {
    gates.push({ label: stop.label, kind: 'obstacle', elements: stop.elements });
  }
  if (chegada) gates.push({ label: 'chegada', kind: 'timing', line: chegada });
  if (gates.length < 2) return null;

  const com = (chave: 'approachM' | 'getawayM', metros: number): RideParams => ({
    ...params,
    [chave]: metros,
  });

  const entryOf = (g: Gate, reta: number) =>
    g.kind === 'timing'
      ? timingPose(g.line, com('approachM', reta), 'antes', field)
      : entryPose(g.elements[0]!, com('approachM', reta), field);

  const exitOf = (g: Gate, reta: number) =>
    g.kind === 'timing'
      ? timingPose(g.line, com('getawayM', reta), 'depois', field)
      : exitPose(g.elements[g.elements.length - 1]!, com('getawayM', reta), field);

  // Primeiro as retas: cada vão decide quanto cabe de cada lado. Só depois
  // se resolvem as voltas, já com as pontas nos lugares certos.
  const entradas: ReturnType<typeof entryOf>[] = [];
  const saidas: ReturnType<typeof exitOf>[] = [];

  gates.forEach((g, i) => {
    const anterior = gates[i - 1];
    const proximo = gates[i + 1];

    const vaoAntes = anterior ? distance(exitOf(anterior, 0).pos, entryOf(g, 0).pos) : Infinity;
    const vaoDepois = proximo ? distance(exitOf(g, 0).pos, entryOf(proximo, 0).pos) : Infinity;

    entradas[i] = entryOf(g, straightBudget(vaoAntes, params.approachM));
    saidas[i] = exitOf(g, straightBudget(vaoDepois, params.getawayM));
  });

  const solucoes = gates.map((_, i) =>
    i < gates.length - 1 ? solveLegCurve(saidas[i]!, entradas[i + 1]!, field, params) : null,
  );

  // A volta pode ter cedido reta: as retas do salto param onde ela começa.
  const desliza = (pose: Pose, metros: number, paraFrente: boolean): Vec2 =>
    add(pose.pos, scale(fromAngle(pose.heading), paraFrente ? metros : -metros));

  const pontaEntrada = (i: number): Vec2 => {
    const anterior = solucoes[i - 1];
    return anterior ? desliza(entradas[i]!, anterior.shrink.before, true) : entradas[i]!.pos;
  };
  const pontaSaida = (i: number): Vec2 => {
    const propria = solucoes[i];
    return propria ? desliza(saidas[i]!, propria.shrink.after, false) : saidas[i]!.pos;
  };

  const pieces: PathNode[][] = [];
  const problems: RideProblem[] = [];
  const legs: RideLeg[] = [];

  gates.forEach((g, i) => {
    // O salto em si, e a combinação por dentro: reta, sempre.
    if (g.kind === 'obstacle' && g.elements.length > 1) {
      let atual = pontaEntrada(i);
      for (let k = 0; k < g.elements.length - 1; k += 1) {
        const vao = distance(
          exitPose(g.elements[k]!, com('getawayM', 0), field).pos,
          entryPose(g.elements[k + 1]!, com('approachM', 0), field).pos,
        );
        const reta = straightBudget(vao, params.getawayM);
        const fim = exitPose(g.elements[k]!, com('getawayM', reta), field).pos;
        pieces.push(straightNodes(atual, fim));
        atual = entryPose(g.elements[k + 1]!, com('approachM', reta), field).pos;
        pieces.push(straightNodes(fim, atual));
      }
      pieces.push(straightNodes(atual, pontaSaida(i)));
    } else {
      pieces.push(straightNodes(pontaEntrada(i), pontaSaida(i)));
    }

    const proximo = gates[i + 1];
    const solucao = solucoes[i];
    if (!proximo || !solucao) return;

    pieces.push(solucao.nodes);
    legs.push({
      where: `${g.label} para ${proximo.label}`,
      minRadiusM: solucao.minRadiusM,
      inflections: solucao.inflections,
      shape: solucao.shape,
    });
    for (const warning of solucao.warnings) {
      problems.push({ where: `${g.label} para ${proximo.label}`, warning });
    }
  });

  const nodes = joinNodes(pieces);
  if (nodes.length < 2) return null;

  return { path: createPath(nodes), problems, stops: gates.map((g) => g.label), legs };
}
