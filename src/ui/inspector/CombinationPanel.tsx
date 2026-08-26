import { alignCombination, currentGaps, orderAlongLine } from '@core/commands/alignOps';
import { obstacleLabel } from '@core/library/obstacles';
import type { Obstacle } from '@core/model/types';
import { useDocumentStore } from '@store/documentStore';
import { NumberField } from './NumberField';

/**
 * Combinação e linha reta.
 *
 * A distância se mede de VARA A VARA: da vara de saída do anterior até a
 * vara de entrada do seguinte. É o vão que o cavalo galopa, e é o número
 * que vai para o croqui — num oxer largo, medir pelo centro erraria mais
 * de uma passada.
 *
 * Os campos mostram a distância que os obstáculos têm agora, e digitar
 * outra JÁ ajusta o croqui: é o gesto de quem está montando a combinação,
 * e obrigar a um segundo clique só atrasaria.
 *
 * A ordem é a da NUMERAÇÃO do percurso, não a da geometria: 1, 2, 3a, 3b,
 * 4, 5a, 5b, 5c. É o percurso que diz quem vem antes.
 */
export function CombinationPanel({ obstacles }: { obstacles: Obstacle[] }) {
  const { apply } = useDocumentStore();
  const ordenados = orderAlongLine(obstacles);
  const vaos = currentGaps(ordenados);
  const travado = ordenados.some((o) => o.locked);
  const ids = ordenados.map((o) => o.id);

  /**
   * Digitar a distância JÁ aplica: os elementos se ajustam no croqui.
   *
   * Não há estado próprio no painel — os campos mostram o que o documento
   * tem. Guardar um rascunho aqui dentro criaria duas verdades, e a do
   * painel ficaria velha assim que alguém arrastasse um obstáculo.
   */
  const ajusta = (indice: number, metros: number) =>
    apply('Distância da combinação', (d) =>
      alignCombination(
        d,
        ids,
        vaos.map((v, i) => (i === indice ? metros : v)),
      ),
    );

  const nome = (o: Obstacle, i: number) => obstacleLabel(o) || `elemento ${i + 1}`;

  return (
    <section className="object-panel">
      <h3>Composto ou linha reta</h3>

      <p className="note">Na ordem do percurso: {ordenados.map(nome).join(' - ')}</p>

      {ordenados.slice(1).map((o, i) => (
        <NumberField
          key={o.id}
          label={`${nome(ordenados[i]!, i)} - ${nome(o, i + 1)}`}
          unit="m"
          value={vaos[i] ?? 0}
          decimals={2}
          step={0.1}
          disabled={travado}
          onCommit={(v) => ajusta(i, v)}
        />
      ))}

      <div className="row-buttons">
        <button
          disabled={travado}
          title="Põe os elementos em linha e na mesma inclinação, sem mudar as distâncias"
          onClick={() => apply('Alinhar combinação', (d) => alignCombination(d, ids, vaos))}
        >
          Endireitar
        </button>
      </div>

      <p className="note dim">
        Da vara de saída de um até a vara de entrada do seguinte. O primeiro
        elemento não se move: os outros se acertam em relação a ele.
      </p>
    </section>
  );
}
