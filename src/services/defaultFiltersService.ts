import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { deepClean } from './firebaseService';
import { SaleStatus } from '../types';

// Filtros/visualização padrão que uma conta NOVA recebe na tela de Vendas (ver botão "Salvar
// Como Padrão para Novas Contas" dentro do painel "Filtros e Configurações" de SalesView, só
// visível pra conta de desenvolvimento) — mesmo desenho de dashboardDefaultsService.ts (doc por
// perfil dentro de appDefaultFilters). Só afeta quem ainda não tocou em nada (localStorage vazio
// pras chaves salesView_*, ver o useEffect que aplica isso em SalesView) — nunca sobrescreve
// escolha de quem já usa o app.
const COLLECTION = 'appDefaultFilters';

export interface SalesDefaultFilters {
  filter?: 'ALL' | 'RETAIL' | 'WHOLESALE';
  paymentFilter?: 'ALL' | 'PENDING' | 'PAID';
  deliveryFilter?: 'ALL' | 'PENDING' | 'DELIVERED';
  periodPreset?: 'ALL' | 'TODAY' | '7D' | '30D' | 'MONTH' | 'YEAR' | 'CUSTOM';
  periodStart?: string;
  periodEnd?: string;
  selectedStatuses?: SaleStatus[];
  expandedCards?: boolean;
  showProducts?: boolean;
  showGradeBreakdown?: boolean;
  showSeparationInfo?: boolean;
  showSeparationThumbnails?: boolean;
  showSummaryBar?: boolean;
  showStockGlanceCard?: boolean;
}

export function subscribeToSalesDefaultFilters(callback: (data: SalesDefaultFilters | null) => void) {
  return onSnapshot(
    doc(db, COLLECTION, 'sales'),
    (snap) => callback(snap.exists() ? (snap.data() as SalesDefaultFilters) : null),
    (error) => console.error('[defaultFiltersService] Falha ao assinar', error)
  );
}

export async function saveSalesDefaultFilters(data: SalesDefaultFilters): Promise<void> {
  await setDoc(doc(db, COLLECTION, 'sales'), deepClean(data));
}

// Mesma ideia acima, pro popup "Filtros" (Barra de Estatísticas / Menu de Ações Flutuante) do
// PCP — ver o botão "Salvar Como Padrão para Novas Contas" em PCPView.tsx.
export interface PcpDefaultFilters {
  statsBarHidden?: boolean;
  statsBarTiles?: Record<string, boolean>;
  floatingActionMenuEnabled?: boolean;
}

export function subscribeToPcpDefaultFilters(callback: (data: PcpDefaultFilters | null) => void) {
  return onSnapshot(
    doc(db, COLLECTION, 'pcp'),
    (snap) => callback(snap.exists() ? (snap.data() as PcpDefaultFilters) : null),
    (error) => console.error('[defaultFiltersService] Falha ao assinar', error)
  );
}

export async function savePcpDefaultFilters(data: PcpDefaultFilters): Promise<void> {
  await setDoc(doc(db, COLLECTION, 'pcp'), deepClean(data));
}
