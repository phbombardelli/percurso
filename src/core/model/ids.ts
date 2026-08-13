let counter = 0;

/**
 * Id local, curto e legível. Não precisa ser globalmente único: o documento
 * é de um usuário só, sem colaboração (§37).
 */
export function newId(prefix = 'o'): string {
  counter += 1;
  return `${prefix}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
