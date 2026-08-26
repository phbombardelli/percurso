import { cubicPoint, type Cubic } from '@core/geometry/bezier';
import { DEG, add, distance, fromAngle, scale, sub, type Vec2 } from '@core/geometry/vec';
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
   * Metros a mais de reta usados de cada lado. Negativo é reta cedida
   * para caber a curva; positivo é reta ganha para caber a curva para
   * trás. O construtor precisa saber para desenhar a reta do salto até o
   * ponto certo.
   */
  lead: { after: number; before: number };
  warnings: CurveWarning[];
  /** Menor raio da volta — o aperto real que o cavalo enfrenta. */
  minRadiusM: number;
  /** Quantas vezes a linha troca de mão. Volta boa troca zero ou uma vez. */
  inflections: number;
  /** Giro total da volta, em graus. Medida de economia. */
  turnDeg: number;
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
  const leads = leadsToTry(params);

  // Primeiro a linha DIRETA: sem alongar reta nenhuma. Havendo ali uma
  // volta galopável e limpa, é ela — cavaleiro não dá a volta por fora
  // quando dá para ir direto.
  const direta = avalia(leads.filter((l) => l.after <= 0 && l.before <= 0), from, to, field, params);
  const melhorDireta = escolhe(direta, params);
  if (melhorDireta && serve(melhorDireta, params) && melhorDireta.turnDeg <= GIRO_MANSO) {
    return melhorDireta;
  }

  // Só então a curva para trás, que custa reta e metros. É RECURSO, não
  // alternativa de igual para igual: comparar as duas famílias no mesmo
  // balcão fazia a volta por fora ganhar sempre que a direta ficava um
  // pouco apertada, e o croqui virava um emaranhado de laçadas.
  const porFora = avalia(leads.filter((l) => l.after > 0 || l.before > 0), from, to, field, params);
  const melhorPorFora = escolhe(porFora, params);
  if (melhorPorFora && serve(melhorPorFora, params)) return melhorPorFora;

  // Nenhuma serve: entrega a menos ruim, com os avisos.
  return escolhe([...direta, ...porFora], params) ?? melhorDireta!;
}

/**
 * As formas realmente DIFERENTES de fazer uma pernada.
 *
 * Existe porque a calibração mostrou que o assistente não sabe escolher:
 * ele erra 40% na distância total de uma prova real, e nenhum ajuste de
 * parâmetro conserta. Gerar boas opções, porém, ele sabe — e escolher é
 * o que o desenhador sabe fazer.
 *
 * O trabalho aqui é PODAR. A busca produz centenas de candidatos, quase
 * todos variações imperceptíveis do mesmo desenho: meio grau de giro, dez
 * centímetros de raio. Mostrar tudo seria inútil. O que se agrupa é a
 * FORMA — para que lado vira, quantas vezes troca de mão, se vai direto
 * ou por fora, e quanto gira em degraus grossos. De cada grupo sobra o
 * melhor exemplar.
 */
export function legCandidates(
  from: Pose,
  to: Pose,
  field: Field,
  params: RideParams = DEFAULT_RIDE,
  maximo = 6,
): CurveSolution[] {
  const todos = avalia(leadsToTry(params), from, to, field, params);
  if (todos.length === 0) return [];

  const melhor = [...todos].sort((a, b) => compara(a, b, params))[0]!;

  // Poda antes de agrupar. Duas regras, e as duas são sobre o que NÃO é
  // alternativa:
  //
  // Havendo caminho limpo, caminho com problema não é opção — é o mesmo
  // trajeto com um defeito.
  //
  // E um caminho que gira meia volta a mais que o melhor não é outra
  // maneira de fazer a pernada: é um desvio. Numa reta absoluta, sem essa
  // regra, a lista vinha com seis "opções", cinco delas voltas por fora
  // desnecessárias.
  const limpoExiste = todos.some((c) => c.warnings.length === 0);
  const tetoGiro = melhor.turnDeg + 180;
  const candidatos = todos.filter(
    (c) => (!limpoExiste || c.warnings.length === 0) && c.turnDeg <= tetoGiro,
  );

  const porForma = new Map<string, CurveSolution>();
  for (const c of candidatos) {
    const chave = assinatura(c);
    const atual = porForma.get(chave);
    if (!atual || compara(c, atual, params) < 0) porForma.set(chave, c);
  }

  return [...porForma.values()].sort((a, b) => compara(a, b, params)).slice(0, maximo);
}

/**
 * Assinatura da forma. Duas voltas com a mesma assinatura são a mesma
 * ideia desenhada com meio grau de diferença.
 */
