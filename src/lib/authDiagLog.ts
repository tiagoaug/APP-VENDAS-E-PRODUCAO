// Fila de diagnóstico temporária do bug "sessão nunca é gravada no iOS" — as funções de
// capacitorPreferencesPersistence.ts (_isAvailable/_get/_set) e o catch de initializeAuth() em
// firebase.ts rodam bem cedo na inicialização do app, ANTES de qualquer componente React montar
// (inclusive o ToastContainer, que só passa a escutar o evento de toast depois de montado). Um
// `toast.show()` chamado nesse momento dispara um evento que ninguém está ouvindo ainda — a
// mensagem simplesmente se perde, mesmo que a função tenha rodado normalmente.
//
// `logAuthDiag` resolve isso com um "flush" registrável: enquanto ninguém registrou um (antes
// do app montar), as mensagens só se acumulam na fila; assim que App.tsx registra o flush (no
// mount, primeiro momento com o ToastContainer já escutando), tudo que estava na fila é
// mostrado de uma vez E qualquer mensagem POSTERIOR (ex.: _set() durante o login, bem depois do
// mount) passa a ir direto pro toast, ao vivo — sem isso, mensagens tardias ficariam paradas na
// fila pra sempre, já que o mount só roda uma vez. Remover depois de achar a causa real do bug.
export const authDiagLog: string[] = [];
let flush: ((message: string) => void) | null = null;

export function logAuthDiag(message: string) {
  if (flush) {
    flush(message);
  } else {
    authDiagLog.push(message);
  }
}

export function registerAuthDiagFlush(fn: (message: string) => void) {
  flush = fn;
  while (authDiagLog.length > 0) {
    fn(authDiagLog.shift()!);
  }
}
