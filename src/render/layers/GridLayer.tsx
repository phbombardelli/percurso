import { visibleGridStep } from '@core/geometry/snap';
import { mmPerMeter } from '@core/scale/units';
import type { GridSettings } from '@core/model/types';
import type { Vec2 } from '@core/geometry/vec';
import { color, stroke } from '@render/style/tokens';

interface Props {
  grid: GridSettings;
  printScale: number;
  originMm: Vec2;
  /** Área visível, em milímetros de papel. */
  viewBoxMm: { x: number; y: number; width: number; height: number };
  metersPerPixel: number;
}

const MAX_LINES = 400;

/**
 * Grid em unidades reais: o espaçamento é sempre um número redondo de
 * metros, escolhido conforme a densidade de tela. Camada de tela apenas —
 * não é desenhada no modo papel.
 */
export function GridLayer({ grid, printScale, originMm, viewBoxMm, metersPerPixel }: Props) {
  if (!grid.visible) return null;

  const k = mmPerMeter(printScale);
  const minor = grid.stepM > 0 ? grid.stepM : visibleGridStep(metersPerPixel, 8);
  const major = minor * Math.max(2, grid.subdivisions);

  // Limites da área visível convertidos para metros do modelo.
  const x0 = (viewBoxMm.x - originMm.x) / k;
  const x1 = (viewBoxMm.x + viewBoxMm.width - originMm.x) / k;
  const y0 = (viewBoxMm.y - originMm.y) / k;
  const y1 = (viewBoxMm.y + viewBoxMm.height - originMm.y) / k;

  if ((x1 - x0) / minor > MAX_LINES || (y1 - y0) / minor > MAX_LINES) return null;

  const verticals: { m: number; major: boolean }[] = [];
  for (let m = Math.ceil(x0 / minor) * minor; m <= x1; m += minor) {
    verticals.push({ m, major: Math.abs(m % major) < minor / 1000 });
  }
  const horizontals: { m: number; major: boolean }[] = [];
  for (let m = Math.ceil(y0 / minor) * minor; m <= y1; m += minor) {
    horizontals.push({ m, major: Math.abs(m % major) < minor / 1000 });
  }

  const px = (m: number) => originMm.x + m * k;
  const py = (m: number) => originMm.y + m * k;

  return (
    <g data-layer="grid" pointerEvents="none">
      {verticals.map(({ m, major: isMajor }) => (
        <line
          key={`v${m}`}
          x1={px(m)}
          y1={viewBoxMm.y}
          x2={px(m)}
          y2={viewBoxMm.y + viewBoxMm.height}
          stroke={isMajor ? color.gridMajor : color.gridMinor}
          strokeWidth={isMajor ? stroke.thin : stroke.hairline}
        />
      ))}
      {horizontals.map(({ m, major: isMajor }) => (
        <line
          key={`h${m}`}
          x1={viewBoxMm.x}
          y1={py(m)}
          x2={viewBoxMm.x + viewBoxMm.width}
          y2={py(m)}
          stroke={isMajor ? color.gridMajor : color.gridMinor}
          strokeWidth={isMajor ? stroke.thin : stroke.hairline}
        />
      ))}
    </g>
  );
}
