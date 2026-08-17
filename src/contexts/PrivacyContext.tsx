import { createContext, useContext } from 'react';

// Modo Privacidade Financeira (Acessibilidade) — true = borra valores monetários no Financeiro
// e nos cards do Dashboard, pra dar pra mostrar a tela pra alguém sem expor números. Contexto
// (em vez de prop drilling) porque o toggle mora em Acessibilidade (SettingsView) mas afeta
// exibições de valor espalhadas por vários componentes (Dashboard, Financeiro,
// BusinessOverviewCard...).
export const PrivacyContext = createContext(false);

export function usePrivacyMode(): boolean {
  return useContext(PrivacyContext);
}

// Classe utilitária aplicada condicionalmente nos elementos que mostram valor — borra e
// impede seleção de texto (senão dava pra copiar o valor mesmo borrado).
export const PRIVACY_BLUR_CLASS = 'blur-sm select-none';
