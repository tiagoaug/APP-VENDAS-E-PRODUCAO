import { ViewType, ProductionScreenType } from '../types';

// Tours de processo ("Journeys") — ver GuidedTourOverlay.tsx e docs/SPEC_ASSISTENTE_LOCAL.md
// seção 3-B. Dado puro (igual helpKnowledgeBase.ts), sem lógica: adicionar um tour novo é só um
// objeto novo neste array, o motor (GuidedTourOverlay) não precisa mudar.
//
// `screen` em highlight_tap é opcional: se ausente, o passo vale em qualquer tela (caso de
// elementos sempre montados, como a nav inferior). Se presente, o spotlight só aparece quando
// `currentView` bate com essa tela — evita desenhar o recorte durante a navegação/transição.

export type JourneyStep =
  | { type: 'highlight_tap'; screen?: ViewType; anchorKey: string; text: string }
  | { type: 'message'; text: string };

export type Journey = {
  id: string;
  title: string;
  productionOnly?: boolean;
  entryScreen: ViewType;
  // Params extras pra navegação de entrada (ex.: { initialFilter: 'CUSTOMER' }, { guided: true })
  // — repassados direto pro navigateTo(entryScreen, entryParams) em handleStartJourney.
  entryParams?: any;
  // Força ProductionConfigView a abrir direto na aba certa (mesmo mecanismo que os atalhos do
  // menu e a Configuração Inicial já usam) — só relevante quando entryScreen é PRODUCTION_CONFIG.
  productionSubScreen?: ProductionScreenType;
  steps: JourneyStep[];
};

