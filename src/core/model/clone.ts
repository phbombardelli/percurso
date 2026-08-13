/**
 * Clonagem profunda dos objetos do documento.
 *
 * Não usar `structuredClone`: ele lança `DataCloneError` sobre os proxies
 * de rascunho do Immer, que é exatamente o contexto em que duplicar e
 * colar rodam. O modelo é JSON puro por decisão (números, textos, arrays,
 * objetos simples e `null`), então esta travessia cobre tudo — e continua
 * cobrindo se novos campos forem acrescentados, desde que sigam a mesma
 * regra.
 */
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => deepClone(v)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = deepClone(v);
  }
  return out as T;
}
