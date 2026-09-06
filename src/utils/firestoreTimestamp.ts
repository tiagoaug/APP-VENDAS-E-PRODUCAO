// Normaliza um campo que deveria ser millis (number) mas pode ter chegado como Firestore
// Timestamp — alguns registros antigos de CatalogRequest.submittedAt foram gravados com
// admin.firestore.FieldValue.serverTimestamp() antes de padronizarmos pra sempre gravar
// Date.now() (ver functions/src/catalog/publicCatalog.ts); sem isso, `format()`/subtração
// direta num Timestamp falha silenciosamente (data em branco, ordenação quebrada). Só rede de
// segurança pra dado antigo — não usar pra normalizar todo campo de data do app.
export function toMillis(value: unknown): number {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'object') return 0;
  const v = value as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
  return 0;
}
