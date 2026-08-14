import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { distance } from '@core/geometry/vec';
import { createDocument } from '@core/model/document';
import {
  createPath,
  createPathNode,
  flattenPath,
  formatDistance,
  legLength,
  legMidpoint,
  legStraightDistance,
  pathD,
  pathLength,
  segmentAt,
} from '@core/model/path';
import { getBounds } from '@core/model/transform';
import type { Vec2 } from '@core/geometry/vec';
import type { CourseDocument, CoursePath } from '@core/model/types';
import { addObject } from './ops';
import {
  addNode,
  insertNode,
  moveHandle,
  moveNode,
  removeNode,
  setAllLegLabels,
  setLegLabel,
  setNodeType,
  setPathStyle,
  straightenLeg,
} from './pathOps';

const edit = (doc: CourseDocument, recipe: (d: CourseDocument) => void) => produce(doc, recipe);

function docCom(path: CoursePath): CourseDocument {
  return edit(createDocument(), (d) => addObject(d, path));
}

const get = (doc: CourseDocument, id: string) =>
  doc.objects.find((o): o is CoursePath => o.id === id)!;

const reto = (pontos: Vec2[]) => createPath(pontos.map((p) => createPathNode(p)));

describe('comprimento do traçado', () => {
  it('em linha reta é a soma dos segmentos', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 30, y: 40 }, // 50
      { x: 30, y: 60 }, // 20
    ]);
    expect(pathLength(p)).toBeCloseTo(70, 9);
    expect(legLength(p, 0)).toBeCloseTo(50, 9);
    expect(legLength(p, 1)).toBeCloseTo(20, 9);
  });

  it('mede o traçado desenhado, NÃO a distância em linha reta (§19)', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 24.5, y: 0 },
    ]);
    expect(legStraightDistance(p, 0)).toBeCloseTo(24.5, 9);
    expect(legLength(p, 0)).toBeCloseTo(24.5, 9);

    // Curvando o trecho, a reta continua 24,50 mas o traçado alonga.
    const curvo = produce(p, (d) => {
      d.nodes[0]!.type = 'smooth';
      d.nodes[0]!.handleOut = { x: 6, y: -9 };
      d.nodes[1]!.handleIn = { x: -6, y: -9 };
    });
    expect(legStraightDistance(curvo, 0)).toBeCloseTo(24.5, 9);
    expect(legLength(curvo, 0)).toBeGreaterThan(24.5);
    // É este o número que vai para o croqui.
    expect(formatDistance(legLength(curvo, 0))).not.toBe('24,50');
  });

  it('curvar um trecho aumenta o total, sem mexer nos outros', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 40, y: 0 },
    ]);
    const antes = { total: pathLength(p), segundo: legLength(p, 1) };
    const curvo = produce(p, (d) => {
      d.nodes[0]!.handleOut = { x: 5, y: 8 };
      d.nodes[1]!.handleIn = { x: -5, y: 8 };
    });
    expect(pathLength(curvo)).toBeGreaterThan(antes.total);
    expect(legLength(curvo, 1)).toBeCloseTo(antes.segundo, 9);
  });

  it('traçado de um nó só não tem comprimento', () => {
    expect(pathLength(createPath([createPathNode({ x: 0, y: 0 })]))).toBe(0);
  });

  it('formata com vírgula, como o croqui', () => {
    expect(formatDistance(27.8)).toBe('27,80');
    expect(formatDistance(27.8, 1)).toBe('27,8');
  });
});

