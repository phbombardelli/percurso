import { createDocument } from '@core/model/document';
import { CourseFileError } from '@core/persistence/format';
import { deserialize, serialize, suggestedFileName } from '@core/persistence/serialize';
import { openFile, saveFile, saveFileAs } from '@platform/fileSystem';
import { useDocumentStore } from '@store/documentStore';
import { useEditorStore } from '@store/editorStore';

/**
 * Ações de arquivo. Ficam fora dos componentes porque a barra superior, os
 * atalhos de teclado e o guarda de saída precisam exatamente das mesmas
 * regras — em especial a de nunca descartar trabalho sem perguntar.
 */

export type ActionResult = 'ok' | 'cancelado' | 'erro';

/** Confirmação antes de descartar alterações não salvas. */
function confirmDiscard(): boolean {
  const { dirty, fileName } = useDocumentStore.getState();
  if (!dirty) return true;
  const nome = fileName ?? 'Sem título';
  return window.confirm(
    `"${nome}" tem alterações não salvas.\n\nDescartar as alterações e continuar?`,
  );
}

function reportError(err: unknown, fallback: string): void {
  if (err instanceof CourseFileError) {
    window.alert(err.detail ? `${err.message}\n\n${err.detail}` : err.message);
    return;
  }
  console.error(err);
  window.alert(fallback);
}

export function newDocument(): ActionResult {
  if (!confirmDiscard()) return 'cancelado';
  useDocumentStore.getState().replace(createDocument());
  useEditorStore.getState().clearSelection();
  return 'ok';
}

export async function openDocument(): Promise<ActionResult> {
  if (!confirmDiscard()) return 'cancelado';
  try {
    const opened = await openFile();
    if (!opened) return 'cancelado';

    const { document, warnings } = deserialize(opened.text);
    useDocumentStore.getState().replace(document, {
      name: opened.name,
      handle: opened.handle,
    });
    useEditorStore.getState().clearSelection();

    if (warnings.length > 0) {
      window.alert(
        `O arquivo foi aberto, com ressalvas:\n\n- ${warnings.join('\n- ')}`,
      );
    }
    return 'ok';
  } catch (err) {
    reportError(err, 'Não foi possível abrir o arquivo.');
    return 'erro';
  }
}

export async function saveDocument(): Promise<ActionResult> {
  const { doc, fileHandle } = useDocumentStore.getState();
  try {
    const saved = await saveFile(serialize(doc), fileHandle, suggestedFileName(doc));
    if (!saved) return 'cancelado';
    useDocumentStore.getState().markSaved(saved);
    return 'ok';
  } catch (err) {
    reportError(err, 'Não foi possível salvar o arquivo.');
    return 'erro';
  }
}

export async function saveDocumentAs(): Promise<ActionResult> {
  const { doc } = useDocumentStore.getState();
  try {
    const saved = await saveFileAs(serialize(doc), suggestedFileName(doc));
    if (!saved) return 'cancelado';
    useDocumentStore.getState().markSaved(saved);
    return 'ok';
  } catch (err) {
    reportError(err, 'Não foi possível salvar o arquivo.');
    return 'erro';
  }
}

/**
 * Aviso do navegador ao fechar com alterações pendentes. É a única rede de
 * proteção que existe: o salvamento é manual por decisão do usuário, não
 * há salvamento automático nem rascunho local.
 */
export function installUnloadGuard(): () => void {
  const handler = (e: BeforeUnloadEvent) => {
    if (!useDocumentStore.getState().dirty) return;
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}
