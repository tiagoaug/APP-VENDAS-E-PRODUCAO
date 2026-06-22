import { ViewType } from '../types';
import type { Collaborator, SectorId } from '../types';

export type { Collaborator, SectorId };

// Cada setor agrupa as telas (ViewType) que ele libera, e uma lista curta de
// "atribuições" só para exibição (badges) na tela de cadastro de colaboradores.
// COLLABORATORS_CONFIG propositalmente não aparece em nenhum setor — só quem é
// isUnrestricted (ou ninguém logado em nenhum colaborador ainda) alcança aquela tela.
export const SECTORS: { id: SectorId; label: string; icon: string; tasks: string[]; views: ViewType[] }[] = [
  {
    id: 'vendas', label: 'Vendas', icon: 'ShoppingBag',
    tasks: ['Vender', 'Emitir Orçamentos', 'Imprimir Etiquetas'],
    views: [ViewType.SALES, ViewType.SALE_FORM, ViewType.PRINT_CENTER],
  },
  {
    id: 'compras', label: 'Compras', icon: 'ShoppingCart',
    tasks: ['Lançar Pedidos de Compra', 'Gerenciar Fornecedores'],
    views: [ViewType.PURCHASES, ViewType.PURCHASE_FORM],
  },
  {
    id: 'cadastro_produtos', label: 'Cadastro de Produtos', icon: 'Package',
    tasks: ['Produtos e Variações', 'Categorias', 'Grades de Tamanho', 'Cores', 'Ficha Técnica'],
    views: [ViewType.PRODUCTS, ViewType.PRODUCT_FORM, ViewType.PRODUCT_DETAIL, ViewType.CATEGORIES, ViewType.GRIDS, ViewType.COLORS, ViewType.CATEGORY_CONFIG, ViewType.PRODUCTION_ENGINEERING, ViewType.PRODUCT_SHEET],
  },
  {
    id: 'cadastro_insumos', label: 'Cadastro de Insumos', icon: 'Boxes',
    tasks: ['Solados', 'Palmilhas', 'Recebimento de Compras', 'Pesagem e Contagem'],
    views: [ViewType.PRODUCTION_SOLE_PURCHASE, ViewType.PRODUCTION_SOLE_RECEIPT, ViewType.PRODUCTION_SOLE_STOCK, ViewType.PRODUCTION_PALMILHA_STOCK, ViewType.PRODUCTION_PALMILHA_PURCHASE, ViewType.PRODUCTION_GENERAL_RECEIPT, ViewType.PRODUCTION_ESTOQUES_MENU, ViewType.PRODUCTION_WEIGHING],
  },
  {
    id: 'producao_pcp', label: 'Produção (PCP)', icon: 'Factory',
    tasks: ['Mapas de Produção', 'Setores de Fábrica', 'Necessidade de Compras', 'Ordens de Serviço'],
    views: [ViewType.PRODUCTION_MENU, ViewType.PRODUCTION_PCP, ViewType.PRODUCTION_STOCK, ViewType.PRODUCTION_PURCHASE_NEEDS, ViewType.PRODUCTION_CONFIG, ViewType.PRODUCTION_SERVICE_ORDER_FORM],
  },
  {
    id: 'estoque', label: 'Estoque e Expedição', icon: 'PackageOpen',
    tasks: ['Estoque de Produtos Prontos', 'Expedição'],
    views: [ViewType.STOCK],
  },
  {
    id: 'financeiro', label: 'Financeiro', icon: 'Wallet',
    tasks: ['Fluxo de Caixa', 'Contas Bancárias', 'Relatórios', 'Meios de Pagamento'],
    views: [ViewType.FINANCIAL, ViewType.ACCOUNTS, ViewType.REPORTS, ViewType.REPORT_DETAILED, ViewType.PAYMENT_METHODS],
  },
  {
    id: 'clientes_fornecedores', label: 'Clientes e Fornecedores', icon: 'Users',
    tasks: ['Cadastro de Pessoas'],
    views: [ViewType.PEOPLE, ViewType.PERSON_DETAIL],
  },
  {
    id: 'pessoal', label: 'Financeiro Pessoal', icon: 'Landmark',
    tasks: ['Finanças Pessoais e Família'],
    views: [ViewType.PERSONAL_FINANCIAL],
  },
  {
    id: 'sistema', label: 'Sistema e Backup', icon: 'Database',
    tasks: ['Backup', 'Módulos', 'Dashboard', 'Manual'],
    views: [ViewType.BACKUP, ViewType.MODULES_CONFIG, ViewType.DASHBOARD_CONFIG, ViewType.MANUAL],
  },
];

// null = acesso total (sem colaborador ativo, ou colaborador isUnrestricted)
export function getAllowedViews(collab: Collaborator | null): ViewType[] | null {
  if (!collab || collab.isUnrestricted) return null;
  const set = new Set<ViewType>([ViewType.DASHBOARD, ViewType.SETTINGS]);
  collab.sectors.forEach(sectorId => {
    SECTORS.find(s => s.id === sectorId)?.views.forEach(v => set.add(v));
  });
  return Array.from(set);
}

export function isViewAllowed(collab: Collaborator | null, view: ViewType): boolean {
  const allowed = getAllowedViews(collab);
  if (allowed === null) return true;
  return allowed.includes(view);
}

export function isSectorAllowed(collab: Collaborator | null, sectorId: SectorId): boolean {
  if (!collab || collab.isUnrestricted) return true;
  return collab.sectors.includes(sectorId);
}

// A que setor(es) cada card do Dashboard pertence — usado pra mostrar, no
// Dashboard, somente os cards do(s) setor(es) do colaborador ativo. Cards
// ausentes daqui (ex. "activity", um feed genérico) ficam sempre visíveis.
// "ai_assistant" não entra aqui de propósito — é controlado por canUseAI.
export const DASHBOARD_CARD_SECTORS: Record<string, SectorId[]> = {
  balance: ['financeiro'],
  sales_products: ['cadastro_produtos'],
  manual_entries: ['financeiro'],
  report_center: ['financeiro'],
  quick_reports: ['financeiro'],
  dashboard_rankings: ['vendas'],
  cash_flow: ['financeiro'],
  receivables: ['financeiro'],
  stock_alerts: ['estoque'],
  customers: ['clientes_fornecedores'],
  suppliers: ['compras'],
  debt_management: ['financeiro'],
  stock_value: ['estoque'],
  estimated_profit: ['financeiro'],
  checks: ['financeiro'],
  monthly_profit_detailed: ['financeiro'],
  engineering_config: ['cadastro_produtos'],
  production_stock_control: ['producao_pcp', 'cadastro_insumos'],
  factory_config: ['producao_pcp'],
  personal_balance: ['pessoal'],
  print_center: ['vendas'],
  pcp_sector_map: ['producao_pcp'],
  pcp_purchase_needs: ['producao_pcp', 'compras'],
  qr_scanner: ['producao_pcp', 'estoque'],
};

export function isDashboardCardAllowed(collab: Collaborator | null, cardId: string): boolean {
  if (!collab || collab.isUnrestricted) return true;
  const sectors = DASHBOARD_CARD_SECTORS[cardId];
  if (!sectors) return true;
  return sectors.some(s => collab.sectors.includes(s));
}

export function collaboratorCanUseAI(collab: Collaborator | null): boolean {
  return !collab || collab.isUnrestricted || collab.canUseAI;
}
