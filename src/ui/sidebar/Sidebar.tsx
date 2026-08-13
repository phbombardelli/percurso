import { ORNAMENTS } from '@core/library/ornaments';
import { useEditorStore } from '@store/editorStore';

/**
 * Ferramentas de inserção. Cada item é habilitado na fase em que o objeto
 * correspondente passa a existir no modelo.
 */
const PENDING: { icon: string; label: string; phase: number }[] = [
  { icon: '▭', label: 'Pista', phase: 5 },
  { icon: '🖼', label: 'Imagem de fundo', phase: 6 },
  { icon: '⌗', label: 'Calibrar escala', phase: 6 },
  { icon: '▬', label: 'Obstáculo', phase: 7 },
  { icon: '✎', label: 'Traçado', phase: 8 },
  { icon: 'T', label: 'Texto', phase: 10 },
  { icon: '▤', label: 'Quadro técnico', phase: 10 },
  { icon: '▦', label: 'Tabela de alturas', phase: 10 },
];

export function Sidebar() {
  const { tool, setTool, ornamentType, setOrnamentType } = useEditorStore();

  return (
    <nav className="sidebar">
      {PENDING.map((t) => (
        <button key={t.label} disabled title={`${t.label} — fase ${t.phase}`}>
          <span className="icon">{t.icon}</span>
          <span className="label">{t.label}</span>
        </button>
      ))}

      <button
        className={tool === 'ornament' ? 'active' : ''}
        onClick={() => setTool(tool === 'ornament' ? 'select' : 'ornament')}
        title="Clique na pista para inserir. Shift mantém a ferramenta ativa."
      >
        <span className="icon">🌳</span>
        <span className="label">Ornamento</span>
      </button>

      {tool === 'ornament' && (
        <div className="tool-options">
          {ORNAMENTS.map((o) => (
            <button
              key={o.type}
              className={ornamentType === o.type ? 'active' : ''}
              onClick={() => setOrnamentType(o.type)}
            >
              <span className="label">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
