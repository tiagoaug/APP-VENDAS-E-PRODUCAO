import { ViewType } from '../types';

// Base de conhecimento da Central de Ajuda — assistente local, offline e determinístico
// (sem LLM, sem rede): um tópico por tela + FAQ transversal, buscados por palavras-chave.
// Não confundir com o Assistente IA (AIAssistantModal.tsx), que é um recurso à parte, na
// nuvem. Ver docs/AGENT_CONTEXT_REACT.md para as decisões de arquitetura desta adaptação.
//
// Cresce por conteúdo, não por código: pra ensinar uma tela nova, basta adicionar uma
// entrada aqui (ou uma linha em HELP_FAQ) — nenhuma outra parte do app precisa mudar.

export interface HelpSection {
  heading: string;
  body: string; // aceita quebras de linha (\n) — cada uma vira um parágrafo curto
}

export interface HelpTopic {
  view: ViewType;
  title: string;
  summary: string;
  sections: HelpSection[];
  keywords: string[];
  relatedViews?: ViewType[];
  // Só produtos/fluxos exclusivos de quem fabrica — o mesmo gate já usado no resto do
  // app (modulesConfig.production), aplicado no momento de carregar/filtrar a KB.
  productionOnly?: boolean;
}

export interface HelpFaqEntry {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  linkView?: ViewType;
  productionOnly?: boolean;
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    view: ViewType.DASHBOARD,
    title: 'Painel Inicial',
    summary: 'Resumo do seu negócio: vendas recentes, pendências, alertas de estoque baixo e atalhos para as áreas principais.',
    sections: [
      { heading: 'O que você vê aqui', body: 'Cards configuráveis com números do dia/mês, atalhos rápidos e avisos que precisam da sua atenção (ex.: estoque baixo, lembretes vencendo).' },
      { heading: 'Personalizar', body: 'Em Configurações → Personalizar Dashboard você escolhe quais cards aparecem e em que ordem.' },
    ],
    keywords: ['inicio', 'painel', 'dashboard', 'resumo', 'home'],
    relatedViews: [ViewType.SALES, ViewType.STOCK, ViewType.FINANCIAL],
  },
  {
    view: ViewType.PRODUCTS,
    title: 'Cadastro de Produtos',
    summary: 'Lista de todos os modelos cadastrados — a partir daqui você cria, edita ou consulta um produto completo.',
    sections: [
      { heading: 'Criar um produto', body: 'Toque em "Novo Produto". Você vai definir referência, nome, categoria, cores, grade de tamanhos e preços.' },
      { heading: 'Atacado, Varejo ou Híbrido', body: 'Marque só Atacado (vende em caixa fechada), só Varejo (vende por par) ou os dois — híbrido mantém pools de estoque separados automaticamente.' },
      { heading: 'Ficha técnica', body: 'Só aparece pra quem tem o módulo de Produção ligado — lista os materiais que compõem o par e calcula o custo sozinho.' },
    ],
    keywords: ['produto', 'modelo', 'cadastrar produto', 'novo produto', 'referencia', 'variacao', 'cor', 'tamanho'],
    relatedViews: [ViewType.PRODUCT_FORM, ViewType.CATEGORIES, ViewType.GRIDS, ViewType.COLORS],
  },
  {
    view: ViewType.PRODUCT_FORM,
    title: 'Cadastro/Edição de Produto',
    summary: 'Formulário completo de um produto: dados básicos, variações (cor + tamanho), preços e, se você fabrica, ficha técnica de materiais.',
    sections: [
      { heading: 'Campos obrigatórios', body: 'Referência, nome, fornecedor, categoria e ao menos uma cor com grade preenchida.' },
      { heading: 'Preço e custo', body: 'Atacado: preço por grade fechada. Varejo: preço por par avulso. Produto híbrido tem os dois, calculados separadamente.' },
      { heading: 'Ficha técnica (produção)', body: 'Some os materiais e a quantidade de cada um por par — o custo do produto é calculado automaticamente a partir disso.' },
    ],
    keywords: ['produto', 'ficha tecnica', 'preco', 'custo', 'variacao', 'grade', 'cor'],
    relatedViews: [ViewType.PRODUCTS, ViewType.GRIDS, ViewType.COLORS, ViewType.CATEGORIES],
  },
  {
    view: ViewType.SALES,
    title: 'Vendas',
    summary: 'Lista de pedidos de venda — crie, acompanhe status, separe caixas e finalize entregas por aqui.',
    sections: [
      { heading: 'Fazer uma venda', body: 'Toque em "Nova Venda". Escolha o cliente, adicione os produtos (modelo, cor, tamanho ou grade), defina pagamento e finalize.' },
      { heading: 'Status do pedido', body: 'Orçamento → Confirmado → Venda. Só vira baixa de estoque de verdade quando o pedido está como Venda.' },
      { heading: 'Produto híbrido', body: 'Cada item do pedido escolhe se sai em Atacado (caixa) ou Varejo (par avulso), mesmo produto.' },
    ],
    keywords: ['venda', 'vender', 'pedido', 'cliente', 'orcamento', 'cartao', 'pix', 'pagamento'],
    relatedViews: [ViewType.SALE_FORM, ViewType.PEOPLE, ViewType.STOCK],
  },
  {
    view: ViewType.SALE_FORM,
    title: 'Pedido de Venda',
    summary: 'Monte o pedido: cliente, itens (produto/cor/tamanho ou grade), condição de pagamento e endereço de entrega.',
    sections: [
      { heading: 'Cliente', body: 'Escolha um cliente cadastrado, ou marque "Consumidor Final" pra venda de balcão sem cadastro.' },
      { heading: 'Itens', body: 'O estoque disponível daquela variação aparece junto — evita vender o que não tem.' },
      { heading: 'Pagamento', body: 'À vista ou a prazo (com parcelas). Se a prazo, dá pra já lançar as parcelas no financeiro.' },
    ],
    keywords: ['venda', 'pedido', 'cliente', 'consumidor final', 'condicao de pagamento', 'entrega'],
    relatedViews: [ViewType.SALES, ViewType.PEOPLE, ViewType.PAYMENT_METHODS],
  },
  {
    view: ViewType.PURCHASES,
    title: 'Compras',
    summary: 'Registre entradas de mercadoria/insumos: reposição de estoque, compras gerais, solados e palmilhas.',
    sections: [
      { heading: 'Tipos de compra', body: 'Reposição (abastece estoque de um produto já cadastrado), Geral (despesa avulsa/material), Solado e Palmilha (fluxos próprios de produção).' },
      { heading: 'Atacado x Varejo', body: 'Em produto híbrido, cada bloco de compra escolhe se abastece o pool Atacado (caixas) ou Varejo (pares por tamanho) — os dois pools ficam sempre separados no estoque.' },
    ],
    keywords: ['compra', 'comprar', 'fornecedor', 'entrada de estoque', 'reposicao', 'abastecer'],
    relatedViews: [ViewType.PURCHASE_FORM, ViewType.STOCK, ViewType.PEOPLE],
  },
  {
    view: ViewType.PURCHASE_FORM,
    title: 'Pedido de Compra',
    summary: 'Monte a compra: fornecedor, produtos/quantidades, custo e (se aplicável) grade de embalagem.',
    sections: [
      { heading: 'Registrar como recebido', body: 'Só marque essa opção quando a mercadoria já chegou de verdade — é isso que credita o estoque.' },
      { heading: 'Transformar em Varejo ao Receber', body: 'Pra quem compra em caixa fechada mas vende por par: escolhe uma grade (composição por tamanho) e a compra já entra fatiada em pares no pool Varejo, sem precisar do PCP.' },
    ],
    keywords: ['compra', 'fornecedor', 'grade', 'embalagem', 'recebido', 'estoque', 'atacado', 'varejo'],
    relatedViews: [ViewType.PURCHASES, ViewType.STOCK],
  },
  {
    view: ViewType.STOCK,
    title: 'Estoque',
    summary: 'Saldo de cada produto/variação, separado por pool (Atacado em caixas, Varejo em pares).',
    sections: [
      { heading: 'Produto híbrido', body: 'Mostra os dois pools lado a lado, cada um com seu próprio mínimo configurado no cadastro do produto.' },
      { heading: 'Converter em Pares', body: 'Sem o módulo de Produção, use esse botão pra transformar caixas do Atacado em pares no Varejo, escolhendo a grade — sem precisar de Mapa de Produção.' },
      { heading: 'Fazer Balanço', body: 'Corrige a contagem manualmente quando o saldo do sistema não bate com a contagem física.' },
    ],
    keywords: ['estoque', 'saldo', 'caixa', 'par', 'balanco', 'converter', 'minimo'],
    relatedViews: [ViewType.PRODUCTS, ViewType.PURCHASES],
  },
  {
    view: ViewType.FINANCIAL,
    title: 'Financeiro',
    summary: 'Receitas, despesas e saldo das contas — a maior parte é gerada automaticamente por vendas e compras.',
    sections: [
      { heading: 'Lançamentos automáticos x manuais', body: 'Vendas e compras já geram o lançamento sozinhas; use "Lançar" só pra despesas/receitas avulsas que não vêm de um pedido.' },
      { heading: 'Categorias', body: 'Todo lançamento pede uma categoria — organize elas em Cadastros → Categorias antes de lançar muita coisa.' },
    ],
    keywords: ['financeiro', 'receita', 'despesa', 'conta', 'saldo', 'fluxo de caixa', 'categoria'],
    relatedViews: [ViewType.ACCOUNTS, ViewType.CATEGORIES],
  },
  {
    view: ViewType.PEOPLE,
    title: 'Cadastro de Pessoas',
    summary: 'Clientes, fornecedores, vendedores e prestadores de serviço — tudo no mesmo cadastro, marcado por papel.',
    sections: [
      { heading: 'Papéis', body: 'Uma pessoa pode ser Cliente, Fornecedor, Prestador de Serviço, ou marcada como Vendedor/Comprador interno (pra aparecer como responsável em Vendas/Compras).' },
      { heading: 'Contato interno de um Cliente/Fornecedor', body: 'Ao marcar Cliente ou Fornecedor, um popup pergunta se você já quer registrar o comprador/vendedor de contato daquela empresa.' },
    ],
    keywords: ['pessoa', 'cliente', 'fornecedor', 'vendedor', 'comprador', 'contato', 'cadastro'],
    relatedViews: [ViewType.SALES, ViewType.PURCHASES],
  },
  {
    view: ViewType.CATEGORIES,
    title: 'Categorias',
    summary: 'Classificam produtos, despesas e receitas — deixam relatórios e filtros muito mais úteis.',
    sections: [
      { heading: 'Modelos prontos', body: 'A seção "Modelos" traz sugestões já usadas por outras contas — toque pra adicionar como sua, sem digitar do zero.' },
      { heading: 'Suas categorias como modelo', body: 'Categoria que você criou pode virar sugestão pra outras contas também, com o botão de marcador.' },
    ],
    keywords: ['categoria', 'classificar', 'tipo', 'grupo', 'modelo', 'sugestao'],
    relatedViews: [ViewType.PRODUCTS, ViewType.FINANCIAL],
  },
  {
    view: ViewType.PRODUCTION_PCP,
    title: 'PCP — Planejamento e Controle de Produção',
    summary: 'Acompanha pedidos em produção por setor, do corte até a expedição.',
    productionOnly: true,
    sections: [
      { heading: 'Mapas e fichas', body: 'Cada pedido em produção vira um Mapa com fichas por tamanho — elas avançam de setor em setor conforme o trabalho é feito.' },
      { heading: 'Ordem de Serviço (OS)', body: 'Emite pra fornecedores terceirizados (ex.: corte, costura) — controla valor a pagar e vincula ao financeiro.' },
    ],
    keywords: ['producao', 'pcp', 'mapa', 'ficha', 'setor', 'ordem de servico', 'os'],
    relatedViews: [ViewType.PRODUCTION_MENU, ViewType.PRODUCTION_STOCK],
  },
];

