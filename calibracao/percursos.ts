import { produce } from 'immer';
import { addObject } from '@core/commands/ops';
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

export const PERCURSOS = [WORLD_CHALLENGE_2020];

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

    const saltos = d.objects.filter((o) => o.kind === 'obstacle');
    const primeiro = saltos[0];
    const ultimo = saltos[saltos.length - 1];
    if (primeiro?.kind === 'obstacle') addObject(d, placeTimingLine('start', primeiro, p.cruzadaM));
    if (ultimo?.kind === 'obstacle') addObject(d, placeTimingLine('finish', ultimo, p.cruzadaM));
  });
}
