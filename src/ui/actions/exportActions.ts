import { exportDocumentPdf } from '@platform/exportPdf';
import { useDocumentStore } from '@store/documentStore';

/** Exporta o croqui aberto em PDF, com o nome do arquivo. Para o atalho Ctrl+E. */
export async function exportCurrentPdf(): Promise<void> {
  const { doc, fileName } = useDocumentStore.getState();
  try {
    await exportDocumentPdf(doc, (fileName ?? 'croqui').replace(/\.[^.]+$/, ''));
  } catch (err) {
    console.error(err);
    window.alert('Não foi possível gerar o PDF. Detalhes no console.');
  }
}
