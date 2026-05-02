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
  User as UserIcon
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
  ColorValue,
  PaymentMethod,
  SaleStatus,
  Transaction,
  TransactionType,
  Account,
  PaymentTerm,
  ProductStatus,
  PaymentStatus,
  SalePayment,
  FamilyMember,
  Budget,
  DashboardConfig,
  DashboardCardConfig,
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
import GradesView from "./views/GradesView";
import ColorsView from "./views/ColorsView";
import PaymentMethodsView from "./views/PaymentMethodsView";
import ReportsView from "./views/ReportsView";
import ReportDetailedView from "./views/ReportDetailedView";
import BackupView from "./views/BackupView";
import AccountsView from "./views/AccountsView";
import StockView from "./views/StockView";
import PersonDetailView from "./views/PersonDetailView";
import LoginView from "./views/LoginView";
import DashboardConfigView from "./views/DashboardConfigView";
import PersonalFinancialView from "./views/PersonalFinancialView";

// Modals
import AccountModal from "./components/AccountModal";
import PaymentMethodModal from "./components/PaymentMethodModal";

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>(ViewType.DASHBOARD);
  const [history, setHistory] = useState<ViewType[]>([ViewType.DASHBOARD]);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Modals state
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>();
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | undefined>();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

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
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig | null>(null);

  const defaultDashboardConfig: DashboardConfig = {
    cards: [
      { id: 'balance', label: 'Saldo Consolidado', visible: true, order: 0 },
      { id: 'cash_flow', label: 'Balanço Mensal', visible: true, order: 1 },
      { id: 'receivables', label: 'A Receber (Vendas)', visible: true, order: 2 },
      { id: 'stock_alerts', label: 'Alertas de Estoque', visible: true, order: 3 },
      { id: 'customers', label: 'Relacionamento Clientes', visible: true, order: 4 },
      { id: 'suppliers', label: 'Relacionamento Fornecedores', visible: true, order: 5 },
      { id: 'debt_management', label: 'Gestão de Dívidas', visible: true, order: 6 },
      { id: 'stock_value', label: 'Patrimônio em Estoque', visible: true, order: 7 },
      { id: 'estimated_profit', label: 'Lucro Total Estimado', visible: true, order: 8 },
      { id: 'checks', label: 'Relatório de Cheques', visible: true, order: 9 },
      { id: 'activity', label: 'Atividade Recente', visible: true, order: 10 },
      { id: 'monthly_profit_detailed', label: 'Análise de Lucro Detalhada', visible: true, order: 11 },
    ]
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
      unsubDashboardConfig();
    };
  }, [user]);

  const suppliers = useMemo(() => people.filter((p) => p.isSupplier), [people]);

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

  const navigateTo = (view: ViewType, id: string | null = null, search: string = '') => {
    if (view === ViewType.PRODUCT_FORM) setSelectedProductId(id);
    if (view === ViewType.PURCHASE_FORM) setSelectedPurchaseId(id);
    if (view === ViewType.SALE_FORM) setSelectedSaleId(id);
    if (view === ViewType.PERSON_DETAIL) setSelectedPersonId(id);
    setSearchContext(search);

    setCurrentView(view);
    setHistory((prev) => [...prev, view]);
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

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  useEffect(() => {
    const handleChangeView = (e: any) => {
      navigateTo(e.detail);
    };
    window.addEventListener('change-view', handleChangeView);
    return () => window.removeEventListener('change-view', handleChangeView);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  }, [isDarkMode]);

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

  const handleCancelSale = async (id: string) => {
    console.log("handleCancelSale chamado para ID:", id);
    const sale = sales.find(s => s.id === id);
    if (!sale) {
      console.error("Venda não encontrada no estado local:", id);
      alert("Erro: Venda não encontrada no sistema.");
      return;
    }

    if (sale.status === SaleStatus.CANCELLED) {
      alert("Esta venda já está cancelada.");
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

        // D. Atualizar Status para CANCELADO
        transaction.update(salesRef, { status: SaleStatus.CANCELLED });
      });

      alert('Venda cancelada com sucesso! Estoque e financeiro estornados.');
    } catch (err: any) {
      console.error("Erro ao cancelar venda:", err);
      alert('Erro ao cancelar: ' + (err.message || err));
    }
  };

  const renderView = () => {
    switch (currentView) {
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
            onNavigate={navigateTo}
          />
        );
      case ViewType.DASHBOARD_CONFIG:
        return (
          <DashboardConfigView 
            config={dashboardConfig || defaultDashboardConfig}
            onSave={async (newConfig) => {
              try {
                // Use a fixed ID 'main_config' to ensure we only have one configuration document
                const configToSave = { ...newConfig, id: 'main_config' };
                await firebaseService.saveDocument("dashboard_config", configToSave);
                alert("Configuração salva com sucesso!");
              } catch (err) {
                console.error("Error saving dashboard config:", err);
                alert("Erro ao salvar configuração.");
              }
            }}
            onBack={goBack}
            isDarkMode={isDarkMode}
          />
        );
      case ViewType.SETTINGS:
        return (
          <SettingsView
            onNavigate={navigateTo}
            isDarkMode={isDarkMode}
            toggleDarkMode={toggleDarkMode}
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
            isDarkMode={isDarkMode}
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
        return (
          <ProductFormView
            productId={selectedProductId}
            products={products}
            grids={grids}
            suppliers={suppliers}
            categories={categories}
            colors={colors}
            onSave={(product) => {
              firebaseService.saveDocument("products", product);
              goBack();
            }}
            onCancel={goBack}
            isDarkMode={isDarkMode}
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
                    if (purchase.type === PurchaseType.REPLENISHMENT) {
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
                if (prevPurchase && prevPurchase.type === PurchaseType.REPLENISHMENT) {
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
                if (purchase.type === PurchaseType.REPLENISHMENT) {
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
                await firebaseService.saveDocument("purchases", purchase);

                for (const [_, prod] of productUpdates) {
                  await firebaseService.saveDocument("products", prod);
                }

                for (const [_, acc] of accountUpdates) {
                  await firebaseService.updateDocument("accounts", acc.id, { balance: acc.balance });
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
            onDelete={handleCancelSale}
            onCancelOnly={handleCancelOnlySale}
            onConvert={async (id) => {
              const sale = sales.find((s) => s.id === id);
              if (sale) {
                // Diminui estoque (Conversão)
                for (const item of sale.items) {
                  const product = products.find((p) => p.id === item.productId);
                  if (product) {
                    const variationIndex = product.variations.findIndex(
                      (v) => v.id === item.variationId,
                    );
                    if (variationIndex !== -1) {
                      const updatedProduct = { ...product };
                      const variation = updatedProduct.variations[variationIndex];

                      const key = (product.type === SaleType.RETAIL && item.size) ? item.size : 'WHOLESALE';

                      if (variation.stock[key] !== undefined) {
                        variation.stock[key] -= item.quantity;
                        if (variation.stock[key] < 0) variation.stock[key] = 0;
                        await firebaseService.saveDocument("products", updatedProduct);
                      }
                    }
                  }
                }

                // If it was already marked as PAID, or if we decide it's PAID now
                // Usually Conversion means it's finalized.
                const updatedSale = { 
                  ...sale, 
                  status: SaleStatus.SALE,
                };
                
                // Limpeza de campos undefined para evitar erro do Firestore
                Object.keys(updatedSale).forEach(key => {
                  if ((updatedSale as any)[key] === undefined) {
                    delete (updatedSale as any)[key];
                  }
                });

                await firebaseService.saveDocument("sales", updatedSale);

                if (updatedSale.paymentStatus === PaymentStatus.PAID) {
                  // Movimenta financeiro
                  const defaultAccount = sale.accountId || accounts[0]?.id || "acc1";
                  const newTransaction: Omit<Transaction, "id"> = {
                    type: TransactionType.INCOME,
                    categoryId: "rev1",
                    accountId: defaultAccount,
                    amount: sale.total,
                    date: Date.now(),
                    description: `Venda #${sale.orderNumber} (Conversão)`,
                    status: "COMPLETED",
                    relatedId: sale.id,
                    contactId: sale.customerId,
                    contactName: sale.customerName || people.find(p => p.id === sale.customerId)?.name,
                  };
                  await firebaseService.saveDocument(
                    "transactions",
                    newTransaction,
                  );

                  // Atualiza saldo da conta
                  const acc = accounts.find((a) => a.id === defaultAccount);
                  if (acc) {
                    await firebaseService.updateDocument(
                      "accounts",
                      defaultAccount,
                      { balance: acc.balance + sale.total },
                    );
                  }
                }

                alert("Pedido convertido em venda com sucesso!");
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

                firebaseService.updateDocument("accounts", fromId, {
                  balance: from.balance - amount,
                });
                firebaseService.updateDocument("accounts", toId, {
                  balance: to.balance + amount,
                });

                const txOut: Omit<Transaction, "id"> = {
                  type: TransactionType.EXPENSE,
                  categoryId: "exp1",
                  accountId: fromId,
                  amount,
                  date: Date.now(),
                  description: `Transferência para ${to.name}`,
                  status: "COMPLETED",
                };
                const txIn: Omit<Transaction, "id"> = {
                  type: TransactionType.INCOME,
                  categoryId: "rev3",
                  accountId: toId,
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
          />
        );
      case ViewType.STOCK:
        return (
          <StockView
            products={products}
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

              // 2. Create New Transactions from paymentHistory
              if (sale.paymentHistory && sale.paymentHistory.length > 0) {
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

              // Save accumulated account updates
              for (const [_, acc] of accountUpdates) {
                await firebaseService.updateDocument("accounts", acc.id, { balance: acc.balance });
              }

              // 3. Update Customer Credit (Haver)
              if (sale.customerId) {
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
              } catch (err: any) {
                console.error("Save Error:", err);
                alert("Erro ao salvar: " + (err.message || err));
                throw err;
              }
            }}
            onDelete={handleCancelSale}
            onCancelOnly={handleCancelOnlySale}
            onCancel={goBack}
            isDarkMode={isDarkMode}
          />
        );
      default:
        return (
          <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest italic">
            Em desenvolvimento
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
      ].includes(currentView)
    )
      return "settings";
    return "dashboard";
  }, [currentView]);

  const viewTitle = useMemo(() => {
    switch (currentView) {
      case ViewType.DASHBOARD:
        return "Vendas Pro";
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
      default:
        return "Detalhes";
    }
  }, [currentView]);

  const viewIcon = useMemo(() => {
    switch(currentView) {
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
      case ViewType.BACKUP: return <Database size={24} className="text-slate-500 dark:text-slate-400" />;
      case ViewType.DASHBOARD_CONFIG: return <LayoutDashboard size={24} className="text-indigo-600 dark:text-indigo-400" />;
      
      default: return <Shield size={24} className="text-blue-600 dark:text-blue-400" />;
    }
  }, [currentView]);

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
      className={`flex flex-col h-screen ${isDarkMode ? "dark bg-slate-950" : "bg-slate-50"} font-sans text-slate-900 dark:text-slate-100 overflow-hidden`}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-10 pb-4 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800/60 sticky top-0 z-10 shrink-0">
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
            {viewTitle}
          </h1>
        </div>
        <div className="flex items-center gap-3 text-slate-500">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={isDarkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
            aria-label={isDarkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
          >
            <Moon size={20} />
          </button>
          <button 
            onClick={logout}
            title="Sair do aplicativo"
            aria-label="Sair do aplicativo"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.15 }}
            className="p-6 min-h-full"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Tab Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-around py-3 px-2 pb-6 z-40">
        <TabItem
          icon={<LayoutDashboard size={22} />}
          label="HOME"
          active={activeTab === "dashboard"}
          onClick={() => resetTo(ViewType.DASHBOARD)}
          colorClass="text-indigo-600 dark:text-indigo-400"
        />
        <TabItem
          icon={<ShoppingCart size={22} />}
          label="COMPRAS"
          active={activeTab === "purchases"}
          onClick={() => resetTo(ViewType.PURCHASES)}
          colorClass="text-cyan-500 dark:text-cyan-400"
        />
        <TabItem
          icon={<ShoppingBag size={22} />}
          label="VENDAS"
          active={activeTab === "sales"}
          onClick={() => resetTo(ViewType.SALES)}
          colorClass="text-emerald-500 dark:text-emerald-400"
        />
        <TabItem
          icon={<DollarSign size={22} />}
          label="FINAN."
          active={activeTab === "financial"}
          onClick={() => resetTo(ViewType.FINANCIAL)}
          colorClass="text-amber-500 dark:text-amber-400"
        />
        <TabItem
          icon={<UserIcon size={22} />}
          label="PESSOAL"
          active={activeTab === "personal"}
          onClick={() => resetTo(ViewType.PERSONAL_FINANCIAL)}
          colorClass="text-amber-600 dark:text-amber-500"
        />
        <TabItem
          icon={<Settings size={22} />}
          label="MAIS"
          active={activeTab === "settings" || activeTab === "products"}
          onClick={() => resetTo(ViewType.SETTINGS)}
          colorClass="text-slate-500 dark:text-slate-400"
        />
      </nav>
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        onSave={(account) => {
          if (editingAccount) {
            firebaseService.updateDocument("accounts", editingAccount.id, account);
          } else {
            firebaseService.saveDocument("accounts", account);
          }
          setIsAccountModalOpen(false);
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
    </div>
  );
}

function TabItem({
  icon,
  label,
  active,
  onClick,
  colorClass
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  colorClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-2 min-w-[64px] h-[64px] transition-all rounded-[20px] ${active ? "bg-slate-100 dark:bg-slate-900" : "bg-transparent"}`}
    >
      <div
        className={`transition-all ${colorClass} ${active ? "scale-110" : ""}`}
      >
        {icon}
      </div>
      <span
        className={`text-[8px] font-bold tracking-widest mt-1 uppercase transition-all ${colorClass} ${active ? "opacity-100" : "opacity-90"}`}
      >
        {label}
      </span>
    </button>
  );
}
