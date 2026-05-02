import { Product, Grid, Sale, Purchase, PurchaseType, SaleType, Category, CategoryType, ColorValue, PaymentMethod, Person, SaleStatus, PaymentTerm, Transaction, TransactionType, Account, ProductStatus, AccountType } from './types';

export const SIZES = ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];

export const MOCK_PEOPLE: Person[] = [
  { id: 'c1', name: 'João Silva', email: 'joao@email.com', phone: '(11) 99999-9999', isCustomer: true, isSupplier: false },
  { id: 'c2', name: 'Maria Oliveira', email: 'maria@email.com', phone: '(11) 88888-8888', isCustomer: true, isSupplier: false },
  { id: 's1', name: 'Calçados Elite', isCustomer: false, isSupplier: true },
  { id: 's2', name: 'Distribuidora Caminho', isCustomer: false, isSupplier: true },
];

export const MOCK_CATEGORIES: Category[] = [
  // Categorias de Produtos
  { id: 'cat1', name: 'Tênis Esportivo', color: 'bg-indigo-500', type: CategoryType.PRODUCT },
  { id: 'cat2', name: 'Sapatos Sociais', color: 'bg-amber-500', type: CategoryType.PRODUCT },
  { id: 'cat3', name: 'Sandálias', color: 'bg-rose-500', type: CategoryType.PRODUCT },
  
  // Categorias de Despesas
  { id: 'exp1', name: 'Aluguel', color: 'bg-rose-600', type: CategoryType.EXPENSE },
  { id: 'exp2', name: 'Energia / Água', color: 'bg-amber-600', type: CategoryType.EXPENSE },
  { id: 'exp3', name: 'Funcionários', color: 'bg-slate-600', type: CategoryType.EXPENSE },
  { id: 'exp4', name: 'Marketing', color: 'bg-indigo-400', type: CategoryType.EXPENSE },

  // Categorias de Receitas
  { id: 'rev1', name: 'Venda de Balcão', color: 'bg-emerald-500', type: CategoryType.REVENUE },
  { id: 'rev2', name: 'Venda Online', color: 'bg-blue-500', type: CategoryType.REVENUE },
  { id: 'rev3', name: 'Serviços', color: 'bg-purple-500', type: CategoryType.REVENUE },
];

export const MOCK_COLORS: ColorValue[] = [
  { id: 'col1', name: 'Preto', hex: '#000000' },
  { id: 'col2', name: 'Branco', hex: '#FFFFFF' },
  { id: 'col3', name: 'Vermelho', hex: '#FF0000' },
];

export const MOCK_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'pm1', name: 'Dinheiro', icon: 'DollarSign' },
  { id: 'pm2', name: 'Cartão de Crédito', icon: 'CreditCard' },
  { id: 'pm3', name: 'PIX', icon: 'Zap' },
];

export const MOCK_GRIDS: Grid[] = [
  {
    id: 'g1',
    name: 'Grade Padrão (12 pares)',
    sizes: ['35', '36', '37', '38', '39', '40'],
    configuration: { '35': 1, '36': 2, '37': 3, '38': 3, '39': 2, '40': 1 }
  },
  {
    id: 'g2',
    name: 'Grade Masculina (10 pares)',
    sizes: ['39', '40', '41', '42'],
    configuration: { '39': 2, '40': 3, '41': 3, '42': 2 }
  }
];

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    reference: 'SNK-001',
    name: 'Tênis Urban Pro',
    supplierId: 's1',
    categoryId: 'cat1',
    defaultGridId: 'g1',
    type: SaleType.WHOLESALE,
    status: ProductStatus.ACTIVE,
    costPrice: 85.00,
    salePrice: 159.90,
    minStockInBoxes: 5,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    variations: [
      {
        id: 'v1',
        color: '#ff0000',
        colorName: 'Vermelho Vibrante',
        minStock: 10,
        stock: { '36': 15, '37': 20, '38': 10 }
      }
    ]
  },
  {
    id: 'p2',
    reference: 'SPT-052',
    name: 'Sapatilha Casual Elegance',
    supplierId: 's2',
    categoryId: 'cat3',
    defaultGridId: 'g1',
    type: SaleType.RETAIL,
    status: ProductStatus.ACTIVE,
    costPrice: 45.00,
    salePrice: 89.00,
    minStockInBoxes: 2,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    variations: [
      {
        id: 'v2',
        color: '#000000',
        colorName: 'Preto Clássico',
        minStock: 5,
        stock: { '35': 8, '36': 12 }
      }
    ]
  }
];

export const MOCK_PURCHASES: Purchase[] = [
  {
    id: 'pur1',
    supplierId: 's1',
    date: Date.now() - 1000 * 60 * 60 * 24 * 3,
    type: PurchaseType.REPLENISHMENT,
    total: 1200.00,
    items: [
      {
        productId: 'p1',
        variationId: 'v1',
        quantity: 10,
        isBox: true,
        cost: 120.00,
        note: 'Pedido de reposição mensal'
      }
    ]
  }
];

export const MOCK_SALES: Sale[] = [
  {
    id: 'sal1',
    orderNumber: '001',
    date: Date.now() - 1000 * 60 * 30,
    customerId: 'c1',
    customerName: 'João Silva',
    subtotal: 159.90,
    discount: 0,
    total: 159.90,
    status: SaleStatus.SALE,
    paymentTerm: PaymentTerm.CASH,
    paymentMethodId: 'pm1',
    items: [
      {
        productId: 'p1',
        variationId: 'v1',
        saleType: SaleType.RETAIL,
        quantity: 1,
        price: 159.90
      }
    ]
  }
];

export const MOCK_ACCOUNTS: Account[] = [
  { id: 'acc1', name: 'Caixa Empresa', balance: 4500.25, color: 'bg-emerald-500', type: AccountType.CASH },
  { id: 'acc2', name: 'Banco Brasil', balance: 12500.00, color: 'bg-blue-600', type: AccountType.BANK },
  { id: 'acc3', name: 'Nubank', balance: 3200.50, color: 'bg-purple-600', type: AccountType.BANK },
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 't1',
    type: TransactionType.INCOME,
    categoryId: 'rev1',
    accountId: 'acc1',
    amount: 159.90,
    date: Date.now() - 1000 * 60 * 30,
    description: 'Venda #001',
    status: 'COMPLETED',
    relatedId: 'sal1'
  },
  {
    id: 't2',
    type: TransactionType.EXPENSE,
    categoryId: 'exp1',
    accountId: 'acc2',
    amount: 2500.00,
    date: Date.now() - 1000 * 60 * 60 * 24 * 10,
    description: 'Aluguel Abril',
    status: 'COMPLETED'
  }
];
