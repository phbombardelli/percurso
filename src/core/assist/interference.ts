import { angleOf, distance, sub, type Vec2 } from '@core/geometry/vec';
import { obstacleFootprint, insidePolygon, jumpHeading } from './ridePath';
import { arenaPoints } from '@core/model/arena';
import { flattenPath } from '@core/model/path';
import { obstacleLabel } from '@core/library/obstacles';
import type { Arena, CourseDocument, CoursePath, ObjectId, Obstacle } from '@core/model/types';

/**
 * Detecção de interferência.
 *
 * A pergunta que dá trabalho aqui não é "o traçado cruza o obstáculo?" —
 * ele DEVE cruzar cada obstáculo que salta. A pergunta é: este cruzamento
 * é um salto ou um estorvo?
 *
 * A resposta é geométrica, e é a mesma que o olho de quem monta usa:
 * salto é cruzamento pela FRENTE, perto do meio da vara e mais ou menos
 * perpendicular a ela. Passar raspando o paraflanco, ou atravessar a vara
 * de lado, não é salto — é o cavalo batendo no obstáculo.
 *
 * Nada aqui valida regra esportiva, que o §44 proíbe. É medição de
 * geometria: um corpo no caminho de uma linha. E nada aqui impede nada —
 * o desenhador vê o aviso e decide.
 */

export type InterferenceKind =
  | 'obstaculos-sobrepostos'
  | 'tracado-cruza-obstaculo'
  | 'obstaculo-fora-da-pista';

export interface Interference {
  kind: InterferenceKind;
  /** Objetos envolvidos: o obstáculo, e o outro objeto quando houver. */
  ids: ObjectId[];
  /** Onde mostrar o aviso, em metros. */
  at: Vec2;
  /** Texto pronto para a lista da interface. */
  message: string;
}

/**
 * Como o aviso chama o obstáculo — sem artigo, para cada frase pôr o seu.
 *
 * Sem número, `obstacleLabel` devolve string vazia e a frase sairia manca
 * ("  e 3 se sobrepõem"). E obstáculo sem número é justamente o que se
 * acabou de largar na pista, o caso mais provável de estar no lugar
 * errado.
 */
const nomeDe = (o: Obstacle): string => {
  const rotulo = obstacleLabel(o);
  return rotulo === '' ? 'obstáculo sem número' : `obstáculo ${rotulo}`;
};

/** Tolerância do que ainda conta como salto perpendicular, em graus. */
const TOLERANCIA_ANGULO = 40;

/** Fração da vara, a partir do centro, que conta como "pelo meio". */
const FRACAO_CENTRAL = 0.55;

const meioAngulo = (a: number, b: number): number => {
  const d = Math.abs(((((a - b) % 360) + 540) % 360) - 180);
  return 180 - d;
};

/**
 * Um cruzamento é salto quando acontece perto do meio da vara e em ângulo
 * próximo do perpendicular. Fora disso, é estorvo.
 *
 * O sentido não importa: saltar de trás para a frente continua sendo
 * saltar, e quem decide o sentido é a seta do croqui, não esta conta.
 */
export function crossingIsJump(obstacle: Obstacle, at: Vec2, heading: number): boolean {
  const alvo = jumpHeading(obstacle);
  const desvio = Math.min(meioAngulo(heading, alvo), meioAngulo(heading, alvo + 180));
  if (desvio > TOLERANCIA_ANGULO) return false;

  // Distância do ponto ao centro, medida ao longo da vara.
  const aoLongo = Math.abs(
    distance(at, obstacle.pos) *
      Math.cos(((angleOf(sub(at, obstacle.pos)) - obstacle.rotation) * Math.PI) / 180),
  );
  return aoLongo <= (obstacle.faceWidthM / 2) * FRACAO_CENTRAL;
}

/** Interseção de dois segmentos; `null` quando não se cruzam. */
function segmentIntersection(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 | null {
  const r = sub(b, a);
  const s = sub(d, c);
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denom;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a.x + r.x * t, y: a.y + r.y * t };
}

