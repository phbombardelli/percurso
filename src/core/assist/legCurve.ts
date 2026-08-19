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
  let anterior: Vec2 | null = null;

  for (let i = 0; i <= amostras; i += 1) {
    const t = i / amostras;
    const d1 = derivative(c, t);
    const d2 = secondDerivative(c, t);

    // Retorno: a curva inverte o sentido da marcha. Acontece quando as duas
    // tangentes se opõem na mesma reta — a linha sobe e volta por cima de
    // si mesma. A curvatura ali é zero, então a fórmula daria "reta
    // perfeita" para o que é, na verdade, o pior traçado possível. Sem
    // este teste isso passava limpo por toda a checagem.
    if (anterior && anterior.x * d1.x + anterior.y * d1.y < 0) return 0;
    anterior = d1;

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
  /**
   * Quanto de reta foi cedido de cada lado para caber a curva, em metros.
   * O construtor precisa saber para encurtar as retas do salto.
   */
  shrink: { after: number; before: number };
  warnings: CurveWarning[];
  /** Menor raio da volta — o aperto real que o cavalo enfrenta. */
  minRadiusM: number;
  /** Quantas vezes a linha troca de mão. Volta boa troca zero ou uma vez. */
  inflections: number;
  shape: LegShape;
}

/**
 * Quantas vezes a linha inverte a mão da curva.
 *
 * Cavaleiro que vai virar à direita não começa torcendo à esquerda. Essa
 * inversão — que a cúbica produz sozinha quando as tangentes puxam demais
 * — é exatamente o que o olho de quem monta reprova primeiro, mesmo
 * quando o raio e o comprimento estão bons. Sem esta contagem, o juiz não
 * tinha como enxergar o defeito.
 *
 * Trechos quase retos não contam: ruído de arredondamento numa reta
 * inventaria inversões que ninguém vê.
 */
export function inflectionCount(pontos: Vec2[]): number {
  const RETO = 1e-4;
  let trocas = 0;
  let sinal = 0;
  for (let i = 2; i < pontos.length; i += 1) {
    const a = sub(pontos[i - 1]!, pontos[i - 2]!);
    const b = sub(pontos[i]!, pontos[i - 1]!);
    const cruzado = a.x * b.y - a.y * b.x;
    const escala = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (escala === 0 || Math.abs(cruzado) / escala < RETO) continue;
    const atual = Math.sign(cruzado);
    if (sinal !== 0 && atual !== sinal) trocas += 1;
    sinal = atual;
  }
  return trocas;
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

/**
 * Maior raio que QUALQUER curva ligando duas poses pode ter.
 *
 * Entre duas direções que diferem de Δ, virar exige um arco; e o arco de
 * raio r que gira Δ tem corda 2·r·sen(Δ/2). Como a corda não pode passar
 * do vão, o raio não passa de vão / (2·sen(Δ/2)).
 *
 * O limite existe porque a medição ponto a ponto não enxerga o caso
 * degenerado: quando as duas retas quase se encostam e apontam em sentidos
 * opostos, a curva vira um ponto, a curvatura medida dá zero, e o
 * resultado era classificado como "reta perfeita" — o oposto da verdade.
 */
export function reachableRadius(from: Pose, to: Pose): number {
  const bruto = to.heading - from.heading;
  const giro = Math.abs(((((bruto + 180) % 360) + 360) % 360) - 180);
  if (giro < 1e-9) return Infinity;
  return distance(from.pos, to.pos) / (2 * Math.sin((giro * Math.PI) / 360));
}

const samplesOfCubic = (c: Cubic, n = 60): Vec2[] => {
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i += 1) out.push(cubicPoint(c, i / n));
  return out;
};

/**
 * Escolhe a volta entre dois saltos.
 *
 * Gera os dois tipos de solução e julga todas pelo mesmo critério, nesta
 * ordem: menos problemas, menos troca de mão, e por fim a curva mais
 * ampla. Avaliar tudo em vez de parar na primeira que serve custa
 * microssegundos e evita dois vícios — escolher sempre a mais fechada e
 * aceitar uma linha que serpenteia.
 */
export function solveLegCurve(
  from: Pose,
  to: Pose,
  field: Field,
  params: RideParams = DEFAULT_RIDE,
): CurveSolution {
  const candidatos: CurveSolution[] = [];

  const julga = (
    shrink: { after: number; before: number },
    nodes: PathNode[],
    pontos: Vec2[],
    minRadiusM: number,
    shape: LegShape,
  ) => {
    const warnings: CurveWarning[] = [...checkPoints(pontos, field, params)];
    if (minRadiusM < params.tightRadiusM) warnings.push('curva-fechada');
    candidatos.push({
      nodes,
      shrink,
      warnings,
      minRadiusM,
      inflections: inflectionCount(pontos),
      shape,
    });
  };

  for (const shrink of shrinksToTry(params)) {
    const saida = slide(from, shrink.after, false);
    const chegada = slide(to, shrink.before, true);
    const teto = reachableRadius(saida, chegada);

    for (const tension of TENSIONS) {
      const curve = legCurve(saida, chegada, tension);
      const raio = Math.min(minRadiusOf(curve), teto);
      julga(shrink, curveNodes(curve), samplesOfCubic(curve), raio, 'curva');
    }

    // Arco-reta-arco: indispensável nas voltas grandes, onde a cúbica bica.
    // Laçadas ficam de fora pelo limite de giro — foram elas que sujaram o
    // primeiro croqui de verdade.
    for (const raio of radiiForLeg(params)) {
      for (const path of dubinsPaths(saida, chegada, raio)) {
        const giro = path.segments.reduce((t, seg) => t + (seg.kind === 'arco' ? seg.sweep : 0), 0);
        if (giro > params.maxTurnDeg) continue;
        julga(shrink, nodesFromDubins(path), samplePath(path, 0.5), Math.min(raio, teto), 'arco-reta-arco');
      }
    }
  }

  candidatos.sort((a, b) => compara(a, b, params));
  return candidatos[0]!;
}

