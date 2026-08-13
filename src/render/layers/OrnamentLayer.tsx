import type { Vec2 } from '@core/geometry/vec';
import type { Ornament } from '@core/model/types';
import { mmPerMeter } from '@core/scale/units';
import { OrnamentShape } from '@render/symbols/ornamentShapes';

interface Props {
  ornament: Ornament;
  printScale: number;
  originMm: Vec2;
  onPointerDown?: (e: React.PointerEvent) => void;
}

export function OrnamentLayer({ ornament, printScale, originMm, onPointerDown }: Props) {
  const k = mmPerMeter(printScale);
  const x = originMm.x + ornament.pos.x * k;
  const y = originMm.y + ornament.pos.y * k;
  // A forma é desenhada em raio 1; escala leva ao tamanho real em papel.
  const s = (ornament.sizeM / 2) * k;

  return (
    <g
      data-object={ornament.id}
      data-kind="ornament"
      transform={`translate(${round(x)} ${round(y)}) rotate(${ornament.rotation}) scale(${round(s)})`}
      onPointerDown={onPointerDown}
      style={{ cursor: 'move' }}
    >
      <OrnamentShape type={ornament.type} color={ornament.color} />
    </g>
  );
}

const round = (v: number): number => Math.round(v * 1000) / 1000;
