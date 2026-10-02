import type { Asset, Logo } from '@core/model/types';
import { logoHeightMm } from '@core/model/transform';

interface Props {
  logo: Logo;
  asset: Asset | undefined;
  onPointerDown?: (e: React.PointerEvent) => void;
}

/**
 * Logo na folha (decisão 55). Posição e tamanho em milímetros de papel,
 * como o quadro técnico: a escala do desenho não mexe nele. Raster por
 * data URL, que o conversor para PDF embute (verificado na fase 2).
 */
export function LogoLayer({ logo, asset, onPointerDown }: Props) {
  if (!asset) return null;
  return (
    <image
      data-object={logo.id}
      data-kind="logo"
      href={asset.dataUrl}
      x={logo.posMm.x}
      y={logo.posMm.y}
      width={logo.widthMm}
      height={logoHeightMm(logo)}
      preserveAspectRatio="none"
      onPointerDown={onPointerDown}
      style={{ cursor: logo.locked ? 'default' : 'move' }}
    />
  );
}
