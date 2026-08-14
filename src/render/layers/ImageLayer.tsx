import type { Vec2 } from '@core/geometry/vec';
import type { Asset, BackgroundImage } from '@core/model/types';
import { mmPerMeter } from '@core/scale/units';

interface Props {
  image: BackgroundImage;
  asset: Asset | undefined;
  printScale: number;
  originMm: Vec2;
  onPointerDown?: (e: React.PointerEvent) => void;
}

/**
 * Imagem de referência. O `<image>` é desenhado em pixels do arquivo e
 * levado ao papel por um único `transform`: assim a escala vem inteira de
 * `metersPerPixel`, e não de dois lugares que poderiam divergir.
 *
 * Confirmado na fase 2 que o conversor para PDF embute raster por data URL.
 */
export function ImageLayer({ image, asset, printScale, originMm, onPointerDown }: Props) {
  if (!asset) return null;
  const k = mmPerMeter(printScale);
  const x = originMm.x + image.origin.x * k;
  const y = originMm.y + image.origin.y * k;
  const scale = image.metersPerPixel * k;

  return (
    <g
      data-object={image.id}
      data-kind="image"
      transform={`translate(${round(x)} ${round(y)}) rotate(${image.rotation}) scale(${round(scale)})`}
      opacity={image.opacity}
      onPointerDown={onPointerDown}
      style={{ cursor: image.locked ? 'default' : 'move' }}
    >
      <image
        href={asset.dataUrl}
        x={0}
        y={0}
        width={image.widthPx}
        height={image.heightPx}
        preserveAspectRatio="none"
      />
    </g>
  );
}

const round = (v: number): number => Math.round(v * 1e6) / 1e6;
