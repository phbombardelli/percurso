import type { Vec2 } from './vec';

/** Passos de grid oferecidos, em metros. */
export const GRID_STEPS: readonly number[] = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100] as const;

export function snapValue(v: number, step: number): number {
  if (!(step > 0)) return v;
  return Math.round(v / step) * step;
}

export function snapPoint(p: Vec2, step: number): Vec2 {
  return { x: snapValue(p.x, step), y: snapValue(p.y, step) };
}

/** Snap de ângulo (Shift ao girar). `increment` em graus. */
export function snapAngle(degrees: number, increment: number): number {
  if (!(increment > 0)) return degrees;
  return Math.round(degrees / increment) * increment;
}

/**
 * Passo de grid visível para a densidade atual: o menor passo cuja
 * projeção em tela ainda respeite `minPixels`. Evita que o grid vire
 * uma mancha sólida quando se afasta o zoom.
 */
export function visibleGridStep(metersPerPixel: number, minPixels = 8): number {
  const minMeters = metersPerPixel * minPixels;
  for (const step of GRID_STEPS) if (step >= minMeters) return step;
  return GRID_STEPS[GRID_STEPS.length - 1]!;
}

/**
 * Corrige o erro de ponto flutuante do snap para a precisão de milímetro,
 * que é a menor unidade com significado no modelo.
 */
export const toMillimeterPrecision = (m: number): number => Math.round(m * 1000) / 1000;
