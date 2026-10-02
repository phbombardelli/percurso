import type { Logo } from '@core/model/types';
import { logoHeightMm } from '@core/model/transform';
import { useDocumentStore } from '@store/documentStore';
import { NumberField } from './NumberField';

/** Logo na folha: só o tamanho. A proporção é sempre a do arquivo. */
export function LogoPanel({ logo }: { logo: Logo }) {
  const { doc, apply } = useDocumentStore();
  const asset = doc.assets[logo.assetId];
  return (
    <>
      <NumberField
        label="Largura"
        unit="mm"
        value={logo.widthMm}
        decimals={1}
        step={1}
        min={3}
        disabled={logo.locked}
        onCommit={(v) =>
          apply('Tamanho do logo', (d) => {
            const o = d.objects.find((x) => x.id === logo.id);
            if (o?.kind === 'logo') o.widthMm = Math.max(3, v);
          })
        }
      />
      <p className="note">
        Altura {logoHeightMm(logo).toFixed(1).replace('.', ',')} mm, na proporção do arquivo
        {asset ? ` (${asset.name})` : ''}.
      </p>
      <p className="note dim">
        Fica na folha, em milímetros: não muda quando a escala do desenho muda. Arraste para
        posicionar.
      </p>
    </>
  );
}