function assinatura(c: CurveSolution): string {
  // Ir por fora não entra na assinatura: o GIRO já distingue a volta
  // direta da volta por fora, e marcar as duas coisas fazia a mesma reta
  // aparecer duas vezes — uma delas com seis metros a mais e nenhuma
  // diferença de desenho.
  return `${maoInicial(c.nodes)}|${c.inflections}|${Math.round(c.turnDeg / 45)}`;
}

/** Para que lado a linha vira primeiro: -1 esquerda, 1 direita, 0 reta. */
function maoInicial(nodes: PathNode[]): number {
  const pontos = nodes.map((n) => n.pos);
  for (let i = 2; i < pontos.length; i += 1) {
    const a = sub(pontos[i - 1]!, pontos[i - 2]!);
    const b = sub(pontos[i]!, pontos[i - 1]!);
    const escala = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (escala === 0) continue;
    const cruzado = (a.x * b.y - a.y * b.x) / escala;
    if (Math.abs(cruzado) > 0.02) return Math.sign(cruzado);
  }
  return 0;
}

/** Volta que dá para galopar e não esbarra em nada. */
const serve = (c: CurveSolution, params: RideParams): boolean =>
  c.warnings.length === 0 && c.minRadiusM >= params.tightRadiusM;

/**
 * Giro até o qual a volta direta ainda é "mansa", em graus.
 *
 * A ordem de preferência do ofício é: volta direta mansa, depois curva
 * para trás, e só em último caso volta direta com giro grande. Sem este
 * degrau, uma laçada de 350 graus passava como direta — limpa e
 * galopável, portanto aceita — e o croqui enchia de rabiscos onde a volta
 * por fora teria resolvido com elegância.
 *
 * Meia volta e um quarto: mais que isso a linha já está se enrolando.
 */
const GIRO_MANSO = 200;

const escolhe = (lista: CurveSolution[], params: RideParams): CurveSolution | null =>
  lista.length === 0 ? null : [...lista].sort((a, b) => compara(a, b, params))[0]!;

/** Gera e julga todos os candidatos para um conjunto de alongamentos. */
function avalia(
  leads: { after: number; before: number }[],
  from: Pose,
  to: Pose,
  field: Field,
  params: RideParams,
): CurveSolution[] {
  const candidatos: CurveSolution[] = [];

  const julga = (
    lead: { after: number; before: number },
    nodes: PathNode[],
    pontos: Vec2[],
    minRadiusM: number,
    shape: LegShape,
  ) => {
    const warnings: CurveWarning[] = [...checkPoints(pontos, field, params)];
    if (minRadiusM < params.tightRadiusM) warnings.push('curva-fechada');
    candidatos.push({
      nodes,
      lead,
      warnings,
      minRadiusM,
      inflections: inflectionCount(pontos),
      turnDeg: turnOfPoints(pontos),
      shape,
    });
  };

  for (const lead of leads) {
    // Positivo afasta do obstáculo: a saída avança e a chegada recua.
    const saida = slide(from, lead.after);
    const chegada = slide(to, -lead.before);
    const teto = reachableRadius(saida, chegada);

    for (const tension of TENSIONS) {
      const curve = legCurve(saida, chegada, tension);
      const raio = Math.min(minRadiusOf(curve), teto);
      julga(lead, curveNodes(curve), samplesOfCubic(curve), raio, 'curva');
    }

    // Arco-reta-arco: indispensável nas voltas grandes, onde a cúbica bica.
    for (const raio of radiiForLeg(params)) {
      for (const path of dubinsPaths(saida, chegada, raio)) {
        const giro = path.segments.reduce((t, seg) => t + (seg.kind === 'arco' ? seg.sweep : 0), 0);
        if (giro > params.maxTurnDeg) continue;
        julga(lead, nodesFromDubins(path), samplePath(path, 0.5), Math.min(raio, teto), 'arco-reta-arco');
      }
    }
  }
  return candidatos;
}

function leadsToTry(params: RideParams): { after: number; before: number }[] {
  const piso = (base: number) => -Math.max(0, base - MIN_STRAIGHT_M);
  const cede = (base: number) => [0, -2, -4, -6].filter((v) => v >= piso(base));
  const alonga = [6, 12, 20, 30];

  const out: { after: number; before: number }[] = [];

  // Ceder reta: as combinações dos dois lados, que são poucas e baratas.
  for (const after of cede(params.getawayM)) {
    for (const before of cede(params.approachM)) out.push({ after, before });
  }

  // Alongar: só de UM lado por vez, mais alguns simétricos. Alongar os
  // dois lados em medidas diferentes quase nunca ajuda e multiplicava o
  // custo da busca — o percurso inteiro levava um segundo e meio.
  for (const v of alonga) {
    out.push({ after: v, before: 0 });
    out.push({ after: 0, before: v });
  }
  out.push({ after: 12, before: 12 }, { after: 20, before: 20 });

  // Do mais econômico ao mais largo: mexer na reta é concessão, e só se
  // faz a que for necessária.
  out.sort(
    (a, b) =>
      Math.abs(a.after) + Math.abs(a.before) - (Math.abs(b.after) + Math.abs(b.before)),
  );
  return out.length > 0 ? out : [{ after: 0, before: 0 }];
}

