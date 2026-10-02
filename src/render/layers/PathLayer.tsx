import {
  formatDistance,
  legLength,
  legMidpoint,
  pathD,
  pathLength,
  pathMidpoint,
} from '@core/model/path';
import type { Vec2 } from '@core/geometry/vec';
import type { CoursePath, Obstacle } from '@core/model/types';
import { obstacleDistancesAlong } from '@core/assist/obstacleDistances';
import { mmPerMeter } from '@core/scale/units';
import { dashPattern, font, text } from '@render/style/tokens';

interface Props {
  path: CoursePath;
  printScale: number;
  originMm: Vec2;
  /** Obstáculos do croqui: para as distâncias entre eles (decisão 54). */
  obstacles?: Obstacle[];
  /** Centros escolhidos pelo leiaute de rótulos (decisão 55), em metros. */
  distanceAt?: Map<string, Vec2>;
  onPointerDown?: (e: React.PointerEvent) => void;
}

/** Afastamento do rótulo de distância em relação à linha, em mm de papel. */
const AFASTA_MM = 3.4;

/**
 * Traçado do percurso e as distâncias de cada trecho.
 *
 * O número mostrado é o comprimento do traçado desenhado, medido sobre a
 * curva — não a distância em linha reta entre os nós (§19).
 */
export function PathLayer({ path, printScale, originMm, obstacles = [], distanceAt, onPointerDown }: Props) {
  const k = mmPerMeter(printScale);
  const toPaper = (p: Vec2): Vec2 => ({ x: originMm.x + p.x * k, y: originMm.y + p.y * k });
  const escolhidas = Object.values(path.obstacleDistances ?? {}).some(Boolean)
    ? obstacleDistancesAlong(path, obstacles).filter((d) => path.obstacleDistances[d.key])
    : [];

  return (
    <g data-object={path.id} data-kind="path">
      {/* Faixa larga e invisível: dá o que clicar num traço de 0,4 mm. */}
      <path
        d={pathD(path, toPaper)}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(2, path.style.strokeMm * 6)}
        onPointerDown={onPointerDown}
        style={{ cursor: path.locked ? 'default' : 'move' }}
      />
      <path
        d={pathD(path, toPaper)}
        fill="none"
        stroke={path.style.color}
        strokeWidth={path.style.strokeMm}
        strokeDasharray={dashPattern[path.style.dash]}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
      />

      {path.distanceMode === 'total' && path.totalLabel.visible && path.nodes.length > 1 && (
        <DistanceText
          at={toPaper({
            x: pathMidpoint(path).x + path.totalLabel.offsetM.x,
            y: pathMidpoint(path).y + path.totalLabel.offsetM.y,
          })}
          value={formatDistance(pathLength(path), path.totalLabel.decimals)}
          color={path.totalLabel.color}
        />
      )}

      {path.distanceMode === 'trecho' && path.legs.map((leg, i) => {
        if (!leg.label.visible) return null;
        const meio = legMidpoint(path, i);
        const p = toPaper({
          x: meio.x + leg.label.offsetM.x,
          y: meio.y + leg.label.offsetM.y,
        });
        return (
          <DistanceText
            key={i}
            at={p}
            value={formatDistance(legLength(path, i), leg.label.decimals)}
            color={leg.label.color}
          />
        );
      })}

      {escolhidas.map((d) => {
        const escolhido = distanceAt?.get(d.key);
        const p = toPaper(escolhido ?? d.at);
        return (
          <DistanceText
            key={d.key}
            at={escolhido ? p : { x: p.x + d.normal.x * AFASTA_MM, y: p.y + d.normal.y * AFASTA_MM }}
            value={`${formatDistance(d.meters, 2)} m`}
            color={path.totalLabel.color}
          />
        );
      })}
    </g>
  );
}

function DistanceText({
  at,
  value,
  color,
}: {
  at: Vec2;
  value: string;
  color: string;
}) {
  return (
    <text
      x={round(at.x)}
      y={round(at.y)}
      fontFamily={font.family}
      fontSize={text.small}
      fill={color}
      textAnchor="middle"
      dominantBaseline="middle"
      pointerEvents="none"
    >
      {value}
    </text>
  );
}

const round = (v: number): number => Math.round(v * 1000) / 1000;
