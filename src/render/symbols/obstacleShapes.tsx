import { arrowGeometry } from '@core/library/obstacles';
import type { Obstacle } from '@core/model/types';
import { color, stroke } from '@render/style/tokens';

/**
 * Símbolos de obstáculo em vista superior.
 *
 * Desenhados em MILÍMETROS DE PAPEL, recebendo `k` (mm por metro) para
 * converter a geometria real. Não se usa `scale()` aqui: a escala do grupo
 * engordaria também a espessura do traço, que é anotação e precisa ficar
 * constante em qualquer escala de impressão (DECISOES, decisões 1 e 3).
 *
 * Sistema local: X ao longo da frente, Y na profundidade, salto para −Y.
 * Sem <symbol>/<use> — o conversor de PDF perde o conteúdo deles.
 */

const BAR_MM = 0.9;
const STANDARD_M = 0.35;

interface Props {
  obstacle: Obstacle;
  /** Milímetros de papel por metro. */
  k: number;
}

export function ObstacleShape({ obstacle, k }: Props) {
  const halfW = (obstacle.faceWidthM / 2) * k;
  const spread = (obstacle.spreadM ?? 0) * k;

  switch (obstacle.type) {
    case 'vertical':
    case 'plano':
      return <Bar halfW={halfW} y={0} k={k} thin={obstacle.type === 'plano'} />;

    case 'oxer':
      return (
        <>
          <Bar halfW={halfW} y={spread / 2} k={k} />
          <Bar halfW={halfW} y={-spread / 2} k={k} />
        </>
      );

    case 'triplice':
      return (
        <>
          <Bar halfW={halfW} y={spread / 2} k={k} />
          <Bar halfW={halfW} y={0} k={k} />
          <Bar halfW={halfW} y={-spread / 2} k={k} />
        </>
      );

    case 'muro':
      return (
        <rect
          x={-halfW}
          y={-spread / 2}
          width={halfW * 2}
          height={spread}
          fill={color.ink}
          stroke={color.ink}
          strokeWidth={stroke.thin}
        />
      );

    case 'rio':
      return (
        <rect
          x={-halfW}
          y={-spread / 2}
          width={halfW * 2}
          height={spread}
          fill={color.water}
          stroke={color.ink}
          strokeWidth={stroke.thin}
        />
      );

    case 'liverpool':
      return (
        <>
          <rect
            x={-halfW}
            y={-spread / 2}
            width={halfW * 2}
            height={spread}
            fill={color.water}
            stroke={color.ink}
            strokeWidth={stroke.hairline}
          />
          <Bar halfW={halfW} y={spread / 2} k={k} />
          {obstacle.elements.length > 1 && <Bar halfW={halfW} y={-spread / 2} k={k} />}
        </>
      );
  }
}

/** Barra com os dois pilares nas pontas. */
function Bar({
  halfW,
  y,
  k,
  thin = false,
}: {
  halfW: number;
  y: number;
  k: number;
  thin?: boolean;
}) {
  const standard = (STANDARD_M / 2) * k;
  return (
    <g>
      <line
        x1={-halfW}
        y1={y}
        x2={halfW}
        y2={y}
        stroke={color.ink}
        strokeWidth={thin ? BAR_MM / 2 : BAR_MM}
        strokeLinecap="butt"
      />
      <line x1={-halfW} y1={y - standard} x2={-halfW} y2={y + standard} stroke={color.ink} strokeWidth={stroke.regular} />
      <line x1={halfW} y1={y - standard} x2={halfW} y2={y + standard} stroke={color.ink} strokeWidth={stroke.regular} />
    </g>
  );
}

/**
 * Seta de direção do salto: perpendicular à frente e centrada, por
 * construção. Vive dentro do grupo rotacionado, então acompanha o
 * obstáculo sem o usuário precisar desenhar nada (§16).
 */
export function JumpArrow({ obstacle, k }: Props) {
  const { shaft, head } = arrowGeometry(obstacle, k);
  return (
    <g data-part="arrow">
      <line {...shaft} stroke={color.ink} strokeWidth={stroke.medium} />
      <path
        d={`M ${head[0].x} ${head[0].y} L ${head[1].x} ${head[1].y} L ${head[2].x} ${head[2].y} Z`}
        fill={color.ink}
      />
    </g>
  );
}