// Textos dos passos "abrir → salvar" abaixo espelham os mesmos guideSteps usados na Configuração
// Inicial (App.tsx, onboardingSteps) — os anchors (data-guide-anchor) já existem nas telas reais
// por causa daquela integração, então esses tours ficam prontos sem tocar em nenhuma tela.
export const JOURNEYS: Journey[] = [
  {
    id: 'tour_fazer_venda',
    title: 'Como fazer uma venda',
    entryScreen: ViewType.DASHBOARD,
    steps: [
      { type: 'highlight_tap', anchorKey: 'nav.vendas', text: 'Toque aqui para abrir Vendas.' },
      { type: 'highlight_tap', screen: ViewType.SALES, anchorKey: 'sales.novoPedido', text: 'Toque aqui para criar um novo pedido.' },
      { type: 'message', text: 'Escolha o cliente, adicione os produtos (modelo, cor e tamanho ou grade) e defina a forma de pagamento.' },
      { type: 'highlight_tap', screen: ViewType.SALE_FORM, anchorKey: 'saleForm.finalizar', text: 'Quando terminar, toque aqui para finalizar. O estoque baixa automaticamente e a receita entra no financeiro.' },
    ],
  },
  {
    id: 'tour_fazer_compra',
    title: 'Como lançar uma compra',
    entryScreen: ViewType.DASHBOARD,
    steps: [
      { type: 'highlight_tap', anchorKey: 'nav.compras', text: 'Toque aqui para abrir Compras.' },
      { type: 'highlight_tap', screen: ViewType.PURCHASES, anchorKey: 'purchases.novaCompra', text: 'Toque aqui para lançar uma compra nova.' },
      { type: 'message', text: 'Escolha o fornecedor, adicione os itens e defina o pagamento.' },
      { type: 'highlight_tap', screen: ViewType.PURCHASE_FORM, anchorKey: 'purchaseForm.finalizar', text: 'Quando terminar, toque aqui para finalizar a compra.' },
    ],
  },
  {
    id: 'tour_cadastrar_categoria',
    title: 'Como cadastrar uma categoria',
    entryScreen: ViewType.CATEGORIES,
    steps: [
      { type: 'highlight_tap', anchorKey: 'cat.novo', text: 'Toque aqui para cadastrar uma categoria nova.' },
      { type: 'highlight_tap', anchorKey: 'cat.salvar', text: 'Digite o nome e toque aqui para salvar.' },
    ],
  },
  {
    id: 'tour_cadastrar_cor',
    title: 'Como cadastrar uma cor',
    entryScreen: ViewType.COLORS,
    steps: [
      { type: 'highlight_tap', anchorKey: 'color.novo', text: 'Toque aqui para cadastrar uma cor nova.' },
      { type: 'highlight_tap', anchorKey: 'color.salvar', text: 'Digite o nome e toque aqui para salvar.' },
    ],
  },
  {
    id: 'tour_cadastrar_grade',
    title: 'Como cadastrar uma grade',
    productionOnly: true,
    entryScreen: ViewType.GRIDS,
    steps: [
      { type: 'highlight_tap', anchorKey: 'grade.novo', text: 'Toque aqui para criar uma grade nova.' },
      { type: 'message', text: 'Dê um nome e adicione pelo menos um tamanho.' },
      { type: 'highlight_tap', anchorKey: 'grade.salvar', text: 'Toque aqui para salvar a grade.' },
    ],
  },
  {
    id: 'tour_criar_mapa_producao',
    title: 'Como criar um Mapa de Produção',
    productionOnly: true,
    entryScreen: ViewType.PRODUCTION_PCP,
    entryParams: { initialTab: 'orders' },
    steps: [
      { type: 'message', text: 'Aqui em "Pedidos" ficam os itens ainda sem mapa. Toque nos que você quer agrupar — eles vão se acumulando no Carrinho, à direita (ou embaixo, no celular).' },
      { type: 'highlight_tap', anchorKey: 'pcp.criarMapa', text: 'Depois de selecionar os itens, toque aqui para criar o Mapa de Produção com eles.' },
    ],
  },
  {
    id: 'tour_cadastrar_embalagem',
    title: 'Como cadastrar um padrão de embalagem',
    productionOnly: true,
    entryScreen: ViewType.PRODUCTION_CONFIG,
    productionSubScreen: 'EMBALAGENS',
    steps: [
      { type: 'highlight_tap', anchorKey: 'prodcfg.addRegistro', text: 'Toque aqui para cadastrar um padrão de embalagem.' },
      { type: 'message', text: 'Preencha o nome, a capacidade e a composição por tamanho.' },
      { type: 'highlight_tap', anchorKey: 'prodcfg.salvarRegistro', text: 'Toque aqui para salvar.' },
    ],
  },
  {
    id: 'tour_cadastrar_unidade',
    title: 'Como cadastrar uma unidade de medida',
    productionOnly: true,
    entryScreen: ViewType.PRODUCTION_CONFIG,
    productionSubScreen: 'UNIDADES',
    steps: [
      { type: 'highlight_tap', anchorKey: 'prodcfg.addRegistro', text: 'Toque aqui para cadastrar uma unidade de medida (ex.: kg, metro, unidade).' },
      { type: 'highlight_tap', anchorKey: 'prodcfg.salvarRegistro', text: 'Digite a sigla e toque aqui para salvar.' },
    ],
  },
  {
    id: 'tour_cadastrar_cliente',
    title: 'Como cadastrar um cliente',
    entryScreen: ViewType.PEOPLE,
    entryParams: { initialFilter: 'CUSTOMER' },
    steps: [
      { type: 'highlight_tap', anchorKey: 'people.novo', text: 'Toque aqui para cadastrar um cliente novo.' },
      { type: 'message', text: 'Marque a opção "Cliente" e preencha nome e telefone.' },
      { type: 'highlight_tap', anchorKey: 'person.salvar', text: 'Toque aqui para salvar.' },
    ],
  },
  {
    id: 'tour_cadastrar_fornecedor',
    title: 'Como cadastrar um fornecedor',
    entryScreen: ViewType.PEOPLE,
    entryParams: { initialFilter: 'SUPPLIER' },
    steps: [
      { type: 'highlight_tap', anchorKey: 'people.novo', text: 'Toque aqui para cadastrar um fornecedor novo.' },
      { type: 'message', text: 'Marque a opção "Fornecedor" e preencha nome e telefone.' },
      { type: 'highlight_tap', anchorKey: 'person.salvar', text: 'Toque aqui para salvar.' },
    ],
  },
  {
    id: 'tour_cadastrar_conta',
    title: 'Como cadastrar uma conta',
    entryScreen: ViewType.ACCOUNTS,
    steps: [
      { type: 'highlight_tap', anchorKey: 'account.novo', text: 'Toque aqui para cadastrar uma conta nova.' },
      { type: 'highlight_tap', anchorKey: 'account.salvar', text: 'Digite o nome e toque aqui para salvar.' },
    ],
  },
  {
    id: 'tour_cadastrar_meio_pagamento',
    title: 'Como cadastrar um meio de recebimento',
    entryScreen: ViewType.PAYMENT_METHODS,
    steps: [
      { type: 'highlight_tap', anchorKey: 'paymethod.novo', text: 'Toque aqui para cadastrar um meio de recebimento novo.' },
      { type: 'highlight_tap', anchorKey: 'paymethod.salvar', text: 'Digite o nome e toque aqui para salvar.' },
    ],
  },
];
