import { useState, useEffect, useMemo, ReactNode } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ShoppingBag,
  ArrowLeft,
  Plus,
  Settings,
  DollarSign,
  LogOut,
  LogIn,
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
  Factory,
  GanttChartSquare,
  Hammer,
  ClipboardList,
  PackageOpen,
  ChevronRight,
  FileText,
  User as UserIcon,
  AlertCircle,
  Scale,
  Printer
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { auth, db, signInWithGoogle, logout } from "./lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, collection, query, where, getDocs } from "firebase/firestore";
import { firebaseService } from "./services/firebaseService";
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
  CategoryType,
  ProductStatus,
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
  DashboardCardConfig,
  FlowTag,
  Sector,
  ProductionConfigItem,
  ProductionScreenType,
  WeighingRecord,
  AppModulesConfig,
  SoleStockEntry,
  SolePurchaseItem,
  ProductionOrder,
  ProductionOrderItem,
  ProductionLot,
  PurchaseRequest,
  ServiceOrder,
} from "./types";
import {
  MOCK_PRODUCTS,
  MOCK_PURCHASES,
  MOCK_SALES,
  MOCK_TRANSACTIONS,
  MOCK_ACCOUNTS,
  MOCK_GRIDS,
  MOCK_PEOPLE,
  MOCK_CATEGORIES,
  MOCK_COLORS,
  MOCK_PAYMENT_METHODS,
} from "./constants";

// Views
import DashboardView from "./views/DashboardView";
import ProductsView from "./views/ProductsView";
import ProductFormView from "./views/ProductFormView";
import PurchasesView from "./views/PurchasesView";
import PurchaseFormView from "./views/PurchaseFormView";
import SalesView from "./views/SalesView";
import SaleFormView from "./views/SaleFormView";
import FinancialView from "./views/FinancialView";
import SettingsView from "./views/SettingsView";
import PeopleView from "./views/PeopleView";
import CategoriesView from "./views/CategoriesView";
import CategoryConfigView from "./views/CategoryConfigView";
import GradesView from "./views/GradesView";
import ColorsView from "./views/ColorsView";
import PaymentMethodsView from "./views/PaymentMethodsView";
import ReportsView from "./views/ReportsView";
import ReportDetailedView from "./views/ReportDetailedView";
import PrintCenterView from "./views/PrintCenterView";
import BackupView from "./views/BackupView";
import AccountsView from "./views/AccountsView";
import StockView from "./views/StockView";
import PersonDetailView from "./views/PersonDetailView";
import LoginView from "./views/LoginView";
import DashboardConfigView from "./views/DashboardConfigView";
import ProductionConfigView from "./views/ProductionConfigView";
import ProductSheetMenuView from "./views/ProductSheetMenuView";
import PersonalFinancialView from "./views/PersonalFinancialView";
import ModuleConfigView from "./views/ModuleConfigView";
import ManualView from "./views/ManualView";
import WeighingView from "./views/WeighingView";
import SoleProcurement from "./views/SolePurchaseView";
import SoleStockView from "./views/SoleStockView";
import PCPView from "./views/PCPView";
import PurchaseNeedsView from "./views/PurchaseNeedsView";
import GeneralReceiptsView from "./views/GeneralReceiptsView";

import ProductionEngineeringView from "./views/ProductionEngineeringView";


// Modals
import AccountModal from "./components/AccountModal";
import PaymentMethodModal from "./components/PaymentMethodModal";
import Modal from "./components/Modal";
import TransactionModal from "./components/TransactionModal";
import SolePurchaseModal from "./components/SolePurchaseModal";

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
    ViewType.PRINT_CENTER,
  ],
  production: [
    ViewType.PRODUCTION_MENU,
    ViewType.PRODUCTION_PCP,
    ViewType.PRODUCTION_STOCK,
    ViewType.PRODUCTION_PURCHASE_NEEDS,
    ViewType.PRODUCTION_CONFIG,
    ViewType.PRODUCT_SHEET,
    ViewType.PRODUCTION_ENGINEERING
  ],
  personal: [
    ViewType.PERSONAL_FINANCIAL
  ]
};

