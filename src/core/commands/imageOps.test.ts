import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { distance } from '@core/geometry/vec';
import { createDocument } from '@core/model/document';
import { getBounds } from '@core/model/transform';
import type { BackgroundImage, CourseDocument } from '@core/model/types';
import {
  addImage,
  calibrateImage,
  imageHeightM,
  imageWidthM,
  pruneAssets,
  removeImage,
  setImageOpacity,
  setImageWidthM,
  type ImportedImage,
} from './imageOps';

const edit = (doc: CourseDocument, recipe: (d: CourseDocument) => void) => produce(doc, recipe);

const importada = (widthPx = 800, heightPx = 600): ImportedImage => ({
  widthPx,
  heightPx,
  asset: {
    mime: 'image/png',
    dataUrl: 'data:image/png;base64,AAAA',
    width: widthPx,
    height: heightPx,
    name: 'satelite.png',
  },
});

function docComImagem(largura = 100): { doc: CourseDocument; id: string } {
  let id = '';
  const doc = edit(createDocument(), (d) => {
    id = addImage(d, importada(), { x: 0, y: 0 }, largura).id;
  });
  return { doc, id };
}

const img = (doc: CourseDocument, id: string) =>
  doc.objects.find((o): o is BackgroundImage => o.id === id)!;

describe('inserção', () => {
  it('embute o arquivo e nasce com a largura pedida', () => {
    const { doc, id } = docComImagem(100);
    const i = img(doc, id);
    expect(Object.keys(doc.assets)).toHaveLength(1);
    expect(doc.assets[i.assetId]?.name).toBe('satelite.png');
    expect(imageWidthM(i)).toBe(100);
    expect(imageHeightM(i)).toBe(75); // proporção 800x600 preservada
    expect(i.calibration).toBeNull();
  });

  it('vai para a camada de fundo, sob todo o resto', () => {
    const { doc, id } = docComImagem();
    expect(img(doc, id).layer).toBe('background');
  });

  it('a envoltória cobre a imagem inteira', () => {
    const { doc, id } = docComImagem(100);
    const b = getBounds(img(doc, id), 250);
    expect(b.min).toEqual({ x: 0, y: 0 });
    expect(b.max.x).toBeCloseTo(100, 9);
    expect(b.max.y).toBeCloseTo(75, 9);
  });
});

describe('calibração por referência', () => {
  it('a distância marcada passa a valer o que foi informado', () => {
    const { doc, id } = docComImagem(100);
    // Dois pontos que hoje distam 10 m, mas na realidade são 20 m.
    const a = { x: 10, y: 10 };
    const b = { x: 20, y: 10 };
    const next = edit(doc, (d) => {
      calibrateImage(d, id, a, b, 20);
    });
    const i = img(next, id);
    // A escala dobra: a imagem inteira passa a medir 200 m.
    expect(imageWidthM(i)).toBeCloseTo(200, 9);
  });

  it('o primeiro ponto marcado não sai do lugar', () => {
    const { doc, id } = docComImagem(100);
    const a = { x: 30, y: 20 };
    const b = { x: 40, y: 20 };

    const antes = img(doc, id);
    // Onde `a` cai dentro da imagem, em pixels, antes da calibração.
    const pixelDeA = {
      x: (a.x - antes.origin.x) / antes.metersPerPixel,
      y: (a.y - antes.origin.y) / antes.metersPerPixel,
    };

    const next = edit(doc, (d) => {
      calibrateImage(d, id, a, b, 25);
    });
    const depois = img(next, id);
    // O mesmo pixel continua caindo no mesmo ponto do terreno.
    expect(depois.origin.x + pixelDeA.x * depois.metersPerPixel).toBeCloseTo(a.x, 6);
    expect(depois.origin.y + pixelDeA.y * depois.metersPerPixel).toBeCloseTo(a.y, 6);
  });

  it('calibrar duas vezes converge, em vez de acumular erro', () => {
    const { doc, id } = docComImagem(100);
    const a = { x: 0, y: 0 };
    const b = { x: 25, y: 0 };

    let next = edit(doc, (d) => {
      calibrateImage(d, id, a, b, 50);
    });
    // Depois da primeira, os mesmos pixels agora medem 50 m. Marcando os
    // pontos correspondentes de novo e confirmando 50, nada muda.
    const escalaApos1 = img(next, id).metersPerPixel;
    next = edit(next, (d) => {
      calibrateImage(d, id, a, { x: 50, y: 0 }, 50);
    });
    expect(img(next, id).metersPerPixel).toBeCloseTo(escalaApos1, 12);
  });

  it('guarda o que foi usado, para poder revisar', () => {
    const { doc, id } = docComImagem(100);
    const next = edit(doc, (d) => {
      calibrateImage(d, id, { x: 1, y: 1 }, { x: 3, y: 1 }, 20);
    });
    expect(img(next, id).calibration).toEqual({
      pointA: { x: 1, y: 1 },
      pointB: { x: 3, y: 1 },
      knownDistanceM: 20,
    });
  });

  it('recusa dois pontos iguais e distância não positiva', () => {
    const { doc, id } = docComImagem(100);
    const p = { x: 5, y: 5 };
    expect(edit(doc, (d) => { calibrateImage(d, id, p, p, 10); })).toEqual(doc);
    expect(edit(doc, (d) => { calibrateImage(d, id, p, { x: 6, y: 5 }, 0); })).toEqual(doc);
    expect(edit(doc, (d) => { calibrateImage(d, id, p, { x: 6, y: 5 }, -3); })).toEqual(doc);
  });

  it('a calibração funciona em qualquer direção, não só na horizontal', () => {
    const { doc, id } = docComImagem(100);
    const a = { x: 10, y: 10 };
    const b = { x: 13, y: 14 }; // distância 5
    const next = edit(doc, (d) => {
      calibrateImage(d, id, a, b, 15);
    });
    const i = img(next, id);
    expect(distance(a, b) * 3).toBeCloseTo(15, 9);
    expect(imageWidthM(i)).toBeCloseTo(300, 9);
  });
});

