import type { Vec2 } from '@core/geometry/vec';
import { newId } from '@core/model/ids';
import type { CourseDocument, TimingLine, WingsAppearance } from '@core/model/types';

/**
 * Linhas de partida e chegada.
 *
 * São entidade própria, não obstáculo: não têm altura, não entram na
 * tabela de alturas e não recebem número de percurso. Compartilham o
 * sistema local do obstáculo (X ao longo da linha, salto/passagem para
 * −Y) para que paraflancos e seta se comportem igual.
 */

export const TIMING_ROLES = [
  { role: 'start' as const, label: 'Partida', defaultText: 'Partida' },
  { role: 'finish' as const, label: 'Chegada', defaultText: 'Chegada' },
];

const defaultWings = (): WingsAppearance => ({
  style: 'paraflanco',
  widthM: 0.4,
  depthM: 0.8,
  color: '#2e7d32',
});

export function createTimingLine(
  role: 'start' | 'finish',
  pos: Vec2,
  label?: string,
): TimingLine {
  return {
    id: newId('tim'),
    kind: 'timing',
    layer: 'obstacles',
    locked: false,
    visible: true,
    z: 0,
    role,
    pos,
    rotation: 0,
    widthM: 8,
    label: label ?? (role === 'start' ? 'Partida' : 'Chegada'),
    labelVisible: true,
    wings: defaultWings(),
    // Vermelha, como nos croquis: distingue a cronometragem do percurso.
    arrow: { visible: true, reversed: false, lengthMm: 7 },
    style: { dash: 'dotted', strokeMm: 0.35, color: '#d32020' },
  };
}

/** Extensão local, em metros — a base da envoltória e da seta. */
export function timingExtent(line: TimingLine): {
  halfWidthM: number;
  frontM: number;
  backM: number;
} {
  const meia = line.wings.style === 'paraflanco' ? line.wings.depthM / 2 : 0.3;
  return { halfWidthM: line.widthM / 2, frontM: -meia, backM: meia };
}

export const allTimingLines = (doc: CourseDocument): TimingLine[] =>
  doc.objects.filter((o): o is TimingLine => o.kind === 'timing');

/** Já existe uma linha desse papel? Serve para o aviso, não para bloquear. */
export const hasTimingRole = (doc: CourseDocument, role: 'start' | 'finish'): boolean =>
  allTimingLines(doc).some((l) => l.role === role);
