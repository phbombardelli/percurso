import { OBSTACLES } from '@core/library/obstacles';
import { ORNAMENTS } from '@core/library/ornaments';
import { importBackgroundImage } from '@ui/actions/imageActions';
import { useEditorStore } from '@store/editorStore';

/**
 * Ferramentas de inserção, filtradas pelo momento do trabalho.
 *
 * Configurando a pista aparecem só as ferramentas do local; desenhando o
 * percurso, só as da prova. Encurta a lista e, mais importante, deixa
 * claro o que está em jogo naquele momento.
 */
const PENDENTES: { icon: string; label: string; phase: number }[] = [
  { icon: 'T', label: 'Texto', phase: 10 },
  { icon: '▤', label: 'Quadro técnico', phase: 10 },
  { icon: '▦', label: 'Tabela de alturas', phase: 10 },
];

export function Sidebar() {
  const {
    mode,
    tool,
    setTool,
    ornamentType,
    setOrnamentType,
    obstacleType,
    setObstacleType,
    pathSmooth,
    setPathSmooth,
  } = useEditorStore();

  const alterna = (alvo: typeof tool) => setTool(tool === alvo ? 'select' : alvo);

  if (mode === 'pista') {
    return (
      <nav className="sidebar">
        <p className="sidebar-title">Cenário do local</p>

        <button
          onClick={() => void importBackgroundImage()}
          title="Importa PNG, JPG ou WEBP como camada de referência. O arquivo fica embutido no projeto."
        >
          <span className="icon">🖼</span>
          <span className="label">Imagem de fundo</span>
        </button>

        <button
          className={tool === 'arena-rect' ? 'active' : ''}
          onClick={() => alterna('arena-rect')}
          title="Arraste para definir a pista. As dimensões exatas se digitam no painel."
        >
          <span className="icon">▭</span>
          <span className="label">Pista</span>
        </button>

        <button
          className={tool === 'arena-polygon' ? 'active' : ''}
          onClick={() => alterna('arena-polygon')}
          title="Clique para marcar cada vértice. Enter fecha o contorno, Esc cancela."
        >
          <span className="icon">⬠</span>
          <span className="label">Contorno livre</span>
        </button>

        <button
          className={tool === 'ornament' ? 'active' : ''}
          onClick={() => alterna('ornament')}
          title="Árvores, arbustos e demais elementos fixos do local."
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

        <p className="sidebar-hint">
          O percurso fica esmaecido e não recebe clique enquanto você
          configura o local.
        </p>
      </nav>
    );
  }

  return (
    <nav className="sidebar">
      <p className="sidebar-title">Prova</p>

      <button
        className={tool === 'obstacle' ? 'active' : ''}
        onClick={() => alterna('obstacle')}
        title="Clique na pista para inserir. Shift mantém a ferramenta ativa."
      >
        <span className="icon">▬</span>
        <span className="label">Obstáculo</span>
      </button>

      {tool === 'obstacle' && (
        <div className="tool-options">
          {OBSTACLES.map((o) => (
            <button
              key={o.type}
              className={obstacleType === o.type ? 'active' : ''}
              title={o.hint}
              onClick={() => setObstacleType(o.type)}
            >
              <span className="label">{o.label}</span>
            </button>
          ))}
        </div>
      )}

      <button
        className={tool === 'path' ? 'active' : ''}
        onClick={() => alterna('path')}
        title="Clique para marcar cada nó; arraste ao clicar para curvar. Enter conclui, Esc cancela."
      >
        <span className="icon">✎</span>
        <span className="label">Traçado</span>
      </button>

      {tool === 'path' && (
        <div className="tool-options">
          <button
            className={pathSmooth ? 'active' : ''}
            onClick={() => setPathSmooth(true)}
            title="Os cliques viram uma curva contínua"
          >
            <span className="label">Curvo</span>
          </button>
          <button
            className={!pathSmooth ? 'active' : ''}
            onClick={() => setPathSmooth(false)}
            title="Os cliques viram segmentos retos"
          >
            <span className="label">Reto</span>
          </button>
        </div>
      )}

      <button
        className={tool === 'timing-start' ? 'active' : ''}
        onClick={() => alterna('timing-start')}
        title="Linha de partida: dois paraflancos, o traço entre eles e a seta de passagem."
      >
        <span className="icon">⇥</span>
        <span className="label">Partida</span>
      </button>

      <button
        className={tool === 'timing-finish' ? 'active' : ''}
        onClick={() => alterna('timing-finish')}
        title="Linha de chegada."
      >
        <span className="icon">⇤</span>
        <span className="label">Chegada</span>
      </button>

      {PENDENTES.map((t) => (
        <button key={t.label} disabled title={`${t.label} — fase ${t.phase}`}>
          <span className="icon">{t.icon}</span>
          <span className="label">{t.label}</span>
        </button>
      ))}

      <p className="sidebar-hint">
        A pista é fundo: para mexer nela, volte ao modo Pista.
      </p>
    </nav>
  );
}
