export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

export const TOAST_EVENT = 'app:toast';

const KEYWORDS_ERROR = ['erro', 'error', 'falha', 'falhou', 'não foi', 'nao foi', 'inválid', 'invalido'];
const KEYWORDS_SUCCESS = [
  'sucesso', 'salvo', 'salva', 'criado', 'criada', 'gerado', 'gerada',
  'excluído', 'excluida', 'excluido', 'removido', 'removida', 'atualizado', 'atualizada',
  'duplicado', 'adicionado', 'adicionada', 'confirmado', 'realizado', 'concluído', 'concluido',
  'cadastro realizado', 'cadastro atualizado',
];
const KEYWORDS_WARNING = [
  'atenção', 'atencao', 'aviso', 'selecione', 'preencha', 'informe',
  'necessário', 'obrigatório', 'obrigatorio',
];

function classify(message: string): ToastType {
  const lower = message.toLowerCase();
  if (KEYWORDS_ERROR.some(k => lower.includes(k))) return 'error';
  if (KEYWORDS_SUCCESS.some(k => lower.includes(k))) return 'success';
  if (KEYWORDS_WARNING.some(k => lower.includes(k))) return 'warning';
  return 'info';
}

function dispatch(message: string, type: ToastType) {
  window.dispatchEvent(
    new CustomEvent<ToastItem>(TOAST_EVENT, {
      detail: { id: Date.now() + Math.random(), message, type },
    })
  );
}

export const toast = {
  show: (message: string) => dispatch(message, classify(message)),
  success: (message: string) => dispatch(message, 'success'),
  error: (message: string) => dispatch(message, 'error'),
  warning: (message: string) => dispatch(message, 'warning'),
  info: (message: string) => dispatch(message, 'info'),
};
