/** Vetor 2D. Nas coordenadas do modelo a unidade é sempre metro. */
export interface Vec2 {
  x: number;
  y: number;
}

export const vec = (x: number, y: number): Vec2 => ({ x, y });

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });

export const length = (a: Vec2): number => Math.hypot(a.x, a.y);
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(b.x - a.x, b.y - a.y);

export function normalize(a: Vec2): Vec2 {
  const len = length(a);
  return len === 0 ? { x: 0, y: 0 } : { x: a.x / len, y: a.y / len };
}

export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
/** Produto vetorial 2D (componente z do produto 3D). */
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;

export const DEG = Math.PI / 180;

/**
 * Rotação em graus, sentido horário, em torno de `origin`.
 * Horário porque o eixo Y do modelo cresce para baixo (igual ao SVG) —
 * ver docs/DECISOES.md, decisão 2.
 */
export function rotate(p: Vec2, degrees: number, origin: Vec2 = { x: 0, y: 0 }): Vec2 {
  const rad = degrees * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/** Vetor unitário apontando no ângulo dado (0° = leste, horário). */
export function fromAngle(degrees: number): Vec2 {
  const rad = degrees * DEG;
  return { x: Math.cos(rad), y: Math.sin(rad) };
}

/** Ângulo do vetor em graus, no intervalo [0, 360). */
export function angleOf(a: Vec2): number {
  const deg = Math.atan2(a.y, a.x) / DEG;
  return deg < 0 ? deg + 360 : deg;
}

/** Normaliza um ângulo qualquer para [0, 360). */
export function normalizeAngle(degrees: number): number {
  const m = degrees % 360;
  return m < 0 ? m + 360 : m;
}

export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;