/**
 * Quanto de reta se pode ceder de cada lado, em metros.
 *
 * Numa virada fechada entre saltos próximos não sobra espaço para curvar:
 * as duas retas de 8 m comem quase todo o vão. O cavaleiro resolve isso
 * cedendo reta — encurta a saída, encurta a aproximação, e ganha o espaço
 * da curva. É troca, não perda: reta demais com curva impossível é pior
 * que reta menor com curva galopável.
 *
 * Nunca abaixo do mínimo: alguma reta perpendicular sempre tem que haver,
 * senão o cavalo chega torto no salto.
 */
function shrinksToTry(params: RideParams): { after: number; before: number }[] {
  const passos = [0, 2, 4, 6];
  const cabe = (v: number, base: number) => base - v >= MIN_STRAIGHT_M;
  const out: { after: number; before: number }[] = [];
  for (const total of [0, 2, 4, 6, 8, 10, 12]) {
    for (const after of passos) {
      const before = total - after;
      if (before < 0 || !passos.includes(before)) continue;
      if (!cabe(after, params.getawayM) || !cabe(before, params.approachM)) continue;
      out.push({ after, before });
    }
  }
  return out;
}

const MIN_STRAIGHT_M = 3;

const slide = (pose: Pose, metros: number, paraFrente: boolean): Pose => ({
  pos: add(pose.pos, scale(fromAngle(pose.heading), paraFrente ? metros : -metros)),
  heading: pose.heading,
});

/**
 * Raios de arco a tentar, do preferido ao de aperto.
 *
 * Não há teto ligado ao vão: quem barra a laçada é o limite de giro, e
 * limitar o raio pelo vão só tirava da mesa a curva ampla que resolvia
 * uma virada de 70 graus em 11 m — justamente a boa.
 */
function radiiForLeg(params: RideParams): number[] {
  const raios: number[] = [];
  for (let r = params.radiusM; r > params.tightRadiusM; r *= 0.85) raios.push(r);
  raios.push(params.tightRadiusM);
  return raios;
}

const galopavel = (c: CurveSolution, params: RideParams) => c.minRadiusM >= params.tightRadiusM;

/**
 * A ordem do juiz.
 *
 * Primeiro o que é impedimento de fato: sair da pista ou atropelar
 * obstáculo. Depois separa quem dá para galopar de quem não dá.
 *
 * Entre as galopáveis vence a que troca menos de mão — a inflexão à
 * esquerda antes de uma curva à direita é o vício que o olho de quem
 * monta reprova primeiro — e, no empate, a mais ampla.
 *
 * Entre as ingalopáveis a conta se inverte: o que importa é o aperto, e
 * comparar inflexão antes do raio elegia o BICO, que tecnicamente não
 * troca de mão porque inverte passando pelo zero. Foi o que aconteceu na
 * primeira tentativa desta regra.
 */
function compara(a: CurveSolution, b: CurveSolution, params: RideParams): number {
  const duros = (c: CurveSolution) => c.warnings.filter((w) => w !== 'curva-fechada').length;
  if (duros(a) !== duros(b)) return duros(a) - duros(b);

  const ga = galopavel(a, params);
  const gb = galopavel(b, params);
  if (ga !== gb) return ga ? -1 : 1;

  const cedeu = (c: CurveSolution) => c.shrink.after + c.shrink.before;
  if (!ga) return b.minRadiusM - a.minRadiusM || cedeu(a) - cedeu(b);

  // Entre as galopáveis, a reta cedida é o último critério: só se abre mão
  // dela quando ela não estava comprando nada.
  return (
    a.inflections - b.inflections ||
    cedeu(a) - cedeu(b) ||
    b.minRadiusM - a.minRadiusM
  );
}

/** A curva em nós do traçado: dois nós, alças na direção dos saltos. */
export function curveNodes(c: Cubic): PathNode[] {
  return [
    { pos: c.p0, type: 'smooth', handleIn: null, handleOut: sub(c.p1, c.p0), anchor: null },
    { pos: c.p3, type: 'smooth', handleIn: sub(c.p2, c.p3), handleOut: null, anchor: null },
  ];
}
