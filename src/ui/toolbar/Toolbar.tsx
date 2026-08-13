import { pageRectMm } from '@core/model/document';
import { fitToRect, MAX_ZOOM, MIN_ZOOM, ZOOM_ACTUAL_SIZE } from '@core/scale/viewport';
import { clamp } from '@core/geometry/vec';
import { useDocumentStore } from '@store/documentStore';
import { useEditorStore } from '@store/editorStore';

export function Toolbar() {
  const { doc, undo, redo, canUndo, canRedo, apply, dirty } = useDocumentStore();
  const { viewport, setViewport, tool, setTool, showPageFrame, togglePageFrame } =
    useEditorStore();

  const zoomBy = (factor: number) =>
    setViewport({ ...viewport, zoom: clamp(viewport.zoom * factor, MIN_ZOOM, MAX_ZOOM) });

  const fitPage = () => {
    const el = document.querySelector('.canvas-svg') as SVGSVGElement | null;
    if (!el) return;
    setViewport(fitToRect(pageRectMm(doc), { width: el.clientWidth, height: el.clientHeight }));
  };

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <span className="brand">Percurso</span>
        <span className="doc-name">
          {useDocumentStore.getState().fileName ?? 'Sem título'}
          {dirty ? ' •' : ''}
        </span>
      </div>

      <div className="toolbar-group">
        <button disabled title="Fase 4">Novo</button>
        <button disabled title="Fase 4">Abrir</button>
        <button disabled title="Fase 4">Salvar</button>
        <button disabled title="Fase 12">Exportar PDF</button>
        <button disabled title="Fase 12">Imprimir</button>
      </div>

      <div className="toolbar-group">
        <button onClick={undo} disabled={!canUndo()} title="Ctrl+Z">↶ Desfazer</button>
        <button onClick={redo} disabled={!canRedo()} title="Ctrl+Y">↷ Refazer</button>
      </div>

      <div className="toolbar-group">
        <button
          className={tool === 'select' ? 'active' : ''}
          onClick={() => setTool('select')}
          title="Selecionar (V)"
        >
          ⬉
        </button>
        <button
          className={tool === 'pan' ? 'active' : ''}
          onClick={() => setTool('pan')}
          title="Mover a vista (espaço)"
        >
          ✋
        </button>
      </div>

      <div className="toolbar-group">
        <button onClick={() => zoomBy(1 / 1.25)} title="Afastar">−</button>
        <span className="readout">{Math.round((viewport.zoom / ZOOM_ACTUAL_SIZE) * 100)}%</span>
        <button onClick={() => zoomBy(1.25)} title="Aproximar">+</button>
        <button onClick={fitPage} title="Ajustar página (Ctrl+0)">Ajustar</button>
        <button
          onClick={() => setViewport({ ...viewport, zoom: ZOOM_ACTUAL_SIZE })}
          title="1 mm de papel = 1 mm na tela"
        >
          1:1
        </button>
      </div>

      <div className="toolbar-group">
        <label className="check">
          <input
            type="checkbox"
            checked={doc.grid.visible}
            onChange={() => apply('Alternar grid', (d) => { d.grid.visible = !d.grid.visible; })}
          />
          Grid
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={doc.grid.snap}
            onChange={() => apply('Alternar snap', (d) => { d.grid.snap = !d.grid.snap; })}
          />
          Snap
        </label>
        <label className="check">
          <input type="checkbox" checked={showPageFrame} onChange={togglePageFrame} />
          Página
        </label>
      </div>
    </header>
  );
}