/**
 * Quanto a linha gira ao todo, somando as viradas, em graus.
 *
 * Serve de medida de ECONOMIA e vale para as duas formas de volta, o que
 * é o ponto: uma curva mansa gira 60 graus, uma laçada gira 330, e uma
 * curva para trás legítima gira 270 — mas só ganha quando nada menor
 * passa nas exigências. É assim que a laçada some sem que a curva para
 * trás seja proibida junto.
 */
export function turnOfPoints(pontos: Vec2[]): number {
  let total = 0;
  for (let i = 2; i < pontos.length; i += 1) {
    const a = sub(pontos[i - 1]!, pontos[i - 2]!);
    const b = sub(pontos[i]!, pontos[i - 1]!);
    const escala = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (escala === 0) continue;
    const cruzado = (a.x * b.y - a.y * b.x) / escala;
    const alinhado = (a.x * b.x + a.y * b.y) / escala;
    total += Math.abs(Math.atan2(cruzado, alinhado)) / DEG;
  }
  return total;
}

const MIN_STRAIGHT_M = 3;

/** Desliza a pose ao longo da própria direção. Sinal já vem do chamador. */
const slide = (pose: Pose, metros: number): Pose => ({
  pos: add(pose.pos, scale(fromAngle(pose.heading), metros)),
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
 * obstáculo. Depois separa quem dá para galopar de quem não dá — entre as
 * ingalopáveis vale o menor aperto, e nada mais.
 *
 * Entre as galopáveis vence o menor CUSTO, que soma o giro total da volta
 * com uma taxa por troca de mão. É a medida de economia, e é ela que
 * separa a laçada da curva para trás: as duas giram muito, mas a laçada
 * aparece onde havia opção mansa, e a curva para trás só aparece quando
 * não havia nenhuma. Comparar giro resolve as duas de uma vez, sem
 * precisar proibir volta grande — proibir era o que quebrava o traçado
 * entre saltos colados, onde a volta grande é a única saída.
 *
 * A taxa da inflexão vale 90 graus de curva: cavaleiro que vai virar à
 * direita não começa torcendo à esquerda, e o desvio custa caro no olho
 * de quem monta mesmo quando o raio está bom.
 *
 * A reta mexida entra por último. Só se cede ou se alonga reta quando
 * isso compra alguma coisa.
 *
 * O custo é comparado em degraus de 5 graus, e não no valor cru. Sem
 * isso, meio grau de diferença decidia antes da amplitude e TODA volta
 * caía no raio de aperto: uma curva de raio 6 gira um tiquinho menos que
 * a mesma curva de raio 11, e ganhava por isso. Empate em degrau devolve
 * a decisão a quem deve tê-la — a curva mais ampla.
 */
const TAXA_INFLEXAO = 90;
const DEGRAU_CUSTO = 5;

function compara(a: CurveSolution, b: CurveSolution, params: RideParams): number {
  const duros = (c: CurveSolution) => c.warnings.filter((w) => w !== 'curva-fechada').length;
  if (duros(a) !== duros(b)) return duros(a) - duros(b);

  const ga = galopavel(a, params);
  const gb = galopavel(b, params);
  if (ga !== gb) return ga ? -1 : 1;

  const mexeu = (c: CurveSolution) => Math.abs(c.lead.after) + Math.abs(c.lead.before);
  if (!ga) return b.minRadiusM - a.minRadiusM || mexeu(a) - mexeu(b);

  const custo = (c: CurveSolution) =>
    Math.round((c.turnDeg + c.inflections * TAXA_INFLEXAO) / DEGRAU_CUSTO);
  return custo(a) - custo(b) || b.minRadiusM - a.minRadiusM || mexeu(a) - mexeu(b);
}

/** A curva em nós do traçado: dois nós, alças na direção dos saltos. */
export function curveNodes(c: Cubic): PathNode[] {
  return [
    { pos: c.p0, type: 'smooth', handleIn: null, handleOut: sub(c.p1, c.p0), anchor: null },
    { pos: c.p3, type: 'smooth', handleIn: sub(c.p2, c.p3), handleOut: null, anchor: null },
  ];
}
