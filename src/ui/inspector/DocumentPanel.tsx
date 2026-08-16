import { centerOnPage, fitScaleToPage, firstArena } from '@core/model/document';
import { GRID_STEPS } from '@core/geometry/snap';
import { PAGE_FORMATS, STANDARD_SCALES, formatMeters } from '@core/scale/units';
import type { Orientation, PageFormat } from '@core/scale/units';
import { useDocumentStore } from '@store/documentStore';
import { useEditorStore } from '@store/editorStore';
import { ArenaLibraryPanel } from './ArenaLibraryPanel';
import { ObjectPanel } from './ObjectPanel';

export function DocumentPanel() {
  const { doc, apply } = useDocumentStore();
  const mode = useEditorStore((s) => s.mode);
  const arena = firstArena(doc);

  return (
    <aside className="panel">
      <ObjectPanel />
      {mode === 'pista' && <ArenaLibraryPanel />}
      <h2>Documento</h2>

      <section>
        <h3>Página</h3>
        <Field label="Formato">
          <select
            value={doc.page.format}
            onChange={(e) =>
              apply('Formato da página', (d) => {
                d.page.format = e.target.value as PageFormat;
              })
            }
          >
            {Object.keys(PAGE_FORMATS).map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
            <option value="custom">Personalizado</option>
          </select>
        </Field>

        <Field label="Orientação">
          <select
            value={doc.page.orientation}
            onChange={(e) =>
              apply('Orientação', (d) => {
                d.page.orientation = e.target.value as Orientation;
              })
            }
          >
            <option value="landscape">Paisagem</option>
            <option value="portrait">Retrato</option>
          </select>
        </Field>

        <Field label="Margens (mm)">
          <input
            type="number"
            min={0}
            step={1}
            value={doc.page.marginsMm.top}
            onChange={(e) => {
              const v = Number(e.target.value) || 0;
              apply('Margens', (d) => {
                d.page.marginsMm = { top: v, right: v, bottom: v, left: v };
              });
            }}
          />
        </Field>
      </section>

      <section>
        <h3>Escala de impressão</h3>
        <Field label="Escala">
          <div className="inline">
            <span>1:</span>
            <select
              value={STANDARD_SCALES.includes(doc.page.printScale) ? doc.page.printScale : 'custom'}
              onChange={(e) => {
                if (e.target.value === 'custom') return;
                apply('Escala de impressão', (d) => {
                  d.page.printScale = Number(e.target.value);
                });
              }}
            >
              {STANDARD_SCALES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              {!STANDARD_SCALES.includes(doc.page.printScale) && (
                <option value="custom">{doc.page.printScale}</option>
              )}
            </select>
          </div>
        </Field>
        <div className="row-buttons">
          <button
            onClick={() =>
              apply('Ajustar escala ao papel', (d) => {
                d.page.printScale = fitScaleToPage(d);
                centerOnPage(d);
              })
            }
          >
            Ajustar ao papel
          </button>
          <button onClick={() => apply('Centralizar na página', centerOnPage)}>
            Centralizar
          </button>
        </div>
        <p className="note">
          1 m no terreno = {formatMeters(1000 / doc.page.printScale, 2)} mm no papel.
        </p>
      </section>

      <section>
        <h3>Grid e snap</h3>
        <Field label="Espaçamento">
          <select
            value={doc.grid.stepM}
            onChange={(e) =>
              apply('Espaçamento do grid', (d) => {
                d.grid.stepM = Number(e.target.value);
              })
            }
          >
            <option value={0}>Automático</option>
            {GRID_STEPS.map((s) => (
              <option key={s} value={s}>{formatMeters(s, s < 1 ? 2 : 0)} m</option>
            ))}
          </select>
        </Field>
        <Field label="Linha forte a cada">
          <input
            type="number"
            min={2}
            max={20}
            value={doc.grid.subdivisions}
            onChange={(e) =>
              apply('Subdivisões do grid', (d) => {
                d.grid.subdivisions = Math.max(2, Number(e.target.value) || 2);
              })
            }
          />
        </Field>
        <Field label="Passo do snap">
          <select
            value={doc.grid.snapStepM}
            onChange={(e) =>
              apply('Passo do snap', (d) => {
                d.grid.snapStepM = Number(e.target.value);
              })
            }
          >
            {GRID_STEPS.map((s) => (
              <option key={s} value={s}>{formatMeters(s, s < 1 ? 2 : 0)} m</option>
            ))}
          </select>
        </Field>
        <Field label="Snap de ângulo">
          <select
            value={doc.grid.angleSnapDeg}
            onChange={(e) =>
              apply('Snap de ângulo', (d) => {
                d.grid.angleSnapDeg = Number(e.target.value);
              })
            }
          >
            {[1, 5, 10, 15, 22.5, 30, 45, 90].map((a) => (
              <option key={a} value={a}>{a}°</option>
            ))}
          </select>
        </Field>
      </section>

      {arena && (
        <section>
          <h3>Pista</h3>
          <p className="note">
            {formatMeters(arena.widthM, 0)} × {formatMeters(arena.heightM, 0)} m ·{' '}
            {formatMeters(arena.widthM * arena.heightM, 0)} m²
          </p>
          <p className="note dim">Edição da pista na fase 5.</p>
        </section>
      )}
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
