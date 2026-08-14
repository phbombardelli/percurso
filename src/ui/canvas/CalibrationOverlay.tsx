import { distance, type Vec2 } from '@core/geometry/vec';
import { formatMeters } from '@core/scale/units';
import { color, font } from '@render/style/tokens';

interface Props {
  pointA: Vec2 | null;
  pointB: Vec2 | null;
  /** Ponto sob o cursor, para a régua acompanhar antes do segundo clique. */
  cursor: Vec2 | null;
  toPaper: (p: Vec2) => Vec2;
  zoom: number;
}

/**
 * Régua de calibração: os dois pontos marcados sobre a imagem e a medida
 * atual entre eles, na escala vigente. É esse número que o usuário vai
 * corrigir para a distância real.
 */
export function CalibrationOverlay({ pointA, pointB, cursor, toPaper, zoom }: Props) {
  if (!pointA) return null;
  const mm = (px: number) => px / zoom;
  const end = pointB ?? cursor;

  const a = toPaper(pointA);
  const b = end ? toPaper(end) : null;
  const atual = end ? distance(pointA, end) : 0;

  return (
    <g data-part="calibration" pointerEvents="none">
      {b && (
        <>
          <line
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={color.distance}
            strokeWidth={mm(2)}
          />
          <text
            x={(a.x + b.x) / 2}
            y={(a.y + b.y) / 2 - mm(8)}
            fontFamily={font.family}
            fontSize={mm(13)}
            fill={color.distance}
            textAnchor="middle"
            stroke="#ffffff"
            strokeWidth={mm(3)}
            paintOrder="stroke"
          >
            {formatMeters(atual)} m
          </text>
        </>
      )}
      {[a, b].map((p, i) =>
        p ? (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={mm(5)} fill="none" stroke={color.distance} strokeWidth={mm(1.5)} />
            <line x1={p.x - mm(8)} y1={p.y} x2={p.x + mm(8)} y2={p.y} stroke={color.distance} strokeWidth={mm(1)} />
            <line x1={p.x} y1={p.y - mm(8)} x2={p.x} y2={p.y + mm(8)} stroke={color.distance} strokeWidth={mm(1)} />
          </g>
        ) : null,
      )}
    </g>
  );
}
