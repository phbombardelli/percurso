import { CourseFileError } from './format';

/**
 * Migrações de esquema. Cada entrada leva um documento da versão `n` para
 * a `n+1`, sempre sobre JSON cru — nunca sobre os tipos atuais do modelo,
 * que vão continuar mudando e deixariam a migração antiga sem compilar.
 *
 * Regra: uma vez publicada uma versão, sua migração nunca mais muda.
 */
export type RawDocument = Record<string, unknown>;
export type Migration = (doc: RawDocument) => RawDocument;

/**
 * Ainda não há migração alguma: o esquema 1 é o primeiro. O mecanismo
 * existe desde já porque acrescentá-lo depois exigiria adivinhar o que
 * havia nos arquivos gravados antes dele.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

export function applyMigrations(
  doc: RawDocument,
  fromVersion: number,
  toVersion: number,
  table: Readonly<Record<number, Migration>> = MIGRATIONS,
): RawDocument {
  if (fromVersion > toVersion) {
    throw new CourseFileError(
      'Este arquivo foi salvo por uma versão mais nova do Percurso.',
      `Versão do arquivo: ${fromVersion}. Versão suportada: ${toVersion}.`,
    );
  }

  let current = doc;
  for (let v = fromVersion; v < toVersion; v += 1) {
    const migrate = table[v];
    if (!migrate) {
      throw new CourseFileError(
        'Não foi possível atualizar este arquivo.',
        `Falta a migração da versão ${v} para a ${v + 1}.`,
      );
    }
    current = migrate(current);
  }
  return current;
}
