import { produce } from 'immer';
import { addObject } from '@core/commands/ops';
import { alignCombination, currentGaps, orderAlongLine } from '@core/commands/alignOps';
import { createObstacle } from '@core/library/obstacles';
import { placeTimingLine } from '@core/library/timing';
import { createDocument } from '@core/model/document';
import { createRectangleArena } from '@core/model/arena';
import type { CourseDocument, ObstacleType } from '@core/model/types';

/**
 * Percursos reais transcritos de croquis oficiais, para calibrar o
 * assistente de traçado.
 *
 * A verdade conhecida é a DISTÂNCIA TOTAL impressa na folha: ela foi
 * medida sobre a linha que o traçador desenhou, e é o único número contra
 * o qual dá para conferir o modelo em vez de opinar sobre ele.
 *
 * O risco desta abordagem é medir o meu erro de leitura em vez do modelo:
 * as posições saem de olhar a imagem. Por isso cada percurso traz também
 * as distâncias IMPRESSAS entre obstáculos, quando o croqui as tem. Se a
 * transcrição reproduz esses números, ela está boa; se não reproduz, o
 * problema é a leitura, e calibrar em cima dela seria calibrar no ruído.
 */

export interface SaltoTranscrito {
  numero: string;
  letra?: 'A' | 'B' | 'C';
  tipo: ObstacleType;
  x: number;
  y: number;
  /** Graus horários da FACE. O salto sai perpendicular a ela. */
  rotacao: number;
  /** Seta invertida: o salto vai para o lado oposto ao padrão. */
  invertido?: boolean;
}

/** Distância impressa no croqui, para conferir a transcrição. */
export interface DistanciaImpressa {
  de: string;
  para: string;
  metros: number;
}

export interface PercursoTranscrito {
  nome: string;
  fonte: string;
  pista: { largura: number; altura: number };
  /** Distância total impressa na folha, em metros. */
  distanciaOficial: number;
  /** Distância da partida ao 1 e do último à chegada, quando declarada. */
  cruzadaM: number;
  saltos: SaltoTranscrito[];
  impressas: DistanciaImpressa[];
}

/**
 * FEI Jumping World Challenge 2020, Competição 3, Volta 1.
 *
 * Escolhido primeiro porque é o croqui com a grade mais limpa: pista de
 * 65 x 45 m com linhas a cada 5 m nos quatro lados, e cinco distâncias
 * impressas para conferir a leitura.
 */
/**
 * As posições saem de olhar a imagem, MENOS as que o croqui declara: 5B,
 * 8B e 9 foram deduzidas das distâncias impressas, a partir do elemento
 * anterior e da direção do salto. Onde o croqui dá o número, o número
 * manda — a leitura de pixel só entra onde não há alternativa.
 */
export const WORLD_CHALLENGE_2020: PercursoTranscrito = {
  nome: 'FEI Jumping World Challenge 2020 - Comp. 3, Volta 1',
  fonte: 'Croqui oficial, Christoph Johnen (GER)',
  pista: { largura: 65, altura: 45 },
  distanciaOficial: 420,
  cruzadaM: 12,
  saltos: [
    { numero: '1', tipo: 'vertical', x: 48.5, y: 32.5, rotacao: 90 },
    { numero: '2', tipo: 'triplice', x: 46.5, y: 9, rotacao: 90, invertido: true },
    { numero: '3', tipo: 'oxer', x: 22.5, y: 25.5, rotacao: 115 },
    { numero: '4', tipo: 'vertical', x: 20.5, y: 12.5, rotacao: 90 },
    { numero: '5', letra: 'A', tipo: 'vertical', x: 46.5, y: 16, rotacao: 115 },
    { numero: '5', letra: 'B', tipo: 'vertical', x: 56.65, y: 20.73, rotacao: 115 },
    { numero: '6', tipo: 'oxer', x: 31, y: 24, rotacao: 90, invertido: true },
    { numero: '7', tipo: 'vertical', x: 18.5, y: 5.5, rotacao: 90, invertido: true },
    { numero: '8', letra: 'A', tipo: 'vertical', x: 21, y: 39.5, rotacao: 90 },
    { numero: '8', letra: 'B', tipo: 'vertical', x: 28.9, y: 39.5, rotacao: 90 },
    { numero: '9', tipo: 'vertical', x: 47.6, y: 39.5, rotacao: 90 },
    { numero: '10', tipo: 'vertical', x: 46, y: 24.5, rotacao: 115 },
    { numero: '11', tipo: 'oxer', x: 11, y: 21, rotacao: 105, invertido: true },
  ],
  impressas: [
    { de: '5A', para: '5B', metros: 11.2 },
    { de: '8A', para: '8B', metros: 7.9 },
    { de: '8B', para: '9', metros: 18.7 },
  ],
};

