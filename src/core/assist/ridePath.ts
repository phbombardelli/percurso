import { dubinsPaths, samplePath, type DubinsPath, type Pose } from '@core/geometry/dubins';
import { DEG, add, fromAngle, rotate, scale, sub, type Vec2 } from '@core/geometry/vec';
import { arenaPoints } from '@core/model/arena';
import { obstacleExtent } from '@core/library/obstacles';
import type { Arena, Obstacle, TimingLine } from '@core/model/types';

/**
 * O traçado do cavaleiro, obstáculo a obstáculo.
 *
 * Aqui mora o que a geometria pura não sabe: onde começa e termina cada
 * volta, e quais das voltas possíveis o cavaleiro descartaria por sair da
 * pista ou passar por cima de outro obstáculo.
 *
 * Os números do `RideParams` são a parte calibrável — a intenção é ajustá-
 * los contra croquis reais de distância total conhecida, não defendê-los
 * na base do achismo. Os padrões atuais são declaradamente provisórios.
 */
export interface RideParams {
  /** Reta perpendicular ANTES do obstáculo, para o cavalo se organizar. */
  approachM: number;
  /** Reta perpendicular DEPOIS, que é o salto e a recepção. */
  getawayM: number;
  /** Raio de curva preferido. Curva boa é a de maior raio. */
  radiusM: number;
  /**
   * Raio mais fechado que o cavaleiro aceita quando o espaço aperta. Sem
   * ele, obstáculo saltado contra o alambrado não teria volta nenhuma —
   * e o cavaleiro, na pista, simplesmente fecha a curva.
   */
  tightRadiusM: number;
  /** Folga até o alambrado: o traçado não encosta na cerca. */
  railMarginM: number;
}

export const DEFAULT_RIDE: RideParams = {
  approachM: 8,
  getawayM: 8,
  radiusM: 11,
  tightRadiusM: 6,
  railMarginM: 2,
};

/**
 * Direção do salto, em graus horários.
 *
 * A face do obstáculo é o X local e o salto atravessa no Y local; a seta
 * padrão aponta para o Y negativo, e `reversed` inverte. Vem daí o mesmo
 * sentido que o desenho já mostra: assistente e seta nunca discordam.
 */
export function jumpHeading(obstacle: Obstacle): number {
  return obstacle.rotation + (obstacle.arrow.reversed ? 90 : -90);
}

export function timingHeading(line: TimingLine): number {
  return line.rotation + (line.arrow.reversed ? 90 : -90);
}

/**
 * Reta mínima. Encostado no alambrado não cabem os 8 m de sempre, e o
 * cavaleiro pousa e já vira — mas alguma reta sempre existe, nem que seja
 * o próprio salto.
 */
const MIN_STRAIGHT_M = 2;

/**
 * Encurta a reta até ela caber dentro da pista.
 *
 * Sem isso, um obstáculo saltado contra o alambrado colocaria o ponto de
 * saída do lado de fora da cerca, e toda volta a partir dele nasceria
 * marcada como inválida. Encurtar é o que o cavaleiro faz de verdade.
 */
function fitStraight(
  origin: Vec2,
  heading: number,
  base: number,
  pedido: number,
  field: Field | null,
  params: RideParams,
): Vec2 {
  const ponto = (extra: number) => add(origin, scale(fromAngle(heading), base + extra));
  if (!field?.outline) return ponto(pedido);

  for (let extra = pedido; extra > MIN_STRAIGHT_M; extra -= 0.25) {
    const p = ponto(extra);
    if (insidePolygon(p, field.outline) && distanceToOutline(p, field.outline) >= params.railMarginM) {
      return p;
    }
  }
  return ponto(MIN_STRAIGHT_M);
}

/** Onde a reta de aproximação começa: antes da face, já apontando para ela. */
export function entryPose(obstacle: Obstacle, params: RideParams, field: Field | null = null): Pose {
  const heading = jumpHeading(obstacle);
  const corpo = obstacleExtent(obstacle).backM;
  return {
    pos: fitStraight(obstacle.pos, heading + 180, corpo, params.approachM, field, params),
    heading,
  };
}

/** Onde a reta de saída termina, depois do salto. */
export function exitPose(obstacle: Obstacle, params: RideParams, field: Field | null = null): Pose {
  const heading = jumpHeading(obstacle);
  const corpo = -obstacleExtent(obstacle).frontM;
  return {
    pos: fitStraight(obstacle.pos, heading, corpo, params.getawayM, field, params),
    heading,
  };
}

/** A partida e a chegada são cruzadas retas, como qualquer obstáculo. */
export function timingPose(
  line: TimingLine,
  params: RideParams,
  lado: 'antes' | 'depois',
  field: Field | null = null,
): Pose {
  const heading = timingHeading(line);
  const pedido = lado === 'antes' ? params.approachM : params.getawayM;
  return {
    pos: fitStraight(line.pos, lado === 'antes' ? heading + 180 : heading, 0, pedido, field, params),
    heading,
  };
}

