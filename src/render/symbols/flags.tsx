import { color, stroke } from '@render/style/tokens';

/** Tamanho da bandeirola em milímetros de PAPEL: legível em qualquer escala. */
const FLAG_W = 1.7;
const FLAG_H = 1.15;
const POLE_R = 0.32;
const GAP = 0.9;

/** Quanto a bandeirola ocupa para fora do paraflanco, em mm de papel. */
export const FLAG_SPAN_MM = GAP + FLAG_W + 2;

const RED = '#d32020';
const WHITE = '#ffffff';

/**
 * Bandeirolas de um obstáculo ou de uma cruzada de tempo: VERMELHA À
 * DIREITA e BRANCA À ESQUERDA de quem salta (decisão 54).
 *
 * Desenhada no sistema local do objeto: a frente no X e o salto para −Y
 * (ou +Y com a seta invertida). Olhando para −Y, a direita é +X; com o
 * salto invertido, a direita passa a ser −X — é o que `reversed` troca.
 *
 * `halfMm` é a meia largura até a ponta do paraflanco: a bandeirola fica
 * logo depois dele, para fora.
 */
export function SideFlags({ halfMm, reversed }: { halfMm: number; reversed: boolean }) {
  const direita = reversed ? -1 : 1;
  const flag = (lado: 1 | -1, fill: string, key: string) => {
    const poste = lado * (halfMm + GAP);
    // O pano sai do poste para fora, no sentido de quem salta.
    const x = lado > 0 ? poste : poste - FLAG_W;
    const yPano = reversed ? 0 : -FLAG_H;
    return (
      <g key={key} data-part={`flag-${fill === RED ? 'vermelha' : 'branca'}`}>
        <rect
          x={x}
          y={yPano}
          width={FLAG_W}
          height={FLAG_H}
          fill={fill}
          stroke={color.ink}
          strokeWidth={stroke.hairline}
        />
        <circle cx={poste} cy={0} r={POLE_R} fill={color.ink} />
      </g>
    );
  };
  return (
    <g data-part="flags">
      {flag(direita as 1 | -1, RED, 'd')}
      {flag(-direita as 1 | -1, WHITE, 'e')}
    </g>
  );
}
