import { centerOnPage, fitScaleToPage, firstArena } from '@core/model/document';
import { GRID_STEPS } from '@core/geometry/snap';
import { PAGE_FORMATS, STANDARD_SCALES, formatMeters } from '@core/scale/units';
import type { Orientation, PageFormat, SheetCorner } from '@core/scale/units';
import { useDocumentStore } from '@store/documentStore';
import { useEditorStore } from '@store/editorStore';
import { ArenaLibraryPanel } from './ArenaLibraryPanel';
import { InterferencePanel } from './InterferencePanel';
import { ObjectPanel } from './ObjectPanel';

const ROTULO_MARGEM = {
  top: 'Topo',
  right: 'Direita',
  bottom: 'Base',
  left: 'Esquerda',
} as const;

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

        <h3>Margens (mm)</h3>
        <div className="margin-grid">
          {(['top', 'right', 'bottom', 'left'] as const).map((lado) => (
            <label key={lado} className="margin-cell">
              <span>{ROTULO_MARGEM[lado]}</span>
              <input
                type="number"
                min={0}
                step={1}
                value={doc.page.marginsMm[lado]}
                onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0);
                  apply(`Margem ${ROTULO_MARGEM[lado].toLowerCase()}`, (d) => {
                    d.page.marginsMm[lado] = v;
                  });
                }}
              />
            </label>
          ))}
        </div>
        <div className="row-buttons">
          <button
            title="Aplica a margem de cima nos quatro lados"
            onClick={() =>
              apply('Margens iguais', (d) => {
                const v = d.page.marginsMm.top;
                d.page.marginsMm = { top: v, right: v, bottom: v, left: v };
              })
            }
          >
            Igualar
          </button>
        </div>
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

        <label className="check">
          <input
            type="checkbox"
            checked={doc.page.scaleLabel.visible}
            onChange={(e) =>
              apply('Legenda de escala', (d) => {
                d.page.scaleLabel.visible = e.target.checked;
              })
            }
          />
          Imprimir a escala na folha
        </label>
        {doc.page.scaleLabel.visible && (
          <>
            <Field label="Canto">
              <select
                value={doc.page.scaleLabel.corner}
                onChange={(e) =>
                  apply('Canto da legenda', (d) => {
                    d.page.scaleLabel.corner = e.target.value as SheetCorner;
                  })
                }
              >
                <option value="inferior-direito">Inferior direito</option>
                <option value="inferior-esquerdo">Inferior esquerdo</option>
                <option value="superior-direito">Superior direito</option>
                <option value="superior-esquerdo">Superior esquerdo</option>
              </select>
            </Field>
            <label className="check">
              <input
                type="checkbox"
                checked={doc.page.scaleLabel.bar}
                onChange={(e) =>
                  apply('Barra de escala', (d) => {
                    d.page.scaleLabel.bar = e.target.checked;
                  })
                }
              />
              Barra gráfica
            </label>
            <p className="note dim">
              A barra continua certa mesmo se a folha for copiada reduzida;
              o número escrito, não.
            </p>
          </>
        )}
      </section>

      {mode === 'percurso' && <InterferencePanel />}

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