export const HELP_FAQ: HelpFaqEntry[] = [
  {
    id: 'custo-produto',
    question: 'Como o custo do produto é calculado?',
    answer: 'Revenda: é o preço de compra que você digita no cadastro. Produção: é a soma dos materiais da ficha técnica (quantidade × custo unitário de cada insumo) — atualize o custo do material pra refletir no produto.',
    keywords: ['custo', 'calculo', 'preco de custo', 'margem', 'lucro'],
    linkView: ViewType.PRODUCT_FORM,
  },
  {
    id: 'hibrido',
    question: 'O que é um produto híbrido (Atacado + Varejo)?',
    answer: 'É um produto vendido tanto em caixa fechada (Atacado) quanto por par avulso (Varejo), com os dois saldos de estoque mantidos separados. Marque os dois botões no cadastro do produto pra ativar.',
    keywords: ['hibrido', 'atacado', 'varejo', 'caixa', 'par', 'pool'],
    linkView: ViewType.PRODUCTS,
  },
  {
    id: 'converter-pares',
    question: 'Comprei em caixa fechada, como vendo por par sem ter Produção?',
    answer: 'Duas opções: (1) na hora da compra, ligue "Transformar em Varejo ao Receber" e escolha a grade — a compra já entra fatiada em pares. (2) se já comprou em Atacado, use o botão "Converter em Pares" na tela de Estoque.',
    keywords: ['converter', 'fatiar', 'grade', 'caixa', 'par', 'sem producao'],
    linkView: ViewType.STOCK,
  },
  {
    id: 'perfil-negocio',
    question: 'Qual a diferença entre um negócio só de Revenda e um com Produção?',
    answer: 'Revenda: você compra produtos prontos e revende — sem ficha técnica, sem Mapa de Produção. Com Produção ligada (Configurações → Módulos): ficha técnica, cálculo automático de custo, PCP e Ordens de Serviço ficam disponíveis.',
    keywords: ['revenda', 'producao', 'modulo', 'perfil', 'diferenca'],
    linkView: ViewType.MODULES_CONFIG,
  },
  {
    id: 'onboarding-retomar',
    question: 'Como retomo a configuração inicial que pulei?',
    answer: 'Em Configurações existe um atalho pra reabrir o assistente de configuração inicial — ele continua exatamente da etapa que faltou, sem repetir o que você já cadastrou.',
    keywords: ['configuracao inicial', 'onboarding', 'assistente', 'retomar', 'pular'],
    linkView: ViewType.SETTINGS,
  },
];
