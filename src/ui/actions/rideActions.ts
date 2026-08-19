import { addObject } from '@core/commands/ops';
import { buildCourseRide } from '@core/assist/courseRide';
import { DEFAULT_RIDE, type RideParams, type RideWarning } from '@core/assist/ridePath';
import { formatDistance, pathLength } from '@core/model/path';
import { useDocumentStore } from '@store/documentStore';
import { useEditorStore } from '@store/editorStore';

const MOTIVO: Record<RideWarning, string> = {
  'fora-da-pista': 'a volta não cabe dentro da pista',
  'passa-por-obstaculo': 'a volta passa por cima de outro obstáculo',
};

/**
 * Traça o percurso inteiro pela numeração já lançada.
 *
 * O resultado é um traçado comum, editável nó a nó — o assistente é ponto
 * de partida, não caixa-preta. Quando alguma volta não fecha, ela é
 * desenhada assim mesmo e o problema é dito: o desenhador precisa ver
 * ONDE está o aperto para decidir o que mudar na pista.
 */
export function traceCourse(params: RideParams = DEFAULT_RIDE): void {
  const { doc, apply } = useDocumentStore.getState();
  const resultado = buildCourseRide(doc, params);

  if (!resultado) {
    window.alert(
      'Não há o que traçar ainda.\n\n' +
        'O assistente segue a numeração dos obstáculos: numere pelo menos ' +
        'dois deles, ou acrescente partida e chegada.',
    );
    return;
  }

  apply('Assistente de traçado', (d) => addObject(d, resultado.path));
  useEditorStore.getState().setSelection([resultado.path.id]);

  if (resultado.problems.length > 0) {
    const lista = resultado.problems
      .map((p) => `  ${p.where}: ${MOTIVO[p.warning]}`)
      .join('\n');
    window.alert(
      `Traçado desenhado: ${resultado.stops.join(' - ')}\n` +
        `${formatDistance(pathLength(resultado.path))} m\n\n` +
        `Estas voltas não fecham como estão:\n${lista}\n\n` +
        'O traçado foi desenhado assim mesmo, para você ver onde está o aperto.',
    );
  }
}
