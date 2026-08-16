import type { CourseDocument, ObjectId, SceneObject } from '@core/model/types';
import { isLayerVisible } from '@core/model/document';
import { objectScope } from '@core/model/transform';
import type { ObjectScope } from '@core/model/types';
import { LAYER_ORDER } from '@core/model/types';
import { pageSize } from '@core/scale/units';
import { ArenaLayer } from './layers/ArenaLayer';
import { GridLayer } from './layers/GridLayer';
import { ImageLayer } from './layers/ImageLayer';
import { ObstacleLayer } from './layers/ObstacleLayer';
import { OrnamentLayer } from './layers/OrnamentLayer';
import { PathLayer } from './layers/PathLayer';
import { TimingLayer } from './layers/TimingLayer';
import { color, stroke } from './style/tokens';

/** Ordem de empilhamento: camada primeiro, depois z dentro da camada. */
function sortForRender(doc: CourseDocument): SceneObject[] {
  return [...doc.objects].sort((a, b) => {
    const byLayer = LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer);
    return byLayer !== 0 ? byLayer : a.z - b.z;
  });
}

export type RenderMode = 'screen' | 'paper';

export interface RenderOptions {
  mode: RenderMode;
  doc: CourseDocument;
  selection: ObjectId[];
  /** Área visível em mm; no modo papel é a própria página. */
  viewBoxMm: { x: number; y: number; width: number; height: number };
  metersPerPixel: number;
  showPageFrame: boolean;
  /**
   * Escopo em edição. Objetos de outro escopo viram fundo: não recebem
   * clique e ficam esmaecidos. `null` no modo papel, onde tudo é desenho.
   */
  editScope?: ObjectScope | null;
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

      {sortForRender(doc).map((obj) => {
        if (!isLayerVisible(doc, obj.layer) || !obj.visible) return null;

        // Fora do modo ativo o objeto é cenário: some do alcance do mouse.
        const ativo = opts.editScope == null || objectScope(obj) === opts.editScope;
        const onPointerDown =
          ativo && opts.onObjectPointerDown
            ? (e: React.PointerEvent) => opts.onObjectPointerDown!(obj.id, e)
            : undefined;
        const conteudo = (() => {
        switch (obj.kind) {
          case 'arena':
            return (
              <ArenaLayer
                key={obj.id}
                arena={obj}
                printScale={doc.page.printScale}
                originMm={doc.originMm}
                selected={isSelected(obj.id)}
                onPointerDown={onPointerDown}
              />
            );
          case 'image':
            return (
              <ImageLayer
                key={obj.id}
                image={obj}
                asset={doc.assets[obj.assetId]}
                printScale={doc.page.printScale}
                originMm={doc.originMm}
                onPointerDown={onPointerDown}
              />
            );
          case 'obstacle':
            return (
              <ObstacleLayer
                key={obj.id}
                obstacle={obj}
                printScale={doc.page.printScale}
                originMm={doc.originMm}
                onPointerDown={onPointerDown}
              />
            );
          case 'path':
            return (
              <PathLayer
                key={obj.id}
                path={obj}
                printScale={doc.page.printScale}
                originMm={doc.originMm}
                onPointerDown={onPointerDown}
              />
            );
          case 'timing':
            return (
              <TimingLayer
                key={obj.id}
                line={obj}
                printScale={doc.page.printScale}
                originMm={doc.originMm}
                onPointerDown={onPointerDown}
              />
            );
          case 'ornament':
            return (
              <OrnamentLayer
                key={obj.id}
                ornament={obj}
                printScale={doc.page.printScale}
                originMm={doc.originMm}
                onPointerDown={onPointerDown}
              />
            );
          default:
            return null; // demais tipos entram nas fases seguintes
        }
        })();

        if (conteudo === null) return null;
        return ativo ? (
          conteudo
        ) : (
          <g key={obj.id} pointerEvents="none" opacity={0.45}>
            {conteudo}
          </g>
        );
      })}
    </>
  );
}