describe('nós', () => {
  it('acrescenta nó e o trecho correspondente', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    let doc = docCom(p);
    doc = edit(doc, (d) => addNode(d, p.id, { x: 20, y: 0 }));
    expect(get(doc, p.id).nodes).toHaveLength(3);
    expect(get(doc, p.id).legs).toHaveLength(2);
  });

  it('insere no meio sem mover as pontas', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);
    let doc = docCom(p);
    doc = edit(doc, (d) => {
      insertNode(d, p.id, 0, { x: 10, y: 5 });
    });
    const depois = get(doc, p.id);
    expect(depois.nodes).toHaveLength(3);
    expect(depois.nodes[0]!.pos).toEqual({ x: 0, y: 0 });
    expect(depois.nodes[2]!.pos).toEqual({ x: 20, y: 0 });
    expect(depois.nodes[1]!.pos).toEqual({ x: 10, y: 5 });
  });

  it('preserva os rótulos já ajustados ao inserir', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);
    let doc = docCom(p);
    doc = edit(doc, (d) => setLegLabel(d, p.id, 0, { decimals: 1, visible: false }));
    doc = edit(doc, (d) => {
      insertNode(d, p.id, 0, { x: 10, y: 0 });
    });
    expect(get(doc, p.id).legs[0]!.label.decimals).toBe(1);
    expect(get(doc, p.id).legs[0]!.label.visible).toBe(false);
  });

  it('não deixa o traçado ficar com menos de dois nós', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    let doc = docCom(p);
    doc = edit(doc, (d) => {
      removeNode(d, p.id, 0);
    });
    expect(get(doc, p.id).nodes).toHaveLength(2);
  });

  it('mover um nó desfaz o vínculo com o obstáculo', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    p.nodes[0]!.anchor = { objectId: 'obs1', ref: 'center' };
    let doc = docCom(p);
    doc = edit(doc, (d) => moveNode(d, p.id, 0, { x: 1, y: 1 }));
    expect(get(doc, p.id).nodes[0]!.anchor).toBeNull();
  });
});

describe('curvas', () => {
  it('nó liso mantém as alças opostas, sem bico', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ]);
    let doc = docCom(p);
    doc = edit(doc, (d) => setNodeType(d, p.id, 1, 'smooth'));
    doc = edit(doc, (d) => moveHandle(d, p.id, 1, 'out', { x: 3, y: 4 }));
    const no = get(doc, p.id).nodes[1]!;
    expect(no.handleOut).toEqual({ x: 3, y: 4 });
    // A oposta aponta exatamente ao contrário: colinear, sem bico. O
    // produto vetorial zerado é a forma direta de dizer isso.
    const cruzado = no.handleIn!.x * no.handleOut!.y - no.handleIn!.y * no.handleOut!.x;
    expect(Math.abs(cruzado)).toBeLessThan(1e-12);
    expect(no.handleIn!.x * no.handleOut!.x + no.handleIn!.y * no.handleOut!.y).toBeLessThan(0);
  });

  it('nó de canto move só a alça mexida', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ]);
    let doc = docCom(p);
    doc = edit(doc, (d) => moveHandle(d, p.id, 1, 'out', { x: 3, y: 4 }));
    const no = get(doc, p.id).nodes[1]!;
    expect(no.handleOut).toEqual({ x: 3, y: 4 });
    expect(no.handleIn).toBeNull();
  });

  it('voltar para canto remove as alças e endireita', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ]);
    let doc = docCom(p);
    doc = edit(doc, (d) => setNodeType(d, p.id, 1, 'smooth'));
    doc = edit(doc, (d) => moveHandle(d, p.id, 1, 'out', { x: 0, y: 8 }));
    const curvo = pathLength(get(doc, p.id));
    doc = edit(doc, (d) => setNodeType(d, p.id, 1, 'corner'));
    expect(pathLength(get(doc, p.id))).toBeLessThan(curvo);
    expect(pathLength(get(doc, p.id))).toBeCloseTo(20, 9);
  });

  it('endireitar um trecho não mexe nos vizinhos', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ]);
    let doc = docCom(p);
    doc = edit(doc, (d) => {
      moveHandle(d, p.id, 0, 'out', { x: 3, y: 6 });
      moveHandle(d, p.id, 1, 'out', { x: 3, y: -6 });
    });
    const segundoAntes = legLength(get(doc, p.id), 1);
    doc = edit(doc, (d) => straightenLeg(d, p.id, 0));
    expect(legLength(get(doc, p.id), 0)).toBeCloseTo(10, 9);
    expect(legLength(get(doc, p.id), 1)).toBeCloseTo(segundoAntes, 9);
  });
});

