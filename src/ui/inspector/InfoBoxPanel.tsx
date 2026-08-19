import { courseOrder } from '@core/assist/courseRide';
import { formatDistance, pathLength } from '@core/model/path';
import type { CourseDocument, InfoBox, Obstacle } from '@core/model/types';
import { useDocumentStore } from '@store/documentStore';
import { NumberField } from './NumberField';

/**
 * Valores que o desenho já conhece.
 *
 * Distância é a do traçado desenhado (§19), obstáculos é a contagem de
 * números lançados, e esforços conta cada elemento — a combinação 8ABC é
 * um obstáculo e três esforços. São exatamente os três campos que dão
 * erro quando digitados à mão e depois o percurso muda.
 *
 * Preenche só o que sabe, e só quando pedido: o §44 proíbe validação
 * esportiva, e sobrescrever o que o desenhador digitou seria pior que
 * deixar em branco.
 */
function doDesenho(doc: CourseDocument): Record<string, string> {
  const obstaculos = doc.objects.filter((o): o is Obstacle => o.kind === 'obstacle');
  const degraus = courseOrder(obstaculos);
  const elementos = degraus.reduce((n, d) => n + d.elements.length, 0);
  const tracados = doc.objects.filter((o) => o.kind === 'path');
  const maior = tracados.reduce((m, p) => Math.max(m, p.kind === 'path' ? pathLength(p) : 0), 0);

  const out: Record<string, string> = {
    obstaculos: String(degraus.length),
    esforcos: String(elementos),
  };
  if (maior > 0) out.distancia = `${formatDistance(maior, 0)} m`;
  return out;
}

export function InfoBoxPanel({ box }: { box: InfoBox }) {
  const { doc, apply } = useDocumentStore();
  const travado = box.locked;

  const edita = (rotulo: string, recipe: (b: InfoBox) => void, mergeKey?: string) =>
    apply(
      rotulo,
      (d) => {
        const alvo = d.objects.find((o) => o.id === box.id);
        if (alvo?.kind === 'infobox') recipe(alvo);
      },
      mergeKey,
    );

  const preencher = () => {
    const valores = doDesenho(doc);
    edita('Preencher do desenho', (b) => {
      for (const campo of b.fields) {
        const v = valores[campo.id];
        if (v != null) campo.value = v;
      }
    });
  };

  return (
    <>
      <div className="row-buttons">
        <button
          disabled={travado}
          title="Distância do traçado, número de obstáculos e de esforços, lidos do desenho"
          onClick={preencher}
        >
          Preencher do desenho
        </button>
      </div>

      <h3>Campos</h3>
      <div className="leg-list">
        {box.fields.map((campo, i) => (
          <div className="field-row" key={campo.id}>
            <input
              type="checkbox"
              checked={campo.enabled}
              disabled={travado}
              title={campo.enabled ? 'Esconder este campo' : 'Mostrar este campo'}
              onChange={(e) =>
                edita('Campo do quadro', (b) => {
                  b.fields[i]!.enabled = e.target.checked;
                })
              }
            />
            <span className="field-label" title={campo.label}>
              {campo.label}
            </span>
            <input
              type="text"
              value={campo.value}
              disabled={travado || !campo.enabled}
              onChange={(e) =>
                edita(
                  'Valor do quadro',
                  (b) => {
                    b.fields[i]!.value = e.target.value;
                  },
                  `inf-${box.id}-${campo.id}`,
                )
              }
            />
          </div>
        ))}
      </div>

      <h3>Aparência</h3>
      <NumberField
        label="Largura"
        unit="mm"
        value={box.widthMm}
        decimals={0}
        step={2}
        min={30}
        max={280}
        disabled={travado}
        onCommit={(v) => edita('Largura do quadro', (b) => { b.widthMm = v; })}
      />
      <NumberField
        label="Colunas"
        value={box.columns}
        decimals={0}
        step={1}
        min={1}
        max={4}
        disabled={travado}
        onCommit={(v) => edita('Colunas do quadro', (b) => { b.columns = Math.round(v); })}
      />
      <NumberField
        label="Letra"
        unit="mm"
        value={box.style.sizeMm}
        decimals={1}
        step={0.2}
        min={1.5}
        max={10}
        disabled={travado}
        onCommit={(v) => edita('Letra do quadro', (b) => { b.style.sizeMm = v; })}
      />
      <p className="note dim">
        O quadro é da folha: mudar a escala do croqui não mexe nele.
      </p>
    </>
  );
}
