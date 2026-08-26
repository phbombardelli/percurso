import { useEffect, useState } from 'react';
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
 * Os campos nascem com a distância que os obstáculos já têm, para poder
 * partir do desenho e só arredondar. Nada é aplicado sozinho: alinhar
 * move obstáculo, e mover obstáculo alheio sem pedir seria demais.
 */
export function CombinationPanel({ obstacles }: { obstacles: Obstacle[] }) {
  const { apply } = useDocumentStore();
  const ordenados = orderAlongLine(obstacles);
  const atuais = currentGaps(ordenados);
  const travado = ordenados.some((o) => o.locked);

  const [vaos, setVaos] = useState<number[]>(atuais);
  const chave = ordenados.map((o) => o.id).join('|');

  // Trocou a seleção: recomeça das distâncias que os novos já têm.
  useEffect(() => {
    setVaos(currentGaps(orderAlongLine(obstacles)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const nome = (o: Obstacle, i: number) => obstacleLabel(o) || `elemento ${i + 1}`;

  return (
    <section className="object-panel">
      <h3>{ordenados.length === 2 ? 'Duplo ou linha reta' : 'Triplo ou linha reta'}</h3>

      <p className="note">
        Na ordem do salto: {ordenados.map(nome).join(' - ')}
      </p>

      {ordenados.slice(1).map((o, i) => (
        <NumberField
          key={o.id}
          label={`${nome(ordenados[i]!, i)} - ${nome(o, i + 1)}`}
          unit="m"
          value={vaos[i] ?? 0}
          decimals={2}
          step={0.1}
          disabled={travado}
          onCommit={(v) =>
            setVaos((antes) => {
              const proximo = [...antes];
              proximo[i] = v;
              return proximo;
            })
          }
        />
      ))}

      <div className="row-buttons">
        <button
          disabled={travado}
          title="Põe os elementos em linha, na mesma inclinação, nas distâncias acima"
          onClick={() =>
            apply('Alinhar combinação', (d) =>
              alignCombination(d, ordenados.map((o) => o.id), vaos),
            )
          }
        >
          Alinhar
        </button>
        <button
          disabled={travado}
          title="Volta os campos para a distância que os obstáculos têm agora"
          onClick={() => setVaos(currentGaps(orderAlongLine(obstacles)))}
        >
          Medir
        </button>
      </div>

      <p className="note dim">
        Da vara de saída de um até a vara de entrada do seguinte. O primeiro
        elemento não se move: os outros se acertam em relação a ele.
      </p>
    </section>
  );
}