describe('ajustes', () => {
  it('largura em metros redefine a escala', () => {
    const { doc, id } = docComImagem(100);
    const next = edit(doc, (d) => setImageWidthM(d, id, 250));
    expect(imageWidthM(img(next, id))).toBeCloseTo(250, 9);
    expect(imageHeightM(img(next, id))).toBeCloseTo(187.5, 9);
  });

  it('opacidade fica entre 0 e 1', () => {
    const { doc, id } = docComImagem();
    expect(img(edit(doc, (d) => setImageOpacity(d, id, 5)), id).opacity).toBe(1);
    expect(img(edit(doc, (d) => setImageOpacity(d, id, -2)), id).opacity).toBe(0);
  });

  it('imagem bloqueada não muda de escala', () => {
    const { doc, id } = docComImagem(100);
    const travada = edit(doc, (d) => {
      const i = d.objects.find((o) => o.id === id)!;
      i.locked = true;
    });
    const next = edit(travada, (d) => setImageWidthM(d, id, 999));
    expect(imageWidthM(img(next, id))).toBe(100);
  });
});

describe('arquivos embutidos', () => {
  it('remover a imagem remove o arquivo junto', () => {
    const { doc, id } = docComImagem();
    const next = edit(doc, (d) => removeImage(d, id));
    expect(next.objects.some((o) => o.kind === 'image')).toBe(false);
    expect(Object.keys(next.assets)).toHaveLength(0);
  });

  it('não remove o arquivo se outra imagem ainda o usa', () => {
    const { doc, id } = docComImagem();
    const comCopia = edit(doc, (d) => {
      const original = d.objects.find((o): o is BackgroundImage => o.id === id)!;
      d.objects.push({ ...original, id: 'img-copia' });
    });
    const next = edit(comCopia, (d) => removeImage(d, id));
    expect(Object.keys(next.assets)).toHaveLength(1);
  });

  it('faxina apaga arquivo órfão', () => {
    const { doc } = docComImagem();
    const semObjeto = edit(doc, (d) => {
      d.objects = d.objects.filter((o) => o.kind !== 'image');
    });
    let removidos: string[] = [];
    const next = edit(semObjeto, (d) => {
      removidos = pruneAssets(d);
    });
    expect(removidos).toHaveLength(1);
    expect(Object.keys(next.assets)).toHaveLength(0);
  });
});
