import { useMemo } from 'react';
import { findInterferences } from '@core/assist/interference';
import { useDocumentStore } from '@store/documentStore';
import { useEditorStore } from '@store/editorStore';

/**
 * Lista de interferências.
 *
 * O marcador no desenho diz ONDE; esta lista diz O QUÊ. Clicar seleciona
 * os objetos envolvidos, que é o passo seguinte natural: quem viu o
 * problema quer mexer na peça.
 *
 * Não impede nada nem propõe conserto. O §44 proíbe validação esportiva,
 * e mesmo o que é geometria pura pode ser intencional — obstáculo de
 * decoração encostado no alambrado, por exemplo.
 */
export function InterferencePanel() {
  const doc = useDocumentStore((s) => s.doc);
  const { showInterference, toggleInterference, setSelection } = useEditorStore();
  const achados = useMemo(() => findInterferences(doc), [doc]);

  return (
    <section>
      <h3>Interferências</h3>

      <label className="check">
        <input type="checkbox" checked={showInterference} onChange={toggleInterference} />
        Marcar no desenho
      </label>

      {achados.length === 0 ? (
        <p className="note">Nada atravessado. O percurso está limpo.</p>
      ) : (
        <ul className="issue-list">
          {achados.map((achado, i) => (
            <li key={i}>
              <button onClick={() => setSelection(achado.ids)} title="Selecionar o que está envolvido">
                {achado.message}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="note dim">
        Os avisos são de tela: não saem no PDF nem na impressão.
      </p>
    </section>
  );
}
