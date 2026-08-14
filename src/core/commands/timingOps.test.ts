import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { allTimingLines, createTimingLine, hasTimingRole, timingExtent } from '@core/library/timing';
import { createDocument } from '@core/model/document';
import { getBounds, getRotation, setRotation } from '@core/model/transform';
import type { CourseDocument, TimingLine } from '@core/model/types';
import { addObject } from './ops';
import { setTimingLine, setTimingWings } from './timingOps';

const edit = (doc: CourseDocument, recipe: (d: CourseDocument) => void) => produce(doc, recipe);

function docCom(...linhas: TimingLine[]): CourseDocument {
  return edit(createDocument(), (d) => {
    for (const l of linhas) addObject(d, l);
  });
}

const line = (doc: CourseDocument, id: string) =>
  doc.objects.find((o): o is TimingLine => o.id === id)!;

describe('criação', () => {
  it('partida e chegada nascem com texto próprio', () => {
    expect(createTimingLine('start', { x: 0, y: 0 }).label).toBe('Partida');
    expect(createTimingLine('finish', { x: 0, y: 0 }).label).toBe('Chegada');
  });

  it('nasce com paraflancos, como o obstáculo', () => {
    expect(createTimingLine('start', { x: 0, y: 0 }).wings.style).toBe('paraflanco');
  });

  it('não é obstáculo: não tem altura nem número', () => {
    const l = createTimingLine('start', { x: 0, y: 0 }) as unknown as Record<string, unknown>;
    expect(l.elements).toBeUndefined();
    expect(l.number).toBeUndefined();
  });

  it('encontra as linhas existentes por papel', () => {
    const doc = docCom(createTimingLine('start', { x: 0, y: 0 }));
    expect(allTimingLines(doc)).toHaveLength(1);
    expect(hasTimingRole(doc, 'start')).toBe(true);
    expect(hasTimingRole(doc, 'finish')).toBe(false);
  });
});

describe('ajustes', () => {
  it('largura, texto e papel', () => {
    const l = createTimingLine('start', { x: 0, y: 0 });
    let doc = docCom(l);
    doc = edit(doc, (d) => setTimingLine(d, l.id, { widthM: 12.5, label: 'Largada', role: 'finish' }));
    expect(line(doc, l.id).widthM).toBe(12.5);
    expect(line(doc, l.id).label).toBe('Largada');
    expect(line(doc, l.id).role).toBe('finish');
  });

  it('largura degenerada volta ao padrão', () => {
    const l = createTimingLine('start', { x: 0, y: 0 });
    let doc = docCom(l);
    doc = edit(doc, (d) => setTimingLine(d, l.id, { widthM: 0 }));
    expect(line(doc, l.id).widthM).toBe(8);
  });

  it('linha bloqueada não muda', () => {
    const l = createTimingLine('start', { x: 0, y: 0 });
    l.locked = true;
    const doc = docCom(l);
    const next = edit(doc, (d) => setTimingLine(d, l.id, { widthM: 30 }));
    expect(line(next, l.id).widthM).toBe(8);
  });

  it('aceita vara no chão também na linha', () => {
    const l = createTimingLine('start', { x: 0, y: 0 });
    let doc = docCom(l);
    doc = edit(doc, (d) => setTimingWings(d, l.id, { style: 'nenhum' }));
    expect(line(doc, l.id).wings.style).toBe('nenhum');
  });
});

describe('geometria', () => {
  it('a envoltória cobre a largura entre os paraflancos', () => {
    const l = createTimingLine('start', { x: 20, y: 10 });
    const doc = docCom(l);
    const b = getBounds(line(doc, l.id), 250);
    expect(b.max.x - b.min.x).toBeCloseTo(8, 9);
  });

  it('gira como qualquer objeto', () => {
    const l = createTimingLine('start', { x: 0, y: 0 });
    const doc = docCom(l);
    const obj = line(doc, l.id);
    expect(getRotation(obj)).toBe(0);
    const girada = produce(obj, (o) => setRotation(o, 45));
    expect(getRotation(girada)).toBe(45);
  });

  it('a extensão acompanha a profundidade do paraflanco', () => {
    const l = createTimingLine('start', { x: 0, y: 0 });
    expect(timingExtent(l).backM).toBeCloseTo(l.wings.depthM / 2, 9);
    expect(timingExtent(l).halfWidthM).toBeCloseTo(4, 9);
  });
});
