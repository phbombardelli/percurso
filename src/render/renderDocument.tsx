import type { CourseDocument, ObjectId } from '@core/model/types';
import { isLayerVisible } from '@core/model/document';
import { pageSize } from '@core/scale/units';
import { ArenaLayer } from './layers/ArenaLayer';
import { GridLayer } from './layers/GridLayer';
import { color, stroke } from './style/tokens';

export type RenderMode = 'screen' | 'paper';

export interface RenderOptions {
  mode: RenderMode;
  doc: CourseDocument;
  selection: ObjectId[];
  /** Área visível em mm; no modo papel é a própria página. */
  viewBoxMm: { x: number; y: number; width: number; height: number };
  metersPerPixel: number;
  showPageFrame: boolean;
  onObjectPointerDown?: (id: ObjectId, e: React.PointerEvent) => void;
}

/**
 * Fonte única de renderização: a tela, a impressão e a exportação em PDF
 * consomem esta mesma função. Não existe um gerador de PDF paralelo que
 * possa divergir do que se vê na tela.
 */
export function RenderDocument(opts: RenderOptions) {
  const { doc, mode, selection, viewBoxMm, metersPerPixel, showPageFrame } = opts;
  const { widthMm, heightMm } = pageSize(doc.page);
  const isSelected = (id: ObjectId) => selection.includes(id);

  return (
    <>
      {mode === 'screen' && showPageFrame && (
        <g data-layer="page" pointerEvents="none">
          <rect
            x={0}
            y={0}
            width={widthMm}
            height={heightMm}
            fill={color.paper}
            stroke="#9aa0a6"
            strokeWidth={stroke.thin}
          />
          <rect
            x={doc.page.marginsMm.left}
            y={doc.page.marginsMm.top}
            width={widthMm - doc.page.marginsMm.left - doc.page.marginsMm.right}
            height={heightMm - doc.page.marginsMm.top - doc.page.marginsMm.bottom}
            fill="none"
            stroke="#c8ccd0"
            strokeWidth={stroke.hairline}
            strokeDasharray="2 2"
          />
        </g>
      )}
      {mode === 'paper' && (
        <rect x={0} y={0} width={widthMm} height={heightMm} fill={color.paper} />
      )}

      {mode === 'screen' && (
        <GridLayer
          grid={doc.grid}
          printScale={doc.page.printScale}
          originMm={doc.originMm}
          viewBoxMm={viewBoxMm}
          metersPerPixel={metersPerPixel}
        />
      )}

      {doc.objects.map((obj) => {
        if (!isLayerVisible(doc, obj.layer) || !obj.visible) return null;
        switch (obj.kind) {
          case 'arena':
            return (
              <ArenaLayer
                key={obj.id}
                arena={obj}
                printScale={doc.page.printScale}
                originMm={doc.originMm}
                selected={isSelected(obj.id)}
                onPointerDown={
                  opts.onObjectPointerDown
                    ? (e) => opts.onObjectPointerDown!(obj.id, e)
                    : undefined
                }
              />
            );
          default:
            return null; // demais tipos entram nas fases seguintes
        }
      })}
    </>
  );
}
