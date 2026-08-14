import { formatHeights, labelOffset, obstacleLabel } from '@core/library/obstacles';
import { rotate, type Vec2 } from '@core/geometry/vec';
import type { Obstacle } from '@core/model/types';
import { mmPerMeter } from '@core/scale/units';
import { JumpArrow, ObstacleShape } from '@render/symbols/obstacleShapes';
import { color, font, text } from '@render/style/tokens';

interface Props {
  obstacle: Obstacle;
  printScale: number;
  originMm: Vec2;
  onPointerDown?: (e: React.PointerEvent) => void;
}

export function ObstacleLayer({ obstacle, printScale, originMm, onPointerDown }: Props) {
  const k = mmPerMeter(printScale);
  const cx = originMm.x + obstacle.pos.x * k;
  const cy = originMm.y + obstacle.pos.y * k;

  const numero = obstacleLabel(obstacle);
  const alturas = formatHeights(obstacle);

  // O deslocamento do rótulo é local: gira com o obstáculo para continuar
  // fugindo do corpo e da seta. O TEXTO em si nunca gira.
  const numeroEm = rotate(labelOffset(obstacle, 'numberLabel'), obstacle.rotation);
  const alturasEm = rotate(labelOffset(obstacle, 'heightLabel'), obstacle.rotation);

  return (
    <g data-object={obstacle.id} data-kind="obstacle">
      {/* Corpo e seta giram com o obstáculo. */}
      <g
        transform={`translate(${round(cx)} ${round(cy)}) rotate(${obstacle.rotation})`}
        onPointerDown={onPointerDown}
        style={{ cursor: obstacle.locked ? 'default' : 'move' }}
      >
        <ObstacleShape obstacle={obstacle} k={k} />
        {obstacle.arrow.visible && <JumpArrow obstacle={obstacle} k={k} />}
      </g>

      {/*
        Rótulos NÃO giram: número e alturas têm de continuar legíveis com o
        obstáculo em qualquer ângulo, como no croqui de referência. O
        deslocamento é em metros, medido a partir do centro.
      */}
      {obstacle.numberLabel.visible && numero !== '' && (
        <text
          x={round(cx + numeroEm.x * k)}
          y={round(cy + numeroEm.y * k)}
          fontFamily={font.family}
          fontSize={text.medium}
          fontWeight="bold"
          fill={color.ink}
          textAnchor="middle"
          dominantBaseline="middle"
          pointerEvents="none"
        >
          {numero}
        </text>
      )}

      {obstacle.heightLabel.visible && alturas !== '' && (
        <text
          x={round(cx + alturasEm.x * k)}
          y={round(cy + alturasEm.y * k)}
          fontFamily={font.family}
          fontSize={text.small}
          fill={color.height}
          textAnchor="middle"
          dominantBaseline="middle"
          pointerEvents="none"
        >
          {alturas}
        </text>
      )}
    </g>
  );
}

const round = (v: number): number => Math.round(v * 1000) / 1000;
