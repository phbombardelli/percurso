import type { Vec2 } from '@core/geometry/vec';
import { newId } from '@core/model/ids';
import type { InfoBox, InfoBoxField, HeightTable, TextLabel } from '@core/model/types';

/**
 * Anotações da folha: texto livre, quadro técnico e tabela de alturas.
 *
 * Duas decisões vêm do próprio modelo e valem repetir aqui, porque
 * explicam o porquê de dois sistemas de coordenadas convivendo:
 *
 * - O TEXTO livre mora em metros do terreno. Ele nomeia coisas da pista
 *   ("entrada", "aquecimento") e tem que acompanhar o desenho quando a
 *   escala muda.
 * - O QUADRO e a TABELA moram em milímetros de papel. Eles são da folha,
 *   não do terreno: mudar a escala do croqui não pode encolher a letra do
 *   quadro técnico nem tirá-lo do canto onde foi posto.
 */

export function createTextLabel(pos: Vec2, text = 'Texto'): TextLabel {
  return {
    id: newId('txt'),
    kind: 'text',
    layer: 'annotations',
    locked: false,
    visible: true,
    scope: 'percurso',
    z: 0,
    pos,
    text,
    sizeMm: 3.5,
    align: 'start',
    rotation: 0,
    color: '#23282d',
    bold: false,
  };
}

const campo = (id: string, label: string, value = ''): InfoBoxField => ({
  id,
  label,
  value,
  enabled: true,
});

/**
 * Campos do quadro técnico, na ordem em que os croquis os imprimem.
 *
 * Vêm dos planos oficiais (CBH e FEI): prova, tabela e artigo, altura,
 * velocidade, distância, tempo concedido e limite, número de obstáculos e
 * de esforços, e o desenhador. Nem toda prova usa todos — por isso cada
 * campo tem `enabled`, e desligar é mais rápido que digitar.
 *
 * A lista é um PONTO DE PARTIDA, não uma regra: o §44 proíbe validação
 * esportiva, então o programa não confere nada disso. Quem manda é quem
 * assina o croqui.
 */
export const CAMPOS_PADRAO: InfoBoxField[] = [
  campo('prova', 'Prova'),
  campo('tabela', 'Tabela'),
  campo('artigo', 'Artigo'),
  campo('altura', 'Altura'),
  campo('velocidade', 'Velocidade', '350 m/min'),
  campo('distancia', 'Distância'),
  campo('tempo', 'Tempo concedido'),
  campo('limite', 'Tempo limite'),
  campo('obstaculos', 'Obstáculos'),
  campo('esforcos', 'Esforços'),
  campo('desenhador', 'Desenhador'),
];

export function createInfoBox(posMm: Vec2): InfoBox {
  return {
    id: newId('inf'),
    kind: 'infobox',
    layer: 'annotations',
    locked: false,
    visible: true,
    scope: 'percurso',
    z: 0,
    posMm,
    widthMm: 78,
    columns: 1,
    fields: CAMPOS_PADRAO.map((f) => ({ ...f })),
    style: { sizeMm: 3, borderMm: 0.3 },
  };
}

export function createHeightTable(posMm: Vec2): HeightTable {
  return {
    id: newId('alt'),
    kind: 'heighttable',
    layer: 'annotations',
    locked: false,
    visible: true,
    scope: 'percurso',
    z: 0,
    posMm,
    elementColumns: 2,
    showSpread: true,
    showNote: false,
    style: { sizeMm: 2.6, rowHeightMm: 5 },
  };
}