/** Retângulo do obstáculo no chão, incluindo paraflanco e lâmina d'água. */
export function obstacleFootprint(obstacle: Obstacle): Vec2[] {
  const ext = obstacleExtent(obstacle);
  const meia = obstacle.wings.style === 'paraflanco'
    ? ext.halfWidthM + obstacle.wings.widthM
    : ext.halfWidthM;
  const cantos: Vec2[] = [
    { x: -meia, y: ext.frontM },
    { x: meia, y: ext.frontM },
    { x: meia, y: ext.backM },
    { x: -meia, y: ext.backM },
  ];
  return cantos.map((c) => add(obstacle.pos, rotate(c, obstacle.rotation)));
}

/** Ponto dentro do polígono, pela regra do número de cruzamentos. */
export function insidePolygon(point: Vec2, polygon: Vec2[]): boolean {
  let dentro = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const cruza = a.y > point.y !== b.y > point.y;
    if (cruza && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      dentro = !dentro;
    }
  }
  return dentro;
}

/** Distância de um ponto ao contorno do polígono. */
export function distanceToOutline(point: Vec2, polygon: Vec2[]): number {
  let menor = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    menor = Math.min(menor, distanceToSegment(point, polygon[j]!, polygon[i]!));
  }
  return menor;
}

function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const comprimento = ab.x * ab.x + ab.y * ab.y;
  if (comprimento === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / comprimento));
  return Math.hypot(p.x - (a.x + ab.x * t), p.y - (a.y + ab.y * t));
}

/** O que o assistente precisa saber da pista para julgar uma volta. */
export interface Field {
  /** Contorno da pista, ou `null` quando não há pista definida. */
  outline: Vec2[] | null;
  /** Obstáculos que a volta não pode atravessar. */
  blockers: Obstacle[];
}

export function fieldFrom(arena: Arena | null, obstacles: Obstacle[]): Field {
  return { outline: arena ? arenaPoints(arena) : null, blockers: obstacles };
}

export type RideWarning = 'fora-da-pista' | 'passa-por-obstaculo';

export interface LegSolution {
  path: DubinsPath;
  /** Vazio quando a volta é limpa. Nunca impede a entrega. */
  warnings: RideWarning[];
  /** Raio realmente usado: menor que o preferido quando foi preciso fechar. */
  radiusM: number;
}

/** Passo de amostragem: fino o bastante para não pular um paraflanco. */
const STEP_M = 0.5;

function checkPath(path: DubinsPath, field: Field, params: RideParams): RideWarning[] {
  const pontos = samplePath(path, STEP_M);
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
    return pontos.some((p) => insidePolygon(p, corpo));
  });
  if (atropela) avisos.push('passa-por-obstaculo');

  return avisos;
}

/**
 * Raios a tentar, do preferido ao mais fechado.
 *
 * A ordem é a regra de ouro do traçado: usa-se a curva mais aberta que
 * couber, e só se fecha quando não cabe. Um passo de 15% dá uma dúzia de
 * tentativas entre 11 m e 6 m, o que é barato e fino o bastante.
 */
function radiiToTry(params: RideParams): number[] {
  const raios: number[] = [];
  for (let r = params.radiusM; r > params.tightRadiusM; r *= 0.85) raios.push(r);
  raios.push(params.tightRadiusM);
  return raios;
}

/**
 * Resolve uma volta entre dois saltos.
 *
 * Tenta a curva mais aberta primeiro e vai fechando; a mais curta que
 * passa limpa ganha. Quando nenhuma passa limpa — pista apertada,
 * obstáculo bem no meio —, devolve a menos problemática assim mesmo, COM
 * os avisos: o desenhador precisa ver o problema e decidir, e um traçado
 * ausente esconderia o que um traçado marcado mostra.
 */
export function solveLeg(
  from: Pose,
  to: Pose,
  field: Field,
  params: RideParams = DEFAULT_RIDE,
): LegSolution | null {
  let melhorRuim: LegSolution | null = null;

  for (const raio of radiiToTry(params)) {
    for (const path of dubinsPaths(from, to, raio)) {
      const warnings = checkPath(path, field, params);
      if (warnings.length === 0) return { path, warnings, radiusM: raio };
      if (melhorRuim === null || warnings.length < melhorRuim.warnings.length) {
        melhorRuim = { path, warnings, radiusM: raio };
      }
    }
  }
  return melhorRuim;
}

/** Ângulo entre duas direções, em graus, sempre no intervalo [0, 180]. */
export const headingGap = (a: number, b: number): number => {
  const d = Math.abs(((a - b) % 360 + 540) % 360 - 180);
  return 180 - d;
};

/** Direção de A para B, em graus horários. */
export const headingTo = (a: Vec2, b: Vec2): number =>
  Math.atan2(b.y - a.y, b.x - a.x) / DEG;
