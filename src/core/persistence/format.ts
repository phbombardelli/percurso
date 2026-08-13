import type { CourseDocument } from '@core/model/types';

/**
 * Formato do arquivo de projeto. É JSON puro, legível e diffável: um
 * croqui é um documento de trabalho que o usuário pode precisar recuperar
 * daqui a anos, e um formato binário só acrescentaria risco.
 *
 * O envelope é separado do documento de propósito. `schemaVersion` mora no
 * envelope para poder ser lido antes de qualquer tentativa de interpretar
 * o conteúdo — é o que permite migrar arquivos antigos.
 */
export const FILE_FORMAT = 'percurso-croqui';
export const FILE_EXTENSION = '.pcs';
export const FILE_MIME = 'application/json';

export interface CourseFile {
  format: typeof FILE_FORMAT;
  schemaVersion: number;
  /** Só informativo: nunca é usado para decidir nada na leitura. */
  savedAt: string;
  appVersion: string;
  document: CourseDocument;
}

export class CourseFileError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'CourseFileError';
  }
}
