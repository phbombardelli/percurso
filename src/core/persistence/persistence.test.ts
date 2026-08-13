import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { addObject } from '@core/commands/ops';
import { createOrnament } from '@core/library/ornaments';
import { createDocument } from '@core/model/document';
import type { CourseDocument, CoursePath, TextLabel } from '@core/model/types';
import { SCHEMA_VERSION } from '@core/model/types';
import { CourseFileError, FILE_FORMAT } from './format';
import { applyMigrations, type Migration } from './migrations';
import { deserialize, serialize, suggestedFileName } from './serialize';
import { validateDocument } from './validate';

/** Documento com um objeto de cada tipo que já existe no modelo. */
function richDocument(): CourseDocument {
  return produce(createDocument(), (d) => {
    d.meta.title = 'Longines FEI Jumping World Cup Final';
    d.meta.designer = 'Anderson Lima';
    d.page.printScale = 250;
    d.grid.snapStepM = 0.25;

    addObject(d, createOrnament('arvore', { x: 12.5, y: 7.25 }));
    addObject(d, createOrnament('cronometro', { x: 30, y: 22 }));

    const texto: TextLabel = {
      id: 'txt1', kind: 'text', layer: 'annotations', locked: false, visible: true, z: 0,
      pos: { x: 5, y: 5 }, text: 'Entrada', sizeMm: 3.5, align: 'start',
      rotation: 0, color: '#111111', bold: false,
    };
    addObject(d, texto);

    const traco: CoursePath = {
      id: 'pth1', kind: 'path', layer: 'paths', locked: false, visible: true, z: 0,
      nodes: [
        { pos: { x: 10, y: 10 }, type: 'smooth', handleIn: null, handleOut: { x: 3, y: 0 }, anchor: null },
        { pos: { x: 25.75, y: 18.4 }, type: 'corner', handleIn: { x: -2, y: -1 }, handleOut: null, anchor: null },
      ],
      legs: [{ fromNode: 0, toNode: 1, label: { visible: true, offsetM: { x: 0, y: -1 }, decimals: 2, color: '#d32020' } }],
      style: { dash: 'dashed', strokeMm: 0.35, color: '#6b6b6b' },
    };
    addObject(d, traco);
  });
}

describe('ida e volta', () => {
  it('reabre exatamente o que foi salvo', () => {
    const original = richDocument();
    const { document, warnings } = deserialize(serialize(original));
    expect(warnings).toEqual([]);
    expect(document).toEqual(original);
  });

  it('preserva os decimais das coordenadas sem arredondar', () => {
    const original = richDocument();
    const { document } = deserialize(serialize(original));
    const path = document.objects.find((o): o is CoursePath => o.kind === 'path')!;
    expect(path.nodes[1]!.pos).toEqual({ x: 25.75, y: 18.4 });
    expect(path.nodes[0]!.handleOut).toEqual({ x: 3, y: 0 });
  });

  it('preserva imagens embutidas', () => {
    const withAsset = produce(richDocument(), (d) => {
      d.assets.img1 = {
        mime: 'image/png',
        dataUrl: 'data:image/png;base64,AAAA',
        width: 800,
        height: 600,
        name: 'satelite.png',
      };
    });
    const { document } = deserialize(serialize(withAsset));
    expect(document.assets.img1).toEqual(withAsset.assets.img1);
  });

  it('o arquivo é JSON legível, com envelope e versão', () => {
    const text = serialize(createDocument());
    const parsed = JSON.parse(text);
    expect(parsed.format).toBe(FILE_FORMAT);
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(text).toContain('\n  '); // indentado
  });
});

