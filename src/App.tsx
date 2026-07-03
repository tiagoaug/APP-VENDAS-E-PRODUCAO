import { useState, useEffect, useMemo, useRef, ReactNode, lazy, Suspense } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ShoppingBag,
  ArrowLeft,
  Settings,
  DollarSign,
  Shield,
  Moon,
  Users,
  Tags,
  TableCellsMerge,
  Palette,
  Wallet,
  CreditCard,
  BarChart3,
  Database,
  Boxes,
  Eye,
  Factory,
  GanttChartSquare,
  Hammer,
  ClipboardList,
  PackageOpen,
  ChevronRight,
  FileText,
  User as UserIcon,
  AlertCircle,
  AlertTriangle,
  Scale,
  Printer,
  Footprints,
  Sparkles,
  ScanLine,
  Sun
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { auth, db, logout } from "./lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, collection, query, where, getDocs, deleteField } from "firebase/firestore";
import { firebaseService } from "./services/firebaseService";
import { notificationService, ReminderNotification } from "./services/notificationService";
import { resolveSoleConsumption } from "./utils/soleNeeds";
import { getSourceItemKey, saleProductionHasProgressed } from "./utils/productionRoute";
import { financeService } from "./services/financeService";
import {
  ViewType,
  Product,
  Purchase,
  Sale,
  SaleType,
  PurchaseType,
  Grid,
  Person,
  Category,
  ColorValue,
  PaymentMethod,
  SaleStatus,
  Transaction,
  TransactionType,
  Account,
  AccountType,
  PaymentTerm,
  PaymentStatus,
  SalePayment,
  FamilyMember,
  Budget,
  DashboardConfig,
  FlowTag,
  Sector,
  ProductionConfigItem,
  ProductionScreenType,
  WeighingRecord,
  AppModulesConfig,
  SoleStockEntry,
  SolePurchaseItem,
  PalmilhaStockEntry,
  PalmilhaPurchaseItem,
  ProductionOrder,
  ProductionOrderItem,
  ProductionLot,
  PurchaseRequest,
  ServiceOrder,
  StockLot,
  StockLotRevertPreview,
  Collaborator,
  MonthlySnapshot,
  CleanupConfig,
} from "./types";

// Views — DashboardView e LoginView ficam estáticas (primeira tela vista por
// todo mundo, sem flash de loading); o resto é code-split via lazy() pra não
// jogar o app inteiro num chunk só (eram >4MB minificados em um único arquivo).
import DashboardView from "./views/DashboardView";
import LoginView from "./views/LoginView";
const ProductsView = lazy(() => import("./views/ProductsView"));
const ProductFormView = lazy(() => import("./views/ProductFormView"));
const PurchasesView = lazy(() => import("./views/PurchasesView"));
const PurchaseFormView = lazy(() => import("./views/PurchaseFormView"));
const ServiceOrderFormView = lazy(() => import("./views/ServiceOrderFormView"));
const SalesView = lazy(() => import("./views/SalesView"));
const SaleFormView = lazy(() => import("./views/SaleFormView"));
const FinancialView = lazy(() => import("./views/FinancialView"));
const SettingsView = lazy(() => import("./views/SettingsView"));
const PeopleView = lazy(() => import("./views/PeopleView"));
const CategoriesView = lazy(() => import("./views/CategoriesView"));
const CategoryConfigView = lazy(() => import("./views/CategoryConfigView"));
const GradesView = lazy(() => import("./views/GradesView"));
const ColorsView = lazy(() => import("./views/ColorsView"));
const PaymentMethodsView = lazy(() => import("./views/PaymentMethodsView"));
const ReportsView = lazy(() => import("./views/ReportsView"));
const ReportDetailedView = lazy(() => import("./views/ReportDetailedView"));
const DataCleanupView = lazy(() => import("./views/DataCleanupView"));
const PrintCenterView = lazy(() => import("./views/PrintCenterView"));
const BackupView = lazy(() => import("./views/BackupView"));
const AccountsView = lazy(() => import("./views/AccountsView"));
const StockView = lazy(() => import("./views/StockView"));
const StockGlanceView = lazy(() => import("./views/StockGlanceView"));
const PersonDetailView = lazy(() => import("./views/PersonDetailView"));
const DashboardConfigView = lazy(() => import("./views/DashboardConfigView"));
const ProductionConfigView = lazy(() => import("./views/ProductionConfigView"));
const PersonalFinancialView = lazy(() => import("./views/PersonalFinancialView"));
const ModuleConfigView = lazy(() => import("./views/ModuleConfigView"));
const CollaboratorsConfigView = lazy(() => import("./views/CollaboratorsConfigView"));
const CollaboratorGateView = lazy(() => import("./views/CollaboratorGateView"));
const ManualView = lazy(() => import("./views/ManualView"));
const WeighingView = lazy(() => import("./views/WeighingView"));
const SoleProcurement = lazy(() => import("./views/SolePurchaseView"));
const SoleStockView = lazy(() => import("./views/SoleStockView"));
const PalmilhaStockView = lazy(() => import("./views/PalmilhaStockView"));
const PCPView = lazy(() => import("./views/PCPView"));
const PurchaseNeedsView = lazy(() => import("./views/PurchaseNeedsView"));
const GeneralReceiptsView = lazy(() => import("./views/GeneralReceiptsView"));
const SoleReceiptView = lazy(() => import("./views/SoleReceiptView"));

const ProductionEngineeringView = lazy(() => import("./views/ProductionEngineeringView"));


// Modals
import AccountModal from "./components/AccountModal";
import PaymentMethodModal from "./components/PaymentMethodModal";
import Modal from "./components/Modal";
import TransactionModal from "./components/TransactionModal";
import SolePurchaseModal from "./components/SolePurchaseModal";
import PalmilhaPurchaseModal from "./components/PalmilhaPurchaseModal";
import AIAssistantModal from "./components/AIAssistantModal";
import ScannerModal from "./components/ScannerModal";
import { scannerService } from "./services/scannerService";
import { ToastContainer } from "./components/ToastContainer";
import { toast } from "./utils/toast";
import { parseLocaleNumber } from './utils/numbers';
import { generateId } from './utils/id';
import { seedProductionOrderSequence } from './utils/sequenceSeeds';
import { ThemeId, THEME_VISUALS, ALL_THEME_CLASSES, FONT_OPTIONS, NavIconMode, NAV_TAB_COLORS } from './utils/themes';
import { isViewAllowed, collaboratorCanUseAI, getEffectiveDashboardCards } from './utils/collaborators';

const MODAL_VIEWS = [
  ViewType.PRODUCTS,
  ViewType.PRODUCT_FORM,
  ViewType.PEOPLE,
  ViewType.PERSON_DETAIL,
  ViewType.CATEGORIES,
  ViewType.GRIDS,
  ViewType.COLORS,
  ViewType.ACCOUNTS,
  ViewType.PAYMENT_METHODS,
  ViewType.BACKUP,
  ViewType.REPORTS,
  ViewType.PRODUCT_SHEET,
  ViewType.STOCK,
  ViewType.STOCK_GLANCE,
  ViewType.SALE_FORM,
  ViewType.PURCHASE_FORM,
  ViewType.PRODUCT_DETAIL,
  ViewType.REPORT_DETAILED,
  ViewType.MODULES_CONFIG,
  ViewType.PRINT_CENTER,
];

const MODULE_VIEWS: Record<string, ViewType[]> = {
  sales: [
    ViewType.PURCHASES,
    ViewType.PURCHASE_FORM,
    ViewType.SALES,
    ViewType.SALE_FORM,
    ViewType.FINANCIAL,
    ViewType.ACCOUNTS,
    ViewType.REPORTS,
    ViewType.STOCK,
    ViewType.STOCK_GLANCE,
    ViewType.PRINT_CENTER,
  ],
  production: [
    ViewType.PRODUCTION_MENU,
    ViewType.PRODUCTION_PCP,
    ViewType.PRODUCTION_STOCK,
    ViewType.PRODUCTION_PURCHASE_NEEDS,
    ViewType.PRODUCTION_CONFIG,
    ViewType.PRODUCT_SHEET,
    ViewType.PRODUCTION_ENGINEERING,
    ViewType.PRODUCTION_SERVICE_ORDER_FORM
  ],
  personal: [
    ViewType.PERSONAL_FINANCIAL
  ]
};

interface TabItemProps {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  colorClass?: string;
  appTheme: ThemeId;
  iconMode?: NavIconMode;
  tintColor?: string;
  monoColor?: string;
}

function TabItem({
  icon,
  label,
  active,
  onClick,
  appTheme,
  iconMode = 'mono',
  tintColor = '#4f46e5',
  monoColor = '#4f46e5',
}: TabItemProps) {
  const isColored = iconMode === 'colored';

  // Modo "Colorido": cada item sempre mostra sua própria cor (mais apagada quando
  // inativo). Modo "Monocromático": todos os itens ficam permanentemente na cor
  // escolhida — só o "pill" de fundo diferencia qual está ativo.
  const iconStyle: React.CSSProperties = isColored
    ? { color: tintColor, opacity: active ? 1 : 0.55 }
    : { color: monoColor };
  const pillStyle: React.CSSProperties | undefined = active
    ? { backgroundColor: `${(isColored ? tintColor : monoColor)}1f` }
    : undefined;

  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={`Ir para ${label}`}
      className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-all"
    >
      <div className="w-10 h-7 flex items-center justify-center rounded-xl transition-all" style={pillStyle}>
        <span className="transition-all" style={iconStyle}>
          {icon}
        </span>
      </div>
      <span className="text-[10px] font-bold tracking-tight transition-all" style={iconStyle}>
        {label}
      </span>
    </button>
  );
}

function ViewLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 rounded-full border-[3px] border-slate-200 dark:border-slate-700 border-t-indigo-500 animate-spin" />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>(ViewType.DASHBOARD);
  const [lastNonModalView, setLastNonModalView] = useState<ViewType>(ViewType.DASHBOARD);
  const [history, setHistory] = useState<ViewType[]>([ViewType.DASHBOARD]);
  const [appTheme, setAppTheme] = useState<ThemeId>(() => {
    return (localStorage.getItem('app_theme_pref') as ThemeId) || 'light';
  });
  const isDarkMode = THEME_VISUALS[appTheme]?.cssClass.includes('dark') ?? false;
  const [fontScale, setFontScale] = useState<number>(() => {
    const saved = localStorage.getItem('font_size_pref');
    const parsed = saved ? parseInt(saved, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
  });
  const [fontFamily, setFontFamily] = useState<string>(() => {
    return localStorage.getItem('font_family_pref') || FONT_OPTIONS[0].value;
  });
  const [navIconMode, setNavIconMode] = useState<NavIconMode>(() => {
    return (localStorage.getItem('nav_icon_mode_pref') as NavIconMode) || 'mono';
  });
  const [navMonoColor, setNavMonoColor] = useState<string>(() => {
    return localStorage.getItem('nav_mono_color_pref') || '#4f46e5';
  });
  const updateNavIconMode = (mode: NavIconMode) => {
    setNavIconMode(mode);
    localStorage.setItem('nav_icon_mode_pref', mode);
  };
  const updateNavMonoColor = (color: string) => {
    setNavMonoColor(color);
    localStorage.setItem('nav_mono_color_pref', color);
  };
  const [isA11yOpen, setIsA11yOpen] = useState(false);

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [activeCollaboratorId, setActiveCollaboratorId] = useState<string | null>(() => {
    return localStorage.getItem('active_collaborator_id') || null;
  });
  const activeCollaborator = collaborators.find(c => c.id === activeCollaboratorId) ?? null;

  // Decide, uma única vez por sessão (ao abrir o app / logar), se a tela "Quem é
  // você?" precisa aparecer — fixado no primeiro snapshot do Firestore pra não
  // expulsar o usuário pro gate no meio da sessão ao cadastrar o 1º colaborador.
  const [needsCollabGate, setNeedsCollabGate] = useState(false);
  const [collabSessionConfirmed, setCollabSessionConfirmed] = useState<boolean>(() => {
    return sessionStorage.getItem('collab_session_confirmed') === '1';
  });

  const switchCollaborator = (id: string, pin: string): boolean => {
    const target = collaborators.find(c => c.id === id);
    if (!target || target.locked) return false;
    if (target.pin !== pin) {
      const failedAttempts = (target.failedAttempts || 0) + 1;
      saveCollaborator({ ...target, failedAttempts, locked: failedAttempts >= 5 });
      return false;
    }
    if (target.failedAttempts) {
      saveCollaborator({ ...target, failedAttempts: 0 });
    }
    setActiveCollaboratorId(id);
    localStorage.setItem('active_collaborator_id', id);
    return true;
  };

  const confirmCollabSession = (id: string, pin: string): boolean => {
    const ok = switchCollaborator(id, pin);
    if (ok) {
      setCollabSessionConfirmed(true);
      sessionStorage.setItem('collab_session_confirmed', '1');
    }
    return ok;
  };

  const handleLogout = () => {
    sessionStorage.removeItem('collab_session_confirmed');
    logout();
  };

  const saveCollaborator = async (collab: Collaborator) => {
    await firebaseService.saveDocument("collaborators", collab);
  };

  const deleteCollaborator = async (id: string) => {
    await firebaseService.deleteDocument("collaborators", id);
    if (activeCollaboratorId === id) {
      setActiveCollaboratorId(null);
      localStorage.removeItem('active_collaborator_id');
    }
  };

  useEffect(() => {
    if (!MODAL_VIEWS.includes(currentView)) {
      setLastNonModalView(currentView);
    }
  }, [currentView]);

  // Aplica as preferências de Acessibilidade salvas no perfil do colaborador ativo
  // (tema/fonte/tamanho/ícones), sobrepondo o que estava no aparelho — dispara ao
  // trocar de colaborador (ou quando a lista termina de carregar do Firestore).
  useEffect(() => {
    if (!activeCollaborator) return;
    if (activeCollaborator.themePref) setAppTheme(activeCollaborator.themePref as ThemeId);
    if (activeCollaborator.fontScalePref) setFontScale(activeCollaborator.fontScalePref);
    if (activeCollaborator.fontFamilyPref) setFontFamily(activeCollaborator.fontFamilyPref);
    if (activeCollaborator.navIconModePref) setNavIconMode(activeCollaborator.navIconModePref as NavIconMode);
    if (activeCollaborator.navMonoColorPref) setNavMonoColor(activeCollaborator.navMonoColorPref);
  }, [activeCollaboratorId, collaborators]);

  // Salva as mesmas preferências no perfil do colaborador ativo, pra acompanhá-lo
  // em qualquer aparelho (em vez de ficar só no localStorage deste aparelho).
  // Só grava se algo realmente mudou: sem essa checagem, o efeito acima (que
  // aplica essas mesmas prefs sempre que `collaborators` chega um novo snapshot
  // do Firestore) regravava o documento a cada abertura do app mesmo sem
  // alteração nenhuma — e cada gravação reabre o próprio snapshot, retriggerando
  // o efeito de aplicar e fazendo a tela "piscar" enquanto os dois ficam se
  // realimentando logo na restauração do perfil ao abrir o app.
  useEffect(() => {
    if (!activeCollaborator) return;
    const unchanged =
      activeCollaborator.themePref === appTheme &&
      activeCollaborator.fontScalePref === fontScale &&
      activeCollaborator.fontFamilyPref === fontFamily &&
      activeCollaborator.navIconModePref === navIconMode &&
      activeCollaborator.navMonoColorPref === navMonoColor;
    if (unchanged) return;
    saveCollaborator({
      ...activeCollaborator,
      themePref: appTheme,
      fontScalePref: fontScale,
      fontFamilyPref: fontFamily,
      navIconModePref: navIconMode,
      navMonoColorPref: navMonoColor,
    });
  }, [appTheme, fontScale, fontFamily, navIconMode, navMonoColor, activeCollaboratorId]);

  // Tamanho de fonte: zoom afeta literalmente toda a UI (inclusive os textos com
  // tamanho fixo em px usados em todo o app), diferente de só mudar o font-size da
  // raiz — que só alcançava elementos medidos em rem/em.
  useEffect(() => {
    localStorage.setItem('font_size_pref', String(fontScale));
    (document.body.style as any).zoom = `${fontScale}%`;
  }, [fontScale]);

  // Fonte: aplica na raiz (herda para todo o app) e também na variável usada pelo
  // Tailwind (--font-sans), cobrindo qualquer texto que dependa do font-sans padrão.
  useEffect(() => {
    localStorage.setItem('font_family_pref', fontFamily);
    document.documentElement.style.fontFamily = fontFamily;
    document.documentElement.style.setProperty('--font-sans', fontFamily);
  }, [fontFamily]);

  // Estados para as animações randômicas dos botões do cabeçalho
  const [scanAnim, setScanAnim] = useState({ scale: 1, rotate: 0, y: 0, x: 0, opacity: 1 });
  const [aiAnim, setAiAnim] = useState({ scale: 1, rotate: 0, y: 0, x: 0, opacity: 1 });
  const [themeAnim, setThemeAnim] = useState({ scale: 1, rotate: 0, y: 0, x: 0, opacity: 1 });

  useEffect(() => {
    const getRandomVal = (min: number, max: number) => Math.random() * (max - min) + min;
    
    const interval = setInterval(() => {
      setScanAnim({
        scale: getRandomVal(0.92, 1.12),
        rotate: getRandomVal(-12, 12),
        y: getRandomVal(-2, 2),
        x: getRandomVal(-2, 2),
        opacity: getRandomVal(0.88, 1)
      });
      setAiAnim({
        scale: getRandomVal(0.92, 1.12),
        rotate: getRandomVal(-12, 12),
        y: getRandomVal(-2, 2),
        x: getRandomVal(-2, 2),
        opacity: getRandomVal(0.88, 1)
      });
      setThemeAnim({
        scale: getRandomVal(0.92, 1.12),
        rotate: getRandomVal(-12, 12),
        y: getRandomVal(-2, 2),
        x: getRandomVal(-2, 2),
        opacity: getRandomVal(0.88, 1)
      });
    }, 1500);

    return () => clearInterval(interval);
  }, []);


  // Modals state
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>();
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | undefined>();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionModalType, setTransactionModalType] = useState<TransactionType>(TransactionType.INCOME);
  const [isSolePurchaseModalOpen, setIsSolePurchaseModalOpen] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isHeaderScannerOpen, setIsHeaderScannerOpen] = useState(false);
  const [aiPersonPrefill, setAiPersonPrefill] = useState<Partial<Person> | null>(null);
  const [solePurchaseParams, setSolePurchaseParams] = useState<{
    moldId?: string;
    colorId?: string;
    initialGrid?: Record<string, number>;
    items?: { moldId: string; colorId?: string; initialGrid?: Record<string, number> }[];
    description?: string;
    requestId?: string;
  } | null>(null);
  const [isPalmilhaPurchaseModalOpen, setIsPalmilhaPurchaseModalOpen] = useState(false);
  const [palmilhaPurchaseParams, setPalmilhaPurchaseParams] = useState<{
    toolId?: string;
    colorId?: string;
    initialGrid?: Record<string, number>;
    items?: { toolId: string; toolName?: string; subtype?: 'MONTAGEM' | 'ACABAMENTO'; colorId?: string; colorName?: string; initialGrid?: Record<string, number> }[];
    description?: string;
    requestId?: string;
  } | null>(null);
  const [purchaseDeleteWarning, setPurchaseDeleteWarning] = useState<{
    purchase: Purchase;
    request?: PurchaseRequest;
    order?: ProductionOrder;
    orderLots: ProductionLot[];
  } | null>(null);
  const [isDeletingPurchase, setIsDeletingPurchase] = useState(false);


  // App State
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [grids, setGrids] = useState<Grid[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [colors, setColors] = useState<ColorValue[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [personalContacts, setPersonalContacts] = useState<Person[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [flowTags, setFlowTags] = useState<FlowTag[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [productionConfigs, setProductionConfigs] = useState<ProductionConfigItem[]>([]);
  const [weighingRecords, setWeighingRecords] = useState<WeighingRecord[]>([]);
  const [soleStockEntries, setSoleStockEntries] = useState<SoleStockEntry[]>([]);
  const [palmilhaStockEntries, setPalmilhaStockEntries] = useState<PalmilhaStockEntry[]>([]);
  const [productionLots, setProductionLots] = useState<ProductionLot[]>([]);
  const [stockLots, setStockLots] = useState<StockLot[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [monthlySnapshots, setMonthlySnapshots] = useState<MonthlySnapshot[]>([]);
  const [cleanupConfig, setCleanupConfig] = useState<CleanupConfig | null>(null);
  
  const suppliers = useMemo(() => people.filter(p => p.isSupplier), [people]);


  const defaultDashboardConfig: DashboardConfig = {
    cards: [
      { id: 'ai_assistant', label: 'Assistente IA (Claude)', visible: true, order: -1, module: 'any' },
      { id: 'balance', label: 'Saldo Consolidado', visible: true, order: 0, module: 'sales' },
      { id: 'sales_products', label: 'Produtos e Catálogo', visible: true, order: 1, module: 'sales' },
      { id: 'manual_entries', label: 'Lançamentos Manuais', visible: true, order: 2, module: 'sales' },
      { id: 'report_center', label: 'Central de Relatórios', visible: true, order: 3, module: 'sales' },
      { id: 'quick_reports', label: 'Relatórios Rápidos', visible: true, order: 4, module: 'sales' },
      { id: 'dashboard_rankings', label: 'Rankings de Performance', visible: true, order: 5, module: 'sales' },
      { id: 'cash_flow', label: 'Balanço Mensal', visible: true, order: 6, module: 'sales' },
      { id: 'receivables', label: 'A Receber (Vendas)', visible: true, order: 7, module: 'sales' },
      { id: 'stock_alerts', label: 'Alertas de Estoque', visible: true, order: 8, module: 'sales' },
      { id: 'customers', label: 'Relacionamento Clientes', visible: true, order: 9, module: 'sales' },
      { id: 'suppliers', label: 'Relacionamento Fornecedores', visible: true, order: 10, module: 'sales' },
      { id: 'debt_management', label: 'Gestão de Dívidas', visible: true, order: 11, module: 'sales' },
      { id: 'stock_value', label: 'Patrimônio em Estoque', visible: true, order: 12, module: 'sales' },
      { id: 'estimated_profit', label: 'Lucro Total Estimado', visible: true, order: 13, module: 'sales' },
      { id: 'checks', label: 'Relatório de Cheques', visible: true, order: 14, module: 'sales' },
      { id: 'reminders', label: 'Lembretes e Vencimentos', visible: true, order: 14.5, module: 'any' },
      { id: 'activity', label: 'Atividade Recente', visible: true, order: 15, module: 'any' },
      { id: 'monthly_profit_detailed', label: 'Análise de Lucro Detalhada', visible: true, order: 16, module: 'sales' },
      { id: 'engineering_config', label: 'Configurações de Ficha Técnica', visible: true, order: 17, module: 'production' },
      { id: 'production_stock_control', label: 'Controle de Estoques', visible: true, order: 17.5, module: 'production' },
      { id: 'factory_config', label: 'Configurações de Fábrica', visible: true, order: 22, module: 'production' },
      { id: 'personal_balance', label: 'Saldo Pessoal', visible: true, order: 18, module: 'personal' },
      { id: 'print_center', label: 'Central de Impressões', visible: true, order: 19, module: 'any' },
      { id: 'pcp_sector_map', label: 'Mapas por Setor (PCP)', visible: true, order: 20, module: 'production' },
      { id: 'pcp_purchase_needs', label: 'Necessidades de Compras (PCP)', visible: true, order: 21, module: 'production' },
      { id: 'qr_scanner', label: 'Scanner Rápido', visible: true, order: 23, module: 'any' },
    ]
  };

  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig | null>(() => {
    const saved = localStorage.getItem('dashboard_config');
    let config = saved ? JSON.parse(saved) : defaultDashboardConfig;
    
    // Migration: remove legacy shortcuts card if exists
    if (config.cards && config.cards.find((c: any) => c.id === 'shortcuts')) {
      config.cards = config.cards.filter((c: any) => c.id !== 'shortcuts');
      localStorage.setItem('dashboard_config', JSON.stringify(config));
    }

    // Migration: ensure quick_reports is present
    if (config.cards && !config.cards.find((c: any) => c.id === 'quick_reports')) {
      config.cards.push({ id: 'quick_reports', label: 'Relatórios Rápidos', visible: true, order: config.cards.length });
      localStorage.setItem('dashboard_config', JSON.stringify(config));
    }

    // Migration: ensure dashboard_rankings is present
    if (config.cards && !config.cards.find((c: any) => c.id === 'dashboard_rankings')) {
      config.cards.push({ id: 'dashboard_rankings', label: 'Rankings de Performance', visible: true, order: config.cards.length });
      localStorage.setItem('dashboard_config', JSON.stringify(config));
    }

    // Migration: ensure engineering_config is present
    if (config.cards && !config.cards.find((c: any) => c.id === 'engineering_config')) {
      config.cards.push({ id: 'engineering_config', label: 'Configurações de Ficha Técnica', visible: true, order: config.cards.length });
      localStorage.setItem('dashboard_config', JSON.stringify(config));
    }

    // Migration: ensure print_center is present
    if (config.cards && !config.cards.find((c: any) => c.id === 'print_center')) {
      config.cards.push({ id: 'print_center', label: 'Central de Impressões', visible: true, order: 19, module: 'any' });
      localStorage.setItem('dashboard_config', JSON.stringify(config));
    }
    // Migration: ensure factory_config card is present
    if (config.cards && !config.cards.find((c: any) => c.id === 'factory_config')) {
      config.cards.push({ id: 'factory_config', label: 'Configurações de Fábrica', visible: true, order: 22, module: 'production' });
      localStorage.setItem('dashboard_config', JSON.stringify(config));
    }
    // Migration: ensure PCP cards are present
    if (config.cards && !config.cards.find((c: any) => c.id === 'pcp_sector_map')) {
      config.cards.push({ id: 'pcp_sector_map', label: 'Mapas por Setor (PCP)', visible: true, order: 20, module: 'production' });
      config.cards.push({ id: 'pcp_purchase_needs', label: 'Necessidades de Compras (PCP)', visible: true, order: 21, module: 'production' });
      localStorage.setItem('dashboard_config', JSON.stringify(config));
    }
    // Migration: ensure ai_assistant card is present
    if (config.cards && !config.cards.find((c: any) => c.id === 'ai_assistant')) {
      config.cards.push({ id: 'ai_assistant', label: 'Assistente IA (Claude)', visible: true, order: -1, module: 'any' });
      localStorage.setItem('dashboard_config', JSON.stringify(config));
    }
    // Migration: ensure qr_scanner card is present
    if (config.cards && !config.cards.find((c: any) => c.id === 'qr_scanner')) {
      config.cards.push({ id: 'qr_scanner', label: 'Scanner Rápido', visible: true, order: config.cards.length, module: 'any' });
      localStorage.setItem('dashboard_config', JSON.stringify(config));
    }

    // Migration: ensure production_stock_control is present
    if (config.cards && !config.cards.find((c: any) => c.id === 'production_stock_control')) {
      config.cards.push({ id: 'production_stock_control', label: 'Controle de Estoques', visible: true, order: 17.5, module: 'production' });
      localStorage.setItem('dashboard_config', JSON.stringify(config));
    }

    return config;
  });

  const defaultModulesConfig: AppModulesConfig = {
    personal: true,
    sales: true,
    production: true,
  };

  const [modulesConfig, setModulesConfig] = useState<AppModulesConfig>(() => {
    const saved = localStorage.getItem('modules_config');
    return saved ? JSON.parse(saved) : defaultModulesConfig;
  });

  useEffect(() => {
    localStorage.setItem('modules_config', JSON.stringify(modulesConfig));
  }, [modulesConfig]);

  // Sync with Firestore
  useEffect(() => {
    if (!user) return;
    const unsubModulesConfig = firebaseService.subscribeToCollection<AppModulesConfig & { id: string }>(
      "app_modules_config",
      (data) => {
        const config = data.find(c => c.id === 'main_modules_config');
        if (config) {
          // Remove ID from config before setting state
          const { id, ...rest } = config;
          setModulesConfig(rest as AppModulesConfig);
        }
      }
    );
    return () => unsubModulesConfig();
  }, [user]);

  const saveModulesConfig = async (newConfig: AppModulesConfig) => {
    setModulesConfig(newConfig);
    if (user) {
      await firebaseService.saveDocument("app_modules_config", { ...newConfig, id: 'main_modules_config' });
    }
  };

  // Firebase Subscriptions
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubProducts = firebaseService.subscribeToCollection<Product>(
      "products",
      setProducts,
    );
    // Vendas, compras e transações só crescem com o tempo — em vez de baixar o
    // histórico inteiro para sempre, mantém "recentes" + "ainda em aberto" (o que
    // está pendente continua carregado independente da idade do registro).
    const unsubPurchases = firebaseService.subscribeToRecentOrOpen<Purchase>(
      "purchases",
      { dateField: "date", cutoffMs: Date.now() - 18 * 30 * 24 * 60 * 60 * 1000, openField: "paymentStatus", openValues: ["PENDING"] },
      setPurchases,
    );
    const unsubSales = firebaseService.subscribeToRecentOrOpen<Sale>(
      "sales",
      { dateField: "date", cutoffMs: Date.now() - 18 * 30 * 24 * 60 * 60 * 1000, openField: "paymentStatus", openValues: ["PENDING"] },
      (data) => {
        // Garantir que todos os recebimentos no histórico tenham um ID (suporte a dados legados)
        const processed = data.map(sale => {
          if (!sale.paymentHistory) return sale;
          const updatedHistory = sale.paymentHistory.map((p, index) => {
            if (p.id) return p;
            // Se ID estiver faltando, gera um determinístico baseado nos dados
            return {
              ...p,
              id: `legacy-${p.date}-${p.amount}-${index}`
            };
          });
          return { ...sale, paymentHistory: updatedHistory };
        });
        setSales(processed);
      },
    );
    const unsubTransactions =
      firebaseService.subscribeToRecentOrOpen<Transaction>(
        "transactions",
        { dateField: "date", cutoffMs: Date.now() - 6 * 30 * 24 * 60 * 60 * 1000, openField: "status", openValues: ["PENDING"] },
        setTransactions,
      );
    const unsubAccounts = firebaseService.subscribeToCollection<Account>(
      "accounts",
      setAccounts,
    );
    const unsubGrids = firebaseService.subscribeToCollection<Grid>(
      "grids",
      setGrids,
    );
    const unsubPeople = firebaseService.subscribeToCollection<Person>(
      "people",
      setPeople,
    );
    let collabGateDecided = false;
    const unsubCollaborators = firebaseService.subscribeToCollection<Collaborator>(
      "collaborators",
      (data) => {
        setCollaborators(data);
        if (!collabGateDecided) {
          collabGateDecided = true;
          setNeedsCollabGate(data.length > 0);
        }
      },
    );
    const unsubCategories = firebaseService.subscribeToCollection<Category>(
      "categories",
      setCategories,
    );
    const unsubColors = firebaseService.subscribeToCollection<ColorValue>(
      "colors",
      setColors,
    );
    const unsubPaymentMethods =
      firebaseService.subscribeToCollection<PaymentMethod>(
        "paymentMethods",
        setPaymentMethods,
      );
    const unsubFamilyMembers =
      firebaseService.subscribeToCollection<FamilyMember>(
        "family_members",
        setFamilyMembers,
      );
    const unsubPersonalContacts =
      firebaseService.subscribeToCollection<Person>(
        "personal_contacts",
        setPersonalContacts,
      );
    const unsubBudgets = firebaseService.subscribeToCollection<Budget>(
      "budgets",
      setBudgets,
    );
    const unsubFlowTags = firebaseService.subscribeToCollection<FlowTag>(
      "flowTags",
      setFlowTags,
    );
    const unsubSectors = firebaseService.subscribeToCollection<Sector>(
      "sectors",
      (data) => {
        setSectors([...data].sort((a, b) => a.order - b.order));
      },
    );
    const unsubProductionConfigs = firebaseService.subscribeToCollection<ProductionConfigItem>(
      "productionConfigs",
      setProductionConfigs
    );

    const unsubWeighingRecords = firebaseService.subscribeToCollection<WeighingRecord>(
      "weighingRecords",
      (data) => setWeighingRecords(data.sort((a, b) => b.date - a.date))
    );

    const unsubSoleStock = firebaseService.subscribeToCollection<SoleStockEntry>(
      "soleStock",
      setSoleStockEntries
    );

    const unsubPalmilhaStock = firebaseService.subscribeToCollection<PalmilhaStockEntry>(
      "palmilhaStock",
      setPalmilhaStockEntries
    );

    const unsubProductionLots = firebaseService.subscribeToCollection<ProductionLot>(
      "productionLots",
      setProductionLots
    );

    // Estoque/Pedidos de Produção/OS só crescem com o tempo — mantém "recentes" + "ainda
    // em aberto" (ver Fase 1 em sales/purchases/transactions, mesmo helper). productionLots
    // fica de fora por agora: não tem um campo confiável de "ainda ativo" para consultar.
    const unsubStockLots = firebaseService.subscribeToRecentOrOpen<StockLot>(
      "stockLots",
      { dateField: "createdAt", cutoffMs: Date.now() - 12 * 30 * 24 * 60 * 60 * 1000, openField: "status", openValues: ["EM_ESTOQUE", "RESERVADO"] },
      setStockLots
    );

    const unsubProductionOrders = firebaseService.subscribeToRecentOrOpen<ProductionOrder>(
      "productionOrders",
      { dateField: "orderDate", cutoffMs: Date.now() - 12 * 30 * 24 * 60 * 60 * 1000, openField: "status", openValues: ["PENDING", "IN_PRODUCTION"] },
      setProductionOrders
    );

    const unsubPurchaseRequests = firebaseService.subscribeToCollection<PurchaseRequest>(
      "purchaseRequests",
      (data) => setPurchaseRequests([...data].sort((a, b) => b.requestedAt - a.requestedAt))
    );

    const unsubServiceOrders = firebaseService.subscribeToRecentOrOpen<ServiceOrder>(
      "serviceOrders",
      { dateField: "createdAt", cutoffMs: Date.now() - 12 * 30 * 24 * 60 * 60 * 1000, openField: "status", openValues: ["PENDING"] },
      setServiceOrders
    );

    const unsubDashboardConfig = firebaseService.subscribeToCollection<DashboardConfig>(
      "dashboard_config",
      (data) => {
        // Ordenar por updatedAt para garantir que pegamos a versão mais recente
        const sortedData = [...data].sort((a: any, b: any) => {
          const timeA = a.updatedAt?.toMillis?.() || a.updatedAt?.seconds || 0;
          const timeB = b.updatedAt?.toMillis?.() || b.updatedAt?.seconds || 0;
          return timeB - timeA;
        });

        const mainConfig = sortedData.find(c => c.id === 'main_config') || sortedData[0];
        if (mainConfig) {
          // Reconciliar a configuração carregada com a padrão para garantir que novos cards apareçam
          const defaultCards = defaultDashboardConfig.cards;
          const currentCards = mainConfig.cards || [];
          const currentCardMap = new Map(currentCards.map(c => [c.id, c]));
          
          const reconciledCards = defaultCards.map(defCard => {
            const existing = currentCardMap.get(defCard.id);
            if (existing && typeof existing === 'object') {
              return { ...defCard, ...existing };
            }
            return defCard;
          });

          // Incluir cards que estão no Firestore mas não estão no default (suporte a IDs antigos ou customizados)
          const defaultIds = new Set(defaultCards.map(c => c.id));
          const extraCards = currentCards.filter(c => !defaultIds.has(c.id));
          
          const combinedCards = [...reconciledCards, ...extraCards];

          // Garantir que a ordem seja respeitada, sem buracos e sequencial
          combinedCards.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
          const finalCards = combinedCards.map((card, index) => ({ ...card, order: index }));

          setDashboardConfig({ ...mainConfig, cards: finalCards });
        } else {
          setDashboardConfig(defaultDashboardConfig);
        }
      }
    );

    // Coleções pequenas (1 doc por mês / 1 doc de config) do arquivamento periódico —
    // sempre carregadas por completo, sem necessidade de otimização de janela.
    const unsubMonthlySnapshots = firebaseService.subscribeToCollection<MonthlySnapshot>(
      "monthly_snapshots",
      setMonthlySnapshots
    );
    const unsubCleanupConfig = firebaseService.subscribeToCollection<CleanupConfig>(
      "cleanup_config",
      (data) => setCleanupConfig(data.find(c => c.id === 'main') || null)
    );

    return () => {
      unsubProducts();
      unsubPurchases();
      unsubSales();
      unsubTransactions();
      unsubAccounts();
      unsubGrids();
      unsubPeople();
      unsubCollaborators();
      unsubCategories();
      unsubColors();
      unsubPaymentMethods();
      unsubFamilyMembers();
      unsubPersonalContacts();
      unsubBudgets();
      unsubFlowTags();
      unsubSectors();
      unsubProductionConfigs();
      unsubWeighingRecords();
      unsubSoleStock();
      unsubPalmilhaStock();
      unsubProductionLots();
      unsubStockLots();
      unsubProductionOrders();
      unsubPurchaseRequests();
      unsubServiceOrders();
      unsubDashboardConfig();
      unsubMonthlySnapshots();
      unsubCleanupConfig();

    };
  }, [user]);

  // Lembretes externos (notificações locais) — pede permissão e (re)agenda todos os
  // lembretes pendentes uma única vez por sessão, alguns segundos após o login, dando
  // tempo dos listeners do Firestore povoarem sales/serviceOrders/productionOrders.
  // Funciona como rede de segurança: o agendamento "ao vivo" já acontece nas telas que
  // editam o lembrete, isso aqui cobre reinstalação do app ou notificações perdidas.
  const remindersSyncedRef = useRef(false);
  useEffect(() => {
    if (!user || remindersSyncedRef.current) return;
    const timer = setTimeout(() => {
      if (remindersSyncedRef.current) return;
      remindersSyncedRef.current = true;
      (async () => {
        const granted = await notificationService.requestPermission();
        if (!granted) return;
        const reminders: ReminderNotification[] = [];
        sales.filter(s => s.reminderAt).forEach(s => reminders.push({
          id: `sale-${s.id}`,
          title: s.reminderTitle || s.customerName || 'Venda',
          body: s.reminderTitle ? (s.customerName || 'Venda') : 'Lembrete de venda',
          at: s.reminderAt!,
        }));
        serviceOrders.filter(os => os.reminderAt).forEach(os => reminders.push({
          id: `os-${os.id}`,
          title: os.reminderTitle || `OS ${os.osNumber}`,
          body: os.providerName ? `Fornecedor: ${os.providerName}` : 'Lembrete de Ordem de Serviço',
          at: os.reminderAt!,
        }));
        productionOrders.forEach(order => (order.items || []).forEach((item: any) => {
          if (!item.reminderAt) return;
          reminders.push({
            id: `order-${order.id}-${item.productId}-${item.variationId}`,
            title: item.reminderTitle || `Pedido ${order.orderNumber}`,
            body: `${order.customerName || 'Estoque'} · Pedido ${order.orderNumber}`,
            at: item.reminderAt,
          });
        }));
        notificationService.rescheduleAll(reminders);
      })();
    }, 4000);
    return () => clearTimeout(timer);
  }, [user, sales, serviceOrders, productionOrders]);

  // Selection state for editing
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(
    null,
  );
  const [selectedServiceOrderId, setSelectedServiceOrderId] = useState<string | null>(null);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [searchContext, setSearchContext] = useState<string>('');
  const [productionSubScreen, setProductionSubScreen] = useState<ProductionScreenType>('MENU');

  const [currentParams, setCurrentParams] = useState<any>(null);
  
  const navigateTo = (view: ViewType, idOrParams: string | any = null, maybeParams: any = null) => {
    let id: string | null = null;
    let params: any = null;

    if (typeof idOrParams === 'string' || idOrParams === null) {
      id = idOrParams;
      params = maybeParams;
    } else {
      id = null;
      params = idOrParams;
    }

    if (view === ViewType.PRODUCT_FORM) setSelectedProductId(id);
    if (view === ViewType.PURCHASE_FORM) setSelectedPurchaseId(id);
    if (view === ViewType.SALE_FORM) setSelectedSaleId(id);
    if (view === ViewType.PERSON_DETAIL) setSelectedPersonId(id);
    if (view === ViewType.REPORT_DETAILED) setSelectedReportId(id);
    if (view === ViewType.PRODUCTION_SERVICE_ORDER_FORM) setSelectedServiceOrderId(id);
    
    if (view === ViewType.PRODUCTION_SOLE_PURCHASE) {
      setSolePurchaseParams(params);
      setIsSolePurchaseModalOpen(true);
      return;
    }

    if (view === ViewType.PRODUCTION_PALMILHA_PURCHASE) {
      setPalmilhaPurchaseParams(params);
      setIsPalmilhaPurchaseModalOpen(true);
      return;
    }

    // If params is a string, it might be the old 'search' parameter
    if (typeof params === 'string') {
      setSearchContext(params);
      setCurrentParams(null);
    } else {
      setCurrentParams(params);
      setSearchContext('');
    }

    setCurrentView(view);
    setHistory((prev) => [...prev, view]);
    
    // Reset sub-screen when navigating to a new root view, 
    // unless we specifically set it later
    if (view !== ViewType.PRODUCTION_CONFIG) {
      setProductionSubScreen('MENU');
    }
  };

  // Resolução compartilhada com o "Scanner Rápido" do Dashboard
  // (scannerService.resolveScanResult) — garante que ambos tenham o mesmo
  // comportamento ao abrir um Mapa/pedido a partir de uma etiqueta escaneada.
  // Carrega o Mapa diretamente (local ou Firestore) ANTES de navegar, em vez de
  // navegar e esperar o PCP encontrar o Mapa por conta própria.
  const handleHeaderScan = async (parsed: any) => {
    const resolved = await scannerService.resolveScanResult(parsed, products, productionLots);
    if (!resolved.ok) {
      toast.show(resolved.error);
      return;
    }

    scannerService.pushScanHistory(resolved.entry);

    const { sectorId, lotId, orderId, itemIdx, scanNonce } = resolved.nav;
    navigateTo(ViewType.PRODUCTION_PCP, { initialSectorId: sectorId, initialLotId: lotId, initialOrderId: orderId, initialItemIdx: itemIdx, initialScanNonce: scanNonce });
  };

  const navigateToProduction = (
    subScreen: ProductionScreenType | 'PCP' | 'NECESSIDADES',
    sectorId?: string,
    lotId?: string,
    orderId?: string,
    itemIdx?: string | number,
    scanNonce?: number,
    osId?: string,
    openMode?: 'modal' | 'sector'
  ) => {
    if (subScreen === 'PCP') {
      navigateTo(ViewType.PRODUCTION_PCP, (sectorId || lotId || osId) ? {
        initialSectorId: sectorId,
        initialLotId: lotId,
        initialOrderId: orderId,
        initialItemIdx: itemIdx,
        initialScanNonce: scanNonce,
        initialOSId: osId,
        initialOSNonce: osId ? Date.now() : undefined,
        initialOpenMode: openMode
      } : null);
    } else if (subScreen === 'NECESSIDADES') {
      navigateTo(ViewType.PRODUCTION_PCP, { initialTab: 'needs' });
    } else {
      setProductionSubScreen(subScreen);
      navigateTo(ViewType.PRODUCTION_CONFIG);
    }
  };

  const goBack = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop();
      const lastView = newHistory[newHistory.length - 1];
      setHistory(newHistory);
      setCurrentView(lastView);
    }
  };

  const resetTo = (view: ViewType) => {
    setCurrentView(view);
    setHistory([view]);
  };

  const toggleDarkMode = () => setAppTheme(prev => prev === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    const handleChangeView = (e: any) => {
      navigateTo(e.detail);
    };
    window.addEventListener('change-view', handleChangeView);
    return () => window.removeEventListener('change-view', handleChangeView);
  }, []);

  useEffect(() => {
    localStorage.setItem('app_theme_pref', appTheme);
    const root = document.documentElement;
    const body = document.body;

    // Remove all theme classes first
    root.classList.remove(...ALL_THEME_CLASSES);
    body.classList.remove(...ALL_THEME_CLASSES);

    const classes = THEME_VISUALS[appTheme]?.cssClass.split(' ').filter(Boolean) || [];
    if (classes.length > 0) {
      root.classList.add(...classes);
      body.classList.add(...classes);
    }
  }, [appTheme]);

  useEffect(() => {
    if (!isA11yOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#a11y-panel')) setIsA11yOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isA11yOpen]);

  const handleCheckStatusChange = async (
    purchaseId: string,
    checkId: string,
    newStatus: "PENDING" | "CLEARED" | "OVERDUE",
  ) => {
    try {
      const purchase = purchases.find((p) => p.id === purchaseId);
      if (!purchase || !purchase.checks) return;

      const updatedChecks = purchase.checks.map((c) =>
        c.id === checkId ? { ...c, status: newStatus } : c,
      );

      const updatedPurchase = { ...purchase, checks: updatedChecks };
      await firebaseService.saveDocument("purchases", updatedPurchase);
    } catch (e) {
      console.error(e);
      toast.show("Erro ao atualizar status do cheque.");
    }
  };

  const handleResetDatabase = async () => {
    try {
      const collectionsToClear = [
        { name: "transactions", items: transactions },
        { name: "purchases", items: purchases },
        { name: "sales", items: sales },
        { name: "products", items: products },
        { name: "productionLots", items: productionLots },
        { name: "grids", items: grids },
        { name: "people", items: people },
        { name: "categories", items: categories },
        { name: "colors", items: colors },
        { name: "accounts", items: accounts },
        { name: "paymentMethods", items: paymentMethods },
      ];
      for (const col of collectionsToClear) {
        for (const item of col.items) {
          if (item.id) await firebaseService.deleteDocument(col.name, item.id);
        }
      }
    } catch (e) {
      console.error("Error resetting database:", e);
      throw e;
    }
  };

  const handleSelectiveDelete = async (categories: string[]) => {
    for (const cat of categories) {
      switch (cat) {
        case 'GRADES':
          for (const item of grids) await firebaseService.deleteDocument('grids', item.id);
          break;
        case 'CORES':
          for (const item of colors) await firebaseService.deleteDocument('colors', item.id);
          break;
        case 'SETORES':
          for (const item of sectors) await firebaseService.deleteDocument('sectors', item.id);
          break;
        case 'ETAPAS':
          for (const item of flowTags) await firebaseService.deleteDocument('flowTags', item.id);
          break;
        case 'UNIDADES':
          for (const item of productionConfigs.filter(c => c.type === 'UNIT'))
            await firebaseService.deleteDocument('productionConfigs', item.id);
          break;
        case 'PRAZOS':
          for (const item of productionConfigs.filter(c => c.type === 'DEADLINE'))
            await firebaseService.deleteDocument('productionConfigs', item.id);
          break;
        case 'INFESTO':
          for (const item of productionConfigs.filter(c => c.type === 'INFESTO'))
            await firebaseService.deleteDocument('productionConfigs', item.id);
          break;
        case 'EMBALAGENS':
          for (const item of productionConfigs.filter(c => c.type === 'PACKAGING'))
            await firebaseService.deleteDocument('productionConfigs', item.id);
          break;
        case 'SOLADOS':
          for (const item of productionConfigs.filter(c => c.type === 'MOLD'))
            await firebaseService.deleteDocument('productionConfigs', item.id);
          for (const item of soleStockEntries)
            await firebaseService.deleteDocument('soleStock', item.id);
          break;
        case 'PECAS':
          for (const item of productionConfigs.filter(c => c.type === 'PIECE'))
            await firebaseService.deleteDocument('productionConfigs', item.id);
          break;
        case 'INSUMOS':
          for (const item of productionConfigs.filter(c => c.type === 'MATERIAL'))
            await firebaseService.deleteDocument('productionConfigs', item.id);
          break;
      }
    }
  };

  const handleDuplicateProduct = async (product: Product) => {
    try {
      const newProduct: Product = JSON.parse(JSON.stringify(product));
      newProduct.id = generateId();
      newProduct.name = `${newProduct.name} (Cópia)`;
      newProduct.reference = `${newProduct.reference}-COPY`;
      newProduct.createdAt = Date.now();
      
      // Reset stock in variations to 0 for the copy and give new variation IDs
      newProduct.variations = newProduct.variations.map(v => ({
        ...v,
        id: generateId(),
        stock: Object.keys(v.stock).reduce((acc, key) => ({ ...acc, [key]: 0 }), {})
      }));

      await firebaseService.saveDocument("products", newProduct);
      toast.show("Modelo duplicado com sucesso!");
    } catch (e: any) {
      console.error(e);
      toast.show("Erro ao duplicar produto: " + (e.message || e));
    }
  };

  // "Transferir para Estoque" — cancela a venda e converte os lotes RESERVADO dessa
  // venda em EM_ESTOQUE, incrementando o estoque de produtos. Não estorna transações
  // financeiras (use handleCancelSaleWithRevert para reverter tudo).
  const handleTransferSaleToStock = async (saleId: string) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;

    const reservedLots = stockLots.filter(l => l.saleId === saleId && l.status === 'RESERVADO');
    if (reservedLots.length === 0) {
      toast.show('Nenhum lote produzido reservado para transferir.');
      return;
    }

    try {
      const productUpdates = new Map<string, any>();
      const getProd = (id: string) => {
        if (productUpdates.has(id)) return productUpdates.get(id);
        const p = products.find(pr => pr.id === id);
        if (!p) return null;
        const cloned = JSON.parse(JSON.stringify(p));
        productUpdates.set(id, cloned);
        return cloned;
      };

      // Incrementa estoque do produto para cada lote RESERVADO
      for (const lot of reservedLots) {
        const prod = getProd(lot.productId);
        if (!prod) continue;
        const variation = prod.variations.find((v: any) => v.id === lot.variationId);
        if (!variation) continue;

        if (lot.boxQty !== undefined) {
          const boxQty = lot.boxQty || 0;
          variation.stock['WHOLESALE'] = (variation.stock['WHOLESALE'] || 0) + boxQty;
          if (lot.pkgId && boxQty > 0) {
            const allocations = [...(variation.stockPkgAllocations || [])];
            const idx = allocations.findIndex((a: any) => a.pkgId === lot.pkgId);
            if (idx >= 0) {
              allocations[idx] = { ...allocations[idx], qty: allocations[idx].qty + boxQty };
            } else {
              allocations.push({ pkgId: lot.pkgId, qty: boxQty });
            }
            variation.stockPkgAllocations = allocations;
          }
        } else {
          Object.entries(lot.sizeBreakdown).forEach(([size, qty]) => {
            variation.stock[size] = (variation.stock[size] || 0) + (qty as number);
          });
        }
      }

      // Salva os produtos atualizados
      for (const [, prod] of productUpdates) {
        await firebaseService.saveDocument('products', prod);
      }

      // Converte lotes RESERVADO → EM_ESTOQUE removendo vínculo com a venda
      const now = Date.now();
      for (const lot of reservedLots) {
        await firebaseService.updateDocument('stockLots', lot.id, {
          status: 'EM_ESTOQUE',
          saleId: null,
          saleOrderNumber: null,
          customerName: null,
          updatedAt: now,
        });
      }

      // Cancela a venda
      await firebaseService.updateDocument('sales', saleId, { status: SaleStatus.CANCELLED });

      toast.show(`Pedido cancelado. ${reservedLots.length} lote(s) transferidos para o estoque.`);
    } catch (e: any) {
      console.error(e);
      toast.show('Erro ao transferir para estoque: ' + (e.message || e));
    }
  };

  const handleCancelOnlySale = async (id: string) => {
    const sale = sales.find(s => s.id === id);
    if (!sale) return;

    if (sale.status === SaleStatus.CANCELLED) {
      toast.show("Esta venda já está cancelada/estornada.");
      return;
    }

    try {
      const updatedSale = { ...sale, status: SaleStatus.CANCELLED };
      await firebaseService.saveDocument("sales", updatedSale);
      toast.show("Venda marcada como cancelada (sem estorno).");
    } catch (e: any) {
      console.error(e);
      toast.show("Erro ao cancelar venda: " + (e.message || e));
    }
  };

  // "Liberar Pedido" — baixa manual de uma venda: marca todos os StockLots RESERVADO
  // vinculados a essa venda como ENTREGUE e marca a venda/itens como entregues.
  const handleReleaseSale = async (saleId: string) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;

    const reservedLots = stockLots.filter(l => l.saleId === saleId && l.status === 'RESERVADO');
    if (reservedLots.length === 0) return;

    try {
      const now = Date.now();
      for (const lot of reservedLots) {
        await firebaseService.updateDocument('stockLots', lot.id, {
          status: 'ENTREGUE',
          deliveredAt: now,
          updatedAt: now,
        });
      }

      const updatedItems = sale.items.map(item => ({ ...item, fulfilled: true }));
      await firebaseService.updateDocument('sales', saleId, {
        items: updatedItems,
        deliveryStatus: 'DELIVERED',
        deliveredAt: now,
      });

      toast.show('Pedido liberado para o cliente.');
    } catch (e: any) {
      console.error(e);
      toast.show('Erro ao liberar pedido: ' + (e.message || e));
    }
  };

  // "Expedir" — dá baixa no ESTOQUE GERAL (variation.stock) dos itens da venda que
  // ainda não foram abatidos (fulfilled !== true) e que têm estoque suficiente.
  // Marca esses itens como fulfilled; se todos forem atendidos, marca como entregue.
  const handleExpediteSale = async (saleId: string) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;
    try {
      const allAlreadyFulfilled = sale.items.every(it => it.fulfilled === true);
      if (allAlreadyFulfilled) {
        await firebaseService.updateDocument('sales', saleId, {
          deliveryStatus: 'DELIVERED',
          deliveredAt: Date.now(),
        });
        toast.show('Venda expedida — pedido entregue.');
        return;
      }

      const productUpdates = new Map<string, any>();
      const getProd = (id: string) => {
        if (productUpdates.has(id)) return productUpdates.get(id);
        const p = products.find(pr => pr.id === id);
        if (!p) return null;
        const cloned = JSON.parse(JSON.stringify(p));
        productUpdates.set(id, cloned);
        return cloned;
      };

      let anyExpedited = false;
      const newItems = sale.items.map(item => {
        if (item.fulfilled === true) return item;
        const prod = getProd(item.productId);
        if (!prod) return item;
        const variation = prod.variations.find((v: any) => v.id === item.variationId);
        if (!variation) return item;
        const key = item.saleType === SaleType.WHOLESALE ? 'WHOLESALE' : (item.size || 'WHOLESALE');
        const available = variation.stock?.[key] || 0;
        if (available < item.quantity) return item;

        const newQty = available - item.quantity;
        variation.stock[key] = newQty;
        anyExpedited = true;

        // Recorta stockPkgAllocations na mesma proporção do abate (mesma lógica de
        // "Separar Caixas") e guarda o snapshot em separatedPkgAllocations — sem isso,
        // reverter a expedição depois devolve a quantidade como "Avulso" (perde a
        // categorização de embalagem) por não ter de onde restaurar.
        let consumedAllocations: any[] = [];
        if (key === 'WHOLESALE') {
          const allocsBefore: any[] = (variation.stockPkgAllocations || []).map((a: any) => ({ ...a }));
          const totalAlloc = allocsBefore.reduce((s: number, a: any) => s + a.qty, 0);
          if (newQty < totalAlloc) {
            let excess = totalAlloc - newQty;
            const trimmed = allocsBefore.map((a: any) => ({ ...a }));
            for (let i = trimmed.length - 1; i >= 0 && excess > 0; i--) {
              const cut = Math.min(trimmed[i].qty, excess);
              trimmed[i].qty -= cut;
              excess -= cut;
            }
            variation.stockPkgAllocations = trimmed.filter((a: any) => a.qty > 0);
            consumedAllocations = trimmed
              .map((after: any, i: number) => ({
                ...allocsBefore[i],
                qty: allocsBefore[i].qty - after.qty,
              }))
              .filter((a: any) => a.qty > 0);
          }
        }

        if (consumedAllocations.length === 0) return { ...item, fulfilled: true };

        const prevConsumed: any[] = item.separatedPkgAllocations || [];
        const mergedConsumed = [...prevConsumed];
        for (const ca of consumedAllocations) {
          const isAvulsa = ca.pkgId === 'AVULSA';
          if (!isAvulsa) {
            const idx = mergedConsumed.findIndex((x: any) => x.pkgId === ca.pkgId);
            if (idx >= 0) { mergedConsumed[idx] = { ...mergedConsumed[idx], qty: mergedConsumed[idx].qty + ca.qty }; continue; }
          }
          mergedConsumed.push({ ...ca });
        }

        return { ...item, fulfilled: true, separatedPkgAllocations: mergedConsumed };
      });

      if (!anyExpedited) {
        toast.show('Nenhum item com estoque suficiente para expedir.');
        return;
      }

      for (const [, prod] of productUpdates) {
        await firebaseService.saveDocument('products', prod);
      }

      const allFulfilled = newItems.every(it => it.fulfilled === true);
      await firebaseService.updateDocument('sales', saleId, {
        items: newItems,
        ...(allFulfilled ? { deliveryStatus: 'DELIVERED', deliveredAt: Date.now() } : {}),
      });

      toast.show(allFulfilled
        ? 'Venda expedida — estoque baixado e pedido entregue.'
        : 'Itens disponíveis expedidos — estoque baixado.');
    } catch (e: any) {
      console.error(e);
      toast.show('Erro ao expedir: ' + (e.message || e));
    }
  };

  // "Reverter Expedição" — desfaz a baixa: devolve ao estoque geral as quantidades dos
  // itens já abatidos (fulfilled === true) e marca-os como aguardando estoque novamente.
  // Para itens WHOLESALE: também restaura stockPkgAllocations a partir do snapshot
  // separatedPkgAllocations salvo na separação, e zera boxesSeparated.
  const handleRevertExpedition = async (saleId: string) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;
    try {
      const productUpdates = new Map<string, any>();
      const getProd = (id: string) => {
        if (productUpdates.has(id)) return productUpdates.get(id);
        const p = products.find(pr => pr.id === id);
        if (!p) return null;
        const cloned = JSON.parse(JSON.stringify(p));
        productUpdates.set(id, cloned);
        return cloned;
      };

      let anyReverted = false;
      const newItems = sale.items.map(item => {
        const hasSeparation = item.fulfilled === true || (item.boxesSeparated || 0) > 0;
        if (!hasSeparation) return item;

        // Calcula exatamente quanto foi separado (e portanto precisa voltar pro estoque)
        const qtyToRestore = (item.boxesSeparated || 0) > 0 ? item.boxesSeparated! : (item.fulfilled ? item.quantity : 0);

        if (qtyToRestore > 0) {
          const prod = getProd(item.productId);
          if (prod) {
            const variation = prod.variations.find((v: any) => v.id === item.variationId);
            if (variation) {
              const key = item.saleType === SaleType.WHOLESALE ? 'WHOLESALE' : (item.size || 'WHOLESALE');
              variation.stock[key] = (variation.stock?.[key] || 0) + qtyToRestore;

              // Restaura embalagens (stockPkgAllocations) para itens WHOLESALE
              if (key === 'WHOLESALE' && item.separatedPkgAllocations && item.separatedPkgAllocations.length > 0) {
                const currentAllocs: any[] = variation.stockPkgAllocations || [];
                const restored = [...currentAllocs];
                for (const ca of item.separatedPkgAllocations) {
                  const isAvulsa = ca.pkgId === 'AVULSA';
                  if (!isAvulsa) {
                    const idx = restored.findIndex((a: any) => a.pkgId === ca.pkgId);
                    if (idx >= 0) {
                      restored[idx] = { ...restored[idx], qty: restored[idx].qty + ca.qty };
                      continue;
                    }
                  }
                  restored.push({ ...ca });
                }
                variation.stockPkgAllocations = restored;
              }
            }
          }
        }

        anyReverted = true;
        return {
          ...item,
          fulfilled: false,
          boxesSeparated: 0,
          separatedPkgAllocations: undefined,
        };
      });

      // Se nenhum item tinha separação mas a venda está marcada como "Entregue" (ex.:
      // pedido editado depois da expedição, ficando com itens novos nunca abatidos),
      // ainda assim limpa a marcação — senão a venda fica travada sem nenhuma saída
      // pra desfazer o status de entrega.
      const wasDelivered = sale.deliveryStatus === 'DELIVERED';
      if (!anyReverted && !wasDelivered) {
        toast.show('Não há itens expedidos para reverter.');
        return;
      }

      for (const [, prod] of productUpdates) {
        await firebaseService.saveDocument('products', prod);
      }

      await firebaseService.updateDocument('sales', saleId, {
        items: newItems,
        deliveryStatus: 'PENDING',
      });

      toast.show(anyReverted
        ? 'Expedição revertida — estoque e embalagens restaurados.'
        : 'Marcação de "Pedido Entregue" removida.');
    } catch (e: any) {
      console.error(e);
      toast.show('Erro ao reverter expedição: ' + (e.message || e));
    }
  };

  // Observação livre por cor — usada em "Disponível em Estoque" (StockGlanceView),
  // que é só-leitura pra estoque/balanço mas precisa permitir essa anotação pontual.
  const handleUpdateVariationStockNote = async (productId: string, variationId: string, note: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const updatedVariations = product.variations.map(v =>
      v.id === variationId ? { ...v, stockNote: note || undefined } : v
    );
    await firebaseService.saveDocument('products', { ...product, variations: updatedVariations });
  };

  const handlePartialRevertSeparacao = async (
    saleId: string,
    reverts: { itemIdx: number; quantity: number }[]
  ) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;
    try {
      const productUpdates = new Map<string, any>();
      const getProd = (id: string) => {
        if (productUpdates.has(id)) return productUpdates.get(id);
        const p = products.find(pr => pr.id === id);
        if (!p) return null;
        const cloned = JSON.parse(JSON.stringify(p));
        productUpdates.set(id, cloned);
        return cloned;
      };

      const reservedLots = stockLots.filter(l => l.saleId === saleId && l.status === 'RESERVADO');
      const newItems = sale.items.map(item => ({ ...item }));

      for (const rev of reverts) {
        if (rev.quantity <= 0) continue;
        const item = newItems[rev.itemIdx];
        if (!item) continue;

        const currentSeparated = item.boxesSeparated || 0;
        const qtyToRestore = Math.min(rev.quantity, currentSeparated);
        if (qtyToRestore <= 0) continue;

        const itemReservedLots = reservedLots.filter(
          l => l.productId === item.productId && l.variationId === item.variationId
        );

        let updatedPkgSnapshot: any[] | undefined = item.separatedPkgAllocations;

        if (itemReservedLots.length === 0) {
          const prod = getProd(item.productId);
          if (prod) {
            const variation = prod.variations.find((v: any) => v.id === item.variationId);
            if (variation) {
              const key = item.saleType === SaleType.WHOLESALE ? 'WHOLESALE' : (item.size || 'WHOLESALE');
              variation.stock[key] = (variation.stock[key] || 0) + qtyToRestore;

              // Restaura stockPkgAllocations com a embalagem padrão do produto —
              // o pkgId é fixo e imutável: determinado pelo grid padrão do produto.
              if (key === 'WHOLESALE') {
                const gridId = (prod as any).productionGridId || (prod as any).defaultGridId;
                const defaultPkg = gridId
                  ? productionConfigs.find(c => c.type === 'PACKAGING' && (c.metadata as any)?.productionGradeId === gridId)
                  : undefined;
                // Fallback: primeiro pkgId do snapshot (se o produto ainda não tem grid configurado)
                const pkgId = defaultPkg?.id || (item.separatedPkgAllocations?.[0]?.pkgId);

                if (pkgId) {
                  const currentAllocs: any[] = (variation.stockPkgAllocations || []).map((a: any) => ({ ...a }));
                  const idx = currentAllocs.findIndex((a: any) => a.pkgId === pkgId);
                  if (idx >= 0) {
                    currentAllocs[idx] = { ...currentAllocs[idx], qty: currentAllocs[idx].qty + qtyToRestore };
                  } else {
                    currentAllocs.push({ pkgId, qty: qtyToRestore });
                  }
                  variation.stockPkgAllocations = currentAllocs;
                }

                // Reduz separatedPkgAllocations pelo que foi devolvido (LIFO)
                // para que uma reversão total posterior não restaure mais do que o devido.
                if (item.separatedPkgAllocations?.length) {
                  const newSnapshot = item.separatedPkgAllocations.map((a: any) => ({ ...a }));
                  let remaining = qtyToRestore;
                  for (let i = newSnapshot.length - 1; i >= 0 && remaining > 0; i--) {
                    const take = Math.min(newSnapshot[i].qty, remaining);
                    newSnapshot[i] = { ...newSnapshot[i], qty: newSnapshot[i].qty - take };
                    remaining -= take;
                  }
                  updatedPkgSnapshot = newSnapshot.filter((a: any) => a.qty > 0);
                }
              }
            }
          }
        }

        const newSeparated = currentSeparated - qtyToRestore;
        newItems[rev.itemIdx] = {
          ...item,
          boxesSeparated: newSeparated,
          fulfilled: newSeparated >= item.quantity,
          separatedPkgAllocations: newSeparated === 0 ? undefined : (updatedPkgSnapshot?.length ? updatedPkgSnapshot : undefined),
        };
      }

      for (const [, prod] of productUpdates) {
        await firebaseService.saveDocument('products', prod);
      }

      await firebaseService.updateDocument('sales', saleId, { items: newItems });
      toast.show('Reversão parcial registrada com sucesso.');
    } catch (e: any) {
      console.error(e);
      toast.show('Erro ao reverter separação: ' + (e.message || e));
    }
  };

  // "Separar Caixas" — registra a separação física por item.
  // Para itens SEM lotes RESERVADO vinculados: abate do estoque geral do produto.
  // Para itens COM lotes RESERVADO (produção casada): apenas atualiza boxesSeparated
  // (o estoque nunca foi creditado ao produto nesses casos).
  const handleFixPkgAllocations = async (): Promise<{ fixed: number; total: number }> => {
    let fixed = 0;
    const total = products.length;
    for (const product of products) {
      let changed = false;
      const updatedVariations = product.variations.map((v: any) => {
        const boxQty: number = v.stock?.['WHOLESALE'] ?? 0;
        const allocs: any[] = v.stockPkgAllocations || [];
        const totalAlloc = allocs.reduce((s: number, a: any) => s + a.qty, 0);
        if (totalAlloc > boxQty) {
          let excess = totalAlloc - boxQty;
          const trimmed = allocs.map((a: any) => ({ ...a }));
          for (let i = trimmed.length - 1; i >= 0 && excess > 0; i--) {
            const cut = Math.min(trimmed[i].qty, excess);
            trimmed[i].qty -= cut;
            excess -= cut;
          }
          changed = true;
          return { ...v, stockPkgAllocations: trimmed.filter((a: any) => a.qty > 0) };
        }
        return v;
      });
      if (changed) {
        await firebaseService.saveDocument('products', { ...product, variations: updatedVariations });
        fixed++;
      }
    }
    return { fixed, total };
  };

  const handleSepararCaixas = async (
    saleId: string,
    separations: { itemIdx: number; quantity: number }[]
  ) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;
    try {
      const productUpdates = new Map<string, any>();
      const getProd = (id: string) => {
        if (productUpdates.has(id)) return productUpdates.get(id);
        const p = products.find(pr => pr.id === id);
        if (!p) return null;
        const cloned = JSON.parse(JSON.stringify(p));
        productUpdates.set(id, cloned);
        return cloned;
      };

      const reservedLots = stockLots.filter(l => l.saleId === saleId && l.status === 'RESERVADO');
      const newItems = sale.items.map((item, idx) => ({ ...item }));

      for (const sep of separations) {
        if (sep.quantity <= 0) continue;
        const item = newItems[sep.itemIdx];
        if (!item) continue;

        const itemReservedLots = reservedLots.filter(
          l => l.productId === item.productId && l.variationId === item.variationId
        );

        // Snapshot das alocações consumidas (para restaurar no revert)
        let consumedAllocations: any[] = [];

        if (itemReservedLots.length === 0) {
          // Sem lotes reservados: abate do estoque geral
          const prod = getProd(item.productId);
          if (prod) {
            const variation = prod.variations.find((v: any) => v.id === item.variationId);
            if (variation) {
              const key = item.saleType === SaleType.WHOLESALE ? 'WHOLESALE' : (item.size || 'WHOLESALE');
              const available = variation.stock?.[key] || 0;
              const newQty = Math.max(0, available - sep.quantity);
              variation.stock[key] = newQty;

              // Trim pkg allocations so totalAllocated never exceeds new boxQty
              // AND save a snapshot of what was consumed for later revert
              if (key === 'WHOLESALE') {
                const allocsBefore: any[] = (variation.stockPkgAllocations || []).map((a: any) => ({ ...a }));
                const totalAlloc = allocsBefore.reduce((s: number, a: any) => s + a.qty, 0);
                if (newQty < totalAlloc) {
                  let excess = totalAlloc - newQty;
                  const trimmed = allocsBefore.map((a: any) => ({ ...a }));
                  for (let i = trimmed.length - 1; i >= 0 && excess > 0; i--) {
                    const cut = Math.min(trimmed[i].qty, excess);
                    trimmed[i].qty -= cut;
                    excess -= cut;
                  }
                  const allocsAfter = trimmed.filter((a: any) => a.qty > 0);
                  variation.stockPkgAllocations = allocsAfter;

                  // Calcula o diff por índice (order-preserving) — garante corretude
                  // mesmo com múltiplas entradas AVULSA de customBreakdown distintos
                  consumedAllocations = trimmed
                    .map((after: any, i: number) => ({
                      ...allocsBefore[i], // preserva pkgId, customBreakdown, etc.
                      qty: allocsBefore[i].qty - after.qty, // = quanto foi removido neste slot
                    }))
                    .filter((a: any) => a.qty > 0);
                }
              }
            }
          }
        }
        // Com lotes reservados: sem alteração no estoque (nunca foi creditado ao produto)

        const newSeparated = (item.boxesSeparated || 0) + sep.quantity;
        // Acumula o snapshot de alocações consumidas (merge com possíveis separações parciais anteriores)
        const prevConsumed: any[] = item.separatedPkgAllocations || [];
        const mergedConsumed = [...prevConsumed];
        for (const ca of consumedAllocations) {
          // Avulsas: append sempre (cada uma tem customBreakdown distinto)
          // Padrões: merge por pkgId (soma qty)
          const isAvulsa = ca.pkgId === 'AVULSA';
          if (!isAvulsa) {
            const idx = mergedConsumed.findIndex((x: any) => x.pkgId === ca.pkgId);
            if (idx >= 0) { mergedConsumed[idx] = { ...mergedConsumed[idx], qty: mergedConsumed[idx].qty + ca.qty }; continue; }
          }
          mergedConsumed.push({ ...ca });
        }

        newItems[sep.itemIdx] = {
          ...item,
          boxesSeparated: newSeparated,
          fulfilled: newSeparated >= item.quantity ? true : item.fulfilled,
          ...(mergedConsumed.length > 0 ? { separatedPkgAllocations: mergedConsumed } : {}),
        };
      }

      for (const [, prod] of productUpdates) {
        await firebaseService.saveDocument('products', prod);
      }

      // Separar caixas só deixa o pedido PRONTO (reservado/abatido do estoque) — a
      // entrega em si é um passo manual e separado ("Liberar Pedido"), por isso não
      // marca deliveryStatus aqui mesmo quando todos os itens já foram separados.
      const allFulfilled = newItems.every(it => it.fulfilled === true);
      await firebaseService.updateDocument('sales', saleId, {
        items: newItems,
      });

      toast.show(allFulfilled
        ? 'Todos os itens separados — pedido pronto para liberação.'
        : 'Separação registrada com sucesso.');
    } catch (e: any) {
      console.error(e);
      toast.show('Erro ao registrar separação: ' + (e.message || e));
    }
  };

  useEffect(() => {
    const handleOpenModal = (e: any) => {
      const { params } = e.detail;
      setSolePurchaseParams(params);
      setIsSolePurchaseModalOpen(true);
    };
    window.addEventListener('open-sole-purchase-modal' as any, handleOpenModal);
    return () => window.removeEventListener('open-sole-purchase-modal' as any, handleOpenModal);
  }, []);

  useEffect(() => {
    const handleOpenModal = (e: any) => {
      const { params } = e.detail;
      setPalmilhaPurchaseParams(params);
      setIsPalmilhaPurchaseModalOpen(true);
    };
    window.addEventListener('open-palmilha-purchase-modal' as any, handleOpenModal);
    return () => window.removeEventListener('open-palmilha-purchase-modal' as any, handleOpenModal);
  }, []);

  const handleSaveSolePurchase = async (purchase: Purchase, soleItems: SolePurchaseItem[]) => {

    try {
      if (!purchase || !soleItems) throw new Error("Dados de compra incompletos");
      if (!purchase.date) purchase.date = Date.now();
      if (purchase.total === undefined || purchase.total === null) purchase.total = 0;

      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Usuário não autenticado");

      const purchaseToSave = { ...purchase, items: soleItems };

      // Pre-generate ID so the transaction can reference it for the financial entry
      const purchaseId = (purchaseToSave as any).id || doc(collection(db, `users/${uid}/purchases`)).id;
      const finalPurchaseId = purchaseId;

      // Atomic: save purchase document + update sole stock in one transaction
      await firebaseService.runAtomic(async (txn) => {
        // Reads: load existing sole stock entries we'll need to update
        const soleStockOpsMap = new Map<string, { ref: any; docSnap: any; isNew: boolean }>();
        if (purchase.registerAsReceived === true) {
          for (const item of soleItems) {
            const key = `${item.moldId}_${item.colorId}`;
            if (!soleStockOpsMap.has(key)) {
              const existing = soleStockEntries.find(s => s.moldId === item.moldId && s.colorId === item.colorId);
              if (existing) {
                const ref = doc(db, `users/${uid}/soleStock`, existing.id);
                const docSnap = await txn.get(ref);
                soleStockOpsMap.set(key, { ref, docSnap, isNew: false });
              } else {
                const newRef = doc(collection(db, `users/${uid}/soleStock`));
                soleStockOpsMap.set(key, { ref: newRef, docSnap: null, isNew: true });
              }
            }
          }
        }

        // Write: purchase document
        const { id: _id, ...purchasePayload } = purchaseToSave as any;
        const purchaseRef = doc(db, `users/${uid}/purchases`, purchaseId);
        txn.set(purchaseRef, purchasePayload, { merge: true });

        // Write: sole stock entries
        if (purchase.registerAsReceived === true) {
          for (const item of soleItems) {
            const key = `${item.moldId}_${item.colorId}`;
            const op = soleStockOpsMap.get(key);
            if (!op) continue;

            if (!op.isNew && op.docSnap?.exists()) {
              const updatedStock = { ...op.docSnap.data().stock };
              Object.entries(item.quantities).forEach(([size, qty]) => {
                updatedStock[size] = (updatedStock[size] || 0) + qty;
              });
              const totalPairs = Object.values(updatedStock).reduce((acc: number, curr) => acc + (Number(curr) || 0), 0);
              txn.update(op.ref, {
                stock: updatedStock, totalPairs,
                unitCost: item.unitCost,
                totalCost: totalPairs * parseLocaleNumber(item.unitCost),
                purchaseDate: purchase.date, updatedAt: Date.now()
              });
            } else {
              const totalPairs = Object.values(item.quantities).reduce((acc: number, curr) => acc + (Number(curr) || 0), 0);
              txn.set(op.ref, {
                moldId: item.moldId, moldName: item.moldName,
                colorId: item.colorId, colorName: item.colorName,
                supplierId: purchase.supplierId,
                supplierName: people.find(p => p.id === purchase.supplierId)?.name || 'Fornecedor',
                stock: item.quantities, totalPairs,
                unitCost: parseLocaleNumber(item.unitCost),
                totalCost: parseLocaleNumber(item.totalCost),
                purchaseDate: purchase.date, updatedAt: Date.now()
              });
            }
          }
        }
      });

      // Non-critical: update purchase request status
      if (purchase.registerAsReceived && solePurchaseParams?.requestId) {
        const request = purchaseRequests.find(r => r.id === solePurchaseParams.requestId);
        if (request) {
          const updatedReceivedBreakdown = { ...(request.receivedBreakdown || {}) };
          let totalReceivedNow = 0;
          soleItems.forEach(item => {
            Object.entries(item.quantities).forEach(([size, qty]) => {
              updatedReceivedBreakdown[size] = (updatedReceivedBreakdown[size] || 0) + qty;
              totalReceivedNow += qty;
            });
          });
          const totalReceivedAll = (request.receivedQty || 0) + totalReceivedNow;
          const isFullyReceived = totalReceivedAll >= request.requiredQty;
          await firebaseService.updateDocument("purchaseRequests", request.id, {
            receivedQty: totalReceivedAll,
            receivedBreakdown: updatedReceivedBreakdown,
            status: isFullyReceived ? 'RECEIVED' : 'ORDERED',
            updatedAt: Date.now()
          });
        }
      }

      // Financial entry — financeService.createTransaction handles balance update internally
      if (purchase.paymentTerm === PaymentTerm.CASH && purchase.accountId) {
        const transaction: Omit<Transaction, 'id'> = {
          type: TransactionType.EXPENSE,
          amount: parseLocaleNumber(purchase.total),
          date: purchase.date,
          categoryId: purchase.categoryId || (categories || []).find(c => String(c.name || '').toLowerCase().includes('solado'))?.id || categories?.[0]?.id || 'cat1',
          accountId: purchase.accountId,
          description: `Compra de Solados - ${people.find(p => p.id === purchase.supplierId)?.name || purchase.supplierId}`,
          status: 'COMPLETED',
          relatedId: finalPurchaseId
        };
        await financeService.createTransaction(transaction);
      }

      toast.show("Compra de solados registrada e estoque atualizado com sucesso!");
      setIsSolePurchaseModalOpen(false);
      setSolePurchaseParams(null);
    } catch (err: any) {
      console.error("[App] Erro crítico ao salvar compra de sola:", err);
      toast.show("Erro ao salvar compra: " + (err.message || JSON.stringify(err)));
    }
  };

  const handleSavePalmilhaPurchase = async (purchase: Purchase, palmilhaItems: PalmilhaPurchaseItem[]) => {

    try {
      if (!purchase || !palmilhaItems) throw new Error("Dados de compra incompletos");
      if (!purchase.date) purchase.date = Date.now();
      if (purchase.total === undefined || purchase.total === null) purchase.total = 0;

      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Usuário não autenticado");

      const purchaseToSave = { ...purchase, items: palmilhaItems };

      // Pre-generate ID so the transaction can reference it for the financial entry
      const purchaseId = (purchaseToSave as any).id || doc(collection(db, `users/${uid}/purchases`)).id;
      const finalPurchaseId = purchaseId;

      // Atomic: save purchase document + update palmilha stock in one transaction
      await firebaseService.runAtomic(async (txn) => {
        // Reads: load existing palmilha stock entries we'll need to update
        const palmilhaStockOpsMap = new Map<string, { ref: any; docSnap: any; isNew: boolean }>();
        if (purchase.registerAsReceived === true) {
          for (const item of palmilhaItems) {
            const key = `${item.toolId}_${item.colorId}`;
            if (!palmilhaStockOpsMap.has(key)) {
              const existing = palmilhaStockEntries.find(s => s.toolId === item.toolId && s.colorId === item.colorId);
              if (existing) {
                const ref = doc(db, `users/${uid}/palmilhaStock`, existing.id);
                const docSnap = await txn.get(ref);
                palmilhaStockOpsMap.set(key, { ref, docSnap, isNew: false });
              } else {
                const newRef = doc(collection(db, `users/${uid}/palmilhaStock`));
                palmilhaStockOpsMap.set(key, { ref: newRef, docSnap: null, isNew: true });
              }
            }
          }
        }

        // Write: purchase document
        const { id: _id, ...purchasePayload } = purchaseToSave as any;
        const purchaseRef = doc(db, `users/${uid}/purchases`, purchaseId);
        txn.set(purchaseRef, purchasePayload, { merge: true });

        // Write: palmilha stock entries
        if (purchase.registerAsReceived === true) {
          for (const item of palmilhaItems) {
            const key = `${item.toolId}_${item.colorId}`;
            const op = palmilhaStockOpsMap.get(key);
            if (!op) continue;

            if (!op.isNew && op.docSnap?.exists()) {
              const updatedStock = { ...op.docSnap.data().stock };
              Object.entries(item.quantities).forEach(([grade, qty]) => {
                updatedStock[grade] = (updatedStock[grade] || 0) + qty;
              });
              const totalPairs = Object.values(updatedStock).reduce((acc: number, curr) => acc + (Number(curr) || 0), 0);
              txn.update(op.ref, {
                stock: updatedStock, totalPairs,
                unitCost: item.unitCost,
                totalCost: totalPairs * parseLocaleNumber(item.unitCost),
                purchaseDate: purchase.date, updatedAt: Date.now()
              });
            } else {
              const totalPairs = Object.values(item.quantities).reduce((acc: number, curr) => acc + (Number(curr) || 0), 0);
              txn.set(op.ref, {
                toolId: item.toolId, toolName: item.toolName,
                subtype: item.subtype,
                colorId: item.colorId, colorName: item.colorName,
                supplierId: purchase.supplierId,
                supplierName: people.find(p => p.id === purchase.supplierId)?.name || 'Fornecedor',
                stock: item.quantities, totalPairs,
                unitCost: parseLocaleNumber(item.unitCost),
                totalCost: parseLocaleNumber(item.totalCost),
                purchaseDate: purchase.date, updatedAt: Date.now()
              });
            }
          }
        }
      });

      // Non-critical: update purchase request status
      if (purchase.registerAsReceived && palmilhaPurchaseParams?.requestId) {
        const request = purchaseRequests.find(r => r.id === palmilhaPurchaseParams.requestId);
        if (request) {
          const updatedReceivedBreakdown = { ...(request.receivedBreakdown || {}) };
          let totalReceivedNow = 0;
          palmilhaItems.forEach(item => {
            Object.entries(item.quantities).forEach(([grade, qty]) => {
              updatedReceivedBreakdown[grade] = (updatedReceivedBreakdown[grade] || 0) + qty;
              totalReceivedNow += qty;
            });
          });
          const totalReceivedAll = (request.receivedQty || 0) + totalReceivedNow;
          const isFullyReceived = totalReceivedAll >= request.requiredQty;
          await firebaseService.updateDocument("purchaseRequests", request.id, {
            receivedQty: totalReceivedAll,
            receivedBreakdown: updatedReceivedBreakdown,
            status: isFullyReceived ? 'RECEIVED' : 'ORDERED',
            updatedAt: Date.now()
          });
        }
      }

      // Financial entry — financeService.createTransaction handles balance update internally
      if (purchase.paymentTerm === PaymentTerm.CASH && purchase.accountId) {
        const transaction: Omit<Transaction, 'id'> = {
          type: TransactionType.EXPENSE,
          amount: parseLocaleNumber(purchase.total),
          date: purchase.date,
          categoryId: purchase.categoryId || (categories || []).find(c => String(c.name || '').toLowerCase().includes('palmilha'))?.id || categories?.[0]?.id || 'cat1',
          accountId: purchase.accountId,
          description: `Compra de Palmilhas - ${people.find(p => p.id === purchase.supplierId)?.name || purchase.supplierId}`,
          status: 'COMPLETED',
          relatedId: finalPurchaseId
        };
        await financeService.createTransaction(transaction);
      }

      toast.show("Compra de palmilhas registrada e estoque atualizado com sucesso!");
      setIsPalmilhaPurchaseModalOpen(false);
      setPalmilhaPurchaseParams(null);
    } catch (err: any) {
      console.error("[App] Erro crítico ao salvar compra de palmilhas:", err);
      toast.show("Erro ao salvar compra: " + (err.message || JSON.stringify(err)));
    }
  };

  const handleDeleteSale = async (id: string) => {
    console.log("handleDeleteSale chamado para ID:", id);
    const sale = sales.find(s => s.id === id);
    if (!sale) {
      console.error("Venda não encontrada no estado local:", id);
      toast.show("Erro: Venda não encontrada no sistema.");
      return;
    }

    if (sale.status === SaleStatus.CANCELLED) {
      // Se j est cancelada, estoque/financeiro j foram estornados.
      // Podemos apenas excluir o registro.
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        await firebaseService.deleteDocument("sales", id);
        toast.show("Registro (já cancelado) excluído com sucesso.");
        return;
      } catch (e) {
        console.error(e);
        toast.show("Erro ao excluir registro cancelado.");
        return;
      }
    }

    // Pedido já em produção com baixa em algum setor: não pode mais ser excluído
    // (o Mapa continua em produção). Só pode ser cancelado — ver handleCancelSaleWithRevert.
    if (saleProductionHasProgressed(sale, productionOrders, productionLots)) {
      toast.show("Este pedido já está em produção e não pode ser excluído. Use \"Cancelar e Estornar\".");
      return;
    }

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Usuário não autenticado");

      // Buscar transações reais do Firestore para garantir integridade
      const transactionsRef = collection(db, `users/${uid}/transactions`);
      const q = query(transactionsRef, where("relatedId", "==", id));
      const txSnapshot = await getDocs(q);
      const relatedTxsFromDb = txSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));

      await firebaseService.runAtomic(async (transaction) => {
        const salesRef = doc(db, `users/${uid}/sales`, id);
        
        // 1. Preparar Referências
        const productRefsMap = new Map<string, any>();
        if (sale.status === SaleStatus.SALE) {
          const uniqueProductIds = Array.from(new Set(sale.items.map(item => item.productId as string)));
          uniqueProductIds.forEach((pId: string) => {
            productRefsMap.set(pId, doc(db, `users/${uid}/products`, pId));
          });
        }

        const accountRefsMap = new Map<string, any>();
        const uniqueAccountIds = Array.from(new Set(relatedTxsFromDb.map(t => t.accountId as string)));
        uniqueAccountIds.forEach((aId: string) => {
          accountRefsMap.set(aId, doc(db, `users/${uid}/accounts`, aId));
        });

        let customerRef = null;
        if (sale.customerId) {
          customerRef = doc(db, `users/${uid}/people`, sale.customerId);
        }

        // 2. Realizar todas as LEITURAS
        const productDocsMap = new Map();
        for (const [pId, ref] of productRefsMap.entries()) {
          productDocsMap.set(pId, await transaction.get(ref));
        }

        const accountDocsMap = new Map();
        for (const [aId, ref] of accountRefsMap.entries()) {
          accountDocsMap.set(aId, await transaction.get(ref));
        }

        let customerDoc = null;
        if (customerRef) {
          customerDoc = await transaction.get(customerRef);
        }

        // 3. Realizar todas as ESCRITAS

        // A. Estorno de Estoque
        if (sale.status === SaleStatus.SALE) {
          for (const [pId, pDoc] of productDocsMap.entries()) {
            if (pDoc.exists()) {
              const productData = pDoc.data() as Product;
              const saleItemsForThisProduct = sale.items.filter(item => item.productId === pId);
              
              saleItemsForThisProduct.forEach(item => {
                const variationIndex = productData.variations.findIndex(v => v.id === item.variationId);
                if (variationIndex !== -1) {
                  const variation = productData.variations[variationIndex];
                  const stockKey = item.saleType === SaleType.WHOLESALE ? 'WHOLESALE' : (item.size || 'WHOLESALE');
                  const currentStock = variation.stock[stockKey] || 0;
                  variation.stock[stockKey] = currentStock + item.quantity;
                }
              });
              transaction.update(productRefsMap.get(pId), { variations: productData.variations });
            }
          }
        }

        // B. Estorno Financeiro
        for (const tx of relatedTxsFromDb) {
          const aDoc = accountDocsMap.get(tx.accountId);
          if (aDoc?.exists()) {
            const accData = aDoc.data() as Account;
            // INCOME (entrada): subtraímos. EXPENSE: somamos. (Adjustment to current balance)
            const adjustment = tx.type === TransactionType.INCOME ? -tx.amount : tx.amount;
            transaction.update(accountRefsMap.get(tx.accountId), { balance: accData.balance + adjustment });
          }
          transaction.delete(doc(db, `users/${uid}/transactions`, tx.id));
        }

        // C. Estorno de Crédito de Cliente
        if (customerDoc?.exists() && sale.paymentHistory) {
          const custData = customerDoc.data() as Person;
          const amountPaid = sale.paymentHistory.reduce((acc, p) => acc + p.amount, 0);
          const surplus = Math.max(0, amountPaid - sale.total);
          if (surplus > 0) {
            transaction.update(customerRef!, { credit: Math.max(0, (custData.credit || 0) - surplus) });
          }
        }

        // D. Excluir Pedido de Produção (e Mapas) ainda sem nenhuma baixa — checado
        // acima via saleProductionHasProgressed, então é seguro remover.
        if (sale.productionOrderId) {
          const po = productionOrders.find(p => p.id === sale.productionOrderId);
          if (po) {
            po.lotIds.forEach(lotId => {
              transaction.delete(doc(db, `users/${uid}/productionLots`, lotId));
            });
            transaction.delete(doc(db, `users/${uid}/productionOrders`, po.id));
          }
        }

        // E. Excluir o Registro
        transaction.delete(salesRef);
      });

      toast.show('Registro excluído com sucesso! Estoque e financeiro estornados.');
    } catch (err: any) {
      console.error("Erro ao excluir venda:", err);
      toast.show('Erro ao excluir: ' + (err.message || err));
    }
  };

  // Cancela e estorna um pedido cuja produção já teve "baixa" em algum setor — não pode
  // mais ser excluído (ver handleDeleteSale/saleProductionHasProgressed), pois o Mapa
  // continua em produção. Reverte estoque/financeiro/crédito como uma exclusão faria,
  // mas mantém o registro como CANCELLED (em vez de apagar) e devolve ao estoque geral
  // (EM_ESTOQUE) qualquer caixa já produzida e reservada (RESERVADO) para essa venda —
  // a produção pendente segue normalmente e, ao concluir, entra no estoque geral em vez
  // de ser reservada para esta venda (ver classifyExpedicaoOrders em PCPView).
  const handleCancelSaleWithRevert = async (id: string) => {
    const sale = sales.find(s => s.id === id);
    if (!sale) {
      toast.show("Erro: Venda não encontrada no sistema.");
      return;
    }
    if (sale.status === SaleStatus.CANCELLED) {
      toast.show("Esta venda já está cancelada.");
      return;
    }

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Usuário não autenticado");

      const transactionsRef = collection(db, `users/${uid}/transactions`);
      const q = query(transactionsRef, where("relatedId", "==", id));
      const txSnapshot = await getDocs(q);
      const relatedTxsFromDb = txSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));

      const reservedLots = stockLots.filter(l => l.saleId === id && l.status === 'RESERVADO');

      await firebaseService.runAtomic(async (transaction) => {
        const salesRef = doc(db, `users/${uid}/sales`, id);

        // 1. Preparar Referências
        const productRefsMap = new Map<string, any>();
        if (sale.status === SaleStatus.SALE) {
          sale.items.forEach(item => {
            if (item.fulfilled !== false) productRefsMap.set(item.productId, doc(db, `users/${uid}/products`, item.productId));
          });
        }
        reservedLots.forEach(lot => {
          if (!productRefsMap.has(lot.productId)) productRefsMap.set(lot.productId, doc(db, `users/${uid}/products`, lot.productId));
        });

        const accountRefsMap = new Map<string, any>();
        const uniqueAccountIds = Array.from(new Set(relatedTxsFromDb.map(t => t.accountId as string)));
        uniqueAccountIds.forEach((aId: string) => {
          accountRefsMap.set(aId, doc(db, `users/${uid}/accounts`, aId));
        });

        let customerRef = null;
        if (sale.customerId) {
          customerRef = doc(db, `users/${uid}/people`, sale.customerId);
        }

        // 2. Realizar todas as LEITURAS
        const productDocsMap = new Map();
        for (const [pId, ref] of productRefsMap.entries()) {
          productDocsMap.set(pId, await transaction.get(ref));
        }

        const accountDocsMap = new Map();
        for (const [aId, ref] of accountRefsMap.entries()) {
          accountDocsMap.set(aId, await transaction.get(ref));
        }

        let customerDoc = null;
        if (customerRef) {
          customerDoc = await transaction.get(customerRef);
        }

        // 3. Realizar todas as ESCRITAS

        // A. Estorno do estoque já abatido na venda + entrada das caixas RESERVADAS
        // (já produzidas para este pedido) de volta ao estoque geral.
        for (const [pId, pDoc] of productDocsMap.entries()) {
          if (!pDoc.exists()) continue;
          const productData = pDoc.data() as Product;

          if (sale.status === SaleStatus.SALE) {
            sale.items.filter(item => item.productId === pId && item.fulfilled !== false).forEach(item => {
              const variation = productData.variations.find(v => v.id === item.variationId);
              if (!variation) return;
              const stockKey = item.saleType === SaleType.WHOLESALE ? 'WHOLESALE' : (item.size || 'WHOLESALE');
              variation.stock[stockKey] = (variation.stock[stockKey] || 0) + item.quantity;
            });
          }

          reservedLots.filter(l => l.productId === pId).forEach(lot => {
            const variation = productData.variations.find(v => v.id === lot.variationId);
            if (!variation) return;
            if (lot.boxQty !== undefined) {
              const boxQty = lot.boxQty || 0;
              variation.stock['WHOLESALE'] = (variation.stock['WHOLESALE'] || 0) + boxQty;
              if (lot.pkgId && boxQty > 0) {
                const allocations = [...(variation.stockPkgAllocations || [])];
                const allocIdx = allocations.findIndex(a => a.pkgId === lot.pkgId);
                if (allocIdx >= 0) {
                  allocations[allocIdx] = { ...allocations[allocIdx], qty: allocations[allocIdx].qty + boxQty };
                } else {
                  allocations.push({ pkgId: lot.pkgId, qty: boxQty });
                }
                variation.stockPkgAllocations = allocations;
              }
            } else {
              Object.entries(lot.sizeBreakdown).forEach(([size, qty]) => {
                variation.stock[size] = (variation.stock[size] || 0) + qty;
              });
            }
          });

          transaction.update(productRefsMap.get(pId), { variations: productData.variations });
        }

        // B. Devolve as caixas RESERVADO para o estoque geral (EM_ESTOQUE), removendo
        // o vínculo com a venda — a produção pendente seguirá normalmente e entrará
        // direto no estoque geral (classifyExpedicaoOrders, PCPView).
        reservedLots.forEach(lot => {
          transaction.update(doc(db, `users/${uid}/stockLots`, lot.id), {
            status: 'EM_ESTOQUE',
            saleId: deleteField(),
            saleOrderNumber: deleteField(),
            customerName: deleteField(),
            updatedAt: Date.now(),
          });
        });

        // C. Estorno Financeiro
        for (const tx of relatedTxsFromDb) {
          const aDoc = accountDocsMap.get(tx.accountId);
          if (aDoc?.exists()) {
            const accData = aDoc.data() as Account;
            const adjustment = tx.type === TransactionType.INCOME ? -tx.amount : tx.amount;
            transaction.update(accountRefsMap.get(tx.accountId), { balance: accData.balance + adjustment });
          }
          transaction.delete(doc(db, `users/${uid}/transactions`, tx.id));
        }

        // D. Estorno de Crédito de Cliente
        if (customerDoc?.exists() && sale.paymentHistory) {
          const custData = customerDoc.data() as Person;
          const amountPaid = sale.paymentHistory.reduce((acc, p) => acc + p.amount, 0);
          const surplus = Math.max(0, amountPaid - sale.total);
          if (surplus > 0) {
            transaction.update(customerRef!, { credit: Math.max(0, (custData.credit || 0) - surplus) });
          }
        }

        // E. Marca como cancelada (mantém o registro — o Mapa em produção continua
        // vinculado ao Pedido de Produção e não é alterado aqui).
        transaction.update(salesRef, { status: SaleStatus.CANCELLED });
      });

      toast.show('Pedido cancelado e estornado. A produção em andamento segue normalmente e as caixas produzidas entrarão no estoque geral.');
    } catch (err: any) {
      console.error("Erro ao cancelar pedido com estorno:", err);
      toast.show('Erro ao cancelar: ' + (err.message || err));
    }
  };

  // Executa a exclusão de uma compra e, se houver vínculos com o PCP (solicitação de compra
  // e/ou Pedido de Produção gerados a partir dela), recalcula/limpa essas referências para que
  // a tela de Necessidades de Materiais volte a refletir a realidade.
  const executePurchaseDeletion = async (
    purchase: Purchase,
    pcpLinks?: { request?: PurchaseRequest; order?: ProductionOrder; orderLots?: ProductionLot[] }
  ) => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Usuário não autenticado");

      // Atomic: delete purchase + revert financials + revert stock in a single transaction
      await firebaseService.runAtomic(async (txn) => {
        const purchaseRef = doc(db, `users/${uid}/purchases`, purchase.id);

        // Read refs for financial revert
        let txRef: any = null, accRef: any = null, txDoc: any = null, accDoc: any = null;
        if (purchase.paymentTerm === PaymentTerm.CASH && purchase.accountId) {
          const relatedTx = transactions.find(t => t.relatedId === purchase.id);
          if (relatedTx) {
            txRef = doc(db, `users/${uid}/transactions`, relatedTx.id);
            accRef = doc(db, `users/${uid}/accounts`, purchase.accountId);
            txDoc = await txn.get(txRef);
            accDoc = await txn.get(accRef);
          }
        }

        // Read refs for stock revert — compras com OP não creditam estoque ao salvar,
        // então não há estoque a reverter na exclusão.
        const productRefsMap = new Map<string, any>();
        const productDocsMap = new Map<string, any>();
        if (purchase.type === PurchaseType.REPLENISHMENT && !purchase.isProductionOrder && purchase.items) {
          for (const item of purchase.items) {
            if (!productRefsMap.has(item.productId)) {
              const pRef = doc(db, `users/${uid}/products`, item.productId);
              productRefsMap.set(item.productId, pRef);
              productDocsMap.set(item.productId, await txn.get(pRef));
            }
          }
        }

        // Writes: delete purchase
        txn.delete(purchaseRef);

        // Writes: revert financial
        if (txRef && txDoc?.exists() && accDoc?.exists()) {
          const accData = accDoc.data() as Account;
          txn.delete(txRef);
          txn.update(accRef, { balance: accData.balance + purchase.total });
        }

        // Writes: revert stock
        if (purchase.type === PurchaseType.REPLENISHMENT && !purchase.isProductionOrder && purchase.items) {
          for (const item of purchase.items) {
            const pDoc = productDocsMap.get(item.productId);
            if (pDoc?.exists()) {
              const productData = pDoc.data() as Product;
              const variationIndex = productData.variations.findIndex(v => v.id === item.variationId);
              if (variationIndex !== -1) {
                const variation = productData.variations[variationIndex];
                const itemSaleType = item.saleType ?? productData.type;
                const key = (itemSaleType === SaleType.RETAIL && item.size) ? item.size : 'WHOLESALE';
                const amountToSubtract = (itemSaleType === SaleType.RETAIL && item.isBox && !item.size) ? item.quantity * 12 : item.quantity;
                variation.stock[key] = (variation.stock[key] || 0) - amountToSubtract;
                txn.update(productRefsMap.get(item.productId), { variations: productData.variations });
              }
            }
          }
        }
      });

      // Non-critical: recalculate PCP purchase request
      const request = pcpLinks?.request;
      if (request) {
        let contributedQty = 0;
        const contributedBreakdown: Record<string, number> = {};
        (purchase.generalItems || []).forEach(gi => { contributedQty += gi.quantity || 0; });
        (purchase.soleItems || []).forEach(si => {
          Object.entries(si.quantities || {}).forEach(([size, qty]) => {
            const q = Number(qty) || 0;
            contributedBreakdown[size] = (contributedBreakdown[size] || 0) + q;
            contributedQty += q;
          });
        });

        if (purchase.registerAsReceived && contributedQty > 0) {
          const newReceivedQty = Math.max(0, (request.receivedQty || 0) - contributedQty);
          const newReceivedBreakdown = { ...(request.receivedBreakdown || {}) };
          Object.entries(contributedBreakdown).forEach(([size, qty]) => {
            newReceivedBreakdown[size] = Math.max(0, (newReceivedBreakdown[size] || 0) - qty);
          });
          const newStatus = newReceivedQty <= 0 ? 'PENDING' : (newReceivedQty < request.requiredQty ? 'ORDERED' : 'RECEIVED');
          await firebaseService.updateDocument("purchaseRequests", request.id, {
            receivedQty: newReceivedQty,
            receivedBreakdown: newReceivedBreakdown,
            status: newStatus,
            updatedAt: Date.now(),
          });
        } else if (request.status === 'IN_PROGRESS' || request.status === 'ORDERED') {
          await firebaseService.updateDocument("purchaseRequests", request.id, {
            status: 'PENDING',
            updatedAt: Date.now(),
          });
        }
      }

      // Non-critical: remove the Production Order and its still-PENDING Mapas (the
      // purchase that originated them was excluded). Mapas that already progressed in
      // production (baixa em algum setor) are preserved — só os ainda pendentes são
      // excluídos, como esperado ao cancelar uma compra de estoque não produzida.
      const order = pcpLinks?.order;
      if (order) {
        const lots = pcpLinks?.orderLots || [];
        const hasProgressed = (l: ProductionLot) =>
          (l.history && l.history.length > 0) || l.currentSectorIndex > 0 || !!l.finishedAt;
        const pendingLots = lots.filter(l => !hasProgressed(l));

        for (const l of pendingLots) {
          await firebaseService.deleteDocument("productionLots", l.id);
        }

        if (lots.every(l => !hasProgressed(l))) {
          // Nenhum mapa com progresso → remove a OP inteira.
          await firebaseService.deleteDocument("productionOrders", order.id);
        } else {
          // Mantém a OP, apenas removendo das suas referências os mapas pendentes excluídos.
          await firebaseService.updateDocument("productionOrders", order.id, {
            lotIds: (order.lotIds || []).filter(id => !pendingLots.some(pl => pl.id === id)),
          });
        }
      }
    } catch (err) {
      console.error('Error during purchase deletion:', err);
      toast.show('Erro ao excluir compra: ' + ((err as any)?.message || err));
    }
  };

  // Calcula o que reverter este StockLot vai desfazer — sem escrever nada —
  // para exibir um popup de devolução com os valores de estoque (produto e
  // solados) antes/depois e a confirmação da volta do pedido p/ Expedição.
  const buildStockLotRevertPreview = (stockLot: StockLot): StockLotRevertPreview => {
    const product = products.find(p => p.id === stockLot.productId);
    const variation = product?.variations.find(v => v.id === stockLot.variationId);

    const productStockRows: { label: string; before: number; after: number }[] = [];
    if (product && variation && stockLot.status === 'EM_ESTOQUE') {
      if (stockLot.boxQty !== undefined) {
        const before = variation.stock['WHOLESALE'] || 0;
        productStockRows.push({
          label: stockLot.pkgName ? `Caixas · ${stockLot.pkgName}` : 'Caixas',
          before,
          after: Math.max(0, before - stockLot.boxQty),
        });
      } else {
        Object.entries(stockLot.sizeBreakdown || {})
          .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
          .forEach(([size, qty]) => {
            const before = variation.stock[size] || 0;
            productStockRows.push({ label: size, before, after: Math.max(0, before - (Number(qty) || 0)) });
          });
      }
    }

    let sole: StockLotRevertPreview['sole'];
    if (product && variation) {
      const consumption = resolveSoleConsumption(product, variation, stockLot.sizeBreakdown || {}, stockLot.totalPairs, soleStockEntries);
      if (consumption) {
        const entry = soleStockEntries.find(s => String(s.moldId).trim() === consumption.moldId && String(s.colorId || '').trim() === consumption.colorId);
        if (entry) {
          const rows = Object.entries(consumption.gradeQuantities)
            .filter(([k]) => k !== 'pesagem' && k !== 'total')
            .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
            .map(([size, qty]) => ({ size, before: entry.stock[size] || 0, after: (entry.stock[size] || 0) + (Number(qty) || 0) }));
          sole = { moldName: entry.moldName, colorName: entry.colorName, rows };
        }
      }
    }

    const lot = productionLots.find(l => l.id === stockLot.lotId);
    const expedicaoSectorId = sectors.find(s => s.isProductionCycleEnd)?.id;

    return {
      productName: stockLot.productName,
      productReference: stockLot.productReference,
      variationName: stockLot.variationName,
      gradeLabel: stockLot.gradeLabel,
      totalPairs: stockLot.totalPairs,
      boxQty: stockLot.boxQty,
      pkgName: stockLot.pkgName,
      stockReverted: stockLot.status === 'EM_ESTOQUE',
      productStockRows,
      sole,
      lotOrderNumber: stockLot.lotOrderNumber,
      orderNumber: stockLot.productionOrderNumber || stockLot.saleOrderNumber,
      orderReturnedToExpedicao: !!(lot && stockLot.productionOrderId && expedicaoSectorId),
      lotReopened: !!lot?.finishedAt,
    };
  };

  // Reverte uma entrada de estoque criada por uma "baixa de expedição" (StockLot):
  // remove a caixa/pares do estoque do produto (se EM_ESTOQUE), repõe os solados
  // que haviam sido consumidos, devolve o pedido para o setor de Expedição no mapa
  // de origem (removendo a marca ORDER_FINALIZED) e, se o mapa havia sido marcado
  // como concluído por essa baixa, reabre o mapa (remove `finishedAt`).
  const handleRevertStockLot = async (stockLot: StockLot): Promise<StockLotRevertPreview> => {
    const preview = buildStockLotRevertPreview(stockLot);
    const product = products.find(p => p.id === stockLot.productId);
    const variation = product?.variations.find(v => v.id === stockLot.variationId);

    if (product && variation && stockLot.status === 'EM_ESTOQUE') {
      const variIdx = product.variations.findIndex(v => v.id === variation.id);
      const updatedVariations = product.variations.map((v, idx) => {
        if (idx !== variIdx) return v;
        const newStock = { ...v.stock };
        if (stockLot.boxQty !== undefined) {
          newStock['WHOLESALE'] = Math.max(0, (newStock['WHOLESALE'] || 0) - stockLot.boxQty);
          const allocations = (v.stockPkgAllocations || []).map(a =>
            a.pkgId === stockLot.pkgId ? { ...a, qty: Math.max(0, a.qty - (stockLot.boxQty || 0)) } : a
          );
          return { ...v, stock: newStock, stockPkgAllocations: allocations };
        }
        Object.entries(stockLot.sizeBreakdown || {}).forEach(([size, qty]) => {
          newStock[size] = Math.max(0, (newStock[size] || 0) - (Number(qty) || 0));
        });
        return { ...v, stock: newStock };
      });
      await firebaseService.saveDocument("products", { ...product, variations: updatedVariations });
    }

    if (product && variation) {
      const consumption = resolveSoleConsumption(product, variation, stockLot.sizeBreakdown || {}, stockLot.totalPairs, soleStockEntries);
      if (consumption) {
        const entry = soleStockEntries.find(s => String(s.moldId).trim() === consumption.moldId && String(s.colorId || '').trim() === consumption.colorId);
        if (entry) {
          const updatedStock = { ...entry.stock };
          Object.entries(consumption.gradeQuantities).forEach(([gradeKey, qty]) => {
            updatedStock[gradeKey] = (updatedStock[gradeKey] || 0) + qty;
          });
          const totalPairs = Object.entries(updatedStock)
            .filter(([k]) => k !== 'pesagem' && k !== 'total')
            .reduce((s, [, v]) => s + (Number(v) || 0), 0);
          await firebaseService.updateDocument('soleStock', entry.id, { stock: updatedStock, totalPairs, updatedAt: Date.now() });
        }
      }
    }

    const lot = productionLots.find(l => l.id === stockLot.lotId);
    if (lot && stockLot.productionOrderId) {
      const expedicaoSectorId = sectors.find(s => s.isProductionCycleEnd)?.id;
      const currentOrderSectors: Record<string, string> = (lot as any).metadata?.orderSectors || {};
      const updatedOrderSectors = { ...currentOrderSectors };
      const itemKey = getSourceItemKey({ orderId: stockLot.productionOrderId, itemIdx: stockLot.itemIdx });
      if (expedicaoSectorId) updatedOrderSectors[itemKey] = expedicaoSectorId;
      else delete updatedOrderSectors[itemKey];

      await firebaseService.updateDocument('productionLots', lot.id, {
        metadata: { ...(lot as any).metadata, orderSectors: updatedOrderSectors },
        ...(lot.finishedAt ? { finishedAt: deleteField() } : {}),
      });
    }

    await firebaseService.deleteDocument('stockLots', stockLot.id);
    toast.show('Entrada revertida — estoque, solados e pedido devolvidos ao estado anterior.');
    return preview;
  };

  const handleSaveProductionLot = async (lot: ProductionLot) => {
    try {
      // 0. Pegar o estado anterior do lote para detectar remoções
      const oldLot = productionLots.find(l => l.id === lot.id);
      const oldLinkedIds = new Set<string>();
      if (oldLot) {
        if (oldLot.productionOrderId) oldLinkedIds.add(oldLot.productionOrderId);
        if ((oldLot as any).metadata?.sourceItems) {
          (oldLot as any).metadata.sourceItems.forEach((item: any) => oldLinkedIds.add(item.orderId));
        }
      }

      await firebaseService.saveDocument("productionLots", lot);
      
      // 1. Identificar todas as OPs vinculadas ATUALMENTE
      const linkedOrderIds = new Set<string>();
      if (lot.productionOrderId) linkedOrderIds.add(lot.productionOrderId);
      
      const lotMetadata = (lot as any).metadata;
      if (lotMetadata?.sourceItems) {
        lotMetadata.sourceItems.forEach((item: any) => linkedOrderIds.add(item.orderId));
      }

      // 2. Identificar OPs que foram REMOVIDAS
      const removedOrderIds = Array.from(oldLinkedIds).filter(id => !linkedOrderIds.has(id));

      // 3. Atualizar OPs vinculadas (Adição ou Manutenção)
      for (const orderId of Array.from(linkedOrderIds)) {
        const order = productionOrders.find(o => o.id === orderId);
        if (order) {
          let newStatus = order.status;
          if (lot.finishedAt) {
            newStatus = 'COMPLETED';
          } else if (order.status === 'PENDING') {
            newStatus = 'IN_PRODUCTION';
          }

          const alreadyLinked = order.lotIds?.includes(lot.id);
          if (newStatus !== order.status || !alreadyLinked) {
            const updatedLotIds = alreadyLinked ? order.lotIds : [...(order.lotIds || []), lot.id];
            await firebaseService.saveDocument("productionOrders", {
              ...order,
              status: newStatus,
              lotIds: updatedLotIds
            });
          }
        }
      }

      // 4. Limpar OPs que foram retiradas deste mapa
      for (const orderId of removedOrderIds) {
        const order = productionOrders.find(o => o.id === orderId);
        if (order) {
          const updatedLotIds = order.lotIds?.filter(id => id !== lot.id) || [];
          // Se não restarem lotes ativos, a OP volta para PENDENTE
          const hasOtherLots = productionLots.some(l => 
            l.id !== lot.id && 
            !l.finishedAt && 
            (l.productionOrderId === orderId || (l as any).metadata?.sourceItems?.some((si: any) => si.orderId === orderId))
          );
          
          await firebaseService.saveDocument("productionOrders", {
            ...order,
            status: hasOtherLots ? order.status : 'PENDING',
            lotIds: updatedLotIds
          });
        }
      }
    } catch (err: any) {
      console.error("Erro ao salvar mapa:", err);
      toast.show("Erro ao salvar mapa: " + (err.message || err));
    }
  };

  const handleDeleteProductionLot = async (lotId: string) => {
    try {
      const lot = productionLots.find(l => l.id === lotId);
      if (!lot) return;

      await firebaseService.deleteDocument("productionLots", lotId);
      
      // 1. Identificar todas as OPs vinculadas
      const linkedOrderIds = new Set<string>();
      if (lot.productionOrderId) linkedOrderIds.add(lot.productionOrderId);
      
      const lotMetadata = (lot as any).metadata;
      if (lotMetadata?.sourceItems) {
        lotMetadata.sourceItems.forEach((item: any) => linkedOrderIds.add(item.orderId));
      }

      // 2. Para cada OP, verificar se deve voltar a PENDENTE
      for (const orderId of Array.from(linkedOrderIds)) {
        const order = productionOrders.find(o => o.id === orderId);
        if (order) {
          // Verificamos se existem outros mapas ativos para esta OP
          // Importante: verificar tanto lot.productionOrderId quanto metadata.sourceItems nos outros lotes
          const otherLots = productionLots.filter(l => 
            l.id !== lotId && 
            !l.finishedAt && 
            (l.productionOrderId === orderId || (l as any).metadata?.sourceItems?.some((si: any) => si.orderId === orderId))
          );
          
          const updatedLotIds = order.lotIds?.filter(id => id !== lotId) || [];
          const newStatus = otherLots.length === 0 ? 'PENDING' : order.status;

          await firebaseService.saveDocument("productionOrders", {
            ...order,
            status: newStatus,
            lotIds: updatedLotIds
          });
        }
      }
    } catch (err: any) {
      console.error("Erro ao excluir mapa:", err);
      toast.show("Erro ao excluir mapa: " + (err.message || err));
    }
  };

  // Remove um Pedido de Produção (OP) da fila do PCP — usado tanto para limpar OPs órfãs
  // (cuja compra de origem já foi excluída) quanto para remoção manual a pedido do usuário.
  // Por segurança, não remove se já existirem mapas/lotes ativos vinculados a ela.
  const handleDeleteProductionOrder = async (orderId: string) => {
    try {
      const order = productionOrders.find(o => o.id === orderId);
      if (!order) return;

      const hasActiveLots = productionLots.some(l => l.productionOrderId === orderId && !l.finishedAt);
      if (hasActiveLots) {
        toast.show('Este pedido já possui mapa(s) de produção ativos vinculados — exclua ou finalize os mapas antes de remover o pedido.');
        return;
      }

      await firebaseService.deleteDocument("productionOrders", orderId);
    } catch (err: any) {
      console.error("Erro ao excluir pedido de produção:", err);
      toast.show("Erro ao excluir pedido: " + (err.message || err));
    }
  };

  const handleSavePurchaseRequest = async (req: PurchaseRequest) => {
    // 1. Detect increase in receivedQty and update material stock accordingly (Estoques Gerais)
    if (req.type === 'MATERIAL' && req.materialId) {
      const existing = purchaseRequests.find(r => r.id === req.id);
      const prevReceived = existing?.receivedQty || 0;
      const newReceived = req.receivedQty || 0;
      const delta = newReceived - prevReceived;

      if (delta > 0) {
        const mat = productionConfigs.find(c => c.id === req.materialId);
        if (mat) {
          const currentStock = mat.metadata?.stock || 0;
          await firebaseService.saveDocument("productionConfigs", {
            ...mat,
            metadata: { ...mat.metadata, stock: currentStock + delta },
          });
        }
      }
    }

    // 2. Detect increase in receivedBreakdown and update sole stock accordingly (Estoque de Solados)
    if (req.type === 'SOLE' && req.moldId) {
      const existing = purchaseRequests.find(r => r.id === req.id);
      const prevBreakdown = existing?.receivedBreakdown || {};
      const newBreakdown = req.receivedBreakdown || {};

      const mold = productionConfigs.find(c => c.id === req.moldId);
      const moldName = mold?.name || req.name || 'Solado';
      const color = colors.find(c => c.id === req.colorId);
      const colorName = color?.name || 'Cor';
      const unitCost = mold?.metadata?.unitCost || 0;

      const deltaSizes: Record<string, number> = {};
      let totalDeltaPairs = 0;

      const allSizes = Array.from(new Set([...Object.keys(newBreakdown), ...Object.keys(prevBreakdown)]));
      allSizes.forEach(size => {
        const prev = prevBreakdown[size] || 0;
        const current = newBreakdown[size] || 0;
        const delta = current - prev;
        if (delta > 0) {
          deltaSizes[size] = delta;
          totalDeltaPairs += delta;
        }
      });

      if (totalDeltaPairs > 0) {
        const stockEntry: Omit<SoleStockEntry, 'id'> = {
          moldId: req.moldId,
          moldName,
          colorId: req.colorId || '',
          colorName,
          supplierId: '',
          supplierName: 'Necessidade de Compras',
          stock: deltaSizes,
          totalPairs: totalDeltaPairs,
          unitCost,
          totalCost: totalDeltaPairs * unitCost,
          purchaseDate: Date.now(),
          updatedAt: Date.now(),
          notes: `Recebido da Solicitação de Compras: ${req.name}`
        };
        await firebaseService.saveDocument('soleStock', stockEntry);
      }
    }

    await firebaseService.saveDocument("purchaseRequests", req);
  };

  const handleDeletePurchaseRequest = async (req: PurchaseRequest) => {
    await firebaseService.deleteDocument("purchaseRequests", req.id);
  };

  const handleCreatePurchaseRequest = async (req: Omit<PurchaseRequest, 'id'>) => {
    console.log('[App] handleCreatePurchaseRequest called', req);
    const id = generateId();
    try {
      await firebaseService.saveDocument("purchaseRequests", { ...req, id });
      console.log('[App] Purchase request saved with ID:', id);
    } catch (err) {
      console.error('[App] Error saving purchase request:', err);
      throw err;
    }
  };



  const autoCreateProductionOrder = async (sale: Sale) => {
    if (!modulesConfig.production) return;
    if (sale.status !== SaleStatus.SALE) return;
    
    // Evitar duplicidade se já houver uma OP vinculada a esta venda
    if (productionOrders.some(op => op.saleId === sale.id)) return;

    try {
      const orderId = generateId();
      const nextOPNum = await firebaseService.getNextSequence('productionOrders', seedProductionOrderSequence);
      const orderNum = `OP #${String(nextOPNum).padStart(3, '0')}`;

      // Agrupar itens da venda por Produto/Variação para criar os lotes (Mapas)
      const groupedItems = new Map<string, {
        productId: string;
        productName: string;
        variationId: string;
        variationName: string;
        saleType: SaleType;
        sizes: Record<string, { total: number; fromStock: number; toProduction: number }>;
        totalQty: number;
      }>();

      sale.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const variation = product?.variations.find(v => v.id === item.variationId);
        if (!product || !variation) return;

        const key = `${item.productId}-${item.variationId}`;
        if (!groupedItems.has(key)) {
          groupedItems.set(key, {
            productId: item.productId,
            productName: product.name,
            variationId: item.variationId,
            variationName: variation.colorName,
            saleType: item.saleType,
            sizes: {},
            totalQty: 0
          });
        }
        const g = groupedItems.get(key)!;
        const sizeKey = item.size || '__all__';
        if (!g.sizes[sizeKey]) g.sizes[sizeKey] = { total: 0, fromStock: 0, toProduction: 0 };
        g.sizes[sizeKey].total += item.quantity;
        g.sizes[sizeKey].toProduction += item.quantity;
        g.totalQty += item.quantity;
      });

      const items: ProductionOrderItem[] = Array.from(groupedItems.values()).map(g => ({
        productId: g.productId,
        productName: g.productName,
        variationId: g.variationId,
        variationName: g.variationName,
        saleType: g.saleType,
        sizes: g.sizes,
        totalQuantity: g.totalQty,
        fromStockQty: 0,
        toProductionQty: g.totalQty
      }));

      const order: ProductionOrder = {
        id: orderId,
        orderNumber: orderNum,
        saleId: sale.id,
        saleOrderNumber: sale.orderNumber,
        customerId: sale.customerId,
        customerName: sale.customerName || 'Avulso',
        orderDate: sale.date,
        deliveryDate: sale.deliveryDate || (Date.now() + 7 * 24 * 60 * 60 * 1000),
        items,
        status: 'PENDING',
        lotIds: [], // Inicia vazio, será preenchido ao criar mapas manualmente
        createdAt: Date.now()
      };

      await firebaseService.saveDocument("productionOrders", order);
      
      // Vincula o ID da OP à venda
      await firebaseService.saveDocument("sales", { ...sale, productionOrderId: order.id });

    } catch (err) {
      console.error("Erro ao criar OP automática:", err);
    }
  };

  // Colaborador restrito: lista de cards do Dashboard fica filtrada aos seus
  // setores, com a personalização (visível/ordem) que ele próprio já salvou.
  const effectiveDashboardCards = getEffectiveDashboardCards(
    (dashboardConfig || defaultDashboardConfig).cards,
    activeCollaborator
  );

  const renderView = (view: ViewType) => {
    // Route Guard: Check if the view is allowed by the current module configuration
    const isSalesView = MODULE_VIEWS.sales.includes(view);
    const isProductionView = MODULE_VIEWS.production.includes(view);
    const isPersonalView = MODULE_VIEWS.personal.includes(view);

    if (isSalesView && !modulesConfig.sales) return renderView(ViewType.DASHBOARD);
    if (isProductionView && (!modulesConfig.sales || !modulesConfig.production)) return renderView(ViewType.DASHBOARD);
    if (isPersonalView && !modulesConfig.personal) return renderView(ViewType.DASHBOARD);
    if (!isViewAllowed(activeCollaborator, view)) return renderView(ViewType.DASHBOARD);

    switch (view) {
      case ViewType.DASHBOARD:
        return (
          <DashboardView
            sales={sales}
            purchases={purchases}
            products={products}
            transactions={transactions}
            accounts={accounts}
            people={people}
            productionLots={productionLots}
            sectors={sectors}
            purchaseRequests={purchaseRequests}
            serviceOrders={serviceOrders}
            productionOrders={productionOrders}
            onAddSale={() => resetTo(ViewType.SALE_FORM)}
            onUpdateCheckStatus={handleCheckStatusChange}
            isDarkMode={isDarkMode}
            categories={categories}
            dashboardConfig={{ cards: effectiveDashboardCards }}
            modulesConfig={modulesConfig}
            onNavigate={navigateTo}
            onNavigateProduction={navigateToProduction}
            onNavigateGrids={() => navigateTo(ViewType.GRIDS)}
            onAddProduct={() => navigateTo(ViewType.PRODUCT_FORM)}
            onAddTransaction={(type) => {
              setTransactionModalType(type);
              setIsTransactionModalOpen(true);
            }}
            onOpenAIAssistant={() => setIsAIAssistantOpen(true)}
            activeCollaborator={activeCollaborator}
          />
        );
      case ViewType.DASHBOARD_CONFIG:
        return (
          <DashboardConfigView
            config={{ cards: effectiveDashboardCards }}
            onSave={async (newConfig) => {
              if (activeCollaborator && !activeCollaborator.isUnrestricted) {
                await saveCollaborator({ ...activeCollaborator, dashboardConfig: newConfig.cards });
                return;
              }
              try {
                const configToSave = { ...newConfig, id: 'main_config' };
                await firebaseService.saveDocument("dashboard_config", configToSave);
              } catch (err) {
                console.error("Error saving dashboard config:", err);
              }
            }}
            onBack={goBack}
            isDarkMode={isDarkMode}
            modulesConfig={modulesConfig}
            activeCollaborator={activeCollaborator}
          />
        );
      case ViewType.SETTINGS:
        return (
          <SettingsView
            onNavigate={navigateTo}
            onNavigateProduction={navigateToProduction}
            isDarkMode={isDarkMode}
            appTheme={appTheme}
            setAppTheme={setAppTheme}
            toggleDarkMode={toggleDarkMode}
            modulesConfig={modulesConfig}
            fontScale={fontScale}
            setFontScale={setFontScale}
            fontFamily={fontFamily}
            setFontFamily={setFontFamily}
            navIconMode={navIconMode}
            setNavIconMode={updateNavIconMode}
            navMonoColor={navMonoColor}
            setNavMonoColor={updateNavMonoColor}
            collaborators={collaborators}
            activeCollaborator={activeCollaborator}
            onSwitchCollaborator={switchCollaborator}
            onLogout={handleLogout}
          />
        );
      case ViewType.PRODUCTS:
        return (
          <ProductsView
            products={products}
            onAdd={() => navigateTo(ViewType.PRODUCT_FORM)}
            onEdit={(id) => navigateTo(ViewType.PRODUCT_FORM, id)}
            onDelete={(id) => firebaseService.deleteDocument("products", id)}
            onToggleStatus={(id, status) => {
              const product = products.find(p => p.id === id);
              if (product) {
                 firebaseService.saveDocument("products", { ...product, status });
              }
            }}
            onDuplicate={handleDuplicateProduct}
            isDarkMode={isDarkMode}
            modulesConfig={modulesConfig}
          />
        );
      case ViewType.PEOPLE:
        return (
          <PeopleView
            people={people}
            sales={sales}
            purchases={purchases}
            transactions={transactions}
            onAdd={async (newPerson) => {
              try {
                await firebaseService.saveDocument("people", newPerson);
                toast.show('Cadastro realizado!');
              } catch (err: any) {
                toast.show('Erro ao cadastrar: ' + (err.message || err));
              }
            }}
            onEdit={async (id, updatedPerson) => {
              try {
                await firebaseService.updateDocument("people", id, updatedPerson);
                toast.show('Cadastro atualizado!');
              } catch (err: any) {
                toast.show('Erro ao atualizar: ' + (err.message || err));
              }
            }}
            onDelete={async (id) => {
              try {
                await firebaseService.deleteDocument("people", id);
                toast.show('Cadastro excluído!');
              } catch (err: any) {
                toast.show('Erro ao excluir: ' + (err.message || err));
              }
            }}
            onShowDetail={(id) => navigateTo(ViewType.PERSON_DETAIL, id)}
            isDarkMode={isDarkMode}
            aiPrefillData={aiPersonPrefill}
            onPrefillConsumed={() => setAiPersonPrefill(null)}
          />
        );
      case ViewType.PERSON_DETAIL:
        return (
          <PersonDetailView
            personId={selectedPersonId || ""}
            people={people}
            transactions={transactions}
            sales={sales}
            purchases={purchases}
            categories={categories}
            accounts={accounts}
            onBack={goBack}
            isDarkMode={isDarkMode}
          />
        );
      case ViewType.PERSONAL_FINANCIAL:
        return (
          <PersonalFinancialView
            transactions={transactions}
            categories={categories}
            accounts={accounts}
            familyMembers={familyMembers}
            personalContacts={personalContacts}
            budgets={budgets}
            onSaveTransaction={async (tx) => {
              await financeService.createTransaction(tx);
            }}
            onEditTransaction={async (id, tx) => {
              await financeService.updateTransaction(id, tx);
            }}
            onDeleteTransaction={async (id) => {
              await financeService.deleteTransaction(id);
            }}
            onSaveCategory={async (cat) => {
              await firebaseService.saveDocument("categories", cat);
            }}
            onEditCategory={async (id, cat) => {
              await firebaseService.updateDocument("categories", id, cat);
            }}
            onDeleteCategory={async (id) => {
              await firebaseService.deleteDocument("categories", id);
            }}
            onAddAccount={async (acc) => {
              await firebaseService.saveDocument("accounts", acc);
            }}
            onSaveFamilyMember={async (fm) => {
              await firebaseService.saveDocument("family_members", fm);
            }}
            onEditFamilyMember={async (id, fm) => {
              await firebaseService.updateDocument("family_members", id, fm);
            }}
            onDeleteFamilyMember={async (id) => {
              await firebaseService.deleteDocument("family_members", id);
            }}
            onSavePersonalContact={async (pc) => {
              await firebaseService.saveDocument("personal_contacts", pc);
            }}
            onEditPersonalContact={async (id, pc) => {
              await firebaseService.updateDocument("personal_contacts", id, pc);
            }}
            onDeletePersonalContact={async (id) => {
              await firebaseService.deleteDocument("personal_contacts", id);
            }}
            onSaveBudget={async (b) => {
              await firebaseService.saveDocument("budgets", b);
            }}
            onEditBudget={async (id, b) => {
              await firebaseService.updateDocument("budgets", id, b);
            }}
            onDeleteBudget={async (id) => {
              await firebaseService.deleteDocument("budgets", id);
            }}
            onBack={goBack}
            isDarkMode={isDarkMode}
          />
        );
      case ViewType.CATEGORIES:
        return (
          <CategoriesView
            categories={categories}
            onAdd={async (newCategory) => {
              try {
                await firebaseService.saveDocument("categories", newCategory);
                toast.show('Categoria adicionada com sucesso!');
              } catch (err: any) {
                toast.show('Erro ao adicionar categoria: ' + (err.message || err));
              }
            }}
            onEdit={async (id, updatedCategory) => {
              try {
                await firebaseService.updateDocument("categories", id, updatedCategory);
                toast.show('Categoria atualizada!');
              } catch (err: any) {
                toast.show('Erro ao atualizar categoria: ' + (err.message || err));
              }
            }}
            onDelete={async (id) => {
              try {
                await firebaseService.deleteDocument("categories", id);
                toast.show('Categoria excluída!');
              } catch (err: any) {
                toast.show('Erro ao excluir categoria: ' + (err.message || err));
              }
            }}
            isDarkMode={isDarkMode}
            modulesConfig={modulesConfig}
            onNavigate={navigateTo}
          />
        );
      case ViewType.CATEGORY_CONFIG:
        return (
          <CategoryConfigView
            categories={categories}
            modulesConfig={modulesConfig}
            onEdit={async (id, updates) => {
              await firebaseService.updateDocument("categories", id, updates);
            }}
            onBack={() => navigateTo(ViewType.CATEGORIES)}
            isDarkMode={isDarkMode}
          />
        );
      case ViewType.GRIDS:
        return (
          <GradesView
            grids={grids}
            onAdd={async (newGrid) => {
              try {
                await firebaseService.saveDocument("grids", newGrid);
                toast.show('Grade salva!');
              } catch (err: any) {
                toast.show('Erro ao salvar grade: ' + (err.message || err));
              }
            }}
            onEdit={async (id, updatedGrid) => {
              try {
                await firebaseService.updateDocument("grids", id, updatedGrid);
                toast.show('Grade atualizada!');
              } catch (err: any) {
                toast.show('Erro ao atualizar grade: ' + (err.message || err));
              }
            }}
            onDelete={async (id) => {
              try {
                await firebaseService.deleteDocument("grids", id);
                toast.show('Grade excluída!');
              } catch (err: any) {
                toast.show('Erro ao excluir grade: ' + (err.message || err));
              }
            }}
            isDarkMode={isDarkMode}
          />
        );
      case ViewType.COLORS:
        return (
          <ColorsView
            colors={colors}
            onAdd={async (newColor) => {
              try {
                await firebaseService.saveDocument("colors", newColor);
                toast.show('Cor salva!');
              } catch (err: any) {
                toast.show('Erro ao salvar cor: ' + (err.message || err));
              }
            }}
            onEdit={async (id, updatedColor) => {
              try {
                await firebaseService.updateDocument("colors", id, updatedColor);
              } catch (err: any) {
                toast.show('Erro ao atualizar cor: ' + (err.message || err));
              }
            }}
            onDelete={async (id) => {
              try {
                await firebaseService.deleteDocument("colors", id);
              } catch (err: any) {
                toast.show('Erro ao excluir cor: ' + (err.message || err));
              }
            }}
            isDarkMode={isDarkMode}
          />
        );
      case ViewType.PAYMENT_METHODS:
        return (
          <PaymentMethodsView
            methods={paymentMethods}
            onAdd={() => {
              setEditingPaymentMethod(undefined);
              setIsPaymentMethodModalOpen(true);
            }}
            onEdit={(id) => {
              const p = paymentMethods.find((x) => x.id === id);
              if (p) {
                setEditingPaymentMethod(p);
                setIsPaymentMethodModalOpen(true);
              }
            }}
            onDelete={(id) => {
              firebaseService.deleteDocument("paymentMethods", id);
            }}
            isDarkMode={isDarkMode}
          />
        );
      case ViewType.REPORTS:
        return (
          <ReportsView
            isDarkMode={isDarkMode}
            sales={sales}
            transactions={transactions}
            onSelectReport={(reportId) => {
              setSelectedReportId(reportId);
              setCurrentView(ViewType.REPORT_DETAILED);
            }}
            onOpenPrintCenter={() => navigateTo(ViewType.PRINT_CENTER)}
          />
        );
      case ViewType.REPORT_DETAILED:
        return (
          <ReportDetailedView
            isDarkMode={isDarkMode}
            reportId={selectedReportId || ''}
            sales={sales}
            purchases={purchases}
            transactions={transactions}
            products={products}
            people={people}
            categories={categories}
            monthlySnapshots={monthlySnapshots}
            onBack={() => setCurrentView(ViewType.REPORTS)}
          />
        );
      case ViewType.DATA_CLEANUP:
        return (
          <DataCleanupView
            isDarkMode={isDarkMode}
            onBack={() => setCurrentView(ViewType.SETTINGS)}
            cleanupConfig={cleanupConfig}
            monthlySnapshots={monthlySnapshots}
            people={people}
            products={products}
          />
        );
      case ViewType.PRINT_CENTER:
        return (
          <PrintCenterView
            isDarkMode={isDarkMode}
            products={products}
            sales={sales}
            purchases={purchases}
            productionLots={productionLots}
            serviceOrders={serviceOrders}
            people={people}
            sectors={sectors}
            onDeleteItems={async (section, ids) => {
              try {
                let collection = '';
                if (section === 'os') collection = 'serviceOrders';
                else if (section === 'lots') collection = 'productionLots';
                else if (section === 'sales') collection = 'sales';
                else if (section === 'purchases') collection = 'purchases';
                else if (section === 'products') collection = 'products';
                
                if (collection) {
                  for (const id of ids) {
                    await firebaseService.deleteDocument(collection, id);
                  }
                  toast.show(`${ids.length} item(ns) apagado(s) com sucesso!`);
                }
              } catch (err: any) {
                console.error("Erro ao apagar itens", err);
                toast.show("Erro ao apagar itens: " + (err.message || err));
              }
            }}
          />
        );
      case ViewType.BACKUP:
        return (
          <BackupView
            isDarkMode={isDarkMode}
            transactions={transactions}
            purchases={purchases}
            sales={sales}
            productionConfigs={productionConfigs}
            gridsCount={grids.length}
            colorsCount={colors.length}
            sectorsCount={sectors.length}
            flowTagsCount={flowTags.length}
            soleStockEntries={soleStockEntries}
            onDeleteTransaction={(id) => firebaseService.deleteDocument("transactions", id)}
            onDeletePurchase={(id) => firebaseService.deleteDocument("purchases", id)}
            onDeleteSale={(id) => firebaseService.deleteDocument("sales", id)}
            onResetDatabase={handleResetDatabase}
            onSelectiveDelete={handleSelectiveDelete}
            onFixPkgAllocations={handleFixPkgAllocations}
          />
        );
      case ViewType.PRODUCT_FORM:
        const productToEdit = selectedProductId ? products.find((p) => p.id === selectedProductId) : undefined;
        const module = (lastNonModalView === ViewType.PRODUCTION_MENU || lastNonModalView === ViewType.PRODUCTION_ENGINEERING) ? 'PRODUCTION' : 'SALES';
        return (
          <ProductFormView
            module={module}
            productId={selectedProductId}
            products={products}
            grids={grids}
            suppliers={suppliers}
            categories={categories}
            colors={colors}
            productionConfigs={productionConfigs}
            flowTags={flowTags}
            onSaveOnly={async (product) => {
              try {
                await firebaseService.saveDocument("products", product);
              } catch (err: any) {
                console.error("Erro ao salvar produto:", err);
                toast.show("Erro ao salvar produto: " + (err.message || err));
              }
            }}
            onSave={async (product) => {
              try {
                await firebaseService.saveDocument("products", product);
                goBack();
              } catch (err: any) {
                console.error("Erro ao salvar produto:", err);
                toast.show("Erro ao salvar produto: " + (err.message || err));
              }
            }}
            onSaveConfigItem={async (item) => {
              try {
                await firebaseService.saveDocument("productionConfigs", item);
              } catch (err: any) {
                console.error("Erro ao salvar item de configuração:", err);
                toast.show("Erro ao salvar item: " + (err.message || err));
              }
            }}
            onDeleteConfigItem={(id: string) => firebaseService.deleteDocument("productionConfigs", id)}
            onCancel={goBack}
            isDarkMode={isDarkMode}
            sectors={sectors}
            modulesConfig={modulesConfig}
            restrictedProductMode={!modulesConfig.production}
          />
        );
      case ViewType.PURCHASES:
        return (
          <PurchasesView
            purchases={purchases}
            suppliers={suppliers}
            products={products}
            onAdd={() => navigateTo(ViewType.PURCHASE_FORM)}
            onEdit={(id) => navigateTo(ViewType.PURCHASE_FORM, id)}
            onDelete={async (id) => {
              console.log('Attempting to delete purchase', id);
              const purchase = purchases.find((p) => p.id === id);
              if (!purchase) {
                console.warn('Purchase not found for deletion', id);
                return;
              }

              // Verifica se esta compra está vinculada a algo no PCP (solicitação de compra
              // e/ou Pedido de Produção). Se estiver, avisa o usuário antes de excluir, pois
              // a exclusão simples deixaria essas referências "presas" e desatualizadas.
              const linkedRequest = purchase.requestId
                ? purchaseRequests.find(r => r.id === purchase.requestId)
                : undefined;
              const linkedOrder = purchase.productionOrderId
                ? productionOrders.find(o => o.id === purchase.productionOrderId)
                : undefined;
              const linkedOrderLots = linkedOrder
                ? productionLots.filter(l => l.productionOrderId === linkedOrder.id)
                : [];

              if ((linkedRequest && linkedRequest.status !== 'RECEIVED') || linkedOrder) {
                setPurchaseDeleteWarning({ purchase, request: linkedRequest, order: linkedOrder, orderLots: linkedOrderLots });
                return;
              }

              await executePurchaseDeletion(purchase);
            }}
            onUpdate={(purchase) => firebaseService.saveDocument("purchases", purchase)}
            isDarkMode={isDarkMode}
            initialSearchQuery={searchContext}
          />
        );
      case ViewType.PURCHASE_FORM:
        return (
          <PurchaseFormView
            purchaseId={selectedPurchaseId}
            purchases={purchases}
            products={products}
            suppliers={suppliers}
            categories={categories}
            accounts={accounts}
            grids={grids}
            people={people}
            colors={colors}
            productionConfigs={productionConfigs}
            initialParams={currentParams}
            productionOrders={productionOrders}
            onCreateProductionOrder={async (order, newLots, deductions) => {
              await firebaseService.saveDocument("productionOrders", order);
              for (const lot of newLots) {
                await firebaseService.saveDocument("productionLots", lot);
              }
              for (const d of deductions) {
                const product = products.find(p => p.id === d.productId);
                if (!product) continue;
                const updatedProduct = JSON.parse(JSON.stringify(product));
                const variation = updatedProduct.variations.find((v: any) => v.id === d.variationId);
                if (!variation) continue;
                if (d.size) {
                  variation.stock[d.size] = Math.max(0, (variation.stock[d.size] || 0) - d.quantity);
                } else {
                  variation.stock['WHOLESALE'] = Math.max(0, (variation.stock['WHOLESALE'] || 0) - d.quantity);
                }
                await firebaseService.saveDocument("products", updatedProduct);
              }
            }}
            onSave={async (purchase) => {
              try {
                const prevPurchase = selectedPurchaseId ? purchases.find(p => p.id === selectedPurchaseId) : null;
                
                // Local maps to track mutations before saving
                const productUpdates = new Map<string, any>();
                const getProductForUpdate = (id: string) => {
                  if (productUpdates.has(id)) return productUpdates.get(id);
                  const p = products.find(prod => prod.id === id);
                  if (p) {
                    const cloned = JSON.parse(JSON.stringify(p));
                    productUpdates.set(id, cloned);
                    return cloned;
                  }
                  return null;
                };

                const accountUpdates = new Map<string, any>();
                const getAccountForUpdate = (id: string) => {
                  if (accountUpdates.has(id)) return accountUpdates.get(id);
                  const a = accounts.find(acc => acc.id === id);
                  if (a) {
                    const cloned = JSON.parse(JSON.stringify(a));
                    accountUpdates.set(id, cloned);
                    return cloned;
                  }
                  return null;
                };

                // 1. REVERT OLD STOCK if it was REPLENISHMENT
                // OBS: compras com "Pedido de Produção (OP)" NÃO creditam estoque ao salvar
                // (o estoque entra pela produção/Expedição), então também não revertem aqui.
                if (prevPurchase && prevPurchase.type === PurchaseType.REPLENISHMENT && !prevPurchase.isProductionOrder && prevPurchase.items) {
                  for (const item of prevPurchase.items) {
                    const updatedProduct = getProductForUpdate(item.productId);
                    if (updatedProduct) {
                      const variationIndex = updatedProduct.variations.findIndex((v: any) => v.id === item.variationId);
                      if (variationIndex !== -1) {
                        const variation = updatedProduct.variations[variationIndex];
                        const itemSaleType = item.saleType ?? updatedProduct.type;
                        const key = (itemSaleType === SaleType.RETAIL && item.size) ? item.size : 'WHOLESALE';

                        const amountToSubtract = (itemSaleType === SaleType.RETAIL && item.isBox && !item.size) ? item.quantity * 12 : item.quantity;

                        if (variation.stock[key] !== undefined) {
                          variation.stock[key] -= amountToSubtract;
                          if (variation.stock[key] < 0) variation.stock[key] = 0;
                        }
                      }
                    }
                  }
                }

                // 2. APPLY NEW STOCK if it is REPLENISHMENT
                // Compras com OP (produção para estoque) NÃO entram aqui — a entrada no
                // estoque ocorre quando a produção é finalizada na Expedição.
                if (purchase.type === PurchaseType.REPLENISHMENT && !purchase.isProductionOrder && purchase.items) {
                  for (const item of purchase.items) {
                    const updatedProduct = getProductForUpdate(item.productId);
                    if (updatedProduct) {
                      const variationIndex = updatedProduct.variations.findIndex((v: any) => v.id === item.variationId);
                      if (variationIndex !== -1) {
                        const variation = updatedProduct.variations[variationIndex];
                        const itemSaleType = item.saleType ?? updatedProduct.type;
                        const key = (itemSaleType === SaleType.RETAIL && item.size) ? item.size : 'WHOLESALE';

                        const amountToAdd = (itemSaleType === SaleType.RETAIL && item.isBox && !item.size) ? item.quantity * 12 : item.quantity;

                        variation.stock[key] = (variation.stock[key] || 0) + amountToAdd;
                      }
                    }
                  }
                }

                // AUTO-FULFILL: Atender itens pendentes (CONFIRMED e SALE c/ itens sem estoque)
                // Não roda para OP — nada foi produzido ainda ao salvar a compra.
                if (purchase.type === PurchaseType.REPLENISHMENT && !purchase.isProductionOrder && purchase.items) {
                  const pendingSales = sales
                    .filter(s =>
                      s.status === SaleStatus.CONFIRMED ||
                      (s.status === SaleStatus.SALE && s.items.some(it => it.fulfilled !== true))
                    )
                    .sort((a, b) => (a.date || 0) - (b.date || 0));

                  const autoFulfilled: string[] = [];

                  for (const pendingSale of pendingSales) {
                    const newItems = pendingSale.items.map(it => ({ ...it }));
                    let anyFulfilled = false;

                    for (let i = 0; i < newItems.length; i++) {
                      const item = newItems[i];
                      if (item.fulfilled === true) continue;
                      const prod = getProductForUpdate(item.productId);
                      if (!prod) continue;
                      const variation = prod.variations.find((v: any) => v.id === item.variationId);
                      if (!variation) continue;
                      const key = item.saleType === SaleType.WHOLESALE ? 'WHOLESALE' : (item.size || 'WHOLESALE');
                      const available = variation.stock[key] || 0;
                      if (available >= item.quantity) {
                        variation.stock[key] = Math.max(0, available - item.quantity);
                        newItems[i] = { ...item, fulfilled: true };
                        anyFulfilled = true;
                      }
                    }

                    if (anyFulfilled) {
                      const allFulfilled = newItems.every(it => it.fulfilled === true);
                      const newStatus = (pendingSale.status === SaleStatus.CONFIRMED && allFulfilled)
                        ? SaleStatus.SALE
                        : pendingSale.status;
                      await firebaseService.saveDocument("sales", { ...pendingSale, status: newStatus, items: newItems });
                      autoFulfilled.push(pendingSale.orderNumber);
                    }
                  }

                  if (autoFulfilled.length > 0) {
                    toast.show(`✓ ${autoFulfilled.length} pedido(s) atendido(s) automaticamente: ${autoFulfilled.join(', ')}`);
                  }
                }

                // 3. FINANCIAL LOGIC: Revert Old Transactions
                if (prevPurchase) {
                  const oldTxs = transactions.filter(t => t.relatedId === prevPurchase.id);
                  for (const otx of oldTxs) {
                    await firebaseService.deleteDocument("transactions", otx.id);
                    const acc = getAccountForUpdate(otx.accountId);
                    if (acc) {
                      acc.balance += otx.amount; // Revert spending
                    }
                  }
                }

                // 4. APPLY NEW FINANCIALS 
                if (
                  purchase.generateTransaction !== false &&
                  purchase.paymentTerm === PaymentTerm.CASH &&
                  purchase.accountId
                ) {
                  const newTransaction: Omit<Transaction, "id"> = {
                    type: TransactionType.EXPENSE,
                    amount: purchase.total,
                    date: purchase.date,
                    categoryId: purchase.categoryId || categories[0]?.id || "cat1",
                    accountId: purchase.accountId,
                    description: purchase.type === PurchaseType.REPLENISHMENT
                      ? 'Abastecimento de Estoque'
                      : purchase.type === PurchaseType.SOLE
                      ? 'Compra de Solados'
                      : 'Compra Geral',
                    status: "COMPLETED",
                    relatedId: purchase.id,
                  };
                  await firebaseService.saveDocument("transactions", newTransaction);

                  const acc = getAccountForUpdate(purchase.accountId);
                  if (acc) {
                    acc.balance -= purchase.total;
                  }
                }

                // SAVE ALL MUTATIONS
                const purchaseToSave = {
                  ...purchase,
                  requestId: purchase.requestId || currentParams?.requestId || ""
                };
                await firebaseService.saveDocument("purchases", purchaseToSave);

                for (const [_, prod] of productUpdates) {
                  await firebaseService.saveDocument("products", prod);
                }

                for (const [_, acc] of accountUpdates) {
                  await firebaseService.updateDocument("accounts", acc.id, { balance: acc.balance });
                }

                // O estoque de materiais (inclusive por cor) é creditado exclusivamente
                // na tela "Recebimento de Compras" (conferência) — nunca direto ao salvar
                // a compra. Aqui só marcamos a solicitação vinculada como "em andamento".
                if (currentParams?.requestId) {
                  const req = purchaseRequests.find(r => r.id === currentParams.requestId);
                  if (req && req.status === 'PENDING') {
                    await firebaseService.updateDocument("purchaseRequests", req.id, {
                      status: 'IN_PROGRESS',
                      updatedAt: Date.now(),
                    });
                  }
                }

                goBack();
              } catch (err: any) {
                console.error("Purchase Save Error:", err);
                toast.show("Erro ao salvar compra: " + (err.message || err));
              }
            }}
            onCancel={goBack}
            isDarkMode={isDarkMode}
          />
        );
      case ViewType.SALES:
        return (
          <SalesView
            sales={sales}
            products={products}
            grids={grids}
            people={people}
            paymentMethods={paymentMethods}
            accounts={accounts}
            onAdd={() => navigateTo(ViewType.SALE_FORM)}
            onEdit={(sale) => navigateTo(ViewType.SALE_FORM, sale.id)}
            onDelete={handleDeleteSale}
            onCancelOnly={handleCancelOnlySale}
            onCancelAndRevert={handleCancelSaleWithRevert}
            onAddStockBalance={async (adjustments) => {
              // Balanço de estoque a partir da demanda dos orçamentos: incrementa o
              // estoque das variações (atacado em caixas/WHOLESALE; varejo por tamanho).
              // Agrupa por produto para salvar cada produto uma única vez.
              const byProduct = new Map<string, { productId: string; variationId: string; key: string; amount: number }[]>();
              for (const adj of adjustments) {
                if (adj.amount <= 0) continue;
                if (!byProduct.has(adj.productId)) byProduct.set(adj.productId, []);
                byProduct.get(adj.productId)!.push(adj);
              }
              for (const [productId, adjs] of byProduct) {
                const product = products.find((p) => p.id === productId);
                if (!product) continue;
                const updated = JSON.parse(JSON.stringify(product));
                for (const adj of adjs) {
                  const v = updated.variations.find((vv: any) => vv.id === adj.variationId);
                  if (!v) continue;
                  v.stock = v.stock || {};
                  v.stock[adj.key] = (v.stock[adj.key] || 0) + adj.amount;
                }
                await firebaseService.saveDocument("products", updated);
              }
              toast.show("Estoque atualizado com a demanda dos orçamentos.");
            }}
            onConvert={async (id) => {
              const sale = sales.find((s) => s.id === id);
              if (!sale) return;

              try {
                const uid = auth.currentUser?.uid;
                if (!uid) throw new Error("Usuário não autenticado");

                await firebaseService.runAtomic(async (transaction) => {
                  const saleRef = doc(db, `users/${uid}/sales`, id);
                  
                  // 1. Prepare References for Reads
                  const productRefsMap = new Map<string, any>();
                  const uniqueProductIds = Array.from(new Set(sale.items.map(item => item.productId)));
                  uniqueProductIds.forEach(pId => {
                    productRefsMap.set(pId, doc(db, `users/${uid}/products`, pId));
                  });

                  const defaultAccountId = sale.accountId || accounts[0]?.id || "acc1";
                  const accountRef = doc(db, `users/${uid}/accounts`, defaultAccountId);

                  // 2. Perform all READS first
                  const productDocsMap = new Map();
                  for (const [pId, ref] of productRefsMap.entries()) {
                    productDocsMap.set(pId, await transaction.get(ref));
                  }

                  let accountDoc = null;
                  if (sale.paymentStatus === PaymentStatus.PAID) {
                    accountDoc = await transaction.get(accountRef);
                  }

                  // 3. Perform all WRITES after reads
                  
                  // A. Update Sale Status
                  const updatedSale = { 
                    ...sale, 
                    status: SaleStatus.SALE,
                  };
                  
                  // Cleanup undefineds
                  Object.keys(updatedSale).forEach(key => {
                    if ((updatedSale as any)[key] === undefined) {
                      delete (updatedSale as any)[key];
                    }
                  });

                  transaction.set(saleRef, updatedSale);

                  // B. Deduct Inventory — apenas itens RETAIL (por tamanho)
                  // Itens WHOLESALE (caixas) aguardam a separação física via "Separar Caixas"
                  for (const item of sale.items) {
                    const isWholesaleItem = item.saleType === SaleType.WHOLESALE || (!item.size && item.saleType !== SaleType.RETAIL);
                    if (isWholesaleItem) continue; // não abate automaticamente caixas
                    const productDoc = productDocsMap.get(item.productId);
                    
                    if (productDoc && productDoc.exists()) {
                      const productData = productDoc.data() as Product;
                      const variations = [...productData.variations];
                      const variationIndex = variations.findIndex(v => v.id === item.variationId);
                      
                      if (variationIndex !== -1) {
                        const variation = { ...variations[variationIndex] };
                        // Já passamos pelo continue acima para itens WHOLESALE — aqui é sempre Varejo.
                        const key = item.size || 'WHOLESALE';

                        if (variation.stock[key] !== undefined) {
                          variation.stock[key] = Math.max(0, variation.stock[key] - item.quantity);
                          variations[variationIndex] = variation;
                          transaction.update(productRefsMap.get(item.productId), { variations });
                        }
                      }
                    }
                  }

                  // C. Handle Financials if PAID
                  if (updatedSale.paymentStatus === PaymentStatus.PAID) {
                    // Create Transaction
                    const transactionRef = doc(collection(db, `users/${uid}/transactions`));
                    const newTransaction: Transaction = {
                      id: transactionRef.id,
                      type: TransactionType.INCOME,
                      categoryId: "rev1", // Default Revenue category
                      accountId: defaultAccountId,
                      amount: sale.total,
                      date: Date.now(),
                      description: `Venda #${sale.orderNumber} (Conversão)`,
                      status: "COMPLETED",
                      relatedId: sale.id,
                      contactId: sale.customerId,
                      contactName: sale.customerName || people.find(p => p.id === sale.customerId)?.name,
                    };
                    transaction.set(transactionRef, newTransaction);

                    // Update Account Balance
                    if (accountDoc && accountDoc.exists()) {
                      const accountData = accountDoc.data() as Account;
                      transaction.update(accountRef, { balance: accountData.balance + sale.total });
                    }
                  }
                });

                toast.show("Orçamento confirmado como venda com sucesso!");
                
                // Auto-create Production Order
                const fullSale = sales.find(s => s.id === id);
                if (fullSale) {
                  await autoCreateProductionOrder({ ...fullSale, status: SaleStatus.SALE });
                }
              } catch (err: any) {
                console.error("Conversion Error:", err);
                toast.show("Erro ao converter orçamento: " + (err.message || err));
              }
            }}
            onUpdatePaymentStatus={async (id, newStatus) => {
              const sale = sales.find(s => s.id === id);
              if (!sale) return;

              await firebaseService.updateDocument("sales", id, {
                paymentStatus: newStatus
              });

              if (newStatus === PaymentStatus.PAID) {
                // Generate Financial Entry
                const targetAccount = sale.accountId || accounts[0]?.id || "acc1";
                const newTransaction: Omit<Transaction, "id"> = {
                  type: TransactionType.INCOME,
                  categoryId: "rev1",
                  accountId: targetAccount,
                  amount: sale.total,
                  date: Date.now(),
                  description: `Pagamento Venda #${sale.orderNumber}`,
                  status: "COMPLETED",
                  relatedId: sale.id,
                  contactId: sale.customerId,
                  contactName: sale.customerName || people.find(p => p.id === sale.customerId)?.name,
                };
                await firebaseService.saveDocument("transactions", newTransaction);

                const acc = accounts.find(a => a.id === targetAccount);
                if (acc) {
                  await firebaseService.updateDocument("accounts", targetAccount, {
                    balance: acc.balance + sale.total
                  });
                }
                toast.show('Pagamento registrado e saldo atualizado!');
              }
            }}
            onPaySale={async (id, amount, accountId, paymentMethodId, note) => {
              const sale = sales.find(s => s.id === id);
              if (!sale) return;

              const paymentId = generateId();
              const now = Date.now();

              // 1. Create Financial Entry first to get the document ID
              const newTransaction: Omit<Transaction, "id"> = {
                type: TransactionType.INCOME,
                categoryId: "rev1",
                accountId: accountId,
                amount: amount,
                date: now,
                description: `Recebimento Parcial - Venda #${sale.orderNumber}${note ? ' - ' + note : ''}`,
                status: "COMPLETED",
                relatedId: sale.id,
                contactId: sale.customerId,
                contactName: sale.customerName || people.find(p => p.id === sale.customerId)?.name,
              };
              
              let txResult: any;
              try {
                txResult = await firebaseService.saveDocument("transactions", newTransaction);
              } catch (err) {
                console.error("Erro ao salvar transação:", err);
              }

              // 2. Add to payment history (with transactionId linkage)
              const newPayment: SalePayment = {
                id: paymentId,
                amount,
                date: now,
                accountId,
                paymentMethodId,
                note,
                transactionId: txResult?.id
              };

              const newHistory = [...(sale.paymentHistory || []), newPayment];
              const totalPaid = newHistory.reduce((acc, p) => acc + p.amount, 0);
              const newStatus = totalPaid >= sale.total ? PaymentStatus.PAID : PaymentStatus.PENDING;

              // Handle surplus credit/haver
              if (totalPaid > sale.total && sale.customerId) {
                const surplus = totalPaid - sale.total;
                const customer = people.find(p => p.id === sale.customerId);
                if (customer) {
                  const currentCredit = customer.credit || 0;
                  await firebaseService.updateDocument("people", customer.id, {
                    credit: currentCredit + surplus
                  });
                  toast.show(`O valor pago excedeu o total. R$ ${surplus.toLocaleString('pt-BR')} foram adicionados como crédito para o cliente.`);
                }
              }

              // Update Sale
              await firebaseService.updateDocument("sales", id, {
                paymentHistory: newHistory,
                paymentStatus: newStatus
              });

              // Update Account Balance
              const acc = accounts.find(a => a.id === accountId);
              if (acc) {
                await firebaseService.updateDocument("accounts", accountId, {
                  balance: acc.balance + amount
                });
              }

              console.log('Recebimento registrado com sucesso!');
            }}
            onDeletePayment={async (saleId, paymentId) => {
              console.log("App.tsx: onDeletePayment triggered", { saleId, paymentId });
              
              const sale = sales.find(s => s.id === saleId);
              if (!sale) {
                const msg = `Erro Crítico: Venda ID ${saleId} não encontrada.`;
                console.error(msg);
                toast.show(msg);
                return;
              }
              
              if (!sale.paymentHistory) {
                console.error("App.tsx: Sale has no payment history", saleId);
                return;
              }

              const payment = sale.paymentHistory.find(p => p.id === paymentId);
              if (!payment) {
                const msg = `Erro: Recebimento ID ${paymentId} não encontrado no histórico da venda.`;
                console.error(msg);
                return;
              }

              try {
                // Calculation of surpluses for credit reversal
                const amountPaidBefore = (sale.paymentHistory || []).reduce((acc, p) => acc + p.amount, 0);
                const surplusBefore = Math.max(0, amountPaidBefore - sale.total);

                const newHistory = sale.paymentHistory.filter(p => p.id !== paymentId);
                const amountPaidAfter = newHistory.reduce((acc, p) => acc + p.amount, 0);
                const surplusAfter = Math.max(0, amountPaidAfter - sale.total);
                
                const newStatus = amountPaidAfter >= sale.total ? PaymentStatus.PAID : PaymentStatus.PENDING;

                // 1. Revert Account Balance
                const acc = accounts.find(a => a.id === payment.accountId);
                if (acc) {
                  console.log("App.tsx: Reverting account balance", payment.accountId);
                  await firebaseService.updateDocument("accounts", payment.accountId, {
                    balance: acc.balance - payment.amount
                  });
                } else {
                  console.warn("App.tsx: Account not found for balance reversal", payment.accountId);
                }

                // 2. Delete Transaction - Use link if available, fallback otherwise
                let transactionDeleted = false;
                if (payment.transactionId) {
                  console.log("App.tsx: Deleting linked transaction", payment.transactionId);
                  await firebaseService.deleteDocument("transactions", payment.transactionId);
                  transactionDeleted = true;
                } else {
                  console.warn("App.tsx: No transactionId link, trying heuristic lookup (venda #" + sale.orderNumber + ")");
                  const txToDelete = transactions.find(t => 
                    t.relatedId === saleId && 
                    t.amount === payment.amount && 
                    t.accountId === payment.accountId &&
                    Math.abs(t.date - payment.date) < 300000 // 5 min tolerance
                  );

                  if (txToDelete) {
                    await firebaseService.deleteDocument("transactions", txToDelete.id);
                    transactionDeleted = true;
                  } else {
                    // Try direct lookup
                    const uid = auth.currentUser?.uid;
                    if (uid) {
                      const transactionsRef = collection(db, `users/${uid}/transactions`);
                      const q = query(transactionsRef, 
                        where("relatedId", "==", saleId),
                        where("amount", "==", payment.amount),
                        where("accountId", "==", payment.accountId)
                      );
                      const txSnapshot = await getDocs(q);
                      const docs = txSnapshot.docs.filter(doc => Math.abs(doc.data().date - payment.date) < 600000); // 10 min
                      
                      if (docs.length > 0) {
                        await Promise.all(docs.map(doc => firebaseService.deleteDocument("transactions", doc.id)));
                        transactionDeleted = true;
                      }
                    }
                  }
                }

                if (!transactionDeleted) {
                   console.warn("Aviso: Não foi possível localizar o registro financeiro para exclusão automática.");
                }

                // 3. Revert Customer Credit if necessary
                if (sale.customerId && surplusBefore > surplusAfter) {
                  const customer = people.find(p => p.id === sale.customerId);
                  if (customer) {
                    const creditToRemove = surplusBefore - surplusAfter;
                    const newCredit = Math.max(0, (customer.credit || 0) - creditToRemove);
                    await firebaseService.updateDocument("people", customer.id, {
                      credit: newCredit
                    });
                  }
                }

                // 4. Update Sale History (Central source of truth for the modal)
                await firebaseService.updateDocument("sales", saleId, {
                  paymentHistory: newHistory,
                  paymentStatus: newStatus
                });

                console.log('Exclusão concluída com sucesso!');
              } catch (err: any) {
                console.error("Erro na exclusão:", err);
                let errorMessage = err.message || String(err);
                
                // Tenta extrair a mensagem limpa se for o erro JSON do Firestore
                try {
                  const parsed = JSON.parse(errorMessage);
                  if (parsed.error) errorMessage = parsed.error;
                } catch (e) { /* Não é JSON */ }

                console.error(`Erro ao processar exclusão: ${errorMessage}`);
              }
            }}
            onUpdatePayment={async (saleId, paymentId, amount, accountId, paymentMethodId, note) => {
              const sale = sales.find(s => s.id === saleId);
              if (!sale || !sale.paymentHistory) return;

              const paymentIdx = sale.paymentHistory.findIndex(p => p.id === paymentId);
              if (paymentIdx === -1) return;

              const oldPayment = sale.paymentHistory[paymentIdx];
              const amountPaidBefore = sale.paymentHistory.reduce((acc, p) => acc + p.amount, 0);
              const surplusBefore = Math.max(0, amountPaidBefore - sale.total);

              const newHistory = [...sale.paymentHistory];
              newHistory[paymentIdx] = {
                ...oldPayment,
                amount,
                accountId,
                paymentMethodId,
                note
              };

              const amountPaidAfter = newHistory.reduce((acc, p) => acc + p.amount, 0);
              const surplusAfter = Math.max(0, amountPaidAfter - sale.total);
              const newStatus = amountPaidAfter >= sale.total ? PaymentStatus.PAID : PaymentStatus.PENDING;

              // 1. Update Sale
              await firebaseService.updateDocument("sales", saleId, {
                paymentHistory: newHistory,
                paymentStatus: newStatus
              });

              // 2. Adjust Account Balances
              if (oldPayment.accountId !== accountId) {
                const oldAcc = accounts.find(a => a.id === oldPayment.accountId);
                if (oldAcc) await firebaseService.updateDocument("accounts", oldPayment.accountId, { balance: oldAcc.balance - oldPayment.amount });
                
                const newAcc = accounts.find(a => a.id === accountId);
                const currentNewBalance = newAcc?.id === oldPayment.accountId ? (oldAcc?.balance || 0) - oldPayment.amount : (newAcc?.balance || 0);
                if (newAcc) await firebaseService.updateDocument("accounts", accountId, { balance: currentNewBalance + amount });
              } else {
                const diff = amount - oldPayment.amount;
                const acc = accounts.find(a => a.id === accountId);
                if (acc) await firebaseService.updateDocument("accounts", accountId, { balance: acc.balance + diff });
              }

              // 3. Update Transaction - Use link if available, fallback otherwise
              const txIdToUse = oldPayment.transactionId;
              if (txIdToUse) {
                await firebaseService.updateDocument("transactions", txIdToUse, {
                  amount: amount,
                  accountId: accountId,
                  description: `Recebimento Parcial (Editado) - Venda #${sale.orderNumber}${note ? ' - ' + note : ''}`
                });
              } else {
                const tx = transactions.find(t => 
                  t.relatedId === saleId && 
                  t.amount === oldPayment.amount && 
                  t.accountId === oldPayment.accountId &&
                  Math.abs(t.date - oldPayment.date) < 60000 // 60s tolerance consistent with delete
                );
                if (tx) {
                  await firebaseService.updateDocument("transactions", tx.id, {
                    amount: amount,
                    accountId: accountId,
                    description: `Recebimento Parcial (Editado) - Venda #${sale.orderNumber}${note ? ' - ' + note : ''}`
                  });
                } else {
                  console.warn("Transação financeira correspondente não encontrada para atualização.");
                }
              }

              // 4. Update Customer Credit if surplus changed
              if (sale.customerId && surplusBefore !== surplusAfter) {
                const customer = people.find(p => p.id === sale.customerId);
                if (customer) {
                  const creditDiff = surplusAfter - surplusBefore;
                  const newCredit = Math.max(0, (customer.credit || 0) + creditDiff);
                  await firebaseService.updateDocument("people", customer.id, {
                    credit: newCredit
                  });
                }
              }

              toast.show('Recebimento atualizado com sucesso!');
            }}
            productionOrders={productionOrders}
            lots={productionLots}
            sectors={sectors}
            onCreateProductionOrder={async (order, newLots, deductions) => {
              await firebaseService.saveDocument("productionOrders", order);
              for (const lot of newLots) {
                await firebaseService.saveDocument("productionLots", lot);
              }
              for (const d of deductions) {
                const product = products.find(p => p.id === d.productId);
                if (!product) continue;
                const updatedProduct = JSON.parse(JSON.stringify(product));
                const variation = updatedProduct.variations.find((v: any) => v.id === d.variationId);
                if (!variation) continue;
                if (d.size) {
                  variation.stock[d.size] = Math.max(0, (variation.stock[d.size] || 0) - d.quantity);
                } else {
                  variation.stock['WHOLESALE'] = Math.max(0, (variation.stock['WHOLESALE'] || 0) - d.quantity);
                }
                await firebaseService.saveDocument("products", updatedProduct);
              }
              const sale = sales.find(s => s.id === order.saleId);
              if (sale) await firebaseService.saveDocument("sales", { ...sale, productionOrderId: order.id });
            }}
            modulesConfig={modulesConfig}
            isDarkMode={isDarkMode}
            appTheme={appTheme}
            initialSearchQuery={searchContext}
            stockLots={stockLots}
            onReleaseSale={handleReleaseSale}
            onExpediteSale={handleExpediteSale}
            onRevertExpedition={handleRevertExpedition}
            onSepararCaixas={handleSepararCaixas}
            onPartialRevertSeparacao={handlePartialRevertSeparacao}
            onTransferToStock={handleTransferSaleToStock}
            onNavigateStock={() => navigateTo(ViewType.STOCK)}
            onNavigateStockGlance={() => navigateTo(ViewType.STOCK_GLANCE)}
            productionConfigs={productionConfigs}
          />
        );
      case ViewType.FINANCIAL:
        return (
          <FinancialView
            transactions={transactions}
            categories={categories}
            accounts={accounts}
            people={people}
            purchases={purchases}
            sales={sales}
            products={products}
            onSave={async (newTx) => {
              try {
                await financeService.createTransaction(newTx);
                toast.show('Lançamento salvo com sucesso!');
              } catch (err: any) {
                console.error('onSave error:', err);
                toast.show('Erro ao salvar lançamento: ' + (err.message || err));
              }
            }}
            onEdit={async (id, updates) => {
              try {
                console.log('[App] Calling updateTransaction:', id, updates);
                await financeService.updateTransaction(id, updates);
                console.log('[App] updateTransaction success');
                toast.show('Atualizado com sucesso!');
              } catch (err: any) {
                console.error('onEdit error:', err);
                toast.show('Erro ao atualizar: ' + (err.message || err));
              }
            }}
            onDelete={async (id) => {
              try {
                console.log('[App] Calling deleteTransaction:', id);
                await financeService.deleteTransaction(id);
                console.log('[App] deleteTransaction success');
                toast.show('Excluído com sucesso!');
              } catch (err: any) {
                console.error('onDelete error:', err);
                toast.show('Erro ao excluir: ' + (err.message || err));
              }
            }}
            onUpdatePurchase={async (id, updates) => {
              try {
                await firebaseService.updateDocument("purchases", id, updates);
                // No need for alert here if it's a sub-action usually, but user is used to it.
              } catch (err: any) {
                toast.show('Erro ao atualizar compra: ' + (err.message || err));
              }
            }}
            onUpdatePerson={async (id, updates) => {
              try {
                await firebaseService.updateDocument("people", id, updates);
              } catch (err: any) {
                toast.show('Erro ao atualizar cadastro: ' + (err.message || err));
              }
            }}
            onOpenPurchase={(id) => navigateTo(ViewType.PURCHASE_FORM, id)}
            onOpenSale={(id) => navigateTo(ViewType.SALE_FORM, id)}
            isDarkMode={isDarkMode}
          />
        );
      case ViewType.ACCOUNTS:
        return (
          <AccountsView
            accounts={accounts}
            onAdd={() => {
              setEditingAccount(undefined);
              setIsAccountModalOpen(true);
            }}
            onEdit={(id) => {
              const acc = accounts.find((a) => a.id === id);
              if (acc) {
                setEditingAccount(acc);
                setIsAccountModalOpen(true);
              }
            }}
            onDelete={(id) => {
              firebaseService.deleteDocument("accounts", id);
            }}
            onAdjust={(id) => {
              const acc = accounts.find((a) => a.id === id);
              if (acc) {
                const newBalanceStr = prompt(
                  `Informe o novo saldo para ${acc.name}:`,
                  acc.balance.toString(),
                );
                const newBalance = parseFloat(newBalanceStr || "");
                if (!isNaN(newBalance)) {
                  firebaseService.updateDocument("accounts", id, {
                    balance: newBalance,
                  });

                  // Opcional: criar transação de ajuste
                  const diff = newBalance - acc.balance;
                  if (diff !== 0) {
                    const adjTransaction: Omit<Transaction, "id"> = {
                      type:
                        diff > 0
                          ? TransactionType.INCOME
                          : TransactionType.EXPENSE,
                      categoryId: diff > 0 ? "rev3" : "exp1",
                      accountId: id,
                      amount: Math.abs(diff),
                      date: Date.now(),
                      description: "Ajuste de Saldo Manual",
                      status: "COMPLETED",
                    };
                    firebaseService.saveDocument(
                      "transactions",
                      adjTransaction,
                    );
                  }
                }
              }
            }}
            onTransfer={() => {
              if (accounts.length < 2) {
                toast.show(
                  "É necessário pelo menos duas contas para transferência.",
                );
                return;
              }
              const fromId = prompt(
                "ID da conta de ORIGEM:\n" +
                  accounts.map((a) => `${a.id}: ${a.name}`).join("\n"),
              );
              const toId = prompt(
                "ID da conta de DESTINO:\n" +
                  accounts.map((a) => `${a.id}: ${a.name}`).join("\n"),
              );
              const amountStr = prompt("Valor a transferir:");
              const amount = parseFloat(amountStr || "");

              const from = accounts.find((a) => a.id === fromId);
              const to = accounts.find((a) => a.id === toId);

              if (from && to && !isNaN(amount) && amount > 0) {
                if (from.balance < amount) {
                  if (
                    !confirm(
                      "Saldo insuficiente na conta de origem. Continuar assim mesmo?",
                    )
                  )
                    return;
                }

                firebaseService.updateDocument("accounts", from.id, {
                  balance: from.balance - amount,
                });
                firebaseService.updateDocument("accounts", to.id, {
                  balance: to.balance + amount,
                });
 
                const txOut: Omit<Transaction, "id"> = {
                  type: TransactionType.EXPENSE,
                  categoryId: "exp1",
                  accountId: from.id,
                  amount,
                  date: Date.now(),
                  description: `Transferência para ${to.name}`,
                  status: "COMPLETED",
                };
                const txIn: Omit<Transaction, "id"> = {
                  type: TransactionType.INCOME,
                  categoryId: "rev3",
                  accountId: to.id,
                  amount,
                  date: Date.now(),
                  description: `Transferência de ${from.name}`,
                  status: "COMPLETED",
                };
                firebaseService.saveDocument("transactions", txOut);
                firebaseService.saveDocument("transactions", txIn);
                toast.show("Transferência realizada com sucesso!");
              }
            }}
            isDarkMode={isDarkMode}
            modulesConfig={modulesConfig}
          />
        );
      case ViewType.STOCK:
        return (
          <StockView
            products={products}
            productionConfigs={productionConfigs}
            onUpdateProduct={async (product) => {
              await firebaseService.saveDocument("products", product);
            }}
            isDarkMode={isDarkMode}
            stockLots={stockLots}
            onPreviewRevertStockLot={buildStockLotRevertPreview}
            onRevertStockLot={handleRevertStockLot}
            sales={sales}
            productionOrders={productionOrders}
            onFixPkgAllocations={handleFixPkgAllocations}
          />
        );
      case ViewType.STOCK_GLANCE:
        return (
          <StockGlanceView
            products={products}
            isDarkMode={isDarkMode}
            onBack={goBack}
            onUpdateVariationNote={handleUpdateVariationStockNote}
            grids={grids}
          />
        );
      case ViewType.SALE_FORM:
        return (
          <SaleFormView
            saleId={selectedSaleId}
            sales={sales}
            products={products}
            grids={grids}
            people={people}
            paymentMethods={paymentMethods}
            accounts={accounts}
            productionOrders={productionOrders}
            lots={productionLots}
            sectors={sectors}
            productionConfigs={productionConfigs}
            onCreateProductionOrder={async (order, newLots, deductions) => {
              await firebaseService.saveDocument("productionOrders", order);
              for (const lot of newLots) {
                await firebaseService.saveDocument("productionLots", lot);
              }
              // Deduct stock from products
              for (const d of deductions) {
                const product = products.find(p => p.id === d.productId);
                if (!product) continue;
                const updatedProduct = JSON.parse(JSON.stringify(product));
                const variation = updatedProduct.variations.find((v: any) => v.id === d.variationId);
                if (!variation) continue;
                if (d.size) {
                  variation.stock[d.size] = Math.max(0, (variation.stock[d.size] || 0) - d.quantity);
                } else {
                  variation.stock['WHOLESALE'] = Math.max(0, (variation.stock['WHOLESALE'] || 0) - d.quantity);
                }
                await firebaseService.saveDocument("products", updatedProduct);
              }
              // Link order to sale
              const sale = sales.find(s => s.id === order.saleId);
              if (sale) {
                await firebaseService.saveDocument("sales", { ...sale, productionOrderId: order.id });
              }
            }}
            onSave={async (sale) => {
              try {
                const prevSale = selectedSaleId ? sales.find(s => s.id === selectedSaleId) : null;
                let updatedSale = sale; // will be updated with per-item fulfilled flags

                await firebaseService.saveDocument("sales", sale);

              // Local map to track mutations before saving
              const productUpdates = new Map<string, any>();
              const getProductForUpdate = (id: string) => {
                if (productUpdates.has(id)) return productUpdates.get(id);
                const p = products.find(prod => prod.id === id);
                if (p) {
                  const cloned = JSON.parse(JSON.stringify(p));
                  productUpdates.set(id, cloned);
                  return cloned;
                }
                return null;
              };

              const accountUpdates = new Map<string, any>();
              const getAccountForUpdate = (id: string) => {
                if (accountUpdates.has(id)) return accountUpdates.get(id);
                const a = accounts.find(acc => acc.id === id);
                if (a) {
                  const cloned = JSON.parse(JSON.stringify(a));
                  accountUpdates.set(id, cloned);
                  return cloned;
                }
                return null;
              };

              // REVERT OLD STOCK if it was already a SALE — only fulfilled RETAIL items
              // (WHOLESALE/caixa items are never auto-deducted at registration: they
              //  wait for manual separation via "Separar Caixas")
              if (prevSale && prevSale.status === SaleStatus.SALE) {
                for (const item of prevSale.items) {
                   if (item.fulfilled === false) continue; // não foi abatido, nada a reverter
                   // Itens WHOLESALE não foram auto-abatidos, não há o que reverter
                   const isWholesaleItem = item.saleType === SaleType.WHOLESALE || (!item.size);
                   if (isWholesaleItem) continue;
                   const updatedProduct = getProductForUpdate(item.productId);
                   if (updatedProduct) {
                     const variationIndex = updatedProduct.variations.findIndex((v: any) => v.id === item.variationId);
                     if (variationIndex !== -1) {
                       const variation = updatedProduct.variations[variationIndex];
                       // Já passamos pelo continue acima para itens WHOLESALE — aqui é sempre Varejo.
                       const key = item.size || 'WHOLESALE';
                       variation.stock[key] = (variation.stock[key] || 0) + item.quantity;
                     }
                   }
                }
              }

              // APPLY NEW STOCK if it is a SALE — apenas itens RETAIL (por tamanho)
              // Itens WHOLESALE (caixas) aguardam a separação física via "Separar Caixas"
              if (sale.status === SaleStatus.SALE) {
                const newItems = sale.items.map(item => ({ ...item }));
                for (let i = 0; i < newItems.length; i++) {
                  const item = newItems[i];
                  if (item.fulfilled === true) continue; // já abatido anteriormente
                  // Itens WHOLESALE não são auto-abatidos: aguardam separação manual
                  const isWholesaleItem = item.saleType === SaleType.WHOLESALE || (!item.size && item.saleType !== SaleType.RETAIL);
                  if (isWholesaleItem) { newItems[i] = { ...item, fulfilled: false }; continue; }
                  const updatedProduct = getProductForUpdate(item.productId);
                  if (!updatedProduct) { newItems[i] = { ...item, fulfilled: false }; continue; }
                  const variationIndex = updatedProduct.variations.findIndex((v: any) => v.id === item.variationId);
                  if (variationIndex === -1) { newItems[i] = { ...item, fulfilled: false }; continue; }
                  const variation = updatedProduct.variations[variationIndex];
                  // Já passamos pelo continue acima para itens WHOLESALE — aqui é sempre Varejo.
                  const key = item.size || 'WHOLESALE';
                  const available = variation.stock[key] || 0;
                  if (available >= item.quantity) {
                    variation.stock[key] = Math.max(0, available - item.quantity);
                    newItems[i] = { ...item, fulfilled: true };
                  } else {
                    newItems[i] = { ...item, fulfilled: false };
                  }
                }
                updatedSale = { ...sale, items: newItems };
              }

              // Save accumulated product updates
              for (const [_, prod] of productUpdates) {
                await firebaseService.saveDocument("products", prod);
              }

              // Salva a venda com flags de fulfilled atualizados (se houver mudanças)
              if (updatedSale !== sale) {
                await firebaseService.saveDocument("sales", updatedSale);
              }

              // FINANCIAL LOGIC: Partial Payments & Transactions
              // 1. Revert Old Transactions
              if (prevSale) {
                const oldTxs = transactions.filter(t => t.relatedId === prevSale.id);
                for (const otx of oldTxs) {
                  await firebaseService.deleteDocument("transactions", otx.id);
                  const acc = getAccountForUpdate(otx.accountId);
                  if (acc) {
                    acc.balance -= otx.amount;
                  }
                }
              }

              // 2. Create New Transactions from paymentHistory (skip if non-accounting)
              if (sale.isAccounting !== false && sale.paymentHistory && sale.paymentHistory.length > 0) {
                for (const p of sale.paymentHistory) {
                  const newTransaction: Omit<Transaction, "id"> = {
                    type: TransactionType.INCOME,
                    categoryId: "rev1", 
                    accountId: p.accountId,
                    amount: p.amount,
                    date: p.date,
                    description: `Pagamento Venda #${sale.orderNumber}${p.note ? ' - ' + p.note : ''}`,
                    status: "COMPLETED",
                    relatedId: sale.id,
                    contactId: sale.customerId,
                    contactName: sale.customerName || people.find(p => p.id === sale.customerId)?.name,
                  };
                  await firebaseService.saveDocument("transactions", newTransaction);

                  // Update account balance
                  const acc = getAccountForUpdate(p.accountId);
                  if (acc) {
                    acc.balance += p.amount;
                  }
                }
              }

              // Save accumulated account updates (skip if non-accounting)
              if (sale.isAccounting !== false) {
                for (const [_, acc] of accountUpdates) {
                  await firebaseService.updateDocument("accounts", acc.id, { balance: acc.balance });
                }
              }

              // 3. Update Customer Credit (Haver) — skip if non-accounting
              if (sale.isAccounting !== false && sale.customerId) {
                const amountPaid = sale.paymentHistory?.reduce((acc, p) => acc + p.amount, 0) || 0;
                const surplus = Math.max(0, amountPaid - sale.total);
                
                const prevAmountPaid = prevSale?.paymentHistory?.reduce((acc, p) => acc + p.amount, 0) || 0;
                const prevSurplus = Math.max(0, prevAmountPaid - (prevSale?.total || 0));

                const customer = people.find(p => p.id === sale.customerId);
                if (customer) {
                  const currentCredit = customer.credit || 0;
                  const newCredit = currentCredit - prevSurplus + surplus;
                  if (newCredit !== currentCredit) {
                    await firebaseService.updateDocument("people", sale.customerId, { credit: newCredit });
                  }
                }
              }

              // 4. Auto-create Production Order if it's a new SALE or updated SALE
              if (sale.status === SaleStatus.SALE) {
                await autoCreateProductionOrder(sale);
              }

              } catch (err: any) {
                console.error("Save Error:", err);
                toast.show("Erro ao salvar: " + (err.message || err));
                throw err;
              }
            }}
            onDelete={handleDeleteSale}
            onCancelOnly={handleCancelOnlySale}
            onCancelAndRevert={handleCancelSaleWithRevert}
            onCancel={goBack}
            modulesConfig={modulesConfig}
            isDarkMode={isDarkMode}
          />
        );
      case ViewType.PRODUCTION_MENU:
        return (
          <div className="flex flex-col gap-6 pb-32">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Gestão de Fábrica e PCP</h3>
                <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  {[
                    { id: ViewType.PRODUCTION_PCP, label: 'PCP Central', icon: <GanttChartSquare size={22} />, color: 'text-indigo-600' },
                    { id: ViewType.PRODUCTION_ESTOQUES_MENU, label: 'Estoques', icon: <Boxes size={22} />, color: 'text-emerald-600' },
                    { id: ViewType.PRODUCTION_PURCHASE_NEEDS, label: 'Necessidade de Compras', icon: <ClipboardList size={22} />, color: 'text-amber-600' },
                  ].map((item, index, array) => (
                    <button
                      key={item.id}
                      onClick={() => navigateTo(item.id)}
                      className={`w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${index !== array.length - 1 ? (isDarkMode ? 'border-b border-slate-800' : 'border-b border-slate-50') : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 flex items-center justify-center shrink-0 ${item.color}`}>
                          {item.icon}
                        </div>
                        <div className="text-left">
                          <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.label}</p>
                        </div>
                      </div>
                      <ChevronRight size={20} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Novo Grupo Gestão de Solados */}
              <div className="flex flex-col gap-3">
                <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Gestão de Solados</h3>
                <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  {[
                    { id: ViewType.PRODUCTION_WEIGHING, label: 'Pesagem e Contagem de Solados', icon: <Scale size={22} />, color: 'text-violet-600' },
                    { id: ViewType.PRODUCTION_SOLE_RECEIPT, label: 'Conferência de Compras (Solas)', icon: <ShoppingCart size={22} />, color: 'text-cyan-600' },
                    { id: ViewType.PRODUCTION_SOLE_STOCK, label: 'Estoques de Solados', icon: <Package size={22} />, color: 'text-emerald-500' },
                    { id: 'matrizes', label: 'Matrizes', icon: <Database size={22} />, color: 'text-indigo-500' },
                  ].map((item, index, array) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.id === 'matrizes') {
                          navigateToProduction('MATRIZES');
                        } else {
                          navigateTo(item.id as ViewType);
                        }
                      }}
                      className={`w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${index !== array.length - 1 ? (isDarkMode ? 'border-b border-slate-800' : 'border-b border-slate-50') : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 flex items-center justify-center shrink-0 ${item.color}`}>
                          {item.icon}
                        </div>
                        <div className="text-left">
                          <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.label}</p>
                        </div>
                      </div>
                      <ChevronRight size={20} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Novo Grupo de Engenharia */}
              <div className="flex flex-col gap-3">
                <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Engenharia e Desenvolvimento</h3>
                <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <button
                    onClick={() => navigateTo(ViewType.PRODUCTION_ENGINEERING)}
                    className="w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 flex items-center justify-center shrink-0 text-indigo-600">
                        <Database size={22} />
                      </div>
                      <div className="text-left">
                        <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Engenharia de Produto</p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Produtos, Grades e Solados</p>
                      </div>
                    </div>
                    <ChevronRight size={20} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
                  </button>
                </div>
              </div>
            </div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-4 p-8 rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-4"
            >
              <div className={`w-16 h-16 rounded-[1.8rem] flex items-center justify-center ${isDarkMode ? 'bg-slate-900 text-indigo-500' : 'bg-indigo-50 text-indigo-600'}`}>
                <Factory size={32} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Módulo de Manufatura</p>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                  Controle total do seu processo produtivo, desde a matéria-prima até o produto acabado.
                </p>
              </div>
            </motion.div>
          </div>
        );
      case ViewType.PRODUCTION_CONFIG:
        return (
          <ProductionConfigView 
            flowTags={flowTags}
            sectors={sectors}
            productionConfigs={productionConfigs}
            onSaveFlowTag={(tag: any) => firebaseService.saveDocument("flowTags", tag)}
            onDeleteFlowTag={(id: string) => firebaseService.deleteDocument("flowTags", id)}
            onSaveSector={(sector: any) => firebaseService.saveDocument("sectors", sector)}
            onDeleteSector={(id: string) => firebaseService.deleteDocument("sectors", id)}
            onSaveConfigItem={async (item: any) => {
              try {
                await firebaseService.saveDocument("productionConfigs", item);
              } catch (err: any) {
                console.error("Erro ao salvar item de configuração:", err);
                toast.show("Erro ao salvar item: " + (err.message || err));
              }
            }}
            onDeleteConfigItem={(id: string) => firebaseService.deleteDocument("productionConfigs", id)}
            onUpdateSectorsOrder={(updatedSectors: any[]) => {
              const withOrder = updatedSectors.map((s, i) => ({ ...s, order: i }));
              setSectors(withOrder);
              Promise.all(withOrder.map(s => firebaseService.saveDocument('sectors', s)));
            }}
            onBack={goBack}
            isDarkMode={isDarkMode}
            people={people}
            colors={colors}
            grids={grids}
            categories={categories}
            initialScreen={productionSubScreen}
            onNavigate={navigateTo}
            onAddProduct={() => navigateTo(ViewType.PRODUCT_FORM)}
            onNavigateGrids={() => navigateTo(ViewType.GRIDS)}
            lots={productionLots}
            products={products}
            soleStock={soleStockEntries}
          />
        );
      case ViewType.PRODUCT_SHEET:
      case ViewType.PRODUCTION_ENGINEERING:
        return (
          <ProductionEngineeringView
            products={products}
            categories={categories}
            onAdd={() => navigateTo(ViewType.PRODUCT_FORM)}
            onEdit={(id) => navigateTo(ViewType.PRODUCT_FORM, id)}
            onDelete={async (id) => {
              try {
                await firebaseService.deleteDocument("products", id);
              } catch (e) {
                console.error(e);
                toast.show("Erro ao excluir modelo.");
              }
            }}
            onDuplicate={async (id) => {
              try {
                const original = products.find(p => p.id === id);
                if (!original) return;
                const { id: _id, ...rest } = original;
                const copy = {
                  ...rest,
                  name: `${rest.name} (Cópia)`,
                  reference: `${rest.reference}-C`,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                await firebaseService.saveDocument("products", copy);
                toast.show("Engenharia duplicada com sucesso!");
              } catch (e) {
                console.error(e);
                toast.show("Erro ao duplicar modelo.");
              }
            }}
            onToggleStatus={async (id, status) => {
              try {
                await firebaseService.updateDocument("products", id, { status });
              } catch (e) {
                console.error(e);
                toast.show("Erro ao alterar status.");
              }
            }}
            onBack={goBack}
            isDarkMode={isDarkMode}
          />
        );
      case ViewType.PRODUCTION_PCP:
        return (
          <PCPView
            lots={productionLots}
            products={products}
            grids={grids}
            sectors={sectors}
            productionOrders={productionOrders}
            flowTags={flowTags}
            colors={colors}
            isDarkMode={isDarkMode}
            appTheme={appTheme}
            onSaveLot={handleSaveProductionLot}
            onDeleteLot={handleDeleteProductionLot}
            onDeleteProductionOrder={handleDeleteProductionOrder}
            onBack={goBack}
            userName={user?.displayName || user?.email || 'Usuário'}
            productionConfigs={productionConfigs}
            soleStock={soleStockEntries}
            palmilhaStock={palmilhaStockEntries}
            onNavigate={navigateTo}
            onNavigateProduction={navigateToProduction}
            purchaseRequests={purchaseRequests}
            onRequestPurchase={handleCreatePurchaseRequest}
            initialTab={currentParams?.initialTab}
            initialSectorId={currentParams?.initialSectorId}
            initialLotId={currentParams?.initialLotId}
            initialOrderId={currentParams?.initialOrderId}
            initialItemIdx={currentParams?.initialItemIdx}
            initialScanNonce={currentParams?.initialScanNonce}
            initialOSId={currentParams?.initialOSId}
            initialOSNonce={currentParams?.initialOSNonce}
            initialOpenMode={currentParams?.initialOpenMode}
            people={people}
            accounts={accounts}
            categories={categories}
            serviceOrders={serviceOrders}
            purchases={purchases}
            sales={sales}
            stockLots={stockLots}
            transactions={transactions}
          />
        );
      case ViewType.PRODUCTION_SERVICE_ORDER_FORM:
        return (
          <ServiceOrderFormView
            serviceOrderId={selectedServiceOrderId}
            serviceOrders={serviceOrders}
            lots={productionLots}
            products={products}
            sectors={sectors}
            productionOrders={productionOrders}
            people={people}
            accounts={accounts}
            categories={categories}
            isDarkMode={isDarkMode}
            grids={grids}
            onBack={goBack}
            onNavigate={navigateTo}
            initialParams={currentParams}
          />
        );
      case ViewType.PRODUCTION_STOCK:
        return (
          <ProductionConfigView 
            flowTags={flowTags}
            sectors={sectors}
            productionConfigs={productionConfigs}
            onSaveFlowTag={(tag: any) => firebaseService.saveDocument("flowTags", tag)}
            onDeleteFlowTag={(id: string) => firebaseService.deleteDocument("flowTags", id)}
            onSaveSector={(sector: any) => firebaseService.saveDocument("sectors", sector)}
            onDeleteSector={(id: string) => firebaseService.deleteDocument("sectors", id)}
            onSaveConfigItem={async (item: any) => {
              try {
                await firebaseService.saveDocument("productionConfigs", item);
              } catch (err: any) {
                console.error("Erro ao salvar item de configuração:", err);
                toast.show("Erro ao salvar item: " + (err.message || err));
              }
            }}
            onDeleteConfigItem={(id: string) => firebaseService.deleteDocument("productionConfigs", id)}
            onUpdateSectorsOrder={(updatedSectors: any[]) => {
              const withOrder = updatedSectors.map((s, i) => ({ ...s, order: i }));
              setSectors(withOrder);
              Promise.all(withOrder.map(s => firebaseService.saveDocument('sectors', s)));
            }}
            onBack={goBack}
            isDarkMode={isDarkMode}
            people={people}
            colors={colors}
            grids={grids}
            categories={categories}
            initialScreen="INSUMOS"
            onNavigate={navigateTo}
            onAddProduct={() => navigateTo(ViewType.PRODUCT_FORM)}
            onNavigateGrids={() => navigateTo(ViewType.GRIDS)}
            lots={productionLots}
            products={products}
            soleStock={soleStockEntries}
          />
        );

      case ViewType.PRODUCTION_WEIGHING:
        return (
          <WeighingView
            productionConfigs={productionConfigs}
            colors={colors}
            stockEntries={soleStockEntries}
            onBack={goBack}
            onNavigateToStock={() => navigateTo(ViewType.PRODUCTION_SOLE_STOCK)}
            isDarkMode={isDarkMode}
            existingRecords={weighingRecords}
            initialTab={currentParams?.initialTab}
          />
        );
      case ViewType.PRODUCTION_SOLE_PURCHASE:
        return (
          <SoleProcurement
            accounts={accounts}
            productionConfigs={productionConfigs}
            colors={colors as ColorValue[]}
            people={people}
            onBack={goBack}
            onNavigateToStock={() => navigateTo(ViewType.PRODUCTION_SOLE_STOCK)}
            isDarkMode={isDarkMode}
            initialParams={currentParams}
          />
        );
      case ViewType.PRODUCTION_SOLE_STOCK:
        return (
          <SoleStockView
            stockEntries={soleStockEntries as SoleStockEntry[]}
            productionConfigs={productionConfigs}
            colors={colors as ColorValue[]}
            productionLots={productionLots}
            products={products}
            people={people}
            purchaseRequests={purchaseRequests}
            purchases={purchases}
            onBack={goBack}
            onNavigateToWeighing={() => navigateTo(ViewType.PRODUCTION_WEIGHING)}
            onNavigateToWeighingHistory={() => navigateTo(ViewType.PRODUCTION_WEIGHING, { initialTab: 'history' })}
            onFormularPedido={(items) => navigateTo(ViewType.PURCHASE_FORM, { type: PurchaseType.SOLE, items, initialDescription: 'Pedido formulado a partir do Estoque de Solados' })}
            isDarkMode={isDarkMode}
          />
        );
      case ViewType.PRODUCTION_PALMILHA_STOCK:
        return (
          <PalmilhaStockView
            stockEntries={palmilhaStockEntries}
            productionConfigs={productionConfigs}
            colors={colors as ColorValue[]}
            productionLots={productionLots}
            products={products}
            people={people}
            purchaseRequests={purchaseRequests}
            purchases={purchases}
            onBack={goBack}
            onFormularPedido={(items) => navigateTo(ViewType.PRODUCTION_PALMILHA_PURCHASE, { items, description: 'Pedido formulado a partir do Estoque de Palmilhas' })}
            isDarkMode={isDarkMode}
          />
        );
      case ViewType.PRODUCTION_PURCHASE_NEEDS:
        return (
          <PurchaseNeedsView
            purchaseRequests={purchaseRequests}
            onUpdateRequest={handleSavePurchaseRequest}
            onDeleteRequest={handleDeletePurchaseRequest}
            onNavigate={navigateTo}
            onBack={goBack}
            isDarkMode={isDarkMode}
            userName={user?.displayName || user?.email || 'Usuário'}
            soleStock={soleStockEntries}
            productionConfigs={productionConfigs}
            people={people}
          />
        );
      case ViewType.PRODUCTION_ESTOQUES_MENU:
        return (
          <div className="flex flex-col gap-6">
            <header className="mb-4">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Controle de Estoques</h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Materiais e Solados</p>
            </header>
            
            <div className={`rounded-[2.5rem] border shadow-sm overflow-hidden ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
              {[
                { id: ViewType.PRODUCTION_STOCK, label: 'Estoques Gerais', description: 'Matéria-prima, adesivos e insumos', icon: <PackageOpen size={24} />, color: 'text-emerald-600' },
                { id: ViewType.PRODUCTION_SOLE_STOCK, label: 'Estoque de Solados', description: 'Gerenciamento por modelo, cor e tamanho', icon: <Package size={24} />, color: 'text-indigo-600' },
                { id: ViewType.PRODUCTION_PALMILHA_STOCK, label: 'Estoque de Palmilhas', description: 'Montagem e Acabamento, por faca e cor', icon: <Footprints size={24} />, color: 'text-rose-600' },
                { id: ViewType.STOCK, label: 'Expedição e Estoque', description: 'Produtos prontos — pedidos de clientes e estoque', icon: <Boxes size={24} />, color: 'text-amber-700' },
                { id: ViewType.PRODUCTION_GENERAL_RECEIPT, label: 'Recebimento de Compras', description: 'Dar entrada de materiais comprados no estoque', icon: <ClipboardList size={24} />, color: 'text-amber-600' },
              ].map((item, index, array) => (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.id)}
                  className={`w-full flex items-center justify-between p-8 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all active:scale-[0.98] ${index !== array.length - 1 ? (isDarkMode ? "border-b border-slate-800" : "border-b border-slate-50") : ""}`}
                >
                  <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? "bg-slate-800" : "bg-slate-50"} ${item.color}`}>
                      {item.icon}
                    </div>
                    <div className="text-left">
                      <p className={`text-lg font-black tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>{item.label}</p>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{item.description}</p>
                    </div>
                  </div>
                  <ChevronRight size={24} className={isDarkMode ? "text-slate-700" : "text-slate-300"} />
                </button>
              ))}
            </div>
          </div>
        );
      case ViewType.PRODUCTION_GENERAL_RECEIPT:
        return (
          <GeneralReceiptsView
            purchases={purchases}
            suppliers={suppliers}
            productionConfigs={productionConfigs}
            purchaseRequests={purchaseRequests}
            onBack={goBack}
            isDarkMode={isDarkMode}
            onEditPurchase={(id) => navigateTo(ViewType.PURCHASE_FORM, id)}
            onOpenSoleReceipt={() => navigateTo(ViewType.PRODUCTION_SOLE_RECEIPT)}
          />
        );
      case ViewType.PRODUCTION_SOLE_RECEIPT:
        return (
          <SoleReceiptView
            purchases={purchases}
            suppliers={suppliers}
            soleStockEntries={soleStockEntries}
            productionLots={productionLots}
            products={products}
            onBack={goBack}
            isDarkMode={isDarkMode}
          />
        );
      case ViewType.MODULES_CONFIG:
        return (
          <ModuleConfigView
            config={modulesConfig}
            onSave={saveModulesConfig}
            onNavigate={navigateTo}
            isDarkMode={isDarkMode}
          />
        );
      case ViewType.COLLABORATORS_CONFIG:
        return (
          <CollaboratorsConfigView
            collaborators={collaborators}
            onSave={saveCollaborator}
            onDelete={deleteCollaborator}
            isDarkMode={isDarkMode}
          />
        );
      case ViewType.MANUAL:
        return (
          <ManualView
            onBack={goBack}
            isDarkMode={isDarkMode}
          />
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center gap-6">
            <div className="w-20 h-20 rounded-3xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400">
              <AlertCircle size={40} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-2">Em Desenvolvimento</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto font-bold uppercase tracking-widest leading-relaxed">
                Esta funcionalidade ainda não está pronta para uso.
              </p>
            </div>
            <button onClick={goBack} title="Voltar" className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[11px] font-black uppercase tracking-widest">Voltar</button>
          </div>
        );
    }
  };

  const activeTab = useMemo(() => {
    if ([ViewType.DASHBOARD].includes(currentView)) return "dashboard";
    if ([ViewType.PURCHASES, ViewType.PURCHASE_FORM].includes(currentView))
      return "purchases";
    if ([ViewType.SALES, ViewType.SALE_FORM].includes(currentView))
      return "sales";
    if (
      [
        ViewType.PRODUCTION_MENU,
        ViewType.PRODUCTION_PCP,
        ViewType.PRODUCTION_STOCK,
        ViewType.PRODUCTION_PURCHASE_NEEDS,
        ViewType.PRODUCTION_CONFIG,
        ViewType.PRODUCTION_ENGINEERING,
        ViewType.PRODUCTION_SERVICE_ORDER_FORM
      ].includes(currentView)
    )
      return "production";
    if (
      [
        ViewType.FINANCIAL, 
        ViewType.ACCOUNTS
      ].includes(currentView)
    )
      return "financial";
    if ([ViewType.PERSONAL_FINANCIAL].includes(currentView))
      return "personal";
    if (
      [
        ViewType.SETTINGS,
        ViewType.PRODUCTS,
        ViewType.STOCK,
        ViewType.STOCK_GLANCE,
        ViewType.PEOPLE,
        ViewType.CATEGORIES,
        ViewType.GRIDS,
        ViewType.COLORS,
        ViewType.PAYMENT_METHODS,
        ViewType.REPORTS,
        ViewType.BACKUP,
        ViewType.PRODUCT_SHEET,
      ].includes(currentView)
    )
      return "settings";
    return "dashboard";
  }, [currentView]);

  const viewTitle = useMemo(() => {
    switch (currentView) {
      case ViewType.DASHBOARD:
        return "GESTAO PRO";
      case ViewType.PRODUCTS:
        return "Produção de Produtos";
      case ViewType.STOCK:
        return "Expedição e Estoque";
      case ViewType.STOCK_GLANCE:
        return "Disponível em Estoque";
      case ViewType.PEOPLE:
        return "Cadastros de Pessoas";
      case ViewType.CATEGORIES:
        return "Categorias";
      case ViewType.GRIDS:
        return "Grades";
      case ViewType.COLORS:
        return "Cores";
      case ViewType.PAYMENT_METHODS:
        return "Pagamentos";
      case ViewType.REPORTS:
        return "Relatórios";
      case ViewType.PRINT_CENTER:
        return "Central de Impressões";
      case ViewType.BACKUP:
        return "Ajustes Técnicos";
      case ViewType.PURCHASES:
        return "Compras";
      case ViewType.SALES:
        return "Loja Virtual & Vendas";
      case ViewType.FINANCIAL:
        return "Financeiro";
      case ViewType.ACCOUNTS:
        return "Gerenciamento de Contas";
      case ViewType.PERSONAL_FINANCIAL:
        return "Financeiro Pessoal";
      case ViewType.SETTINGS:
        return "Mais Opções";
      case ViewType.DASHBOARD_CONFIG:
        return "Layout do Painel";
      case ViewType.PRODUCTION_MENU:
        return "Módulo de Produção";
      case ViewType.PRODUCTION_PCP:
        return "PCP Central";
      case ViewType.PRODUCTION_STOCK:
        return "Estoque de Materiais";
      case ViewType.PRODUCTION_WEIGHING:
        return "Pesagem e Contagem de Solados";
      case ViewType.PRODUCTION_SOLE_PURCHASE:
        return "Entrada de Solados";
      case ViewType.PRODUCTION_SOLE_RECEIPT:
        return "Conferência de Compras (Solas)";
      case ViewType.PRODUCTION_SOLE_STOCK:
        return "Estoque de Solados";
      case ViewType.PRODUCTION_PALMILHA_PURCHASE:
        return "Entrada de Palmilhas";
      case ViewType.PRODUCTION_PALMILHA_STOCK:
        return "Estoque de Palmilhas";
      case ViewType.PRODUCTION_ESTOQUES_MENU:
        return "Controle de Estoques";
      case ViewType.PRODUCTION_PURCHASE_NEEDS:
        return "Necessidade de Compras";
      case ViewType.PRODUCTION_CONFIG:
        return "Configurações de Produção";
      case ViewType.PRODUCTION_ENGINEERING:
        return "Engenharia de Produto";
      case ViewType.PRODUCT_SHEET:
        return "Ficha Técnica";
      case ViewType.PRODUCTION_SERVICE_ORDER_FORM:
        return "Emissão de Ordem de Serviço";
      case ViewType.PRODUCT_FORM:
        return "Cadastro de Produto";
      case ViewType.SALE_FORM:
        return "Lançamento de Venda";
      case ViewType.PURCHASE_FORM:
        return "Lançamento de Compra";
      case ViewType.PERSON_DETAIL:
        return "Detalhes do Cadastro";
      default:
        return "Detalhes";
    }
  }, [currentView]);

  const viewIcon = useMemo(() => {
    const viewToUse = MODAL_VIEWS.includes(currentView) ? lastNonModalView : currentView;
    switch(viewToUse) {
      case ViewType.DASHBOARD: return <LayoutDashboard size={24} className="text-indigo-600 dark:text-indigo-400" />;
      case ViewType.PURCHASES:
      case ViewType.PURCHASE_FORM: return <ShoppingCart size={24} className="text-cyan-500 dark:text-cyan-400" />;
      case ViewType.SALES:
      case ViewType.SALE_FORM: return <ShoppingBag size={24} className="text-emerald-500 dark:text-emerald-400" />;
      case ViewType.FINANCIAL: return <DollarSign size={24} className="text-amber-500 dark:text-amber-400" />;
      case ViewType.SETTINGS: return <Settings size={24} className="text-slate-500 dark:text-slate-400" />;
      
      // Settings sub-pages
      case ViewType.PRODUCTS:
      case ViewType.PRODUCT_FORM: return <Package size={24} className="text-slate-500 dark:text-slate-400" />;
      case ViewType.STOCK: return <Boxes size={24} className="text-slate-500 dark:text-slate-400" />;
      case ViewType.STOCK_GLANCE: return <Eye size={24} className="text-slate-500 dark:text-slate-400" />;
      case ViewType.PEOPLE:
      case ViewType.PERSON_DETAIL: return <Users size={24} className="text-slate-500 dark:text-slate-400" />;
      case ViewType.CATEGORIES: return <Tags size={24} className="text-slate-500 dark:text-slate-400" />;
      case ViewType.GRIDS: return <TableCellsMerge size={24} className="text-slate-500 dark:text-slate-400" />;
      case ViewType.COLORS: return <Palette size={24} className="text-slate-500 dark:text-slate-400" />;
      case ViewType.ACCOUNTS: return <Wallet size={24} className="text-slate-500 dark:text-slate-400" />;
      case ViewType.PAYMENT_METHODS: return <CreditCard size={24} className="text-slate-500 dark:text-slate-400" />;
      case ViewType.REPORTS: return <BarChart3 size={24} className="text-slate-500 dark:text-slate-400" />;
      case ViewType.PRINT_CENTER: return <Printer size={24} className="text-indigo-500" />;
      case ViewType.BACKUP: return <Database size={24} className="text-slate-500 dark:text-slate-400" />;
      case ViewType.DASHBOARD_CONFIG: return <LayoutDashboard size={24} className="text-indigo-600 dark:text-indigo-400" />;
      case ViewType.PRODUCTION_MENU: return <Factory size={24} className="text-indigo-600 dark:text-indigo-400" />;
      case ViewType.PRODUCTION_PCP: return <GanttChartSquare size={24} className="text-indigo-600 dark:text-indigo-400" />;
      case ViewType.PRODUCTION_STOCK: return <PackageOpen size={24} className="text-emerald-600 dark:text-emerald-400" />;
      case ViewType.PRODUCTION_WEIGHING: return <Scale size={24} className="text-violet-600 dark:text-violet-400" />;
      case ViewType.PRODUCTION_SOLE_PURCHASE: return <ShoppingCart size={24} className="text-cyan-600 dark:text-cyan-400" />;
      case ViewType.PRODUCTION_SOLE_RECEIPT: return <ShoppingCart size={24} className="text-cyan-600 dark:text-cyan-400" />;
      case ViewType.PRODUCTION_SOLE_STOCK: return <Package size={24} className="text-emerald-600 dark:text-emerald-400" />;
      case ViewType.PRODUCTION_PALMILHA_PURCHASE: return <ShoppingCart size={24} className="text-rose-600 dark:text-rose-400" />;
      case ViewType.PRODUCTION_PALMILHA_STOCK: return <Footprints size={24} className="text-rose-600 dark:text-rose-400" />;
      case ViewType.PRODUCTION_ESTOQUES_MENU: return <Boxes size={24} className="text-emerald-600 dark:text-emerald-400" />;
      case ViewType.PRODUCTION_PURCHASE_NEEDS: return <ClipboardList size={24} className="text-amber-600 dark:text-amber-400" />;
      case ViewType.PRODUCTION_CONFIG: return <Hammer size={24} className="text-slate-500 dark:text-slate-400" />;
      case ViewType.PRODUCTION_ENGINEERING: return <Database size={24} className="text-indigo-600 dark:text-indigo-400" />;
      case ViewType.PRODUCT_SHEET: return <FileText size={24} className="text-slate-500 dark:text-slate-400" />;
      case ViewType.PRODUCTION_SERVICE_ORDER_FORM: return <ClipboardList size={24} className="text-indigo-600 dark:text-indigo-400" />;
      
      default: return <Shield size={24} className="text-blue-600 dark:text-blue-400" />;
    }
  }, [currentView, lastNonModalView]);

  const headerTitle = useMemo(() => {
    if (MODAL_VIEWS.includes(currentView)) {
      switch (lastNonModalView) {
        case ViewType.DASHBOARD: return "GESTAO PRO";
        case ViewType.PURCHASES: return "Compras";
        case ViewType.SALES: return "Vendas";
        case ViewType.PRODUCTION_MENU: return "Módulo de Produção";
        case ViewType.FINANCIAL: return "Financeiro";
        case ViewType.PERSONAL_FINANCIAL: return "Financeiro Pessoal";
        case ViewType.SETTINGS: return "Mais Opções";
        default: return "GESTAO PRO";
      }
    }
    return viewTitle;
  }, [currentView, lastNonModalView, viewTitle]);

  if (loading) {
    return (
      <div
        className={`h-screen flex items-center justify-center ${isDarkMode ? "bg-slate-950" : "bg-slate-50"}`}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  if (needsCollabGate && !collabSessionConfirmed) {
    return (
      <CollaboratorGateView
        collaborators={collaborators}
        lastActiveId={activeCollaboratorId}
        onConfirm={confirmCollabSession}
        onLogout={handleLogout}
      />
    );
  }

  const themeVisual = THEME_VISUALS[appTheme] || THEME_VISUALS.light;

  return (
    <div
      className={`flex flex-col h-screen ${themeVisual.outerBg} font-sans ${themeVisual.baseText} overflow-hidden overflow-x-hidden`}
    >
      <ToastContainer />
      {/* Header */}
      <header className={`sticky top-0 z-10 shrink-0 px-4 pt-10 pb-3 ${themeVisual.headerGradient}`}>
        <div className={`relative flex items-center justify-between px-4 py-2.5 rounded-[1.75rem] overflow-hidden ${themeVisual.pillGradient} shadow-[0_8px_32px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-2px_0_rgba(0,0,0,0.07)]`}>
          {/* 3D top highlight */}
          <div className="absolute top-0 left-6 right-6 h-[1px] rounded-full bg-gradient-to-r from-transparent via-white to-transparent opacity-90 pointer-events-none" />
          {/* 3D bottom shadow */}
          <div className="absolute bottom-0 left-8 right-8 h-[1px] rounded-full bg-gradient-to-r from-transparent via-black/10 to-transparent pointer-events-none" />
        <div className="flex items-center gap-3">
          {history.length > 1 && (
            <button
              onClick={goBack}
              className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400"
              aria-label="Voltar"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex items-center justify-center">
            {viewIcon}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {headerTitle}
          </h1>
        </div>
        <div className="flex items-center gap-3 text-slate-500">
          <motion.button
            type="button"
            onClick={() => setIsHeaderScannerOpen(true)}
            title="Escanear Código"
            aria-label="Escanear Código"
            whileHover={{ scale: 1.15, rotate: -8 }}
            whileTap={{ scale: 0.9 }}
            animate={scanAnim}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="p-2 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
          >
            <ScanLine size={20} />
          </motion.button>
          {collaboratorCanUseAI(activeCollaborator) && (
            <motion.button
              type="button"
              onClick={() => setIsAIAssistantOpen(true)}
              title="Abrir Assistente IA"
              aria-label="Abrir Assistente IA"
              whileHover={{ scale: 1.15, rotate: 8 }}
              whileTap={{ scale: 0.9 }}
              animate={aiAnim}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="p-2 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-500 dark:text-violet-400 transition-colors hover:bg-violet-100 dark:hover:bg-violet-900/50"
            >
              <Sparkles size={20} />
            </motion.button>
          )}
          <motion.button
            onClick={toggleDarkMode}
            title={isDarkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
            aria-label={isDarkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
            whileHover={{ scale: 1.15, rotate: 25 }}
            whileTap={{ scale: 0.9 }}
            animate={themeAnim}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50' : 'bg-blue-50 text-blue-500 hover:bg-blue-100'}`}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </motion.button>
        </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={lastNonModalView}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.15 }}
            className="px-3 py-5 min-h-full"
          >
            <Suspense fallback={<ViewLoadingFallback />}>
              {renderView(lastNonModalView)}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Global Modal View */}
      <Modal 
        isOpen={MODAL_VIEWS.includes(currentView)} 
        onClose={goBack}
        title={viewTitle}
        maxWidth={
          (currentView === ViewType.PRODUCT_FORM || 
           currentView === ViewType.PRODUCTION_PCP || 
           currentView === ViewType.PRODUCTION_PURCHASE_NEEDS ||
           currentView === ViewType.PRODUCTION_ENGINEERING) ? "max-w-5xl" : "max-w-2xl"
        }
      >
        <Suspense fallback={<ViewLoadingFallback />}>
          {renderView(currentView)}
        </Suspense>
      </Modal>

      {/* Aviso de exclusão de compra vinculada ao PCP */}
      <Modal
        isOpen={!!purchaseDeleteWarning}
        onClose={() => { if (!isDeletingPurchase) setPurchaseDeleteWarning(null); }}
        title="Excluir Compra Vinculada ao PCP"
        icon={<AlertTriangle size={20} />}
        maxWidth="max-w-lg"
      >
        {purchaseDeleteWarning && (() => {
          const { purchase, request, order, orderLots } = purchaseDeleteWarning;
          const REQUEST_STATUS_LABEL: Record<string, string> = {
            PENDING: 'Solicitado',
            IN_PROGRESS: 'Em Andamento',
            ORDERED: 'Pedido Feito',
            RECEIVED: 'Recebido',
          };
          return (
            <div className="flex flex-col gap-5 p-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-relaxed">
                Esta compra está vinculada a registros do PCP. Se você confirmar, a compra será excluída e esses registros serão recalculados/atualizados para refletir que ela não existe mais.
              </p>

              {request && (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 flex flex-col gap-1.5">
                  <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Solicitação de compra (Necessidades de Materiais)</p>
                  <p className="text-sm font-black text-slate-800 dark:text-white">{request.name}</p>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Status atual: {REQUEST_STATUS_LABEL[request.status] || request.status}
                    {(request.receivedQty || 0) > 0 && ` · Recebido: ${request.receivedQty}`}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ao confirmar, essa solicitação será recalculada no PCP: a contribuição desta compra será removida e o status voltará a refletir o saldo real ainda em aberto.
                  </p>
                </div>
              )}

              {order && (
                <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/20 p-4 flex flex-col gap-1.5">
                  <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Pedido de Produção (OP) no PCP</p>
                  <p className="text-sm font-black text-slate-800 dark:text-white">{order.orderNumber}</p>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    {orderLots.length > 0
                      ? `${orderLots.length} mapa(s) de produção já vinculado(s) a esta OP`
                      : 'Nenhum mapa de produção criado ainda'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {orderLots.length > 0
                      ? 'Como já existem mapas em produção vinculados a esta OP, ela não será apagada automaticamente — revise manualmente no PCP após excluir a compra.'
                      : 'Como ainda não há mapas vinculados, esta OP será removida automaticamente da fila do PCP ao confirmar.'}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isDeletingPurchase}
                  onClick={async () => {
                    setIsDeletingPurchase(true);
                    try {
                      await executePurchaseDeletion(purchase, { request, order, orderLots });
                    } finally {
                      setIsDeletingPurchase(false);
                      setPurchaseDeleteWarning(null);
                    }
                  }}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg transition-all active:scale-[0.98] bg-rose-500 text-white shadow-rose-100 dark:shadow-none hover:bg-rose-600 ${isDeletingPurchase ? 'opacity-60 cursor-wait' : ''}`}
                >
                  {isDeletingPurchase ? 'Excluindo e recalculando...' : 'Excluir e recalcular no PCP'}
                </button>
                <button
                  type="button"
                  disabled={isDeletingPurchase}
                  onClick={() => setPurchaseDeleteWarning(null)}
                  className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                >
                  Agora não
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Bottom Tab Navigation */}
      <nav className={`fixed bottom-0 left-0 right-0 z-40 flex items-end justify-center pb-5 px-4 pointer-events-none`}>
        <div className={`relative flex items-center justify-around w-full max-w-md px-2 py-2 rounded-[2rem] overflow-hidden pointer-events-auto ${themeVisual.pillGradient} shadow-[0_8px_32px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-2px_0_rgba(0,0,0,0.08)]`}>
          {/* 3D top highlight streak */}
          <div className="absolute top-0 left-4 right-4 h-[1px] rounded-full bg-gradient-to-r from-transparent via-white to-transparent opacity-90 pointer-events-none" />
          {/* 3D bottom shadow line */}
          <div className="absolute bottom-0 left-6 right-6 h-[1px] rounded-full bg-gradient-to-r from-transparent via-black/10 to-transparent pointer-events-none" />
          <TabItem
            icon={<LayoutDashboard size={20} />}
            label="Home"
            active={activeTab === "dashboard"}
            onClick={() => resetTo(ViewType.DASHBOARD)}
            appTheme={appTheme}
            iconMode={navIconMode}
            tintColor={NAV_TAB_COLORS.dashboard}
            monoColor={navMonoColor}
          />
          {modulesConfig.sales && isViewAllowed(activeCollaborator, ViewType.PURCHASES) && (
            <TabItem
              icon={<ShoppingCart size={20} />}
              label="Compras"
              active={activeTab === "purchases"}
              onClick={() => resetTo(ViewType.PURCHASES)}
              appTheme={appTheme}
              iconMode={navIconMode}
              tintColor={NAV_TAB_COLORS.purchases}
              monoColor={navMonoColor}
            />
          )}
          {modulesConfig.sales && isViewAllowed(activeCollaborator, ViewType.SALES) && (
            <TabItem
              icon={<ShoppingBag size={20} />}
              label="Vendas"
              active={activeTab === "sales"}
              onClick={() => resetTo(ViewType.SALES)}
              appTheme={appTheme}
              iconMode={navIconMode}
              tintColor={NAV_TAB_COLORS.sales}
              monoColor={navMonoColor}
            />
          )}
          {modulesConfig.sales && modulesConfig.production && isViewAllowed(activeCollaborator, ViewType.PRODUCTION_MENU) && (
            <TabItem
              icon={<Factory size={20} />}
              label="Prod."
              active={activeTab === "production"}
              onClick={() => resetTo(ViewType.PRODUCTION_MENU)}
              appTheme={appTheme}
              iconMode={navIconMode}
              tintColor={NAV_TAB_COLORS.production}
              monoColor={navMonoColor}
            />
          )}
          {modulesConfig.sales && isViewAllowed(activeCollaborator, ViewType.FINANCIAL) && (
            <TabItem
              icon={<DollarSign size={20} />}
              label="Finan."
              active={activeTab === "financial"}
              onClick={() => resetTo(ViewType.FINANCIAL)}
              appTheme={appTheme}
              iconMode={navIconMode}
              tintColor={NAV_TAB_COLORS.financial}
              monoColor={navMonoColor}
            />
          )}
          {modulesConfig.personal && isViewAllowed(activeCollaborator, ViewType.PERSONAL_FINANCIAL) && (
            <TabItem
              icon={<UserIcon size={20} />}
              label="Pessoal"
              active={activeTab === "personal"}
              onClick={() => resetTo(ViewType.PERSONAL_FINANCIAL)}
              appTheme={appTheme}
              iconMode={navIconMode}
              tintColor={NAV_TAB_COLORS.personal}
              monoColor={navMonoColor}
            />
          )}
          <TabItem
            icon={<Settings size={20} />}
            label="Mais"
            active={activeTab === "settings"}
            onClick={() => resetTo(ViewType.SETTINGS)}
            appTheme={appTheme}
            iconMode={navIconMode}
            tintColor={NAV_TAB_COLORS.settings}
            monoColor={navMonoColor}
          />
        </div>
      </nav>
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        modulesConfig={modulesConfig}
        onSave={async (accountData) => {
          try {
            const updates: Promise<void>[] = [];
            
            // If this account is being set as default, unset default from others
            if (accountData.isDefault) {
              const otherDefaultAccounts = accounts.filter(a => a.isDefault && (!editingAccount || a.id !== editingAccount.id));
              otherDefaultAccounts.forEach(a => {
                updates.push(firebaseService.updateDocument("accounts", a.id, { isDefault: false }));
              });
            }

            if (editingAccount) {
              updates.push(firebaseService.updateDocument("accounts", editingAccount.id, accountData));
            } else {
              await firebaseService.saveDocument("accounts", accountData);
            }
            
            if (updates.length > 0) {
              await Promise.all(updates);
            }
            
            setIsAccountModalOpen(false);
          } catch (error) {
            console.error("Error saving account:", error);
            toast.show("Erro ao salvar conta.");
          }
        }}
        account={editingAccount}
      />
      
      <PaymentMethodModal
        isOpen={isPaymentMethodModalOpen}
        onClose={() => setIsPaymentMethodModalOpen(false)}
        onSave={(method) => {
          if (editingPaymentMethod) {
            firebaseService.updateDocument("paymentMethods", editingPaymentMethod.id, method);
          } else {
            firebaseService.saveDocument("paymentMethods", method);
          }
          setIsPaymentMethodModalOpen(false);
        }}
        method={editingPaymentMethod}
      />
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        onSave={async (data) => {
          try {
            await financeService.createTransaction(data);
            setIsTransactionModalOpen(false);
          } catch (error: any) {
            console.error('Error saving transaction:', error);
            toast.show('Erro ao salvar: ' + (error.message || error));
          }
        }}
        categories={categories.filter(c => !c.isPersonal)}
        accounts={accounts.filter(a => a.type !== AccountType.PERSONAL)}
        people={people}
        initialType={transactionModalType}
        isDarkMode={isDarkMode}
      />
      


      <SolePurchaseModal
        isOpen={isSolePurchaseModalOpen}
        onClose={() => {
          setIsSolePurchaseModalOpen(false);
          setSolePurchaseParams(null);
        }}
        initialParams={solePurchaseParams ?? undefined}
        productionConfigs={productionConfigs}
        colors={colors}
        suppliers={suppliers}
        people={people}
        categories={categories}
        accounts={accounts}
        isDarkMode={isDarkMode}
        onSave={handleSaveSolePurchase}
      />

      <PalmilhaPurchaseModal
        isOpen={isPalmilhaPurchaseModalOpen}
        onClose={() => {
          setIsPalmilhaPurchaseModalOpen(false);
          setPalmilhaPurchaseParams(null);
        }}
        initialParams={palmilhaPurchaseParams ?? undefined}
        productionConfigs={productionConfigs}
        colors={colors}
        suppliers={suppliers}
        people={people}
        categories={categories}
        accounts={accounts}
        isDarkMode={isDarkMode}
        onSave={handleSavePalmilhaPurchase}
      />

      <AIAssistantModal
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        isDarkMode={isDarkMode}
        soleStockEntries={soleStockEntries}
        people={people}
        onOpenPersonForm={(data) => {
          setAiPersonPrefill(data);
          setIsAIAssistantOpen(false);
          navigateTo(ViewType.PEOPLE);
        }}
        onOpenPurchaseForm={(data) => {
          setIsAIAssistantOpen(false);
          navigateTo(ViewType.PURCHASE_FORM, {
            type: PurchaseType.GENERAL,
            supplierId: data.supplierId,
            initialGeneralItems: data.items.map((item) => ({
              id: generateId(),
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              value: item.value ?? 0,
            })),
            initialDescription: data.notes,
          });
        }}
        onOpenSolePurchaseForm={(data) => {
          setIsAIAssistantOpen(false);
          navigateTo(ViewType.PURCHASE_FORM, {
            type: PurchaseType.SOLE,
            items: data.items.map((item) => ({
              moldId: item.moldId,
              colorId: item.colorId,
              initialGrid: item.grid,
            })),
            initialDescription: data.notes || 'Pedido sugerido pelo Assistente IA',
          });
        }}
      />

      <ScannerModal
        isOpen={isHeaderScannerOpen}
        onClose={() => setIsHeaderScannerOpen(false)}
        onScan={(parsed) => { setIsHeaderScannerOpen(false); handleHeaderScan(parsed); }}
        title="Scanner Rápido"
      />
    </div>
  );
}

