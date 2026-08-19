import { cubicPoint, type Cubic } from '@core/geometry/bezier';
import { add, distance, fromAngle, scale, sub, type Vec2 } from '@core/geometry/vec';
import { dubinsPaths, samplePath, type Pose } from '@core/geometry/dubins';
import { nodesFromDubins } from '@core/model/pathFromDubins';
import type { PathNode } from '@core/model/types';
import {
  DEFAULT_RIDE,
  distanceToOutline,
  insidePolygon,
  obstacleFootprint,
  type Field,
  type RideParams,
  type RideWarning,
} from './ridePath';

/**
 * A volta entre dois saltos, como uma curva só.
 *
 * A primeira versão do assistente ligava as poses pelo caminho mais curto
 * de raio mínimo (Dubins). O resultado, na pista de verdade, foi um croqui
 * cheio de laçadas. O diagnóstico: exigir reta perpendicular de tamanho
 * fixo nas duas pontas E raio mínimo entre elas é restritivo demais.
 * Quando os dois saltos não estão bem alinhados — que é o caso quase
 * sempre —, TODAS as soluções giram mais de 330 graus. Não era escolha
 * ruim entre opções boas: não havia opção boa.
 *
 * Os croquis reais mostram outra construção: a linha é uma curva fluida
 * que atravessa o percurso e cruza cada obstáculo perpendicular. É o que
 * uma cúbica de Hermite faz por definição — sai na direção do salto
 * anterior, chega na direção do próximo, e nunca dá laçada.
 *
 * Só que a cúbica única também não basta sozinha: numa volta grande, de
 * meia-volta para trás, ela responde com um BICO, porque não consegue
 * girar tanto sem se dobrar. E é justamente aí que o arco-reta-arco
 * brilha.
 *
 * Então os dois geradores convivem e um só juiz decide: cúbica fluida
 * para as voltas mansas, arco-reta-arco para as voltas grandes. O
 * critério é o mesmo para ambos — cabe na pista, não atropela obstáculo,
 * e o ponto mais fechado ainda se galopa. Vence quem tem menos problema
 * e, no empate, a curva mais ampla.
 */

/** Quanto a curva "puxa" na direção do salto, como fração do vão. */
const TENSIONS = [0.3, 0.4, 0.5, 0.6, 0.75, 0.9, 1.1, 1.35];

export function legCurve(from: Pose, to: Pose, tension: number): Cubic {
  const vao = distance(from.pos, to.pos);
  const puxa = Math.max(1, vao * tension);
  return {
    p0: from.pos,
    p1: add(from.pos, scale(fromAngle(from.heading), puxa)),
    p2: sub(to.pos, scale(fromAngle(to.heading), puxa)),
    p3: to.pos,
  };
}

/**
 * Menor raio de curvatura ao longo da curva, em metros.
 *
 * É a medida que diz se o cavalo consegue fazer a volta: raio pequeno
 * demais é curva que não se galopa. Calculado pela fórmula da curvatura,
 * amostrando o parâmetro — não há forma fechada para o mínimo.
 */
export function minRadiusOf(c: Cubic, amostras = 48): number {
  let menor = Infinity;
  for (let i = 0; i <= amostras; i += 1) {
    const t = i / amostras;
    const d1 = derivative(c, t);
    const d2 = secondDerivative(c, t);
    const cruzado = Math.abs(d1.x * d2.y - d1.y * d2.x);
    const velocidade = Math.hypot(d1.x, d1.y);
    if (cruzado < 1e-12) continue;
    menor = Math.min(menor, (velocidade * velocidade * velocidade) / cruzado);
  }
  return menor;
}

function derivative(c: Cubic, t: number): Vec2 {
  const u = 1 - t;
  const k1 = 3 * u * u;
  const k2 = 6 * u * t;
  const k3 = 3 * t * t;
  return {
    x: k1 * (c.p1.x - c.p0.x) + k2 * (c.p2.x - c.p1.x) + k3 * (c.p3.x - c.p2.x),
    y: k1 * (c.p1.y - c.p0.y) + k2 * (c.p2.y - c.p1.y) + k3 * (c.p3.y - c.p2.y),
  };
}

function secondDerivative(c: Cubic, t: number): Vec2 {
  const u = 1 - t;
  return {
    x: 6 * u * (c.p2.x - 2 * c.p1.x + c.p0.x) + 6 * t * (c.p3.x - 2 * c.p2.x + c.p1.x),
    y: 6 * u * (c.p2.y - 2 * c.p1.y + c.p0.y) + 6 * t * (c.p3.y - 2 * c.p2.y + c.p1.y),
  };
}