/** Os dois polígonos se tocam? Aresta cruzada, ou um dentro do outro. */
export function polygonsOverlap(a: Vec2[], b: Vec2[]): boolean {
  for (let i = 0; i < a.length; i += 1) {
    const a1 = a[i]!;
    const a2 = a[(i + 1) % a.length]!;
    for (let j = 0; j < b.length; j += 1) {
      if (segmentIntersection(a1, a2, b[j]!, b[(j + 1) % b.length]!)) return true;
    }
  }
  return a.some((p) => insidePolygon(p, b)) || b.some((p) => insidePolygon(p, a));
}

/**
 * Pontos em que a linha atravessa o corpo do obstáculo SEM ser um salto.
 *
 * Cada travessia entra pela borda e sai pela borda; basta olhar os pontos
 * de entrada, com a direção que a linha trazia ali.
 */
function estorvosNoCorpo(pontos: Vec2[], obstacle: Obstacle): Vec2[] {
  const corpo = obstacleFootprint(obstacle);
  const achados: Vec2[] = [];

  for (let i = 1; i < pontos.length; i += 1) {
    const de = pontos[i - 1]!;
    const para = pontos[i]!;
    for (let j = 0; j < corpo.length; j += 1) {
      const cruz = segmentIntersection(de, para, corpo[j]!, corpo[(j + 1) % corpo.length]!);
      if (!cruz) continue;
      if (!crossingIsJump(obstacle, cruz, angleOf(sub(para, de)))) achados.push(cruz);
    }
  }
  return achados;
}

export function findInterferences(doc: CourseDocument): Interference[] {
  const obstacles = doc.objects.filter(
    (o): o is Obstacle => o.kind === 'obstacle' && o.visible,
  );
  const paths = doc.objects.filter((o): o is CoursePath => o.kind === 'path' && o.visible);
  const arena = doc.objects.find((o): o is Arena => o.kind === 'arena');
  const out: Interference[] = [];

  // Obstáculo montado por cima de outro: erro de montagem, não de traçado.
  for (let i = 0; i < obstacles.length; i += 1) {
    for (let j = i + 1; j < obstacles.length; j += 1) {
      const a = obstacles[i]!;
      const b = obstacles[j]!;
      // Elementos de uma mesma combinação ficam perto de propósito.
      if (a.number !== '' && a.number === b.number) continue;
      if (!polygonsOverlap(obstacleFootprint(a), obstacleFootprint(b))) continue;
      out.push({
        kind: 'obstaculos-sobrepostos',
        ids: [a.id, b.id],
        at: { x: (a.pos.x + b.pos.x) / 2, y: (a.pos.y + b.pos.y) / 2 },
        message: `O ${nomeDe(a)} e o ${nomeDe(b)} se sobrepõem no chão`,
      });
    }
  }

  // Obstáculo fora do contorno da pista.
  if (arena) {
    const contorno = arenaPoints(arena);
    for (const o of obstacles) {
      const corpo = obstacleFootprint(o);
      if (corpo.every((p) => insidePolygon(p, contorno))) continue;
      out.push({
        kind: 'obstaculo-fora-da-pista',
        ids: [o.id],
        at: o.pos,
        message: `O ${nomeDe(o)} está fora da pista, ou pisando no alambrado`,
      });
    }
  }

  // Traçado que atravessa um obstáculo sem saltá-lo.
  for (const path of paths) {
    const pontos = flattenPath(path, 0.05);
    for (const o of obstacles) {
      const estorvos = estorvosNoCorpo(pontos, o);
      if (estorvos.length === 0) continue;
      out.push({
        kind: 'tracado-cruza-obstaculo',
        ids: [o.id, path.id],
        at: estorvos[0]!,
        message: `O traçado passa pelo ${nomeDe(o)} sem saltá-lo`,
      });
    }
  }

  return out;
}
