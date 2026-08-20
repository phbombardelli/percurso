import { useMemo } from 'react';
import { findInterferences } from '@core/assist/interference';
import { mmPerMeter } from '@core/scale/units';
import { useDocumentStore } from '@store/documentStore';
import { useEditorStore } from '@store/editorStore';

interface Props {
  /** Pixels por milímetro de papel: mantém o marcador do mesmo tamanho na tela. */
  zoom: number;
}

/**
 * Marcadores de interferência.
 *
 * Fica no OVERLAY, e não no desenho: aviso é ferramenta de trabalho, não
 * parte do croqui. Nunca sai no PDF nem na impressão — um alerta impresso
 * viraria erro na folha entregue à comissão.
 *
 * O tamanho é fixo em pixels de tela, como todo o cromo: o marcador serve
 * para ser visto e clicado, não para ser medido.
 */
export function InterferenceOverlay({ zoom }: Props) {
  const doc = useDocumentStore((s) => s.doc);
  const { showInterference, setSelection } = useEditorStore();

  const achados = useMemo(
    () => (showInterference ? findInterferences(doc) : []),
    [doc, showInterference],
  );
  if (achados.length === 0) return null;

  const k = mmPerMeter(doc.page.printScale);
  const mm = (px: number) => px / zoom;

  return (
    <g data-part="interference">
      {achados.map((achado, i) => {
        const x = doc.originMm.x + achado.at.x * k;
        const y = doc.originMm.y + achado.at.y * k;
        const r = mm(11);
        return (
          <g
            key={i}
            transform={`translate(${round(x)} ${round(y)})`}
            style={{ cursor: 'pointer' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setSelection(achado.ids);
            }}
          >
            <title>{achado.message}</title>
            <circle
              r={r}
              fill="#fdecec"
              fillOpacity={0.85}
              stroke="#c62828"
              strokeWidth={mm(1.4)}
            />
            <text
              y={r * 0.36}
              fontSize={r * 1.15}
              fontWeight={700}
              fill="#c62828"
              textAnchor="middle"
              pointerEvents="none"
            >
              !
            </text>
          </g>
        );
      })}
    </g>
  );
}

const round = (v: number): number => Math.round(v * 1000) / 1000;
