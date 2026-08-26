import { OBSTACLES } from '@core/library/obstacles';
import { ORNAMENTS } from '@core/library/ornaments';
import { importBackgroundImage } from '@ui/actions/imageActions';
import { traceCourse } from '@ui/actions/rideActions';
import { insertHeightTable, insertInfoBox } from '@ui/actions/annotationActions';
import { insertTimingLine, TIMING_LIMITS } from '@ui/actions/timingActions';
import { startGuidedRide } from '@ui/actions/guidedActions';
import { clampTimingDistance } from '@core/library/timing';
import { useEditorStore } from '@store/editorStore';

/**
 * Ferramentas de inserção, filtradas pelo momento do trabalho.
 *
 * Configurando a pista aparecem só as ferramentas do local; desenhando o
 * percurso, só as da prova. Encurta a lista e, mais importante, deixa
 * claro o que está em jogo naquele momento.
 */
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
    timingDistanceM,
    setTimingDistance,
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
        className={tool === 'text' ? 'active' : ''}
        onClick={() => alterna('text')}
        title="Clique na pista para inserir um texto livre. O texto acompanha o desenho quando a escala muda."
      >
        <span className="icon">T</span>
        <span className="label">Texto</span>
      </button>

      <button
        onClick={startGuidedRide}
        title="Percorre o percurso pernada a pernada e mostra as formas de fazer cada volta, para você escolher."
      >
        <span className="icon">◑</span>
        <span className="label">Por trechos</span>
      </button>

      <button
        onClick={() => traceCourse()}
        title="Desenha a linha que o cavaleiro faria, seguindo a numeração já lançada: partida, obstáculos em ordem, chegada. O resultado é um traçado comum, que você pode editar."
      >
        <span className="icon">➰</span>
        <span className="label">Assistente</span>
      </button>

      <button
        onClick={() => insertTimingLine('start')}
        title="Coloca a partida no eixo do PRIMEIRO obstáculo, à distância escolhida da vara de entrada. Não se clica na pista: o lugar é consequência do percurso."
      >
        <span className="icon">⇥</span>
        <span className="label">Partida</span>
      </button>

      <button
        onClick={() => insertTimingLine('finish')}
        title="Coloca a chegada no eixo do ÚLTIMO obstáculo, medida da vara de saída."
      >
        <span className="icon">⇤</span>
        <span className="label">Chegada</span>
      </button>

      <label className="tool-options timing-distance">
        <span>Distância</span>
        <input
          type="number"
          min={TIMING_LIMITS.min}
          max={TIMING_LIMITS.max}
          step={TIMING_LIMITS.passo}
          value={timingDistanceM}
          onChange={(e) => setTimingDistance(clampTimingDistance(Number(e.target.value) || 0))}
        />
        <em>m</em>
      </label>

      <button
        onClick={insertInfoBox}
        title="Quadro técnico da prova: tabela, altura, velocidade, distância, tempo. Fica na folha, no canto da margem."
      >
        <span className="icon">▤</span>
        <span className="label">Quadro técnico</span>
      </button>

      <button
        onClick={insertHeightTable}
        title="Tabela de alturas por obstáculo. Lê os obstáculos do desenho: mudou a altura, a tabela muda junto."
      >
        <span className="icon">▦</span>
        <span className="label">Tabela de alturas</span>
      </button>

      <p className="sidebar-hint">
        A pista é fundo: para mexer nela, volte ao modo Pista.
      </p>
    </nav>
  );
}
