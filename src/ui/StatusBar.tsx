import { visibleGridStep } from '@core/geometry/snap';
import { formatMeters, pageSize } from '@core/scale/units';
import { metersPerPixel } from '@core/scale/viewport';
import { useDocumentStore } from '@store/documentStore';
import { useEditorStore } from '@store/editorStore';

export function StatusBar() {
  const doc = useDocumentStore((s) => s.doc);
  const { cursorM, viewport, snapSuspended } = useEditorStore();

  const mpp = metersPerPixel(viewport, doc.page.printScale);
  const step = doc.grid.stepM > 0 ? doc.grid.stepM : visibleGridStep(mpp, 8);
  const { widthMm, heightMm } = pageSize(doc.page);
  const snapOn = doc.grid.snap && !snapSuspended;

  return (
    <footer className="statusbar">
      <span className="mono">
        {cursorM
          ? `X ${formatMeters(cursorM.x)} m   Y ${formatMeters(cursorM.y)} m`
          : 'X —   Y —'}
      </span>
      <span>Grid {formatMeters(step, step < 1 ? 2 : 0)} m</span>
      <span>
        Snap {snapOn ? `${formatMeters(doc.grid.snapStepM, 2)} m` : 'desligado'}
        {snapSuspended ? ' (Alt)' : ''}
      </span>
      <span>Escala 1:{doc.page.printScale}</span>
      <span>
        {doc.page.format} {doc.page.orientation === 'landscape' ? 'paisagem' : 'retrato'} ·{' '}
        {widthMm}×{heightMm} mm
      </span>
      <span className="spacer" />
      <span className="hint">
        roda = zoom · espaço/botão do meio = mover · Alt = suspender snap · G grid · S snap
      </span>
    </footer>
  );
}
