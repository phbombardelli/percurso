import { heightTableLayout } from '@core/model/annotationLayout';
import type { HeightTable, Obstacle } from '@core/model/types';

interface Props {
  table: HeightTable;
  obstacles: Obstacle[];
  onPointerDown?: (e: React.PointerEvent) => void;
}

/**
 * Tabela de alturas.
 *
 * Não tem dados próprios: lê os obstáculos do documento. Mudou a altura
 * de uma vara, a tabela muda junto — não há como o croqui imprimir uma
 * altura que o desenho não tenha, que é o erro clássico de manter as duas
 * coisas separadas.
 */
export function HeightTableLayer({ table, obstacles, onPointerDown }: Props) {
  const l = heightTableLayout(table, obstacles);
  const s = table.style.sizeMm;
  const linha = l.rowHeightMm;

  return (
    <g
      data-object={table.id}
      data-kind="heighttable"
      transform={`translate(${round(table.posMm.x)} ${round(table.posMm.y)})`}
      onPointerDown={onPointerDown}
      style={{ cursor: 'move' }}
    >
      <rect
        width={round(l.widthMm)}
        height={round(l.heightMm)}
        fill="#ffffff"
        stroke="#23282d"
        strokeWidth={0.3}
      />

      {l.columns.map((c) => (
        <text
          key={c.titulo}
          x={round(c.xMm)}
          y={round(linha * 0.75 + s * 0.4)}
          fontSize={s}
          fontFamily="Helvetica, Arial, sans-serif"
          fontWeight={700}
          fill="#6c757d"
        >
          {c.titulo}
        </text>
      ))}

      <line
        x1={0}
        y1={round(linha + s * 0.4)}
        x2={round(l.widthMm)}
        y2={round(linha + s * 0.4)}
        stroke="#23282d"
        strokeWidth={0.3}
      />

      {l.rows.map((r, i) => {
        const y = round(linha * (i + 2) + s * 0.4);
        const valores = [r.label, r.heights, r.spread, r.note];
        return (
          <g key={r.label + i}>
            {l.columns.map((c, j) => (
              <text
                key={c.titulo}
                x={round(c.xMm)}
                y={y}
                fontSize={s}
                fontFamily="Helvetica, Arial, sans-serif"
                fill="#23282d"
              >
                {valores[j] ?? ''}
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );
}

const round = (v: number): number => Math.round(v * 1000) / 1000;
