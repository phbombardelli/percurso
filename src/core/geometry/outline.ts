import type { Vec2 } from './vec';
import { add, distance, normalize, scale, sub } from './vec';

export type CornerTreatment = 'square' | 'rounded' | 'chamfer';

/** Vértices do retângulo, em sentido horário a partir do canto superior esquerdo. */
export function rectanglePoints(origin: Vec2, width: number, height: number): Vec2[] {
  return [
    { x: origin.x, y: origin.y },
    { x: origin.x + width, y: origin.y },
    { x: origin.x + width, y: origin.y + height },
    { x: origin.x, y: origin.y + height },
  ];
}

/**
 * Caminho SVG fechado a partir de um polígono, com cantos quadrados,
 * chanfrados ou arredondados. `project` leva do espaço do modelo (metros)
 * para o espaço de saída (mm de papel), e o raio é convertido pela mesma
 * proporção — por isso `radiusProjected` vem pronto do chamador.
 */
export function polygonPathD(
  points: Vec2[],
  treatment: CornerTreatment,
  radius: number,
  project: (p: Vec2) => Vec2,
): string {
  const n = points.length;
  if (n < 2) return '';
  const pts = points.map(project);
  if (n < 3 || treatment === 'square' || radius <= 0) {
    return `M ${fmt(pts[0]!)} ${pts.slice(1).map((p) => `L ${fmt(p)}`).join(' ')} Z`;
  }

  const parts: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const prev = pts[(i - 1 + n) % n]!;
    const curr = pts[i]!;
    const next = pts[(i + 1) % n]!;

    // O corte nunca pode passar da metade de nenhuma das duas arestas.
    const r = Math.min(radius, distance(prev, curr) / 2, distance(curr, next) / 2);
    const entry = add(curr, scale(normalize(sub(prev, curr)), r));
    const exit = add(curr, scale(normalize(sub(next, curr)), r));

    parts.push(i === 0 ? `M ${fmt(entry)}` : `L ${fmt(entry)}`);
    parts.push(
      treatment === 'chamfer'
        ? `L ${fmt(exit)}`
        : `Q ${fmt(curr)} ${fmt(exit)}`,
    );
  }
  parts.push('Z');
  return parts.join(' ');
}

const fmt = (p: Vec2): string => `${round(p.x)} ${round(p.y)}`;
const round = (v: number): number => Math.round(v * 1000) / 1000;
