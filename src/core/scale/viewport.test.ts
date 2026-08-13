import { describe, expect, it } from 'vitest';
import {
  fitToRect,
  metersPerPixel,
  modelToPaper,
  panBy,
  paperToModel,
  paperToScreen,
  screenToModel,
  screenToPaper,
  viewBox,
  zoomAt,
} from './viewport';
import type { Viewport } from './viewport';

const size = { width: 800, height: 600 };
const vp: Viewport = { centerMm: { x: 210, y: 148.5 }, zoom: 2 };
const origin = { x: 40, y: 30 };

describe('modelo ↔ papel', () => {
  it('aplica a escala de impressão', () => {
    expect(modelToPaper({ x: 10, y: 5 }, 250, origin)).toEqual({ x: 80, y: 50 });
  });

  it('é reversível', () => {
    const p = { x: 35.25, y: 17.4 };
    const back = paperToModel(modelToPaper(p, 250, origin), 250, origin);
    expect(back.x).toBeCloseTo(p.x, 12);
    expect(back.y).toBeCloseTo(p.y, 12);
  });
});

describe('tela ↔ papel', () => {
  it('o centro da tela é o centro do viewport', () => {
    expect(screenToPaper({ x: 400, y: 300 }, vp, size)).toEqual(vp.centerMm);
  });

  it('é reversível', () => {
    const pt = { x: 123, y: 456 };
    const back = paperToScreen(screenToPaper(pt, vp, size), vp, size);
    expect(back.x).toBeCloseTo(pt.x, 10);
    expect(back.y).toBeCloseTo(pt.y, 10);
  });

  it('viewBox cobre exatamente a área visível', () => {
    const b = viewBox(vp, size);
    expect(b.width).toBe(400);
    expect(b.height).toBe(300);
    expect(b.x).toBe(10);
    expect(b.y).toBe(-1.5);
  });
});

describe('zoom', () => {
  it('mantém fixo o ponto sob o cursor', () => {
    const anchor = { x: 640, y: 120 };
    const before = screenToPaper(anchor, vp, size);
    const zoomed = zoomAt(vp, anchor, 1.37, size);
    const after = screenToPaper(anchor, zoomed, size);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it('NÃO altera as coordenadas do modelo', () => {
    const anchor = { x: 100, y: 500 };
    const pontoDoModelo = { x: 35.25, y: 17.4 };
    const paper = modelToPaper(pontoDoModelo, 250, origin);
    const zoomed = zoomAt(vp, anchor, 4, size);
    // O mesmo ponto do modelo continua no mesmo lugar do papel.
    expect(paperToModel(paper, 250, origin)).toEqual(pontoDoModelo);
    expect(zoomed.zoom).not.toBe(vp.zoom);
  });

  it('respeita os limites de zoom', () => {
    let z = vp;
    for (let i = 0; i < 200; i += 1) z = zoomAt(z, { x: 0, y: 0 }, 1.5, size);
    expect(z.zoom).toBeLessThanOrEqual(40);
  });
});

describe('pan', () => {
  it('desloca o centro na proporção inversa do zoom', () => {
    const moved = panBy(vp, { x: 100, y: -50 });
    expect(moved.centerMm.x).toBe(210 - 50);
    expect(moved.centerMm.y).toBe(148.5 + 25);
  });
});

describe('fitToRect', () => {
  it('centraliza o retângulo e cabe na área', () => {
    const rect = { x: 0, y: 0, width: 420, height: 297 };
    const fitted = fitToRect(rect, size, 0);
    expect(fitted.centerMm).toEqual({ x: 210, y: 148.5 });
    const b = viewBox(fitted, size);
    expect(b.width).toBeGreaterThanOrEqual(rect.width - 1e-9);
    expect(b.height).toBeGreaterThanOrEqual(rect.height - 1e-9);
  });
});

describe('grid: 5 m medem 5 m em qualquer zoom', () => {
  it('a distância em metros entre dois pontos de tela não depende do zoom', () => {
    for (const zoom of [0.2, 1, 3.78, 12]) {
      const v: Viewport = { centerMm: { x: 100, y: 100 }, zoom };
      const mpp = metersPerPixel(v, 250);
      const a = screenToModel({ x: 100, y: 100 }, v, size, 250, origin);
      const b = screenToModel({ x: 100 + 5 / mpp, y: 100 }, v, size, 250, origin);
      expect(b.x - a.x).toBeCloseTo(5, 9);
    }
  });
});
