import { newId } from '@core/model/ids';
import type { Ornament, OrnamentType } from '@core/model/types';
import type { Vec2 } from '@core/geometry/vec';

/**
 * Elementos de pista. São puramente gráficos: não têm lógica esportiva e
 * não participam de nenhum cálculo. A biblioteca cresce na fase 11.
 */
export interface OrnamentDef {
  type: OrnamentType;
  label: string;
  /** Tamanho padrão em metros (diâmetro/lado da envoltória). */
  defaultSizeM: number;
  defaultColor: string;
  /** Rotacionar não altera a aparência de formas radialmente simétricas. */
  rotatable: boolean;
}

export const ORNAMENTS: readonly OrnamentDef[] = [
  { type: 'arvore', label: 'Árvore', defaultSizeM: 3, defaultColor: '#3f7d3f', rotatable: false },
  { type: 'arbusto', label: 'Arbusto', defaultSizeM: 1.6, defaultColor: '#5a9448', rotatable: false },
  { type: 'vaso', label: 'Vaso', defaultSizeM: 1, defaultColor: '#7a6a52', rotatable: true },
  { type: 'cerca', label: 'Cerca', defaultSizeM: 4, defaultColor: '#6b6b6b', rotatable: true },
  { type: 'cronometro', label: 'Cronômetro', defaultSizeM: 1.2, defaultColor: '#111111', rotatable: false },
  { type: 'seta', label: 'Seta', defaultSizeM: 3, defaultColor: '#d32020', rotatable: true },
] as const;

export const ornamentDef = (type: OrnamentType): OrnamentDef =>
  ORNAMENTS.find((o) => o.type === type) ?? ORNAMENTS[0]!;

export function createOrnament(type: OrnamentType, pos: Vec2): Ornament {
  const def = ornamentDef(type);
  return {
    id: newId('orn'),
    kind: 'ornament',
    layer: 'ornaments',
    locked: false,
    visible: true,
    scope: 'pista',
    z: 0,
    type,
    pos,
    rotation: 0,
    sizeM: def.defaultSizeM,
    color: def.defaultColor,
  };
}
