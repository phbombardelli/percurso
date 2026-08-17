import { useState } from 'react';
import { pageRectMm } from '@core/model/document';
import { exportDocumentPdf } from '@platform/exportPdf';
import { printDocument } from '@platform/print';
import {
  newDocument,
  openDocument,
  saveDocument,
  saveDocumentAs,
} from '@ui/actions/documentActions';
import { fitToRect, MAX_ZOOM, MIN_ZOOM, ZOOM_ACTUAL_SIZE } from '@core/scale/viewport';
import { clamp } from '@core/geometry/vec';
import { useDocumentStore } from '@store/documentStore';
import { useEditorStore } from '@store/editorStore';
import { Menu, type MenuEntry } from './Menu';

/**
 * Barra superior. Só fica em botão o que se usa o tempo todo enquanto se
 * desenha: modo, ferramenta de seleção e zoom. O resto vive em menu —
 * a barra vinha crescendo a cada fase e deixou de caber na tela.
 */
export function Toolbar() {
  const { doc, undo, redo, canUndo, canRedo, apply, dirty, fileName } = useDocumentStore();
  const { viewport, setViewport, tool, setTool, showPageFrame, togglePageFrame, mode, setMode } =
    useEditorStore();
  const [busy, setBusy] = useState(false);

  const exportPdf = async () => {
    setBusy(true);
    try {
      await exportDocumentPdf(doc, (fileName ?? 'croqui').replace(/\.[^.]+$/, ''));
    } catch (err) {
      console.error(err);
      window.alert('Não foi possível gerar o PDF. Detalhes no console.');
    } finally {
      setBusy(false);
    }
  };

  const zoomBy = (factor: number) =>
    setViewport({ ...viewport, zoom: clamp(viewport.zoom * factor, MIN_ZOOM, MAX_ZOOM) });

  const fitPage = () => {
    const el = document.querySelector('.canvas-svg') as SVGSVGElement | null;
    if (!el) return;
    setViewport(fitToRect(pageRectMm(doc), { width: el.clientWidth, height: el.clientHeight }));
  };

  const arquivo: MenuEntry[] = [
    { label: 'Novo', shortcut: 'Ctrl+N', onSelect: () => newDocument() },
    { label: 'Abrir…', shortcut: 'Ctrl+O', onSelect: () => void openDocument() },
    'separator',
    { label: 'Salvar', shortcut: 'Ctrl+S', onSelect: () => void saveDocument() },
    { label: 'Salvar como…', shortcut: 'Ctrl+Shift+S', onSelect: () => void saveDocumentAs() },
    'separator',
    {
      label: busy ? 'Exportando…' : 'Exportar PDF…',
      disabled: busy,
      onSelect: () => void exportPdf(),
    },
    { label: 'Imprimir…', onSelect: () => printDocument(doc) },
  ];

  const exibir: MenuEntry[] = [
    {
      label: `${doc.grid.visible ? '✓ ' : '   '}Grid`,
      shortcut: 'G',
      onSelect: () =>
        apply('Alternar grid', (d) => {
          d.grid.visible = !d.grid.visible;
        }),
    },
    {
      label: `${doc.grid.snap ? '✓ ' : '   '}Snap`,
      shortcut: 'S',
      onSelect: () =>
        apply('Alternar snap', (d) => {
          d.grid.snap = !d.grid.snap;
        }),
    },
    {
      label: `${showPageFrame ? '✓ ' : '   '}Limites da página`,
      onSelect: togglePageFrame,
    },
    'separator',
    { label: 'Ajustar à página', shortcut: 'Ctrl+0', onSelect: fitPage },
    { label: 'Tamanho real (1:1)', onSelect: () => setViewport({ ...viewport, zoom: ZOOM_ACTUAL_SIZE }) },
  ];

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <span className="brand">Percurso</span>
      </div>

      <div className="toolbar-group">
        <Menu label="Arquivo" entries={arquivo} />
        <Menu label="Exibir" entries={exibir} />
      </div>

      <div className="toolbar-group">
        <button onClick={undo} disabled={!canUndo()} title="Desfazer (Ctrl+Z)">↶</button>
        <button onClick={redo} disabled={!canRedo()} title="Refazer (Ctrl+Y)">↷</button>
      </div>

      <div className="toolbar-group mode-switch">
        <button
          className={mode === 'pista' ? 'active' : ''}
          onClick={() => setMode('pista')}
          title="Configurar o local: contorno, imagem de referência, árvores"
        >
          Pista
        </button>
        <button
          className={mode === 'percurso' ? 'active' : ''}
          onClick={() => setMode('percurso')}
          title="Desenhar a prova: obstáculos, traçados, partida e chegada"
        >
          Percurso
        </button>
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
      </div>

      {/* O nome do arquivo fica por último: é informação, não comando, e é
          o primeiro item que pode ser espremido numa janela estreita. */}
      <div className="toolbar-group doc-name-group">
        <span className="doc-name" title={fileName ?? 'Sem título'}>
          {fileName ?? 'Sem título'}
          {dirty ? ' •' : ''}
        </span>
      </div>
    </header>
  );
}