describe('desenho e envoltória', () => {
  it('o caminho SVG começa em M e usa cúbicas', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    const d = pathD(p, (q) => ({ x: q.x * 5, y: q.y * 5 }));
    expect(d.startsWith('M 0 0')).toBe(true);
    expect(d).toContain('C ');
  });

  it('a envoltória cobre a curva, não só os nós', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);
    const curvo = produce(p, (d) => {
      d.nodes[0]!.handleOut = { x: 0, y: 12 };
      d.nodes[1]!.handleIn = { x: 0, y: 12 };
    });
    const b = getBounds(curvo, 250);
    // Os nós têm y = 0, mas a curva desce bem abaixo disso.
    expect(b.max.y).toBeGreaterThan(3);
  });

  it('o ponto médio do trecho fica sobre a curva', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);
    const curvo = produce(p, (d) => {
      d.nodes[0]!.handleOut = { x: 0, y: 10 };
      d.nodes[1]!.handleIn = { x: 0, y: 10 };
    });
    const meio = legMidpoint(curvo, 0);
    expect(meio.x).toBeCloseTo(10, 6);
    expect(meio.y).toBeGreaterThan(0);
  });

  it('a poligonal acompanha o traçado inteiro', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ]);
    const pontos = flattenPath(p);
    expect(pontos[0]).toEqual({ x: 0, y: 0 });
    expect(pontos[pontos.length - 1]).toEqual({ x: 20, y: 0 });
  });

  it('trecho sem alça é reta exata, não cúbica aproximada', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 3, y: 4 },
    ]);
    const seg = segmentAt(p, 0)!;
    expect(seg.p1).toEqual(seg.p0);
    expect(seg.p2).toEqual(seg.p3);
    expect(legLength(p, 0)).toBe(distance({ x: 0, y: 0 }, { x: 3, y: 4 }));
  });
});

describe('rótulos e estilo', () => {
  it('liga e desliga todos os rótulos de uma vez', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ]);
    let doc = docCom(p);
    doc = edit(doc, (d) => setAllLegLabels(d, p.id, false));
    expect(get(doc, p.id).legs.every((l) => !l.label.visible)).toBe(true);
    doc = edit(doc, (d) => setAllLegLabels(d, p.id, true));
    expect(get(doc, p.id).legs.every((l) => l.label.visible)).toBe(true);
  });

  it('casas decimais ficam dentro do que faz sentido medir', () => {
    const p = reto([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    let doc = docCom(p);
    doc = edit(doc, (d) => setLegLabel(d, p.id, 0, { decimals: 9 }));
    expect(get(doc, p.id).legs[0]!.label.decimals).toBe(3);
    doc = edit(doc, (d) => setLegLabel(d, p.id, 0, { decimals: -2 }));
    expect(get(doc, p.id).legs[0]!.label.decimals).toBe(0);
  });

  it('nasce tracejado, como no croqui profissional', () => {
    expect(reto([{ x: 0, y: 0 }, { x: 1, y: 0 }]).style.dash).toBe('dashed');
  });

  it('espessura degenerada volta ao padrão', () => {
    const p = reto([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    let doc = docCom(p);
    doc = edit(doc, (d) => setPathStyle(d, p.id, { strokeMm: 0 }));
    expect(get(doc, p.id).style.strokeMm).toBe(0.4);
  });

  it('traçado bloqueado não muda', () => {
    const p = reto([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    p.locked = true;
    const doc = docCom(p);
    const next = edit(doc, (d) => {
      moveNode(d, p.id, 0, { x: 99, y: 99 });
      addNode(d, p.id, { x: 50, y: 50 });
    });
    expect(get(next, p.id).nodes).toHaveLength(2);
    expect(get(next, p.id).nodes[0]!.pos).toEqual({ x: 0, y: 0 });
  });
});
