import { useCallback, useEffect, useMemo, useRef } from 'react';
import { snapPoint, toMillimeterPrecision } from '@core/geometry/snap';
import type { Vec2 } from '@core/geometry/vec';
import { pageRectMm } from '@core/model/document';
import {
  fitToRect,
  metersPerPixel as mppOf,
  panBy,
  screenToModel,
  viewBox,
  viewBoxAttr,
  zoomAt,
} from '@core/scale/viewport';
import { RenderDocument } from '@render/renderDocument';
import { color } from '@render/style/tokens';
import { useDocumentStore } from '@store/documentStore';
import { useEditorStore } from '@store/editorStore';
import { useElementSize } from '@ui/hooks/useElementSize';
import { RULER_SIZE, Rulers } from './Rulers';

const ZOOM_STEP = 1.12;

export function Canvas() {
  const doc = useDocumentStore((s) => s.doc);
  const { viewport, setViewport, tool, selection, setSelection, cursorM, setCursor, showPageFrame } =
    useEditorStore();

  const { ref, size: wrapSize } = useElementSize<HTMLDivElement>();
  /**
   * Tamanho do SVG, já descontadas as réguas. TODA a matemática de
   * viewport usa este valor — usar o tamanho do contêiner em um lugar e o
   * do SVG em outro desloca o cursor e o zoom em meia régua.
   */
  const size = useMemo(
    () => ({
      width: Math.max(0, wrapSize.width - RULER_SIZE),
      height: Math.max(0, wrapSize.height - RULER_SIZE),
    }),
    [wrapSize.width, wrapSize.height],
  );
  const svgRef = useRef<SVGSVGElement | null>(null);
  const panState = useRef<{ pointerId: number; last: Vec2 } | null>(null);
  const spaceDown = useRef(false);

  const localPoint = useCallback((e: { clientX: number; clientY: number }): Vec2 => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect
      ? { x: e.clientX - rect.left, y: e.clientY - rect.top }
      : { x: 0, y: 0 };
  }, []);

  const fitPage = useCallback(() => {
    if (size.width > 0) setViewport(fitToRect(pageRectMm(doc), size));
  }, [doc, size, setViewport]);

  // Enquadra a página no primeiro layout válido.
  const didFit = useRef(false);
  useEffect(() => {
    if (!didFit.current && size.width > 0 && size.height > 0 && wrapSize.width > 0) {
      didFit.current = true;
      fitPage();
    }
  }, [size, wrapSize.width, fitPage]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      setViewport(zoomAt(viewport, localPoint(e), factor, size));
    },
    [viewport, size, setViewport, localPoint],
  );

  const wantsPan = (e: React.PointerEvent) =>
    tool === 'pan' || e.button === 1 || spaceDown.current;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (wantsPan(e)) {
        e.preventDefault();
        (e.target as Element).setPointerCapture?.(e.pointerId);
        panState.current = { pointerId: e.pointerId, last: { x: e.clientX, y: e.clientY } };
        return;
      }
      // Clique no vazio limpa a seleção; objetos param o evento antes daqui.
      if (e.button === 0 && selection.length > 0) setSelection([]);
    },
    [tool, selection, setSelection],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pan = panState.current;
      if (pan && pan.pointerId === e.pointerId) {
        setViewport(
          panBy(viewport, { x: e.clientX - pan.last.x, y: e.clientY - pan.last.y }),
        );
        pan.last = { x: e.clientX, y: e.clientY };
        return;
      }
      const raw = screenToModel(localPoint(e), viewport, size, doc.page.printScale, doc.originMm);
      const snapped =
        doc.grid.snap && !useEditorStore.getState().snapSuspended
          ? snapPoint(raw, doc.grid.snapStepM)
          : raw;
      setCursor({ x: toMillimeterPrecision(snapped.x), y: toMillimeterPrecision(snapped.y) });
    },
    [viewport, size, doc, setViewport, setCursor, localPoint],
  );

  const endPan = useCallback((e: React.PointerEvent) => {
    if (panState.current?.pointerId === e.pointerId) panState.current = null;
  }, []);

  // Atalhos de teclado do canvas.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const ed = useEditorStore.getState();
      const st = useDocumentStore.getState();

      if (e.code === 'Space') {
        spaceDown.current = true;
        return;
      }
      if (e.altKey) ed.setSnapSuspended(true);

      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        st.undo();
      } else if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        st.redo();
      } else if (e.key === '0' && ctrl) {
        e.preventDefault();
        fitPage();
      } else if (e.key === 'g' || e.key === 'G') {
        st.apply('Alternar grid', (d) => {
          d.grid.visible = !d.grid.visible;
        });
      } else if (e.key === 's' || e.key === 'S') {
        if (ctrl) return;
        st.apply('Alternar snap', (d) => {
          d.grid.snap = !d.grid.snap;
        });
      } else if (e.key === 'Escape') {
        ed.clearSelection();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = false;
      if (!e.altKey) useEditorStore.getState().setSnapSuspended(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [fitPage]);

  const mpp = mppOf(viewport, doc.page.printScale);
  const box = viewBox(viewport, size);

  return (
    <div className="canvas-wrap" ref={ref}>
      <div className="canvas-inner" style={{ left: RULER_SIZE, top: RULER_SIZE }}>
        <svg
          ref={svgRef}
          className="canvas-svg"
          width={size.width}
          height={size.height}
          viewBox={viewBoxAttr(viewport, size)}
          style={{ background: color.canvasBg, cursor: tool === 'pan' ? 'grab' : 'default' }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onPointerLeave={() => setCursor(null)}
        >
          <RenderDocument
            mode="screen"
            doc={doc}
            selection={selection}
            viewBoxMm={box}
            metersPerPixel={mpp}
            showPageFrame={showPageFrame}
            onObjectPointerDown={(id, e) => {
              if (wantsPan(e)) return;
              e.stopPropagation();
              setSelection(e.shiftKey ? [...new Set([...selection, id])] : [id]);
            }}
          />
        </svg>
      </div>

      <Rulers
        viewport={viewport}
        size={size}
        printScale={doc.page.printScale}
        originMm={doc.originMm}
        metersPerPixel={mpp}
        cursorM={cursorM}
      />
    </div>
  );
}
