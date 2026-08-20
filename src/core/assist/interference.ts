import { angleOf, fromAngle, sub, type Vec2 } from '@core/geometry/vec';
import { obstacleFootprint, insidePolygon, jumpHeading } from './ridePath';
import { arenaPoints } from '@core/model/arena';
import { flattenPath } from '@core/model/path';
import { obstacleLabel } from '@core/library/obstacles';
import type { Arena, CourseDocument, CoursePath, ObjectId, Obstacle } from '@core/model/types';

/**
 * Detecção de interferência.
 *
 * A pergunta que dá trabalho aqui não é "o traçado cruza o obstáculo?" —
 * ele DEVE cruzar cada obstáculo que salta. A pergunta é se aquele
 * cruzamento está certo.
 *
 * E a regra do ofício é dura: o croqui é o TRAÇADO IDEAL, não o traçado
 * mais rápido. A linha passa pelo CENTRO do obstáculo, a 90 graus,
 * sempre. Não há tolerância de cavaleiro aqui, porque o desenho não
 * registra o que um cavalo fez — declara o que ele deve fazer.
 *
 * A primeira versão disto errou justamente nesse ponto: aceitava até 40
 * graus de desvio e passagem a meia vara do centro, tratando o croqui
 * como se fosse a fotografia de uma prova. Não é.
 *
 * As folgas que sobraram são de MEDIÇÃO, não de licença: existem para
 * arredondamento de curva não virar aviso, e são pequenas o bastante para
 * que qualquer desvio visível apareça.
 *
 * Nada aqui valida regra esportiva, que o §44 proíbe. É medição de
 * geometria, e nada é impedido — o desenhador vê o aviso e decide.
 */

export type InterferenceKind =
  | 'obstaculos-sobrepostos'
  | 'tracado-cruza-obstaculo'
  | 'salto-fora-do-centro'
  | 'salto-fora-do-esquadro'
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

/**
 * Folga de medição do esquadro, em graus. Não é licença para cruzar
 * torto: é para arredondamento de curva não acusar o que ninguém vê.
 */
const FOLGA_ESQUADRO = 2;

/** Folga de medição do centro, em metros. Meio palmo de vara. */
const FOLGA_CENTRO = 0.15;

/**
 * A partir de quantos graus o cruzamento deixa de ser tentativa de salto.
 *
 * Passado o meio caminho, a linha corre mais ao longo da vara do que
 * através dela: não é salto torto, é atravessar o obstáculo no
 * comprimento. O caso extremo — linha deitada exatamente sobre a vara —
 * mede 90 graus de desvio e precisa ser chamado pelo nome certo.
 */
const LIMITE_SALTO = 45;

const meioAngulo = (a: number, b: number): number => {
  const d = Math.abs(((((a - b) % 360) + 540) % 360) - 180);
  return 180 - d;
};

/** Como a linha cruzou a face do obstáculo. */
export interface JumpCrossing {
  at: Vec2;
  /** Distância do centro, medida ao longo da vara, em metros. */
  offCentreM: number;
  /** Desvio do perpendicular, em graus, sempre positivo. */
  offSquareDeg: number;
}

/**
 * Onde a linha cruza o eixo da face, mais perto do centro.
 *
 * Procura-se o cruzamento do EIXO da vara — a reta que passa pelo centro
 * na direção da face —, e não do corpo desenhado: é o eixo que define
 * onde o salto acontece, e é sobre ele que centro e esquadro se medem.
 *
 * Devolve `null` quando a linha não cruza o eixo dentro da extensão da
 * vara: aí ela não está saltando este obstáculo, está passando ao largo.
 */
export function jumpCrossing(pontos: Vec2[], obstacle: Obstacle): JumpCrossing | null {
  const aoLongo = fromAngle(obstacle.rotation);
  const normal = fromAngle(jumpHeading(obstacle));
  const alcance = obstacle.faceWidthM / 2 + obstacle.wings.widthM;
  let melhor: JumpCrossing | null = null;

  for (let i = 1; i < pontos.length; i += 1) {
    const a = pontos[i - 1]!;
    const b = pontos[i]!;
    const da = (a.x - obstacle.pos.x) * normal.x + (a.y - obstacle.pos.y) * normal.y;
    const db = (b.x - obstacle.pos.x) * normal.x + (b.y - obstacle.pos.y) * normal.y;
    if (da === db || da > 0 === db > 0) continue;

    const t = da / (da - db);
    const at = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const offCentreM =
      (at.x - obstacle.pos.x) * aoLongo.x + (at.y - obstacle.pos.y) * aoLongo.y;
    if (Math.abs(offCentreM) > alcance) continue;

    const bruto = meioAngulo(angleOf(sub(b, a)), jumpHeading(obstacle));
    const offSquareDeg = Math.min(bruto, 180 - bruto);
    if (!melhor || Math.abs(offCentreM) < Math.abs(melhor.offCentreM)) {
      melhor = { at, offCentreM, offSquareDeg };
    }
  }
  return melhor;
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

/** Primeiro ponto em que a linha entra no corpo desenhado do obstáculo. */
function entraNoCorpo(pontos: Vec2[], obstacle: Obstacle): Vec2 | null {
  const corpo = obstacleFootprint(obstacle);
  for (let i = 1; i < pontos.length; i += 1) {
    for (let j = 0; j < corpo.length; j += 1) {
      const cruz = segmentIntersection(
        pontos[i - 1]!,
        pontos[i]!,
        corpo[j]!,
        corpo[(j + 1) % corpo.length]!,
      );
      if (cruz) return cruz;
    }
  }
  return null;
}

const doisDecimais = (v: number) => v.toFixed(2).replace('.', ',');

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
      if (obstacleFootprint(o).every((p) => insidePolygon(p, contorno))) continue;
      out.push({
        kind: 'obstaculo-fora-da-pista',
        ids: [o.id],
        at: o.pos,
        message: `O ${nomeDe(o)} está fora da pista, ou pisando no alambrado`,
      });
    }
  }

  // O traçado contra cada obstáculo: ou salta ideal, ou está errado.
  for (const path of paths) {
    const pontos = flattenPath(path, 0.05);
    for (const o of obstacles) {
      const medida = jumpCrossing(pontos, o);
      const cruz = medida && medida.offSquareDeg <= LIMITE_SALTO ? medida : null;

      if (!cruz) {
        // Não cruza o eixo da vara. Se ainda assim entra no corpo, está
        // passando por cima do obstáculo sem saltá-lo.
        const entrada = entraNoCorpo(pontos, o);
        if (entrada) {
          out.push({
            kind: 'tracado-cruza-obstaculo',
            ids: [o.id, path.id],
            at: entrada,
            message: `O traçado passa pelo ${nomeDe(o)} sem saltá-lo`,
          });
        }
        continue;
      }

      if (cruz.offSquareDeg > FOLGA_ESQUADRO) {
        out.push({
          kind: 'salto-fora-do-esquadro',
          ids: [o.id, path.id],
          at: cruz.at,
          message: `O traçado cruza o ${nomeDe(o)} a ${cruz.offSquareDeg.toFixed(0)} graus do perpendicular`,
        });
      }
      if (Math.abs(cruz.offCentreM) > FOLGA_CENTRO) {
        out.push({
          kind: 'salto-fora-do-centro',
          ids: [o.id, path.id],
          at: cruz.at,
          message: `O traçado cruza o ${nomeDe(o)} a ${doisDecimais(Math.abs(cruz.offCentreM))} m do centro`,
        });
      }
    }
  }

  return out;
}
