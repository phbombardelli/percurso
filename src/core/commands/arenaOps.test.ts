import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import {
  arenaArea,
  arenaExtent,
  arenaPerimeter,
  arenaPoints,
  createPolygonArena,
  createRectangleArena,
} from '@core/model/arena';
import { createDocument, firstArena } from '@core/model/document';
import { getBounds } from '@core/model/transform';
import type { Arena, CourseDocument } from '@core/model/types';
import { addObject } from './ops';
import {
  convertArenaToPolygon,
  insertArenaVertex,
  moveArenaVertex,
  removeArenaVertex,
  resizeArenaByCorner,
  setArenaCorner,
  setArenaSize,
  setPerimeterRuler,
} from './arenaOps';

const edit = (doc: CourseDocument, recipe: (d: CourseDocument) => void) => produce(doc, recipe);

function docWithArena(arena: Arena): { doc: CourseDocument; id: string } {
  const base = edit(createDocument(), (d) => {
    d.objects = [];
    addObject(d, arena);
  });
  return { doc: base, id: arena.id };
}

const arenaIn = (doc: CourseDocument) => firstArena(doc)!;

describe('geometria da pista', () => {
  it('retângulo: contorno, perímetro e área', () => {
    const a = createRectangleArena({ x: 0, y: 0 }, 80, 40);
    expect(arenaPoints(a)).toHaveLength(4);
    expect(arenaPerimeter(a)).toBe(240);
    expect(arenaArea(a)).toBe(3200);
  });

  it('polígono: área pela fórmula do polígono', () => {
    // Triângulo 10 x 10 -> área 50.
    const a = createPolygonArena([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ]);
    expect(arenaArea(a)).toBe(50);
    expect(arenaPerimeter(a)).toBeCloseTo(20 + Math.hypot(10, 10), 9);
  });

  it('área independe do sentido dos vértices', () => {
    const horario = createPolygonArena([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
    const antiHorario = createPolygonArena([...horario.points].reverse());
    expect(arenaArea(antiHorario)).toBe(arenaArea(horario));
  });

  it('extensão do polígono é a caixa envolvente', () => {
    const a = createPolygonArena([
      { x: 5, y: 2 },
      { x: 45, y: 8 },
      { x: 30, y: 27 },
    ]);
    expect(arenaExtent(a)).toEqual({ origin: { x: 5, y: 2 }, widthM: 40, heightM: 25 });
  });

  it('a envoltória usa o mesmo contorno do desenho', () => {
    const a = createPolygonArena([
      { x: 5, y: 2 },
      { x: 45, y: 8 },
      { x: 30, y: 27 },
    ]);
    const b = getBounds(a, 250);
    expect(b.min).toEqual({ x: 5, y: 2 });
    expect(b.max).toEqual({ x: 45, y: 27 });
  });
});

describe('dimensões digitadas', () => {
  it('aplica largura e comprimento exatos', () => {
    const { doc, id } = docWithArena(createRectangleArena({ x: 0, y: 0 }, 80, 40));
    const next = edit(doc, (d) => setArenaSize(d, id, 62.5, 31.25));
    const a = arenaIn(next);
    expect(a.widthM).toBe(62.5);
    expect(a.heightM).toBe(31.25);
  });

  it('não aceita pista degenerada', () => {
    const { doc, id } = docWithArena(createRectangleArena({ x: 0, y: 0 }, 80, 40));
    const next = edit(doc, (d) => setArenaSize(d, id, 0, -5));
    expect(arenaIn(next).widthM).toBe(1);
    expect(arenaIn(next).heightM).toBe(1);
  });

  it('encolher a pista reduz o corte do canto junto', () => {
    const { doc, id } = docWithArena(createRectangleArena({ x: 0, y: 0 }, 80, 40));
    let next = edit(doc, (d) => setArenaCorner(d, id, { style: 'chamfer', radiusM: 15 }));
    expect(arenaIn(next).corner.radiusM).toBe(15);
    next = edit(next, (d) => setArenaSize(d, id, 80, 20));
    // Metade do menor lado: 10.
    expect(arenaIn(next).corner.radiusM).toBe(10);
  });
});

describe('alça de canto', () => {
  it('mantém o canto oposto fixo', () => {
    const { doc, id } = docWithArena(createRectangleArena({ x: 0, y: 0 }, 80, 40));
    // Arrasta o canto superior esquerdo (0) para (10, 5).
    const next = edit(doc, (d) => resizeArenaByCorner(d, id, 0, { x: 10, y: 5 }));
    const a = arenaIn(next);
    expect(a.origin).toEqual({ x: 10, y: 5 });
    expect(a.widthM).toBe(70);
    expect(a.heightM).toBe(35);
    // Canto inferior direito continua em (80, 40).
    expect(a.origin.x + a.widthM).toBe(80);
    expect(a.origin.y + a.heightM).toBe(40);
  });

  it('atravessar o canto oposto inverte sem virar do avesso', () => {
    const { doc, id } = docWithArena(createRectangleArena({ x: 0, y: 0 }, 80, 40));
    const next = edit(doc, (d) => resizeArenaByCorner(d, id, 0, { x: 100, y: 60 }));
    const a = arenaIn(next);
    expect(a.origin).toEqual({ x: 80, y: 40 });
    expect(a.widthM).toBe(20);
    expect(a.heightM).toBe(20);
  });

  it('ignora arrasto que deixaria a pista minúscula', () => {
    const { doc, id } = docWithArena(createRectangleArena({ x: 0, y: 0 }, 80, 40));
    const next = edit(doc, (d) => resizeArenaByCorner(d, id, 0, { x: 79.5, y: 39.5 }));
    expect(arenaIn(next).widthM).toBe(80);
  });
});

describe('contorno livre', () => {
  it('converter materializa os quatro vértices', () => {
    const { doc, id } = docWithArena(createRectangleArena({ x: 0, y: 0 }, 80, 40));
    const next = edit(doc, (d) => convertArenaToPolygon(d, id));
    const a = arenaIn(next);
    expect(a.shape).toBe('polygon');
    expect(a.points).toEqual([
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 },
    ]);
    expect(arenaArea(a)).toBe(3200);
  });

  it('mover vértice muda só aquele vértice', () => {
    const { doc, id } = docWithArena(
      createPolygonArena([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
    );
    const next = edit(doc, (d) => moveArenaVertex(d, id, 1, { x: 14.25, y: -2.5 }));
    expect(arenaIn(next).points).toEqual([
      { x: 0, y: 0 },
      { x: 14.25, y: -2.5 },
      { x: 10, y: 10 },
    ]);
  });

  it('inserir vértice cria o ponto médio da aresta', () => {
    const { doc, id } = docWithArena(
      createPolygonArena([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
    );
    const next = edit(doc, (d) => {
      insertArenaVertex(d, id, 0);
    });
    expect(arenaIn(next).points[1]).toEqual({ x: 5, y: 0 });
    expect(arenaIn(next).points).toHaveLength(4);
  });

  it('inserir na última aresta fecha o ciclo corretamente', () => {
    const { doc, id } = docWithArena(
      createPolygonArena([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
    );
    const next = edit(doc, (d) => {
      insertArenaVertex(d, id, 2);
    });
    expect(arenaIn(next).points[3]).toEqual({ x: 5, y: 5 });
  });

  it('não deixa o contorno ficar com menos de três vértices', () => {
    const { doc, id } = docWithArena(
      createPolygonArena([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
    );
    const next = edit(doc, (d) => {
      removeArenaVertex(d, id, 0);
    });
    expect(arenaIn(next).points).toHaveLength(3);
  });
});

describe('régua de perímetro', () => {
  it('mescla sem apagar os lados não informados', () => {
    const { doc, id } = docWithArena(createRectangleArena({ x: 0, y: 0 }, 80, 40));
    const next = edit(doc, (d) => setPerimeterRuler(d, id, { sides: { top: false } }));
    expect(arenaIn(next).perimeterRuler.sides).toEqual({
      top: false,
      right: true,
      bottom: true,
      left: true,
    });
  });

  it('passo zero volta ao padrão em vez de travar o desenho', () => {
    const { doc, id } = docWithArena(createRectangleArena({ x: 0, y: 0 }, 80, 40));
    const next = edit(doc, (d) => setPerimeterRuler(d, id, { stepM: 0 }));
    expect(arenaIn(next).perimeterRuler.stepM).toBe(5);
  });
});

describe('pista bloqueada', () => {
  it('não muda de tamanho nem de forma', () => {
    const arena = createRectangleArena({ x: 0, y: 0 }, 80, 40);
    arena.locked = true;
    const { doc, id } = docWithArena(arena);
    const next = edit(doc, (d) => {
      setArenaSize(d, id, 10, 10);
      convertArenaToPolygon(d, id);
    });
    expect(arenaIn(next).widthM).toBe(80);
    expect(arenaIn(next).shape).toBe('rectangle');
  });
});
