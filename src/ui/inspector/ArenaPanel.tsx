import {
  convertArenaToPolygon,
  removeArenaVertex,
  setArenaCorner,
  setArenaSize,
  setArenaStyle,
  setPerimeterRuler,
} from '@core/commands/arenaOps';
import { arenaArea, arenaPerimeter } from '@core/model/arena';
import type { Arena, CornerStyle } from '@core/model/types';
import { formatMeters } from '@core/scale/units';
import { useDocumentStore } from '@store/documentStore';
import { useEditorStore } from '@store/editorStore';
import { NumberField } from './NumberField';

const CORNER_LABEL: Record<CornerStyle, string> = {
  square: 'Reto',
  chamfer: 'Chanfrado',
  rounded: 'Arredondado',
};

export function ArenaPanel({ arena }: { arena: Arena }) {
  const { apply } = useDocumentStore();
  const { editingVertices, setEditingVertices } = useEditorStore();
  const ruler = arena.perimeterRuler;

  return (
    <>
      {arena.shape === 'rectangle' ? (
        <>
          <NumberField
            label="Largura"
            unit="m"
            value={arena.widthM}
            decimals={2}
            step={1}
            min={1}
            disabled={arena.locked}
            onCommit={(v) => apply('Largura da pista', (d) => setArenaSize(d, arena.id, v, arena.heightM))}
          />
          <NumberField
            label="Comprimento"
            unit="m"
            value={arena.heightM}
            decimals={2}
            step={1}
            min={1}
            disabled={arena.locked}
            onCommit={(v) => apply('Comprimento da pista', (d) => setArenaSize(d, arena.id, arena.widthM, v))}
          />
        </>
      ) : (
        <>
          <p className="note">{arena.points.length} vértices.</p>
          <div className="row-buttons">
            <button
              className={editingVertices ? 'active' : ''}
              onClick={() => setEditingVertices(!editingVertices)}
            >
              {editingVertices ? 'Concluir vértices' : 'Editar vértices'}
            </button>
          </div>
          {editingVertices && (
            <p className="note dim">
              Arraste um vértice para movê-lo. Duplo clique no meio de uma aresta
              insere um vértice novo.
            </p>
          )}
        </>
      )}

      <h3>Cantos</h3>
      <label className="field">
        <span>Tipo</span>
        <select
          value={arena.corner.style}
          disabled={arena.locked}
          onChange={(e) =>
            apply('Canto da pista', (d) =>
              setArenaCorner(d, arena.id, { style: e.target.value as CornerStyle }),
            )
          }
        >
          {(Object.keys(CORNER_LABEL) as CornerStyle[]).map((s) => (
            <option key={s} value={s}>{CORNER_LABEL[s]}</option>
          ))}
        </select>
      </label>
      {arena.corner.style !== 'square' && (
        <NumberField
          label="Corte"
          unit="m"
          value={arena.corner.radiusM}
          decimals={2}
          step={0.5}
          min={0}
          disabled={arena.locked}
          onCommit={(v) => apply('Corte do canto', (d) => setArenaCorner(d, arena.id, { radiusM: v }))}
        />
      )}

      <h3>Régua de perímetro</h3>
      <label className="check">
        <input
          type="checkbox"
          checked={ruler.visible}
          onChange={() =>
            apply('Régua de perímetro', (d) =>
              setPerimeterRuler(d, arena.id, { visible: !ruler.visible }),
            )
          }
        />
        Mostrar no croqui
      </label>
      {ruler.visible && (
        <>
          <NumberField
            label="Marca a cada"
            unit="m"
            value={ruler.stepM}
            decimals={1}
            step={1}
            min={0.5}
            onCommit={(v) => apply('Passo da régua', (d) => setPerimeterRuler(d, arena.id, { stepM: v }))}
          />
          <NumberField
            label="Número a cada"
            unit="m"
            value={ruler.labelEveryM}
            decimals={1}
            step={1}
            min={0}
            onCommit={(v) =>
              apply('Rótulos da régua', (d) => setPerimeterRuler(d, arena.id, { labelEveryM: v }))
            }
          />
          <div className="side-toggles">
            {(['top', 'left', 'right', 'bottom'] as const).map((side) => (
              <label key={side} className="check">
                <input
                  type="checkbox"
                  checked={ruler.sides[side]}
                  onChange={() =>
                    apply('Lados da régua', (d) =>
                      setPerimeterRuler(d, arena.id, {
                        sides: { ...ruler.sides, [side]: !ruler.sides[side] },
                      }),
                    )
                  }
                />
                {SIDE_LABEL[side]}
              </label>
            ))}
          </div>
        </>
      )}

      <h3>Traço</h3>
      <NumberField
        label="Espessura"
        unit="mm"
        value={arena.style.strokeMm}
        decimals={2}
        step={0.05}
        min={0.05}
        disabled={arena.locked}
        onCommit={(v) => apply('Traço da pista', (d) => setArenaStyle(d, arena.id, { strokeMm: v }))}
      />
      <label className="field">
        <span>Preenchimento</span>
        <input
          type="color"
          value={arena.style.fill}
          disabled={arena.locked}
          onChange={(e) =>
            apply('Cor da pista', (d) => setArenaStyle(d, arena.id, { fill: e.target.value }))
          }
        />
      </label>

      <p className="note">
        Perímetro {formatMeters(arenaPerimeter(arena), 1)} m · área{' '}
        {formatMeters(arenaArea(arena), 0)} m²
      </p>

      {arena.shape === 'rectangle' && (
        <div className="row-buttons">
          <button
            disabled={arena.locked}
            title="Materializa os quatro vértices para edição livre. Não tem volta."
            onClick={() => {
              apply('Converter em contorno livre', (d) => convertArenaToPolygon(d, arena.id));
              setEditingVertices(true);
            }}
          >
            Converter em contorno livre
          </button>
        </div>
      )}
      {arena.shape === 'polygon' && editingVertices && arena.points.length > 3 && (
        <div className="row-buttons">
          <button
            onClick={() =>
              apply('Remover vértice', (d) => {
                removeArenaVertex(d, arena.id, arena.points.length - 1);
              })
            }
          >
            Remover último vértice
          </button>
        </div>
      )}
    </>
  );
}

const SIDE_LABEL = {
  top: 'Cima',
  left: 'Esq.',
  right: 'Dir.',
  bottom: 'Baixo',
} as const;
