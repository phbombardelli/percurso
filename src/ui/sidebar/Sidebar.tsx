import { ORNAMENTS } from '@core/library/ornaments';
import { importBackgroundImage } from '@ui/actions/imageActions';
import { useEditorStore } from '@store/editorStore';

/**
 * Ferramentas de inserção. Cada item é habilitado na fase em que o objeto
 * correspondente passa a existir no modelo.
 */
const PENDING: { icon: string; label: string; phase: number }[] = [
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
        onClick={() => void importBackgroundImage()}
        title="Importa PNG, JPG ou WEBP como camada de referência. O arquivo fica embutido no projeto."
      >
        <span className="icon">🖼</span>
        <span className="label">Imagem de fundo</span>
      </button>

      <button
        className={tool === 'arena-rect' ? 'active' : ''}
        onClick={() => setTool(tool === 'arena-rect' ? 'select' : 'arena-rect')}
        title="Arraste na área de trabalho para definir a pista. As dimensões exatas se digitam no painel."
      >
        <span className="icon">▭</span>
        <span className="label">Pista</span>
      </button>

      <button
        className={tool === 'arena-polygon' ? 'active' : ''}
        onClick={() => setTool(tool === 'arena-polygon' ? 'select' : 'arena-polygon')}
        title="Clique para marcar cada vértice. Enter fecha o contorno, Esc cancela."
      >
        <span className="icon">⬠</span>
        <span className="label">Contorno livre</span>
      </button>

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