type FontSize = 'xs' | 'sm' | 'md';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>(ViewType.DASHBOARD);
  const [lastNonModalView, setLastNonModalView] = useState<ViewType>(ViewType.DASHBOARD);
  const [history, setHistory] = useState<ViewType[]>([ViewType.DASHBOARD]);
  const [appTheme, setAppTheme] = useState<'light' | 'dark' | 'industrial'>(() => {
    return (localStorage.getItem('app_theme_pref') as any) || 'light';
  });
  const isDarkMode = appTheme === 'dark';
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    return (localStorage.getItem('font_size_pref') as FontSize) || 'xs';
  });
  const [isA11yOpen, setIsA11yOpen] = useState(false);

  useEffect(() => {
    if (!MODAL_VIEWS.includes(currentView)) {
      setLastNonModalView(currentView);
    }
  }, [currentView]);

  useEffect(() => {
    localStorage.setItem('font_size_pref', fontSize);
    const root = document.documentElement;
    if (fontSize === 'xs') root.style.fontSize = '14px';
    else if (fontSize === 'sm') root.style.fontSize = '16px';
    else if (fontSize === 'md') root.style.fontSize = '18px';
  }, [fontSize]);


  // Modals state
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>();
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | undefined>();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionModalType, setTransactionModalType] = useState<TransactionType>(TransactionType.INCOME);
  const [isSolePurchaseModalOpen, setIsSolePurchaseModalOpen] = useState(false);
  const [solePurchaseParams, setSolePurchaseParams] = useState<any>(null);


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
  const [productionLots, setProductionLots] = useState<ProductionLot[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  
  const suppliers = useMemo(() => people.filter(p => p.isSupplier), [people]);
  const buyers = useMemo(() => people.filter(p => p.isBuyer || p.isPersonal), [people]);

  const defaultDashboardConfig: DashboardConfig = {
    cards: [
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
      { id: 'activity', label: 'Atividade Recente', visible: true, order: 15, module: 'any' },
      { id: 'monthly_profit_detailed', label: 'Análise de Lucro Detalhada', visible: true, order: 16, module: 'sales' },
      { id: 'engineering_config', label: 'Configurações de Ficha Técnica', visible: true, order: 17, module: 'production' },
      { id: 'personal_balance', label: 'Saldo Pessoal', visible: true, order: 18, module: 'personal' },
      { id: 'print_center', label: 'Central de Impressões', visible: true, order: 19, module: 'any' },
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
    const unsubPurchases = firebaseService.subscribeToCollection<Purchase>(
      "purchases",
      setPurchases,
    );
    const unsubSales = firebaseService.subscribeToCollection<Sale>(
      "sales",
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
      firebaseService.subscribeToCollection<Transaction>(
        "transactions",
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

    const unsubProductionLots = firebaseService.subscribeToCollection<ProductionLot>(
      "productionLots",
      setProductionLots
    );

    const unsubProductionOrders = firebaseService.subscribeToCollection<ProductionOrder>(
      "productionOrders",
      setProductionOrders
    );

    const unsubPurchaseRequests = firebaseService.subscribeToCollection<PurchaseRequest>(
      "purchaseRequests",
      (data) => setPurchaseRequests([...data].sort((a, b) => b.requestedAt - a.requestedAt))
    );

    const unsubServiceOrders = firebaseService.subscribeToCollection<ServiceOrder>(
      "serviceOrders",
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

    return () => {
      unsubProducts();
      unsubPurchases();
      unsubSales();
      unsubTransactions();
      unsubAccounts();
      unsubGrids();
      unsubPeople();
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
      unsubProductionLots();
      unsubProductionOrders();
      unsubPurchaseRequests();
      unsubServiceOrders();
      unsubDashboardConfig();

    };
  }, [user]);


  // Selection state for editing
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(
    null,
  );
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
    
    if (view === ViewType.PRODUCTION_SOLE_PURCHASE) {
      setSolePurchaseParams(params);
      setIsSolePurchaseModalOpen(true);
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

  const navigateToProduction = (subScreen: ProductionScreenType) => {
    setProductionSubScreen(subScreen);
    navigateTo(ViewType.PRODUCTION_CONFIG);
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
    root.classList.remove("dark", "industrial");
    body.classList.remove("dark", "industrial");

    if (appTheme === 'dark') {
      root.classList.add("dark");
      body.classList.add("dark");
    } else if (appTheme === 'industrial') {
      root.classList.add("industrial");
      body.classList.add("industrial");
    }
  }, [appTheme]);

  useEffect(() => {
    const sizeMap: Record<FontSize, string> = { xs: '14px', sm: '16px', md: '18px' };
    document.documentElement.style.fontSize = sizeMap[fontSize];
    localStorage.setItem('font_size_pref', fontSize);
  }, [fontSize]);

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
      alert("Erro ao atualizar status do cheque.");
    }
  };

  const handleResetDatabase = async () => {
    // Apaga todas as coleções do App (produtos, vendas, transações, etc)
    try {
      const collectionsToClear = [
        { name: "transactions", items: transactions },
        { name: "purchases", items: purchases },
        { name: "sales", items: sales },
        { name: "products", items: products },
        { name: "grds", items: grids }, // Note: the collection is "grids", wait, let me check the array... items: grids -> so maybe "grids". 
        { name: "people", items: people },
        { name: "categories", items: categories },
        { name: "colors", items: colors },
        { name: "accounts", items: accounts },
        { name: "paymentMethods", items: paymentMethods },
      ];

      for (const col of collectionsToClear) {
        // We use the actual collection name expected by firebaseService
        let colName = col.name; 
        if (colName === "grds") colName = "grids";

        for (const item of col.items) {
          if (item.id) {
            await firebaseService.deleteDocument(colName, item.id);
          }
        }
      }
    } catch (e) {
      console.error("Error resetting database:", e);
      throw e;
    }
  };

  const handleDuplicateProduct = async (product: Product) => {
    try {
      const newProduct: Product = JSON.parse(JSON.stringify(product));
      newProduct.id = Math.random().toString(36).substr(2, 9);
      newProduct.name = `${newProduct.name} (Cópia)`;
      newProduct.reference = `${newProduct.reference}-COPY`;
      newProduct.createdAt = Date.now();
      
      // Reset stock in variations to 0 for the copy and give new variation IDs
      newProduct.variations = newProduct.variations.map(v => ({
        ...v,
        id: Math.random().toString(36).substr(2, 9),
        stock: Object.keys(v.stock).reduce((acc, key) => ({ ...acc, [key]: 0 }), {})
      }));

      await firebaseService.saveDocument("products", newProduct);
      alert("Modelo duplicado com sucesso!");
    } catch (e: any) {
      console.error(e);
      alert("Erro ao duplicar produto: " + (e.message || e));
    }
  };

  const handleCancelOnlySale = async (id: string) => {
    const sale = sales.find(s => s.id === id);
    if (!sale) return;

    if (sale.status === SaleStatus.CANCELLED) {
      alert("Esta venda já está cancelada/estornada.");
      return;
    }

    try {
      const updatedSale = { ...sale, status: SaleStatus.CANCELLED };
      await firebaseService.saveDocument("sales", updatedSale);
      alert("Venda marcada como cancelada (sem estorno).");
    } catch (e: any) {
      console.error(e);
      alert("Erro ao cancelar venda: " + (e.message || e));
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

  const handleSaveSolePurchase = async (purchase: Purchase, soleItems: SolePurchaseItem[]) => {
    const parseLocaleNumber = (val: any): number => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const normalized = String(val).replace(',', '.');
      const num = Number(normalized);
      return isNaN(num) ? 0 : num;
    };

    console.log('[handleSaveSolePurchase] Starting save...', { purchase, soleItems });
    try {
      if (!purchase || !soleItems) throw new Error("Dados de compra incompletos");
      if (!purchase.date) purchase.date = Date.now();
      if (purchase.total === undefined || purchase.total === null) purchase.total = 0;
      // 1. Vincular os itens à compra para que apareçam no histórico
      const purchaseToSave = {
        ...purchase,
        items: soleItems // Cast ou ajuste de tipo se necessário
      };
      
      console.log('[handleSaveSolePurchase] Saving purchase doc...');
      const savedResult = await firebaseService.saveDocument("purchases", purchaseToSave);
      const finalPurchaseId = (savedResult as any)?.id || purchase.id;
      console.log('[handleSaveSolePurchase] Purchase saved. ID:', finalPurchaseId);

      // 2. Atualizar Estoque de Solados (soleStock)
      let itemIndex = 0;
      for (const item of soleItems) {
        console.log(`[handleSaveSolePurchase] Processing item ${itemIndex}...`, item);
        // Tenta encontrar entrada existente para este molde/cor
        const existingEntry = soleStockEntries.find(
          s => s.moldId === item.moldId && s.colorId === item.colorId
        );

        if (existingEntry) {
          const updatedStock = { ...existingEntry.stock };
          Object.entries(item.quantities).forEach(([size, qty]) => {
            updatedStock[size] = (updatedStock[size] || 0) + qty;
          });

          const totalPairs = Object.values(updatedStock).reduce((acc, curr) => acc + (Number(curr) || 0), 0);

          await firebaseService.updateDocument("soleStock", existingEntry.id, {
            stock: updatedStock,
            totalPairs,
            unitCost: item.unitCost,
            totalCost: totalPairs * parseLocaleNumber(item.unitCost),
            purchaseDate: purchase.date,
            updatedAt: Date.now()
          });
        } else {
          const totalPairs = Object.values(item.quantities).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
          const newEntry: Omit<SoleStockEntry, 'id'> = {
            moldId: item.moldId,
            moldName: item.moldName,
            colorId: item.colorId,
            colorName: item.colorName,
            supplierId: purchase.supplierId,
            supplierName: people.find(p => p.id === purchase.supplierId)?.name || 'Fornecedor',
            stock: item.quantities,
            totalPairs,
            unitCost: parseLocaleNumber(item.unitCost),
            totalCost: parseLocaleNumber(item.totalCost),
            purchaseDate: purchase.date,
            updatedAt: Date.now()
          };
          await firebaseService.saveDocument("soleStock", newEntry);
        }
      }

      console.log('[handleSaveSolePurchase] Managing partial receipt...');
      if (purchase.registerAsReceived && solePurchaseParams?.requestId) {
        const request = purchaseRequests.find(r => r.id === solePurchaseParams.requestId);
        if (request) {
          console.log('[handleSaveSolePurchase] Found request:', request.id);
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

      console.log('[handleSaveSolePurchase] Generating financial entry...');
      if (purchase.paymentTerm === PaymentTerm.CASH && purchase.accountId) {
        console.log('[handleSaveSolePurchase] Cash payment detected.');
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
        
        const account = accounts.find(a => a.id === purchase.accountId);
        if (account) {
          await firebaseService.updateDocument("accounts", account.id, {
            balance: account.balance - parseLocaleNumber(purchase.total)
          });
        }
      }

      alert("Compra de solados registrada e estoque atualizado com sucesso!");
      setIsSolePurchaseModalOpen(false);
      setSolePurchaseParams(null);
    } catch (err: any) {
      console.error("[App] Erro crítico ao salvar compra de sola:", err);
      alert("Erro ao salvar compra: " + (err.message || JSON.stringify(err)));
    }
  };

  const handleDeleteSale = async (id: string) => {
    console.log("handleDeleteSale chamado para ID:", id);
    const sale = sales.find(s => s.id === id);
    if (!sale) {
      console.error("Venda não encontrada no estado local:", id);
      alert("Erro: Venda não encontrada no sistema.");
      return;
    }

    if (sale.status === SaleStatus.CANCELLED) {
      // Se j est cancelada, estoque/financeiro j foram estornados.
      // Podemos apenas excluir o registro.
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        await firebaseService.deleteDocument("sales", id);
        alert("Registro (já cancelado) excluído com sucesso.");
        return;
      } catch (e) {
        console.error(e);
        alert("Erro ao excluir registro cancelado.");
        return;
      }
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
                  const stockKey = (productData.type === SaleType.RETAIL && item.size) ? item.size : 'WHOLESALE';
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

        // D. Excluir o Registro
        transaction.delete(salesRef);
      });

      alert('Registro excluído com sucesso! Estoque e financeiro estornados.');
    } catch (err: any) {
      console.error("Erro ao excluir venda:", err);
      alert('Erro ao excluir: ' + (err.message || err));
    }
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
      alert("Erro ao salvar mapa: " + (err.message || err));
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
      alert("Erro ao excluir mapa: " + (err.message || err));
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


  const handleCreatePurchaseRequest = async (req: Omit<PurchaseRequest, 'id'>) => {
    console.log('[App] handleCreatePurchaseRequest called', req);
    const id = Math.random().toString(36).substring(2, 11);
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
      const orderId = Math.random().toString(36).substr(2, 9);
      const orderNum = `OP #${String(productionOrders.length + 1).padStart(3, '0')}`;

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

  const renderView = (view: ViewType) => {
    // Route Guard: Check if the view is allowed by the current module configuration
    const isSalesView = MODULE_VIEWS.sales.includes(view);
    const isProductionView = MODULE_VIEWS.production.includes(view);
    const isPersonalView = MODULE_VIEWS.personal.includes(view);

    if (isSalesView && !modulesConfig.sales) return renderView(ViewType.DASHBOARD);
    if (isProductionView && (!modulesConfig.sales || !modulesConfig.production)) return renderView(ViewType.DASHBOARD);
    if (isPersonalView && !modulesConfig.personal) return renderView(ViewType.DASHBOARD);

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
            onAddSale={() => resetTo(ViewType.SALE_FORM)}
            onUpdateCheckStatus={handleCheckStatusChange}
            isDarkMode={isDarkMode}
            categories={categories}
            dashboardConfig={dashboardConfig || defaultDashboardConfig}
            modulesConfig={modulesConfig}
            onNavigate={navigateTo}
            onNavigateProduction={navigateToProduction}
            onNavigateGrids={() => navigateTo(ViewType.GRIDS)}
            onAddProduct={() => navigateTo(ViewType.PRODUCT_FORM)}
            onAddTransaction={(type) => {
              setTransactionModalType(type);
              setIsTransactionModalOpen(true);
            }}
          />
        );
      case ViewType.DASHBOARD_CONFIG:
        return (
          <DashboardConfigView 
            config={dashboardConfig || defaultDashboardConfig}
            onSave={async (newConfig) => {
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
            fontSize={fontSize}
            setFontSize={setFontSize}
            onLogout={logout}
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
                alert('Cadastro realizado!');
              } catch (err: any) {
                alert('Erro ao cadastrar: ' + (err.message || err));
              }
            }}
            onEdit={async (id, updatedPerson) => {
              try {
                await firebaseService.updateDocument("people", id, updatedPerson);
                alert('Cadastro atualizado!');
              } catch (err: any) {
                alert('Erro ao atualizar: ' + (err.message || err));
              }
            }}
            onDelete={async (id) => {
              try {
                await firebaseService.deleteDocument("people", id);
                alert('Cadastro excluído!');
              } catch (err: any) {
                alert('Erro ao excluir: ' + (err.message || err));
              }
            }}
            onShowDetail={(id) => navigateTo(ViewType.PERSON_DETAIL, id)}
            isDarkMode={isDarkMode}
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
                alert('Categoria adicionada com sucesso!');
              } catch (err: any) {
                alert('Erro ao adicionar categoria: ' + (err.message || err));
              }
            }}
            onEdit={async (id, updatedCategory) => {
              try {
                await firebaseService.updateDocument("categories", id, updatedCategory);
                alert('Categoria atualizada!');
              } catch (err: any) {
                alert('Erro ao atualizar categoria: ' + (err.message || err));
              }
            }}
            onDelete={async (id) => {
              try {
                await firebaseService.deleteDocument("categories", id);
                alert('Categoria excluída!');
              } catch (err: any) {
                alert('Erro ao excluir categoria: ' + (err.message || err));
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
                alert('Grade salva!');
              } catch (err: any) {
                alert('Erro ao salvar grade: ' + (err.message || err));
              }
            }}
            onEdit={async (id, updatedGrid) => {
              try {
                await firebaseService.updateDocument("grids", id, updatedGrid);
                alert('Grade atualizada!');
              } catch (err: any) {
                alert('Erro ao atualizar grade: ' + (err.message || err));
              }
            }}
            onDelete={async (id) => {
              try {
                await firebaseService.deleteDocument("grids", id);
                alert('Grade excluída!');
              } catch (err: any) {
                alert('Erro ao excluir grade: ' + (err.message || err));
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
                alert('Cor salva!');
              } catch (err: any) {
                alert('Erro ao salvar cor: ' + (err.message || err));
              }
            }}
            onEdit={async (id, updatedColor) => {
              try {
                await firebaseService.updateDocument("colors", id, updatedColor);
              } catch (err: any) {
                alert('Erro ao atualizar cor: ' + (err.message || err));
              }
            }}
            onDelete={async (id) => {
              try {
                await firebaseService.deleteDocument("colors", id);
              } catch (err: any) {
                alert('Erro ao excluir cor: ' + (err.message || err));
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
            onBack={() => setCurrentView(ViewType.REPORTS)}
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
          />
        );
      case ViewType.BACKUP:
        return (
          <BackupView 
            isDarkMode={isDarkMode} 
            transactions={transactions}
            purchases={purchases}
            sales={sales}
            onDeleteTransaction={(id) => firebaseService.deleteDocument("transactions", id)}
            onDeletePurchase={(id) => firebaseService.deleteDocument("purchases", id)}
            onDeleteSale={(id) => firebaseService.deleteDocument("sales", id)}
            onResetDatabase={handleResetDatabase}
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
            onSave={async (product) => {
              try {
                await firebaseService.saveDocument("products", product);
                goBack();
              } catch (err: any) {
                console.error("Erro ao salvar produto:", err);
                alert("Erro ao salvar produto: " + (err.message || err));
              }
            }}
            onSaveConfigItem={async (item) => {
              try {
                await firebaseService.saveDocument("productionConfigs", item);
              } catch (err: any) {
                console.error("Erro ao salvar item de configuração:", err);
                alert("Erro ao salvar item: " + (err.message || err));
              }
            }}
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
            onAdd={() => navigateTo(ViewType.PURCHASE_FORM)}
            onEdit={(id) => navigateTo(ViewType.PURCHASE_FORM, id)}
            onDelete={async (id) => {
              console.log('Attempting to delete purchase', id);
              const purchase = purchases.find((p) => p.id === id);
              if (purchase) {
                console.log('Found purchase, deleting', purchase);
                try {
                  await firebaseService.deleteDocument("purchases", id);
                  console.log('Purchase document deleted successfully');
                    
                    // Revert financial transaction if cash
                    if (purchase.paymentTerm === PaymentTerm.CASH && purchase.accountId) {
                      console.log('Reverting financial transaction');
                      const tx = transactions.find(t => t.relatedId === id);
                      if (tx) {
                        await firebaseService.deleteDocument("transactions", tx.id);
                        
                        const acc = accounts.find((a) => a.id === purchase.accountId);
                        if (acc) {
                          await firebaseService.updateDocument("accounts", purchase.accountId, {
                            balance: acc.balance + purchase.total,
                          });
                        }
                      }
                    }
                    
                    // Revert stock if replenishment
                    if (purchase.type === PurchaseType.REPLENISHMENT && purchase.items) {
                      console.log('Reverting stock');
                      for (const item of purchase.items) {
                        const product = products.find((p) => p.id === item.productId);
                        if (product) {
                          const variationIndex = product.variations.findIndex(
                            (v) => v.id === item.variationId,
                          );
                          if (variationIndex !== -1) {
                            const updatedProduct = { ...product };
                            const variation = updatedProduct.variations[variationIndex];
                            
                            const key = (product.type === SaleType.RETAIL && item.size) ? item.size : 'WHOLESALE';
                            
                            // If it is a Retail product and marked as a box, we assume 12 units per box.
                            // For Wholesale products, we record the quantity of grades directly.
                            const amountToSubtract = (product.type === SaleType.RETAIL && item.isBox)
                              ? item.quantity * 12
                              : item.quantity;
                              
                            variation.stock[key] = (variation.stock[key] || 0) - amountToSubtract;
                            
                            await firebaseService.saveDocument("products", updatedProduct);
                          }
                        }
                      }
                    }
                  } catch (err) {
                    console.error('Error during purchase deletion:', err);
                  }
                } else {
                  console.warn('Purchase not found for deletion', id);
                }
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
            productionConfigs={productionConfigs}
            initialParams={currentParams}
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
                if (prevPurchase && prevPurchase.type === PurchaseType.REPLENISHMENT && prevPurchase.items) {
                  for (const item of prevPurchase.items) {
                    const updatedProduct = getProductForUpdate(item.productId);
                    if (updatedProduct) {
                      const variationIndex = updatedProduct.variations.findIndex((v: any) => v.id === item.variationId);
                      if (variationIndex !== -1) {
                        const variation = updatedProduct.variations[variationIndex];
                        const key = (updatedProduct.type === SaleType.RETAIL && item.size) ? item.size : 'WHOLESALE';
                        
                        const amountToSubtract = (updatedProduct.type === SaleType.RETAIL && item.isBox) ? item.quantity * 12 : item.quantity;
                        
                        if (variation.stock[key] !== undefined) {
                          variation.stock[key] -= amountToSubtract;
                          if (variation.stock[key] < 0) variation.stock[key] = 0;
                        }
                      }
                    }
                  }
                }

                // 2. APPLY NEW STOCK if it is REPLENISHMENT
                if (purchase.type === PurchaseType.REPLENISHMENT && purchase.items) {
                  for (const item of purchase.items) {
                    const updatedProduct = getProductForUpdate(item.productId);
                    if (updatedProduct) {
                      const variationIndex = updatedProduct.variations.findIndex((v: any) => v.id === item.variationId);
                      if (variationIndex !== -1) {
                        const variation = updatedProduct.variations[variationIndex];
                        const key = (updatedProduct.type === SaleType.RETAIL && item.size) ? item.size : 'WHOLESALE';
                        
                        const amountToAdd = (updatedProduct.type === SaleType.RETAIL && item.isBox) ? item.quantity * 12 : item.quantity;
                        
                        variation.stock[key] = (variation.stock[key] || 0) + amountToAdd;
                      }
                    }
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
                    description: `Compra ${purchase.supplierId || purchase.batchNumber}`,
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

                // Update material stock + PurchaseRequest only if user confirmed
                if (purchase.registerAsReceived && purchase.type === PurchaseType.GENERAL && purchase.generalItems) {
                  for (const gi of purchase.generalItems) {
                    if (gi.materialId && gi.quantity && gi.quantity > 0) {
                      const mat = productionConfigs.find(c => c.id === gi.materialId);
                      if (mat) {
                        const currentStock = mat.metadata?.stock || 0;
                        await firebaseService.saveDocument("productionConfigs", {
                          ...mat,
                          metadata: { ...mat.metadata, stock: currentStock + gi.quantity },
                        });
                      }
                    }
                  }

                  if (currentParams?.requestId) {
                    const req = purchaseRequests.find(r => r.id === currentParams.requestId);
                    if (req) {
                      const purchasedQty = purchase.generalItems.reduce(
                        (sum, gi) => sum + (gi.quantity || 0), 0
                      );
                      const newReceivedQty = (req.receivedQty || 0) + purchasedQty;
                      const isFullyReceived = newReceivedQty >= req.requiredQty;
                      await firebaseService.updateDocument("purchaseRequests", req.id, {
                        receivedQty: newReceivedQty,
                        status: isFullyReceived ? 'RECEIVED' : 'ORDERED',
                        updatedAt: Date.now(),
                      });
                    }
                  }
                } else if (currentParams?.requestId) {
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
                alert("Erro ao salvar compra: " + (err.message || err));
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

                  // B. Deduct Inventory
                  for (const item of sale.items) {
                    const productDoc = productDocsMap.get(item.productId);
                    
                    if (productDoc && productDoc.exists()) {
                      const productData = productDoc.data() as Product;
                      const variations = [...productData.variations];
                      const variationIndex = variations.findIndex(v => v.id === item.variationId);
                      
                      if (variationIndex !== -1) {
                        const variation = { ...variations[variationIndex] };
                        const key = (productData.type === SaleType.RETAIL && item.size) ? item.size : 'WHOLESALE';
                        
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

                alert("Orçamento confirmado como venda com sucesso!");
                
                // Auto-create Production Order
                const fullSale = sales.find(s => s.id === id);
                if (fullSale) {
                  await autoCreateProductionOrder({ ...fullSale, status: SaleStatus.SALE });
                }
              } catch (err: any) {
                console.error("Conversion Error:", err);
                alert("Erro ao converter orçamento: " + (err.message || err));
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
                alert('Pagamento registrado e saldo atualizado!');
              }
            }}
            onPaySale={async (id, amount, accountId, paymentMethodId, note) => {
              const sale = sales.find(s => s.id === id);
              if (!sale) return;

              const paymentId = Math.random().toString(36).substring(2, 9);
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
                  alert(`O valor pago excedeu o total. R$ ${surplus.toLocaleString('pt-BR')} foram adicionados como crédito para o cliente.`);
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
                alert(msg);
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

              alert('Recebimento atualizado com sucesso!');
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
            initialSearchQuery={searchContext}
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
                alert('Lançamento salvo com sucesso!');
              } catch (err: any) {
                console.error('onSave error:', err);
                alert('Erro ao salvar lançamento: ' + (err.message || err));
              }
            }}
            onEdit={async (id, updates) => {
              try {
                console.log('[App] Calling updateTransaction:', id, updates);
                await financeService.updateTransaction(id, updates);
                console.log('[App] updateTransaction success');
                alert('Atualizado com sucesso!');
              } catch (err: any) {
                console.error('onEdit error:', err);
                alert('Erro ao atualizar: ' + (err.message || err));
              }
            }}
            onDelete={async (id) => {
              try {
                console.log('[App] Calling deleteTransaction:', id);
                await financeService.deleteTransaction(id);
                console.log('[App] deleteTransaction success');
                alert('Excluído com sucesso!');
              } catch (err: any) {
                console.error('onDelete error:', err);
                alert('Erro ao excluir: ' + (err.message || err));
              }
            }}
            onUpdatePurchase={async (id, updates) => {
              try {
                await firebaseService.updateDocument("purchases", id, updates);
                // No need for alert here if it's a sub-action usually, but user is used to it.
              } catch (err: any) {
                alert('Erro ao atualizar compra: ' + (err.message || err));
              }
            }}
            onUpdatePerson={async (id, updates) => {
              try {
                await firebaseService.updateDocument("people", id, updates);
              } catch (err: any) {
                alert('Erro ao atualizar cadastro: ' + (err.message || err));
              }
            }}
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
                alert(
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
                alert("Transferência realizada com sucesso!");
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

              // REVERT OLD STOCK if it was already a SALE
              if (prevSale && prevSale.status === SaleStatus.SALE) {
                for (const item of prevSale.items) {
                   const updatedProduct = getProductForUpdate(item.productId);
                   if (updatedProduct) {
                     const variationIndex = updatedProduct.variations.findIndex((v: any) => v.id === item.variationId);
                     if (variationIndex !== -1) {
                       const variation = updatedProduct.variations[variationIndex];
                       const key = (updatedProduct.type === SaleType.RETAIL && item.size) ? item.size : 'WHOLESALE';
                       variation.stock[key] = (variation.stock[key] || 0) + item.quantity;
                     }
                   }
                }
              }

              // APPLY NEW STOCK if it is a SALE
              if (sale.status === SaleStatus.SALE) {
                for (const item of sale.items) {
                  const updatedProduct = getProductForUpdate(item.productId);
                  if (updatedProduct) {
                    const variationIndex = updatedProduct.variations.findIndex(
                      (v: any) => v.id === item.variationId,
                    );
                    if (variationIndex !== -1) {
                      const variation = updatedProduct.variations[variationIndex];
                      const key = (updatedProduct.type === SaleType.RETAIL && item.size) ? item.size : 'WHOLESALE';

                      if (variation.stock[key] !== undefined) {
                        variation.stock[key] -= item.quantity;
                        if (variation.stock[key] < 0) variation.stock[key] = 0;
                      }
                    }
                  }
                }
              }

              // Save accumulated product updates
              for (const [_, prod] of productUpdates) {
                await firebaseService.saveDocument("products", prod);
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
                alert("Erro ao salvar: " + (err.message || err));
                throw err;
              }
            }}
            onDelete={handleDeleteSale}
            onCancelOnly={handleCancelOnlySale}
            onCancel={goBack}
            modulesConfig={modulesConfig}
            isDarkMode={isDarkMode}
          />
        );
      case ViewType.PRODUCTION_MENU:
        return (
          <div className="flex flex-col gap-8 pb-32">
            <header className="flex flex-col gap-3 px-2">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="w-16 h-16 rounded-[1.8rem] bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-500/20"
              >
                <Factory size={32} strokeWidth={2.5} />
              </motion.div>
              <div>
                <motion.h2 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-white"
                >
                  Produção
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1"
                >
                  Módulo de Produção
                </motion.p>
              </div>
            </header>

            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Gestão de Fábrica e PCP</h3>
                <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  {[
                    { id: ViewType.PRODUCTION_PCP, label: 'PCP Central', icon: <GanttChartSquare size={22} />, color: 'text-indigo-600' },
                    { id: ViewType.PRODUCTION_ESTOQUES_MENU, label: 'Estoques', icon: <Boxes size={22} />, color: 'text-emerald-600' },
                    { id: ViewType.PRODUCTION_WEIGHING, label: 'Pesagem e Contagem', icon: <Scale size={22} />, color: 'text-violet-600' },
                    { id: ViewType.PRODUCTION_SOLE_PURCHASE, label: 'Entrada de Solados', icon: <ShoppingCart size={22} />, color: 'text-cyan-600' },
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
                alert("Erro ao salvar item: " + (err.message || err));
              }
            }}
            onDeleteConfigItem={(id: string) => firebaseService.deleteDocument("productionConfigs", id)}
            onUpdateSectorsOrder={(updatedSectors: any[]) => Promise.all(updatedSectors.map(s => firebaseService.saveDocument('sectors', s))).then(() => {})}
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
                alert("Erro ao excluir modelo.");
              }
            }}
            onToggleStatus={async (id, status) => {
              try {
                await firebaseService.updateDocument("products", id, { status });
              } catch (e) {
                console.error(e);
                alert("Erro ao alterar status.");
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
            onSaveLot={handleSaveProductionLot}
            onDeleteLot={handleDeleteProductionLot}
            onBack={goBack}
            userName={user?.displayName || user?.email || 'Usuário'}
            productionConfigs={productionConfigs}
            soleStock={soleStockEntries}
            onNavigate={navigateTo}
            purchaseRequests={purchaseRequests}
            onRequestPurchase={handleCreatePurchaseRequest}
            initialTab={currentParams?.initialTab}
            people={people}
            accounts={accounts}
            categories={categories}
            serviceOrders={serviceOrders}
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
                alert("Erro ao salvar item: " + (err.message || err));
              }
            }}
            onDeleteConfigItem={(id: string) => firebaseService.deleteDocument("productionConfigs", id)}
            onUpdateSectorsOrder={(updatedSectors: any[]) => Promise.all(updatedSectors.map(s => firebaseService.saveDocument('sectors', s))).then(() => {})}
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
            onBack={goBack}
            isDarkMode={isDarkMode}
          />
        );
      case ViewType.PRODUCTION_PURCHASE_NEEDS:
        return (
          <PurchaseNeedsView
            purchaseRequests={purchaseRequests}
            onUpdateRequest={handleSavePurchaseRequest}
            onNavigate={navigateTo}
            onBack={goBack}
            isDarkMode={isDarkMode}
            userName={user?.displayName || user?.email || 'Usuário'}
            soleStock={soleStockEntries}
            productionConfigs={productionConfigs}
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
        ViewType.PRODUCTION_ENGINEERING
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
        return "Controle de Estoque";
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
        return "Pesagem e Contagem";
      case ViewType.PRODUCTION_SOLE_PURCHASE:
        return "Entrada de Solados";
      case ViewType.PRODUCTION_SOLE_STOCK:
        return "Estoque de Solados";
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
      case ViewType.PRODUCTION_SOLE_STOCK: return <Package size={24} className="text-emerald-600 dark:text-emerald-400" />;
      case ViewType.PRODUCTION_ESTOQUES_MENU: return <Boxes size={24} className="text-emerald-600 dark:text-emerald-400" />;
      case ViewType.PRODUCTION_PURCHASE_NEEDS: return <ClipboardList size={24} className="text-amber-600 dark:text-amber-400" />;
      case ViewType.PRODUCTION_CONFIG: return <Hammer size={24} className="text-slate-500 dark:text-slate-400" />;
      case ViewType.PRODUCTION_ENGINEERING: return <Database size={24} className="text-indigo-600 dark:text-indigo-400" />;
      case ViewType.PRODUCT_SHEET: return <FileText size={24} className="text-slate-500 dark:text-slate-400" />;
      
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

  return (
    <div
      className={`flex flex-col h-screen ${
        appTheme === 'light' ? 'bg-slate-50' : 
        appTheme === 'industrial' ? 'industrial bg-[#e5e7eb]' : 
        'dark bg-slate-950'
      } font-sans ${appTheme === 'light' || appTheme === 'industrial' ? 'text-slate-900' : 'text-white'} overflow-hidden overflow-x-hidden`}
    >
      {/* Header */}
      <header className={`flex items-center justify-between px-4 pt-10 pb-4 border-b sticky top-0 z-10 shrink-0 ${
        appTheme === 'light' ? 'bg-white border-slate-100' : 
        appTheme === 'industrial' ? 'bg-[#f3f4f6] border-gray-300' : 
        'bg-slate-950 border-slate-800/60'
      }`}>
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
          <button 
            onClick={toggleDarkMode}
            title={isDarkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
            aria-label={isDarkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Moon size={20} />
          </button>
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
            {renderView(lastNonModalView)}
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
        {renderView(currentView)}
      </Modal>

      {/* Bottom Tab Navigation */}
      <nav className={`fixed bottom-0 left-0 right-0 border-t flex items-center justify-around py-3 px-2 pb-6 z-40 ${
        appTheme === 'light' ? 'bg-white border-slate-100' : 
        appTheme === 'industrial' ? 'bg-[#f3f4f6] border-gray-300' : 
        'bg-slate-950 border-slate-900'
      }`}>
        <TabItem
          icon={<LayoutDashboard size={22} />}
          label="Home"
          active={activeTab === "dashboard"}
          onClick={() => resetTo(ViewType.DASHBOARD)}
          colorClass="text-indigo-600 dark:text-indigo-400"
          appTheme={appTheme}
        />
        {modulesConfig.sales && (
          <>
            <TabItem
              icon={<ShoppingCart size={22} />}
              label="Compras"
              active={activeTab === "purchases"}
              onClick={() => resetTo(ViewType.PURCHASES)}
              colorClass="text-cyan-500 dark:text-cyan-400"
              appTheme={appTheme}
            />
            <TabItem
              icon={<ShoppingBag size={22} />}
              label="Vendas"
              active={activeTab === "sales"}
              onClick={() => resetTo(ViewType.SALES)}
              colorClass="text-emerald-500 dark:text-emerald-400"
              appTheme={appTheme}
            />
          </>
        )}
        {modulesConfig.sales && modulesConfig.production && (
          <TabItem
            icon={<Factory size={22} />}
            label="Prod."
            active={activeTab === "production"}
            onClick={() => resetTo(ViewType.PRODUCTION_MENU)}
            colorClass="text-indigo-600 dark:text-indigo-400"
            appTheme={appTheme}
          />
        )}
        {modulesConfig.sales && (
          <TabItem
            icon={<DollarSign size={22} />}
            label="Finan."
            active={activeTab === "financial"}
            onClick={() => resetTo(ViewType.FINANCIAL)}
            colorClass="text-amber-500 dark:text-amber-400"
            appTheme={appTheme}
          />
        )}
        {modulesConfig.personal && (
          <TabItem
            icon={<UserIcon size={22} />}
            label="Pessoal"
            active={activeTab === "personal"}
            onClick={() => resetTo(ViewType.PERSONAL_FINANCIAL)}
            colorClass="text-amber-600 dark:text-amber-500"
            appTheme={appTheme}
          />
        )}
        <TabItem
          icon={<Settings size={22} />}
          label="Mais"
          active={activeTab === "settings"}
          onClick={() => resetTo(ViewType.SETTINGS)}
          colorClass="text-slate-500 dark:text-slate-400"
          appTheme={appTheme}
        />
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
            alert("Erro ao salvar conta.");
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
            alert('Erro ao salvar: ' + (error.message || error));
          }
        }}
        categories={categories.filter(c => !c.isPersonal)}
        accounts={accounts.filter(a => a.type !== AccountType.PERSONAL)}
        people={people}
        initialType={transactionModalType}
      />
      


      <SolePurchaseModal
        isOpen={isSolePurchaseModalOpen}
        onClose={() => {
          setIsSolePurchaseModalOpen(false);
          setSolePurchaseParams(null);
        }}
        initialParams={solePurchaseParams}
        productionConfigs={productionConfigs}
        colors={colors}
        suppliers={suppliers}
        people={people}
        categories={categories}
        accounts={accounts}
        isDarkMode={isDarkMode}
        onSave={handleSaveSolePurchase}
      />
    </div>
  );
}

function TabItem({
  icon,
  label,
  active,
  onClick,
  colorClass,
  appTheme
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  colorClass: string;
  appTheme: 'light' | 'dark' | 'industrial';
}) {
  const iconColor = appTheme === 'industrial' ? 'text-gray-500' : colorClass;
  const activeBg = appTheme === 'light' ? "bg-slate-100" : 
                   appTheme === 'industrial' ? "bg-gray-300" : 
                   "bg-white/10";

  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={`Ir para ${label}`}
      className={`flex flex-col items-center justify-center p-1 min-w-[50px] h-[60px] transition-all rounded-[15px] ${
        active ? activeBg : "bg-transparent"
      }`}
    >
      <div
        className={`transition-all ${active ? iconColor : (appTheme === 'industrial' ? 'text-gray-400' : iconColor + ' opacity-70')} ${active ? "scale-110" : ""}`}
      >
        {icon}
      </div>
      <span
        className={`text-[11px] font-black tracking-tighter mt-0.5 transition-all ${
          appTheme === 'industrial' ? 'text-black' : (active ? iconColor : iconColor + ' opacity-70')
        } ${active ? "opacity-100" : (appTheme === 'industrial' ? "opacity-60" : "opacity-70")}`}
      >
        {label}
      </span>
    </button>
  );
}
