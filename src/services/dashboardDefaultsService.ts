import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DashboardCardConfig } from '../types';
import { deepClean } from './firebaseService';

// Configuração padrão de Dashboard oferecida a CONTAS NOVAS (sem nenhum dashboard_config
// salvo ainda) — dois perfis fixos, um pra quem ativa Vendas e outro pra quem ativa Produção
// (ver App.tsx, reconciliação do snapshot de dashboard_config). Coleção de topo, mesmo desenho
// de categoryTemplates/gridTemplates: leitura liberada, escrita só pra conta de desenvolvimento
// (ver isTemplateAdmin() em firestore.rules e src/utils/templateAdmin.ts).
const COLLECTION = 'appDefaultDashboards';

export type DashboardDefaultProfile = 'sales' | 'production';

export function subscribeToDashboardDefault(
  profile: DashboardDefaultProfile,
  callback: (cards: DashboardCardConfig[] | null) => void
) {
  return onSnapshot(
    doc(db, COLLECTION, profile),
    (snap) => callback(snap.exists() ? ((snap.data().cards as DashboardCardConfig[]) ?? null) : null),
    (error) => console.error('[dashboardDefaultsService] Falha ao assinar', profile, error)
  );
}

export async function saveDashboardDefault(profile: DashboardDefaultProfile, cards: DashboardCardConfig[]): Promise<void> {
  await setDoc(doc(db, COLLECTION, profile), deepClean({ cards }));
}
