import { addImage } from '@core/commands/imageOps';
import { arenaExtent } from '@core/model/arena';
import { firstArena } from '@core/model/document';
import { ImageImportError, pickImage } from '@platform/imageImport';
import { useDocumentStore } from '@store/documentStore';
import { useEditorStore } from '@store/editorStore';

/**
 * Importa a imagem de referência e já a posiciona cobrindo a pista, com
 * largura igual à dela: é o enquadramento que quase sempre se quer, e
 * poupa o usuário de caçar a imagem pelo canvas antes de calibrar.
 */
export async function importBackgroundImage(): Promise<void> {
  try {
    const imported = await pickImage();
    if (!imported) return;

    const { doc, apply } = useDocumentStore.getState();
    const arena = firstArena(doc);
    const extent = arena ? arenaExtent(arena) : null;
    const larguraInicial = extent && extent.widthM > 0 ? extent.widthM : 100;
    const origem = extent ? extent.origin : { x: 0, y: 0 };

    let novoId = '';
    apply('Inserir imagem de fundo', (d) => {
      novoId = addImage(d, imported, origem, larguraInicial).id;
    });
    useEditorStore.getState().setSelection([novoId]);
  } catch (err) {
    if (err instanceof ImageImportError) {
      window.alert(err.message);
      return;
    }
    console.error(err);
    window.alert('Não foi possível importar a imagem.');
  }
}
