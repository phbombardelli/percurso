import {
  addElement,
  flipArrow,
  removeElement,
  setArrow,
  setElementHeight,
  setFaceWidth,
  setLabelVisible,
  setObstacleLetter,
  setObstacleNote,
  setObstacleNumber,
  setObstacleType,
  setSpread,
} from '@core/commands/obstacleOps';
import { OBSTACLES, formatHeights, obstacleDef } from '@core/library/obstacles';
import type { Obstacle, ObstacleType } from '@core/model/types';
import { useDocumentStore } from '@store/documentStore';
import { NumberField } from './NumberField';

const LETRAS: Obstacle['letter'][] = ['', 'A', 'B', 'C'];

export function ObstaclePanel({ obstacle }: { obstacle: Obstacle }) {
  const { apply } = useDocumentStore();
  const def = obstacleDef(obstacle.type);
  const travado = obstacle.locked;

  return (
    <>
      <label className="field">
        <span>Tipo</span>
        <select
          value={obstacle.type}
          disabled={travado}
          onChange={(e) =>
            apply('Tipo do obstáculo', (d) =>
              setObstacleType(d, obstacle.id, e.target.value as ObstacleType),
            )
          }
        >
          {OBSTACLES.map((o) => (
            <option key={o.type} value={o.type}>{o.label}</option>
          ))}
        </select>
      </label>
      <p className="note dim">{def.hint}</p>

      <h3>Identificação</h3>
      <label className="field">
        <span>Número</span>
        <input
          type="text"
          value={obstacle.number}
          disabled={travado}
          placeholder="livre"
          onChange={(e) =>
            apply(
              'Número do obstáculo',
              (d) => setObstacleNumber(d, obstacle.id, e.target.value),
              `numero-${obstacle.id}`,
            )
          }
        />
      </label>
      <label className="field">
        <span>Letra</span>
        <select
          value={obstacle.letter}
          disabled={travado}
          onChange={(e) =>
            apply('Letra do obstáculo', (d) =>
              setObstacleLetter(d, obstacle.id, e.target.value as Obstacle['letter']),
            )
          }
        >
          {LETRAS.map((l) => (
            <option key={l || 'sem'} value={l}>{l === '' ? 'nenhuma' : l}</option>
          ))}
        </select>
      </label>
      <p className="note dim">
        A letra marca a combinação: 4A, 4B. O programa não interpreta a
        sequência — ela é sua.
      </p>

      <h3>Medidas</h3>
      <NumberField
        label="Largura da frente"
        unit="m"
        value={obstacle.faceWidthM}
        decimals={2}
        step={0.1}
        min={0.5}
        disabled={travado}
        onCommit={(v) => apply('Largura do obstáculo', (d) => setFaceWidth(d, obstacle.id, v))}
      />
      <label className="check">
        <input
          type="checkbox"
          checked={obstacle.spreadM !== null}
          disabled={travado}
          onChange={(e) =>
            apply('Largura de salto', (d) =>
              setSpread(d, obstacle.id, e.target.checked ? (def.spreadM ?? 1.5) : null),
            )
          }
        />
        Tem largura de salto
      </label>
      {obstacle.spreadM !== null && (
        <NumberField
          label="Largura"
          unit="m"
          value={obstacle.spreadM}
          decimals={2}
          step={0.1}
          min={0.1}
          disabled={travado}
          onCommit={(v) => apply('Largura de salto', (d) => setSpread(d, obstacle.id, v))}
        />
      )}

      <h3>Alturas</h3>
      {obstacle.elements.length === 0 && (
        <p className="note dim">Este obstáculo não tem altura.</p>
      )}
      {obstacle.elements.map((el, i) => (
        <div className="element-row" key={i}>
          <NumberField
            label={`Elemento ${i + 1}`}
            unit="m"
            value={el.height ?? 0}
            decimals={2}
            step={0.05}
            min={0}
            disabled={travado}
            onCommit={(v) =>
              apply('Altura do elemento', (d) =>
                setElementHeight(d, obstacle.id, i, v > 0 ? v : null),
              )
            }
          />
          <button
            className="mini"
            title="Remover este elemento"
            disabled={travado}
            onClick={() => apply('Remover elemento', (d) => removeElement(d, obstacle.id, i))}
          >
            ×
          </button>
        </div>
      ))}
      <div className="row-buttons">
        <button
          disabled={travado || obstacle.elements.length >= 6}
          onClick={() => apply('Acrescentar elemento', (d) => addElement(d, obstacle.id))}
        >
          Acrescentar elemento
        </button>
      </div>
      {formatHeights(obstacle) !== '' && (
        <p className="note">No croqui: {formatHeights(obstacle)}</p>
      )}

      <h3>Direção do salto</h3>
      <label className="check">
        <input
          type="checkbox"
          checked={obstacle.arrow.visible}
          disabled={travado}
          onChange={(e) =>
            apply('Seta', (d) => setArrow(d, obstacle.id, { visible: e.target.checked }))
          }
        />
        Mostrar a seta
      </label>
      {obstacle.arrow.visible && (
        <>
          <div className="row-buttons">
            <button disabled={travado} onClick={() => apply('Inverter a seta', (d) => flipArrow(d, obstacle.id))}>
              Inverter direção
            </button>
          </div>
          <NumberField
            label="Comprimento"
            unit="mm"
            value={obstacle.arrow.lengthMm}
            decimals={1}
            step={0.5}
            min={1}
            disabled={travado}
            onCommit={(v) => apply('Tamanho da seta', (d) => setArrow(d, obstacle.id, { lengthMm: v }))}
          />
          <p className="note dim">
            A seta é perpendicular à frente e gira junto com o obstáculo.
          </p>
        </>
      )}

      <h3>Rótulos</h3>
      <label className="check">
        <input
          type="checkbox"
          checked={obstacle.numberLabel.visible}
          disabled={travado}
          onChange={(e) =>
            apply('Rótulo do número', (d) =>
              setLabelVisible(d, obstacle.id, 'numberLabel', e.target.checked),
            )
          }
        />
        Número no desenho
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={obstacle.heightLabel.visible}
          disabled={travado}
          onChange={(e) =>
            apply('Rótulo das alturas', (d) =>
              setLabelVisible(d, obstacle.id, 'heightLabel', e.target.checked),
            )
          }
        />
        Alturas no desenho
      </label>

      <h3>Observação</h3>
      <input
        type="text"
        className="full"
        value={obstacle.note}
        disabled={travado}
        placeholder="ex.: liverpool"
        onChange={(e) =>
          apply(
            'Observação',
            (d) => setObstacleNote(d, obstacle.id, e.target.value),
            `obs-${obstacle.id}`,
          )
        }
      />
    </>
  );
}