describe('recusa de arquivos', () => {
  it('rejeita texto que não é JSON', () => {
    expect(() => deserialize('isto não é json')).toThrow(CourseFileError);
  });

  it('rejeita JSON de outro programa', () => {
    expect(() => deserialize(JSON.stringify({ foo: 1 }))).toThrow(
      /não é um projeto do Percurso/,
    );
  });

  it('rejeita arquivo de versão futura, sem tentar adivinhar', () => {
    const text = serialize(createDocument()).replace(
      `"schemaVersion": ${SCHEMA_VERSION}`,
      `"schemaVersion": ${SCHEMA_VERSION + 5}`,
    );
    expect(() => deserialize(text)).toThrow(/versão mais nova/);
  });

  it('rejeita escala de impressão inválida em vez de abrir torto', () => {
    const doc = JSON.parse(serialize(createDocument()));
    doc.document.page.printScale = 0;
    expect(() => deserialize(JSON.stringify(doc))).toThrow(/escala de impressão/);
  });

  it('rejeita coordenada não numérica', () => {
    const doc = JSON.parse(serialize(richDocument()));
    const orn = doc.document.objects.find((o: { kind: string }) => o.kind === 'ornament');
    orn.pos.x = 'meio-metro';
    expect(() => deserialize(JSON.stringify(doc))).toThrow(/posição inválida/);
  });

  it('rejeita identificadores repetidos', () => {
    const doc = JSON.parse(serialize(richDocument()));
    doc.document.objects[2].id = doc.document.objects[1].id;
    expect(() => deserialize(JSON.stringify(doc))).toThrow(/mesmo identificador/);
  });
});

describe('tolerância ao que é acessório', () => {
  it('ignora objeto de tipo desconhecido e avisa', () => {
    const doc = JSON.parse(serialize(richDocument()));
    doc.document.objects.push({ id: 'x1', kind: 'holograma', layer: 'annotations', z: 9 });
    const { document, warnings } = deserialize(JSON.stringify(doc));
    expect(document.objects.some((o) => o.id === 'x1')).toBe(false);
    expect(warnings.join(' ')).toMatch(/holograma/);
  });

  it('restaura camadas ausentes', () => {
    const doc = JSON.parse(serialize(richDocument()));
    delete doc.document.layers;
    const { document, warnings } = deserialize(JSON.stringify(doc));
    expect(document.layers.length).toBeGreaterThan(0);
    expect(warnings.join(' ')).toMatch(/Camadas/);
  });

  it('corrige camada desconhecida de um objeto', () => {
    const doc = JSON.parse(serialize(richDocument()));
    const orn = doc.document.objects.find((o: { kind: string }) => o.kind === 'ornament');
    orn.layer = 'camada-que-nao-existe';
    const { document, warnings } = deserialize(JSON.stringify(doc));
    expect(document.objects.find((o) => o.id === orn.id)!.layer).toBe('ornaments');
    expect(warnings.join(' ')).toMatch(/camada/i);
  });
});

describe('migrações', () => {
  const tabela: Record<number, Migration> = {
    1: (d) => ({ ...d, campoNovo: 'veio da migração 1→2' }),
    2: (d) => ({ ...d, outroCampo: 42 }),
  };

  it('aplica a cadeia na ordem', () => {
    const out = applyMigrations({ a: 1 }, 1, 3, tabela);
    expect(out).toEqual({ a: 1, campoNovo: 'veio da migração 1→2', outroCampo: 42 });
  });

  it('não faz nada quando já está na versão atual', () => {
    expect(applyMigrations({ a: 1 }, 3, 3, tabela)).toEqual({ a: 1 });
  });

  it('falha claramente quando falta um degrau, dizendo qual', () => {
    expect(() => applyMigrations({ a: 1 }, 1, 4, tabela)).toThrow(CourseFileError);
    try {
      applyMigrations({ a: 1 }, 1, 4, tabela);
    } catch (err) {
      expect((err as CourseFileError).detail).toMatch(/versão 3 para a 4/);
    }
  });

  it('recusa versão futura', () => {
    expect(() => applyMigrations({ a: 1 }, 9, 3, tabela)).toThrow(/versão mais nova/);
  });
});

describe('nome de arquivo sugerido', () => {
  it('tira acentos e espaços do título', () => {
    const doc = produce(createDocument(), (d) => {
      d.meta.title = 'Grande Prêmio São João — 1ª Etapa';
    });
    expect(suggestedFileName(doc)).toBe('grande-premio-sao-joao-1a-etapa');
  });

  it('cai para um nome padrão quando não há título', () => {
    expect(suggestedFileName(createDocument())).toBe('croqui');
  });
});

describe('validação direta', () => {
  it('aceita um documento recém-criado', () => {
    const { warnings } = validateDocument(JSON.parse(JSON.stringify(createDocument())));
    expect(warnings).toEqual([]);
  });
});
