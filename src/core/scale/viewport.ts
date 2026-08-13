import type { Vec2 } from '@core/geometry/vec';
import { clamp } from '@core/geometry/vec';
import type { Meters, Millimeters, Pixels, PrintScale } from './units';
import { mmPerMeter } from './units';

/**
 * Estado do viewport interativo. NÃO faz parte do documento salvo:
 * zoom e pan são estado de edição, nunca dados do croqui.
 */
export interface Viewport {
  /** Ponto do papel (mm) no centro da área visível. */
  centerMm: Vec2;
  /** Pixels CSS por milímetro de papel. 1 = tamanho real em tela ~96dpi/25,4. */
  zoom: number;
}

export interface ViewSize {
  width: Pixels;
  height: Pixels;
}

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 40;

/** Zoom em que 1 mm de papel mede 1 mm físico na tela (aprox. 96 dpi). */
export const ZOOM_ACTUAL_SIZE = 96 / 25.4;

/**
 * Posição do modelo (metros) no espaço do papel (mm).
 * `originMm` é onde o ponto (0,0) do modelo cai na página.
 */
export function modelToPaper(p: Vec2, printScale: PrintScale, originMm: Vec2): Vec2 {
  const k = mmPerMeter(printScale);
  return { x: originMm.x + p.x * k, y: originMm.y + p.y * k };
}

export function paperToModel(p: Vec2, printScale: PrintScale, originMm: Vec2): Vec2 {
  const k = mmPerMeter(printScale);
  return { x: (p.x - originMm.x) / k, y: (p.y - originMm.y) / k };
}

/** viewBox do SVG, em milímetros de papel, para a área visível atual. */
export function viewBox(vp: Viewport, size: ViewSize): {
  x: Millimeters;
  y: Millimeters;
  width: Millimeters;
  height: Millimeters;
} {
  const width = size.width / vp.zoom;
  const height = size.height / vp.zoom;
  return {
    x: vp.centerMm.x - width / 2,
    y: vp.centerMm.y - height / 2,
    width,
    height,
  };
}

export const viewBoxAttr = (vp: Viewport, size: ViewSize): string => {
  const b = viewBox(vp, size);
  return `${b.x} ${b.y} ${b.width} ${b.height}`;
};

/** Pixel dentro do elemento SVG → milímetro de papel. */
export function screenToPaper(pt: Vec2, vp: Viewport, size: ViewSize): Vec2 {
  return {
    x: vp.centerMm.x + (pt.x - size.width / 2) / vp.zoom,
    y: vp.centerMm.y + (pt.y - size.height / 2) / vp.zoom,
  };
}

/** Milímetro de papel → pixel dentro do elemento SVG. */
export function paperToScreen(pt: Vec2, vp: Viewport, size: ViewSize): Vec2 {
  return {
    x: size.width / 2 + (pt.x - vp.centerMm.x) * vp.zoom,
    y: size.height / 2 + (pt.y - vp.centerMm.y) * vp.zoom,
  };
}

export function screenToModel(
  pt: Vec2,
  vp: Viewport,
  size: ViewSize,
  printScale: PrintScale,
  originMm: Vec2,
): Vec2 {
  return paperToModel(screenToPaper(pt, vp, size), printScale, originMm);
}

/** Deslocamento em pixels aplicado ao pan (arrasto com o botão do meio/espaço). */
export function panBy(vp: Viewport, deltaPx: Vec2): Viewport {
  return {
    ...vp,
    centerMm: {
      x: vp.centerMm.x - deltaPx.x / vp.zoom,
      y: vp.centerMm.y - deltaPx.y / vp.zoom,
    },
  };
}

/**
 * Zoom mantendo fixo o ponto sob o cursor — o comportamento esperado de
 * qualquer editor gráfico: o que está sob o mouse não se move.
 */
export function zoomAt(vp: Viewport, anchorPx: Vec2, factor: number, size: ViewSize): Viewport {
  const nextZoom = clamp(vp.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  if (nextZoom === vp.zoom) return vp;
  const anchorMm = screenToPaper(anchorPx, vp, size);
  // Resolve centerMm' tal que anchorMm continue projetando em anchorPx.
  return {
    zoom: nextZoom,
    centerMm: {
      x: anchorMm.x - (anchorPx.x - size.width / 2) / nextZoom,
      y: anchorMm.y - (anchorPx.y - size.height / 2) / nextZoom,
    },
  };
}

/** Enquadra um retângulo de papel na área visível, com folga proporcional. */
export function fitToRect(
  rectMm: { x: number; y: number; width: number; height: number },
  size: ViewSize,
  padding = 0.06,
): Viewport {
  if (rectMm.width <= 0 || rectMm.height <= 0 || size.width <= 0 || size.height <= 0) {
    return { centerMm: { x: 0, y: 0 }, zoom: 1 };
  }
  const zoom = clamp(
    Math.min(size.width / rectMm.width, size.height / rectMm.height) * (1 - padding),
    MIN_ZOOM,
    MAX_ZOOM,
  );
  return {
    zoom,
    centerMm: { x: rectMm.x + rectMm.width / 2, y: rectMm.y + rectMm.height / 2 },
  };
}

/**
 * Quantos metros do modelo cabem em um pixel de tela. Serve para decidir
 * a densidade do grid e o passo da régua sem depender do zoom bruto.
 */
export function metersPerPixel(vp: Viewport, printScale: PrintScale): Meters {
  return 1 / (vp.zoom * mmPerMeter(printScale));
}
