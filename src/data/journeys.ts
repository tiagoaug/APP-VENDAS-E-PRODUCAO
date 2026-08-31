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
  {
    id: 'tour_cadastrar_produto',
    title: 'Como cadastrar um produto novo',
    entryScreen: ViewType.PRODUCTS,
    steps: [
      { type: 'highlight_tap', anchorKey: 'products.novo', text: 'Toque aqui para cadastrar um produto novo.' },
      { type: 'message', text: 'Escolha "Cadastro Guiado" se for seu primeiro produto (o sistema ajuda a cadastrar fornecedor, categoria e cor antes) ou vá direto pro formulário se já tiver tudo pronto.' },
      { type: 'message', text: 'Preencha referência, nome, fornecedor, categoria e ao menos uma cor com a grade de tamanhos.' },
      { type: 'highlight_tap', screen: ViewType.PRODUCT_FORM, anchorKey: 'productForm.salvar', text: 'Quando terminar, toque aqui para salvar o produto.' },
    ],
  },
  {
    id: 'tour_cadastrar_colaborador',
    title: 'Como cadastrar um colaborador',
    entryScreen: ViewType.COLLABORATORS_CONFIG,
    steps: [
      { type: 'highlight_tap', anchorKey: 'collab.novo', text: 'Toque aqui para cadastrar um colaborador novo.' },
      { type: 'message', text: 'Defina um PIN de 6 dígitos e escolha se ele tem Acesso Total ou só aos Setores que você marcar.' },
      { type: 'highlight_tap', anchorKey: 'collab.salvar', text: 'Quando terminar, toque aqui para salvar o colaborador.' },
    ],
  },
  {
    id: 'tour_emitir_os',
    title: 'Como criar uma Ordem de Serviço',
    productionOnly: true,
    entryScreen: ViewType.PRODUCTION_PCP,
    entryParams: { initialTab: 'lots' },
    steps: [
      { type: 'message', text: 'Abra um Mapa de Produção, escolha o setor terceirizado e selecione os itens que quer mandar pro prestador.' },
      { type: 'highlight_tap', anchorKey: 'pcp.detalheEmitirOS', text: 'Com os itens selecionados, toque aqui para emitir a Ordem de Serviço.' },
      { type: 'message', text: 'Escolha o prestador (cadastrado em Pessoas) e o valor por par — o total é calculado sozinho.' },
      { type: 'highlight_tap', screen: ViewType.PRODUCTION_SERVICE_ORDER_FORM, anchorKey: 'serviceOrder.emitir', text: 'Quando terminar, toque aqui para emitir a OS. Isso já gera o valor a pagar no Financeiro.' },
    ],
  },
  {
    id: 'tour_registrar_compra_solados',
    title: 'Como registrar uma compra de solados',
    productionOnly: true,
    entryScreen: ViewType.PRODUCTION_SOLE_PURCHASE,
    steps: [
      { type: 'message', text: 'Escolha o fornecedor e o molde (forma) — os moldes disponíveis dependem de qual fornecedor está vinculado a cada um.' },
      { type: 'message', text: 'Adicione a(s) cor(es) e preencha a grade de tamanhos e o custo de cada uma.' },
      { type: 'highlight_tap', anchorKey: 'solePurchase.confirmar', text: 'Quando terminar, toque aqui para confirmar a entrada. O estoque só é creditado depois, na Conferência de Compras (Solas).' },
    ],
  },
  {
    id: 'tour_registrar_recebimento_solados',
    title: 'Como registrar o recebimento de solados',
    productionOnly: true,
    entryScreen: ViewType.PRODUCTION_SOLE_RECEIPT,
    steps: [
      { type: 'message', text: 'Encontre a compra pendente do fornecedor (use a busca/filtro se tiver muitas) e confira a quantidade que realmente chegou por tamanho.' },
      { type: 'highlight_tap', anchorKey: 'soleReceipt.confirmar', text: 'Toque aqui para confirmar o recebimento — é isso que credita o estoque de verdade.' },
    ],
  },
  {
    id: 'tour_cadastrar_setor',
    title: 'Como cadastrar um setor de fábrica',
    productionOnly: true,
    entryScreen: ViewType.PRODUCTION_CONFIG,
    productionSubScreen: 'SECTORS',
    steps: [
      { type: 'highlight_tap', anchorKey: 'sector.novo', text: 'Toque aqui para cadastrar um setor novo.' },
      { type: 'message', text: 'Dê um nome ao setor e, se quiser, vincule as Etapas/Flow Tags que ele executa.' },
      { type: 'highlight_tap', anchorKey: 'sector.salvar', text: 'Toque aqui para salvar o setor.' },
    ],
  },
  {
    id: 'tour_ficha_tecnica',
    title: 'Como montar a Ficha Técnica de um produto',
    productionOnly: true,
    entryScreen: ViewType.PRODUCTION_ENGINEERING,
    steps: [
      { type: 'message', text: 'Toque num produto da lista que já tenha pelo menos uma cor cadastrada (se ainda não tiver nenhuma, adicione uma em "Cores & Info" antes de continuar).' },
      { type: 'highlight_tap', screen: ViewType.PRODUCT_FORM, anchorKey: 'productForm.abaFichaTecnica', text: 'Dentro da cor, toque aqui para abrir a Ficha Técnica.' },
      { type: 'message', text: 'Escolha uma categoria: "Componentes do Cabedal" para peças de corte, ou "Outros Consumos" para Embalagens, Químicos, Aviamentos, Impostos, Fretes e outras categorias.' },
      { type: 'highlight_tap', anchorKey: 'productForm.fichaTecnicaAdicionar', text: 'Toque aqui para adicionar um componente do cabedal.' },
      { type: 'message', text: 'Escolha o material e, se for peça de corte, a faca vinculada — com faca escolhida, a quantidade por par é calculada sozinha a partir do peso/área cadastrado nela.' },
      { type: 'highlight_tap', anchorKey: 'engineeringEditor.confirmar', text: 'Quando terminar, toque aqui para confirmar e adicionar o item à ficha técnica. Repita para cada material que o produto usa.' },
    ],
  },
  {
    id: 'tour_cadastrar_faca',
    title: 'Como cadastrar uma faca de corte',
    productionOnly: true,
    entryScreen: ViewType.PRODUCTION_CONFIG,
    productionSubScreen: 'FACAS',
    steps: [
      { type: 'highlight_tap', anchorKey: 'prodcfg.addRegistro', text: 'Toque aqui para cadastrar uma faca de corte nova.' },
      { type: 'message', text: 'Preencha nome, categoria e os demais dados da faca.' },
      { type: 'highlight_tap', anchorKey: 'prodcfg.salvarRegistro', text: 'Toque aqui para salvar.' },
    ],
  },
  {
    id: 'tour_cadastrar_matriz',
    title: 'Como cadastrar uma matriz de solado',
    productionOnly: true,
    entryScreen: ViewType.PRODUCTION_CONFIG,
    productionSubScreen: 'MATRIZES',
    steps: [
      { type: 'highlight_tap', anchorKey: 'prodcfg.addRegistro', text: 'Toque aqui para cadastrar uma matriz (molde) nova.' },
      { type: 'message', text: 'Preencha referência, nome, fornecedor e as cores/grade de tamanhos do molde.' },
      { type: 'highlight_tap', anchorKey: 'prodcfg.salvarRegistro', text: 'Toque aqui para salvar a matriz.' },
    ],
  },
  {
    id: 'tour_cadastrar_peca',
    title: 'Como cadastrar uma peça',
    productionOnly: true,
    entryScreen: ViewType.PRODUCTION_CONFIG,
    productionSubScreen: 'PECAS',
    steps: [
      { type: 'message', text: 'Escolha o tipo (Entrada ou Peça) e digite o nome.' },
      { type: 'highlight_tap', anchorKey: 'peca.adicionar', text: 'Toque aqui para adicionar.' },
    ],
  },
  {
    id: 'tour_montar_rota_entrega',
    title: 'Como montar uma rota de entrega',
    entryScreen: ViewType.DELIVERY_MENU,
    steps: [
      { type: 'highlight_tap', anchorKey: 'delivery.montarRota', text: 'Toque aqui para montar uma rota nova.' },
      { type: 'message', text: 'Marque os pedidos prontos pra entrega que você quer levar nessa rota.' },
      { type: 'highlight_tap', screen: ViewType.DELIVERY_ROUTE_BUILDER, anchorKey: 'deliveryRoute.otimizar', text: 'Toque aqui para ordenar as paradas automaticamente pela distância a partir de onde você está.' },
      { type: 'highlight_tap', screen: ViewType.DELIVERY_ROUTE_BUILDER, anchorKey: 'deliveryRoute.salvar', text: 'Satisfeito com a ordem? Toque aqui para salvar a rota.' },
    ],
  },
  {
    id: 'tour_cadastrar_transportadora',
    title: 'Como cadastrar uma transportadora',
    entryScreen: ViewType.DELIVERY_CARRIERS,
    steps: [
      { type: 'highlight_tap', anchorKey: 'carrier.novo', text: 'Toque aqui para cadastrar uma transportadora nova.' },
      { type: 'message', text: 'Preencha nome, telefone e endereço.' },
      { type: 'highlight_tap', anchorKey: 'carrier.salvar', text: 'Toque aqui para salvar.' },
    ],
  },
  {
    id: 'tour_conectar_bling',
    title: 'Como conectar a conta Bling',
    entryScreen: ViewType.BLING_CONNECTION,
    steps: [
      { type: 'message', text: 'Cole o Client ID e o Client Secret do seu app cadastrado no portal de desenvolvedor do Bling.' },
      { type: 'highlight_tap', anchorKey: 'bling.salvarCredenciais', text: 'Toque aqui para salvar as credenciais.' },
      { type: 'message', text: 'Agora conecte sua conta — você será levado ao site do Bling para autorizar e volta automaticamente já conectado.' },
      { type: 'highlight_tap', anchorKey: 'bling.conectar', text: 'Toque aqui para conectar com o Bling.' },
    ],
  },
  {
    id: 'tour_vincular_produto_bling',
    title: 'Como vincular um produto ao Bling',
    entryScreen: ViewType.BLING_PRODUCT_MAPPING,
    steps: [
      { type: 'message', text: 'O sistema já sugere o produto/variação que combina com cada item do Bling — confira se a sugestão está certa (ou busque manualmente se não houver sugestão).' },
      { type: 'highlight_tap', anchorKey: 'blingMapping.confirmar', text: 'Toque aqui para confirmar o vínculo sugerido.' },
    ],
  },
  {
    id: 'tour_registrar_devolucao_bling',
    title: 'Como registrar uma devolução (Bling)',
    entryScreen: ViewType.BLING_DEVOLUCOES,
    steps: [
      { type: 'message', text: 'Escolha "Produto e Nota" se o item físico está voltando (credita estoque e devolve a nota), ou "Somente Nota" se é só a nota fiscal sendo cancelada, sem o produto voltar.' },
      { type: 'highlight_tap', anchorKey: 'blingDevolucao.somenteNota', text: 'Vamos ver o caminho "Somente Nota" — toque aqui.' },
      { type: 'highlight_tap', anchorKey: 'blingDevolucao.confirmarNota', text: 'Informe a quantidade de notas e toque aqui para confirmar.' },
    ],
  },
];