export type CurveWarning = RideWarning | 'curva-fechada';

export type LegShape = 'curva' | 'arco-reta-arco';

export interface CurveSolution {
  nodes: PathNode[];
  warnings: CurveWarning[];
  /** Menor raio da volta — o aperto real que o cavalo enfrenta. */
  minRadiusM: number;
  shape: LegShape;
}

function checkPoints(pontos: Vec2[], field: Field, params: RideParams): RideWarning[] {
  const avisos: RideWarning[] = [];
  if (field.outline) {
    const escapou = pontos.some(
      (p) =>
        !insidePolygon(p, field.outline!) ||
        distanceToOutline(p, field.outline!) < params.railMarginM,
    );
    if (escapou) avisos.push('fora-da-pista');
  }

  const atropela = field.blockers.some((o) => {
    const corpo = obstacleFootprint(o);
    // As pontas ficam de fora: elas encostam de propósito nos saltos que a
    // volta liga, e acusá-las seria acusar o próprio salto.
    return pontos.slice(3, -3).some((p) => insidePolygon(p, corpo));
  });
  if (atropela) avisos.push('passa-por-obstaculo');

  return avisos;
}

const samplesOfCubic = (c: Cubic, n = 60): Vec2[] => {
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i += 1) out.push(cubicPoint(c, i / n));
  return out;
};

/**
 * Escolhe a volta entre dois saltos.
 *
 * Gera os dois tipos de solução e julga todas pelo mesmo critério: menos
 * problemas primeiro e, no empate, o maior raio — porque a regra do
 * traçado é a curva mais ampla que couber. Avaliar tudo em vez de parar
 * na primeira que serve custa microssegundos e evita o vício de escolher
 * sempre a mais fechada.
 */
export function solveLegCurve(
  from: Pose,
  to: Pose,
  field: Field,
  params: RideParams = DEFAULT_RIDE,
): CurveSolution {
  const candidatos: CurveSolution[] = [];

  const julga = (nodes: PathNode[], pontos: Vec2[], minRadiusM: number, shape: LegShape) => {
    const warnings: CurveWarning[] = [...checkPoints(pontos, field, params)];
    if (minRadiusM < params.tightRadiusM) warnings.push('curva-fechada');
    candidatos.push({ nodes, warnings, minRadiusM, shape });
  };

  for (const tension of TENSIONS) {
    const curve = legCurve(from, to, tension);
    julga(curveNodes(curve), samplesOfCubic(curve), minRadiusOf(curve), 'curva');
  }

  // Arco-reta-arco: indispensável nas voltas grandes, onde a cúbica bica.
  // Laçadas ficam de fora pelo limite de giro — foram elas que sujaram o
  // primeiro croqui de verdade.
  for (const raio of radiiForLeg(params, distance(from.pos, to.pos))) {
    for (const path of dubinsPaths(from, to, raio)) {
      const giro = path.segments.reduce((t, seg) => t + (seg.kind === 'arco' ? seg.sweep : 0), 0);
      if (giro > params.maxTurnDeg) continue;
      julga(nodesFromDubins(path), samplePath(path, 0.5), raio, 'arco-reta-arco');
    }
  }

  candidatos.sort(
    (a, b) => a.warnings.length - b.warnings.length || b.minRadiusM - a.minRadiusM,
  );
  return candidatos[0]!;
}

/** Raios de arco a tentar, limitados pelo vão: curva maior que o vão laça. */
function radiiForLeg(params: RideParams, gapM: number): number[] {
  const teto = Math.max(params.tightRadiusM, Math.min(params.radiusM, gapM / 2));
  const raios: number[] = [];
  for (let r = teto; r > params.tightRadiusM; r *= 0.85) raios.push(r);
  raios.push(params.tightRadiusM);
  return raios;
}

/** A curva em nós do traçado: dois nós, alças na direção dos saltos. */
export function curveNodes(c: Cubic): PathNode[] {
  return [
    { pos: c.p0, type: 'smooth', handleIn: null, handleOut: sub(c.p1, c.p0), anchor: null },
    { pos: c.p3, type: 'smooth', handleIn: sub(c.p2, c.p3), handleOut: null, anchor: null },
  ];
}
