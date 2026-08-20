import { pageSize, usableArea, type PageSetup } from '@core/scale/units';

/**
 * Legenda de escala impressa na folha.
 *
 * Duas informações, e cada uma resolve um problema diferente:
 *
 * - O "1:250" escrito diz o que o milímetro do papel vale no terreno.
 * - A BARRA gráfica continua correta mesmo se a folha for fotocopiada com
 *   redução, quando o número escrito passa a mentir. É por isso que os
 *   croquis oficiais trazem as duas, e não só o texto.
 */
export function ScaleLegend({ page }: { page: PageSetup }) {
  const { scaleLabel: cfg } = page;
  if (!cfg.visible) return null;

  const barra = barraDaEscala(page.printScale);
  const larguraBarraMm = (barra.metros * 1000) / page.printScale;
  const texto = 3;
  const alturaMm = cfg.bar ? texto + 5.5 : texto + 1;
  const larguraMm = Math.max(larguraBarraMm, 22);

  const pos = cantoMm(page, larguraMm, alturaMm);

  return (
    <g data-part="scale-legend" pointerEvents="none">
      <text
        x={pos.x}
        y={pos.y + texto}
        fontSize={texto}
        fontFamily="Helvetica, Arial, sans-serif"
        fill="#23282d"
      >
        Escala 1:{page.printScale}
      </text>

      {cfg.bar && (
        <g transform={`translate(${round(pos.x)} ${round(pos.y + texto + 1.8)})`}>
          {/* Duas metades em preto e branco: é como se lê uma barra de
              escala de relance, sem contar tracinhos. */}
          <rect width={round(larguraBarraMm / 2)} height={1.6} fill="#23282d" />
          <rect
            x={round(larguraBarraMm / 2)}
            width={round(larguraBarraMm / 2)}
            height={1.6}
            fill="#ffffff"
            stroke="#23282d"
            strokeWidth={0.2}
          />
          <text x={0} y={5} fontSize={2.2} fontFamily="Helvetica, Arial, sans-serif" fill="#6c757d">
            0
          </text>
          <text
            x={round(larguraBarraMm)}
            y={5}
            fontSize={2.2}
            fontFamily="Helvetica, Arial, sans-serif"
            fill="#6c757d"
            textAnchor="end"
          >
            {barra.metros} m
          </text>
        </g>
      )}
    </g>
  );
}

/**
 * Comprimento redondo para a barra: 10, 20, 25 ou 50 m, o que der uma
 * barra entre 2 e 6 cm no papel. Barra em número quebrado não se lê.
 */
function barraDaEscala(printScale: number): { metros: number } {
  for (const metros of [10, 20, 25, 50, 100]) {
    const mm = (metros * 1000) / printScale;
    if (mm >= 20 && mm <= 60) return { metros };
  }
  return { metros: printScale >= 500 ? 100 : 20 };
}

function cantoMm(page: PageSetup, larguraMm: number, alturaMm: number) {
  const area = usableArea(page);
  const folha = pageSize(page);
  const direita = Math.min(area.xMm + area.widthMm, folha.widthMm) - larguraMm;
  const baixo = Math.min(area.yMm + area.heightMm, folha.heightMm) - alturaMm;

  switch (page.scaleLabel.corner) {
    case 'superior-esquerdo':
      return { x: area.xMm, y: area.yMm };
    case 'superior-direito':
      return { x: direita, y: area.yMm };
    case 'inferior-esquerdo':
      return { x: area.xMm, y: baixo };
    default:
      return { x: direita, y: baixo };
  }
}

const round = (v: number): number => Math.round(v * 1000) / 1000;