/**
 * Jogos Equestres Mundiais FEI 2014, Normandia — CCE, prova de salto.
 *
 * Segundo gabarito, escolhido pela régua: o croqui traz metros de 0 a 105
 * na horizontal e de 0 a 65 na vertical, o que ancora a leitura melhor
 * que a grade do primeiro. Distância oficial 580 m, 1,30 m, 375 m/min,
 * 12 obstáculos e 15 esforços (8abc triplo e 11ab duplo).
 *
 * Limites da leitura: a imagem tem 630 px de largura, uns 3,9 px por
 * metro. As posições têm cerca de 0,5 m de incerteza e as inclinações uns
 * 5 graus. O croqui não imprime distâncias; as duas conferências
 * possíveis são as combinações: 8a-8b sai com uns 11 m (dois galopes) e
 * 8b-8c com uns 8 m (um), o que é coerente com 1,30 m.
 *
 * O sentido de cada salto saiu do fluxo das linhas tracejadas, e é o
 * dado mais sensível: no World Challenge, três sentidos trocados bastavam
 * para levar o total de 432 m a 645 m.
 */
export const NORMANDIA_2014: PercursoTranscrito = {
  nome: 'FEI WEG 2014 Normandia - CCE, prova de salto',
  fonte: 'Croqui oficial, Frédéric Cottier',
  pista: { largura: 105, altura: 65 },
  distanciaOficial: 580,
  cruzadaM: 8,
  saltos: [
    { numero: '1', tipo: 'vertical', x: 19.2, y: 22.0, rotacao: 60 },
    { numero: '2', tipo: 'oxer', x: 58.4, y: 24.9, rotacao: 114 },
    { numero: '3', tipo: 'vertical', x: 80.3, y: 40.3, rotacao: 120 },
    { numero: '4', tipo: 'vertical', x: 64.5, y: 5.9, rotacao: 270 },
    { numero: '5', tipo: 'oxer', x: 35.4, y: 6.0, rotacao: 270 },
    { numero: '6', tipo: 'oxer', x: 38.3, y: 26.5, rotacao: 51 },
    { numero: '7', tipo: 'vertical', x: 74.0, y: 15.9, rotacao: 90 },
    { numero: '8', letra: 'A', tipo: 'vertical', x: 81.8, y: 56.4, rotacao: 260 },
    { numero: '8', letra: 'B', tipo: 'vertical', x: 70.6, y: 57.8, rotacao: 260 },
    { numero: '8', letra: 'C', tipo: 'oxer', x: 62.2, y: 59.7, rotacao: 260 },
    { numero: '9', tipo: 'vertical', x: 29.5, y: 40.0, rotacao: 0 },
    { numero: '10', tipo: 'oxer', x: 11.2, y: 43.2, rotacao: 159 },
    { numero: '11', letra: 'A', tipo: 'oxer', x: 44.3, y: 46.7, rotacao: 62 },
    { numero: '11', letra: 'B', tipo: 'oxer', x: 51.8, y: 42.6, rotacao: 62 },
    { numero: '12', tipo: 'vertical', x: 79.7, y: 25.3, rotacao: 56 },
  ],
  impressas: [],
};

export const PERCURSOS = [WORLD_CHALLENGE_2020, NORMANDIA_2014];

/** Monta o documento do percurso transcrito, pronto para o assistente. */
export function montaPercurso(p: PercursoTranscrito): CourseDocument {
  return produce(createDocument(), (d) => {
    d.objects.length = 0;
    addObject(d, createRectangleArena({ x: 0, y: 0 }, p.pista.largura, p.pista.altura));

    for (const s of p.saltos) {
      const o = createObstacle(s.tipo, { x: s.x, y: s.y }, s.numero);
      o.letter = s.letra ?? '';
      o.rotation = s.rotacao;
      o.arrow.reversed = s.invertido ?? false;
      addObject(d, o);
    }

    // Composto se monta com a ferramenta, como no editor: "Endireitar" põe
    // os elementos no eixo e na inclinação do primeiro, sem mudar os vãos.
    // Transcrito a olho, o composto saía torto e a linha zigue-zagueava
    // dentro dele.
    const obst = d.objects.filter((o) => o.kind === 'obstacle');
    const compostos = new Map<string, typeof obst>();
    for (const o of obst) {
      if (o.kind !== 'obstacle' || o.letter === '') continue;
      compostos.set(o.number, [...(compostos.get(o.number) ?? []), o]);
    }
    for (const elementos of compostos.values()) {
      if (elementos.length < 2) continue;
      const ordenados = orderAlongLine(elementos.filter((o) => o.kind === 'obstacle'));
      alignCombination(d, ordenados.map((o) => o.id), currentGaps(ordenados));
    }

    const saltos = d.objects.filter((o) => o.kind === 'obstacle');
    const primeiro = saltos[0];
    const ultimo = saltos[saltos.length - 1];
    if (primeiro?.kind === 'obstacle') addObject(d, placeTimingLine('start', primeiro, p.cruzadaM));
    if (ultimo?.kind === 'obstacle') addObject(d, placeTimingLine('finish', ultimo, p.cruzadaM));
  });
}
