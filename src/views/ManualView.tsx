import { useState, useMemo } from 'react';
import {
  ArrowLeft, BookOpen, Search, ChevronDown, ChevronUp,
  ShoppingBag, ShoppingCart, DollarSign, Factory,
  Package, Users, Settings, Layers, FileText,
  CheckCircle2, AlertCircle, Info, Lightbulb, Star
} from 'lucide-react';

interface ManualSection {
  id: string;
  icon: React.ReactNode;
  color: string;
  title: string;
  subtitle: string;
  topics: ManualTopic[];
}

interface ManualTopic {
  title: string;
  tag?: 'novo' | 'dica' | 'atenção';
  steps?: string[];
  info?: string;
}

const MANUAL_CONTENT: ManualSection[] = [
  {
    id: 'overview',
    icon: <Star size={20} />,
    color: 'bg-amber-500',
    title: 'Visão Geral do Sistema',
    subtitle: 'O que é e como o sistema está organizado',
    topics: [
      {
        title: 'O que é este sistema?',
        info: 'Sistema integrado de gestão para fábricas de calçados. Cobre vendas, compras, financeiro, estoque e produção em um único lugar, acessível pelo celular ou tablet.'
      },
      {
        title: 'Módulos disponíveis',
        steps: [
          'VENDAS — Cadastro de pedidos, orçamentos, clientes e geração de pedidos de produção.',
          'COMPRAS — Registro de compras de matéria-prima e insumos.',
          'FINANCEIRO — Controle de contas, recebimentos e pagamentos.',
          'PRODUÇÃO (PCP) — Lotes de produção, apontamento por setor e pedidos de produção.',
          'ESTOQUE DE SOLADOS — Entradas, estoque por modelo/cor/tamanho e pesagem.',
          'CADASTROS — Produtos, clientes, fornecedores, grades, cores e categorias.',
          'CONFIGURAÇÕES — Ativar/desativar módulos, backup e preferências.'
        ]
      },
      {
        title: 'Navegação principal',
        steps: [
          'Use a barra inferior para alternar entre os módulos principais.',
          'No módulo de Produção, o menu lateral dá acesso a PCP, Estoque, Solados e Configurações.',
          'O botão de voltar (seta) retorna sempre ao nível anterior.',
          'O Dashboard exibe os indicadores mais importantes de cada módulo ativo.'
        ]
      }
    ]
  },
  {
    id: 'sales',
    icon: <ShoppingBag size={20} />,
    color: 'bg-violet-600',
    title: 'Módulo de Vendas',
    subtitle: 'Pedidos, orçamentos e pedidos de produção',
    topics: [
      {
        title: 'Como criar um novo pedido de venda',
        steps: [
          'Acesse VENDAS no menu inferior.',
          'Toque no botão "+" para abrir um novo registro.',
          'Selecione o Cliente e o Vendedor responsável.',
          'Defina a Data de Entrega combinada com o cliente.',
          'Toque em "+ Adicionar Modelo" para inserir os produtos.',
          'Para cada modelo: selecione a cor, informe as quantidades por tamanho (Varejo) ou por grade (Atacado).',
          'Ajuste o desconto e a forma de pagamento se necessário.',
          'Toque em "Concluir" para salvar a venda.'
        ]
      },
      {
        title: 'Diferença entre Venda e Orçamento',
        steps: [
          'VENDA: baixa o estoque imediatamente ao salvar.',
          'ORÇAMENTO: não movimenta estoque. Use para proposta ao cliente antes de confirmar.',
          'Um orçamento pode ser convertido em venda a qualquer momento editando-o e mudando o status.'
        ]
      },
      {
        title: 'Como gerar um Pedido de Produção a partir de uma venda',
        tag: 'novo',
        steps: [
          'Com a venda já salva e confirmada, abra-a para edição.',
          'Toque no botão roxo "Gerar OP" (fábrica) na barra inferior.',
          'Escolha o modo: "Produzir Inteiro" ou "Abater Estoque".',
          '"Produzir Inteiro" — todo o pedido vai para produção, sem olhar o estoque.',
          '"Abater Estoque" — o sistema mostra o estoque disponível por tamanho. Você define quanto alocar do estoque; o restante vai para produção.',
          'Confirme a Data de Entrega e toque em "Confirmar e Gerar Lote(s)".',
          'O pedido aparecerá na aba "Pedidos" do PCP com todos os dados do cliente e prazo.'
        ]
      },
      {
        title: 'Como registrar recebimentos parciais',
        steps: [
          'Abra a venda desejada.',
          'Na seção "Recebimentos", toque no botão "+".',
          'Informe o valor recebido, o método e a conta de destino.',
          'O saldo restante é calculado automaticamente.',
          'Ao quitar totalmente, o status de pagamento muda para "Quitado".'
        ]
      },
      {
        title: 'Como cancelar uma venda',
        tag: 'atenção',
        steps: [
          '"Cancelar e Estornar" — anula a venda e devolve o estoque. Use quando houve erro.',
          '"Cancelar sem Estorno" — marca como cancelada mas não devolve estoque. Use quando o produto já foi devolvido manualmente.',
          'Vendas canceladas ficam registradas no histórico para auditoria.'
        ]
      },
      {
        title: 'Compartilhar pedido via WhatsApp ou PDF',
        steps: [
          'Abra a venda e toque no ícone de mensagem (WhatsApp) no resumo.',
          'Revise o texto automático ou edite manualmente.',
          'Toque "Enviar WhatsApp" para abrir diretamente na conversa do cliente.',
          'Toque "Compartilhar PDF" para gerar e compartilhar o documento.'
        ]
      }
    ]
  },
  {
    id: 'purchases',
    icon: <ShoppingCart size={20} />,
    color: 'bg-cyan-600',
    title: 'Módulo de Compras',
    subtitle: 'Entradas de matéria-prima e insumos',
    topics: [
      {
        title: 'Como registrar uma compra',
        steps: [
          'Acesse COMPRAS no menu inferior.',
          'Toque em "+" para nova compra.',
          'Selecione o Fornecedor.',
          'Escolha o Tipo: "Abastecimento de Estoque" (produtos cadastrados) ou "Compra Geral" (despesas livres).',
          'Adicione os itens com quantidade e custo.',
          'Defina a forma de pagamento e a conta.',
          'Salve — o estoque é atualizado automaticamente para compras de abastecimento.'
        ]
      },
      {
        title: 'Compra com boleto / a prazo',
        steps: [
          'Selecione "A Prazo" na condição de pagamento.',
          'Informe a data de vencimento.',
          'A compra aparecerá como pendente no Financeiro até ser quitada.'
        ]
      }
    ]
  },
  {
    id: 'financial',
    icon: <DollarSign size={20} />,
    color: 'bg-amber-500',
    title: 'Módulo Financeiro',
    subtitle: 'Contas, recebimentos, pagamentos e saldo',
    topics: [
      {
        title: 'Como registrar um lançamento manual',
        steps: [
          'Acesse FINANCEIRO no menu inferior.',
          'Toque em "+" para novo lançamento.',
          'Selecione Receita ou Despesa.',
          'Informe a categoria, conta, valor e data.',
          'Salve. O saldo da conta é atualizado em tempo real.'
        ]
      },
      {
        title: 'Contas bancárias e caixa',
        steps: [
          'Acesse FINANCEIRO → Contas para ver o saldo de cada conta.',
          'Você pode ter múltiplas contas: Banco, Caixa, Poupança.',
          'Ao registrar vendas e compras, sempre vincule à conta correta para o saldo ficar preciso.',
          'Transferências entre contas: registre uma Despesa na conta de origem e uma Receita na conta de destino.'
        ]
      },
      {
        title: 'Relatórios financeiros',
        steps: [
          'Acesse RELATÓRIOS no menu inferior.',
          'Filtre por período, categoria ou conta.',
          'O relatório mostra entradas, saídas e saldo do período.',
          'Toque em "Detalhar" para ver lançamento por lançamento.'
        ]
      }
    ]
  },
  {
    id: 'pcp',
    icon: <Factory size={20} />,
    color: 'bg-indigo-600',
    title: 'PCP — Produção',
    subtitle: 'Planejamento, lotes, apontamento e pedidos de produção',
    topics: [
      {
        title: 'O que é o PCP?',
        info: 'PCP (Planejamento e Controle da Produção) é onde você acompanha e registra tudo que acontece na fábrica: quais produtos estão sendo produzidos, em qual setor, com qual status e para qual cliente.'
      },
      {
        title: 'Como iniciar um lote de produção manualmente',
        steps: [
          'Acesse PRODUÇÃO → PCP Central.',
          'Toque em "Iniciar Lote" no canto superior direito.',
          'Selecione o Produto e a Cor (variação).',
          'Informe a quantidade de pares e a prioridade.',
          'Confirme. O lote aparecerá no Monitor WIP no primeiro setor da rota do produto.'
        ]
      },
      {
        title: 'Como iniciar um lote a partir de um Pedido de Produção',
        tag: 'novo',
        steps: [
          'Na aba "Pedidos" do PCP, localize o pedido do cliente.',
          'O pedido mostra: número, cliente, data do pedido e prazo de entrega.',
          'Toque em "Iniciar Lote" — o sistema pré-preenche produto, cor, quantidade e vincula ao pedido automaticamente.',
          'O lote criado fica identificado com o código da OP (ex: OP #001) e o nome do cliente.'
        ]
      },
      {
        title: 'Como fazer apontamento de produção (avançar setor)',
        steps: [
          'No Monitor WIP, toque no setor desejado para ver os lotes.',
          'Toque em um lote para abrir os detalhes.',
          'Selecione o Status/Operação realizado.',
          'Adicione observações se necessário (perdas, defeitos, etc.).',
          'Toque em "Próximo Setor" para avançar o lote.',
          'No último setor, o botão muda para "Finalizar Produção".'
        ]
      },
      {
        title: 'Como usar o Scanner de Lote (QR Code)',
        steps: [
          'Imprima a etiqueta do lote tocando no ícone de tag no detalhe do lote.',
          'Para apontar via scanner: toque em "Escanear" no PCP.',
          'Aponte a câmera para o QR Code da etiqueta.',
          'O sistema identifica o lote e pergunta se deseja confirmar a movimentação.'
        ]
      },
      {
        title: 'Prioridades de lote',
        steps: [
          'NORMAL — produção padrão sem urgência.',
          'HIGH — lote importante, deve ser priorizado.',
          'URGENT — produção emergencial. Aparece com alerta vermelho no monitor.'
        ]
      },
      {
        title: 'Monitor WIP — como ler o painel',
        steps: [
          'Cada card de setor mostra: Total de Pares em processamento, Lotes Ativos, Atrasos (>24h sem movimentação) e Urgências.',
          'Badge vermelho piscante = lotes com atraso crítico.',
          'Badge laranja = lotes com alta prioridade.',
          'Toque no card do setor para ver todos os lotes daquele setor.'
        ]
      },
      {
        title: 'Configurar a rota de produção de um produto',
        steps: [
          'Acesse CADASTROS → Produtos → abra o produto.',
          'Na aba de Produção, configure a "Rota de Produção" arrastando os setores na ordem desejada.',
          'Todo lote criado para este produto seguirá automaticamente esta rota.'
        ]
      }
    ]
  },
  {
    id: 'soles',
    icon: <Layers size={20} />,
    color: 'bg-emerald-600',
    title: 'Estoque de Solados',
    subtitle: 'Entradas, estoque, pesagem e etiquetas',
    topics: [
      {
        title: 'Como registrar uma entrada de solados',
        steps: [
          'Acesse PRODUÇÃO → Entrada de Solados.',
          'Selecione o Fornecedor.',
          'Adicione os itens: modelo (forma), cor e quantidades por numeração.',
          'Informe o custo unitário.',
          'Salve — o estoque é atualizado automaticamente.'
        ]
      },
      {
        title: 'Como visualizar o estoque atual de solados',
        steps: [
          'Acesse PRODUÇÃO → Estoque de Solados.',
          'Cada card mostra o modelo, a cor e o total de pares por numeração.',
          'Use a busca ou o filtro de modelo para localizar rapidamente.',
          'O card azul no rodapé mostra o Total de Pares em estoque.'
        ]
      },
      {
        title: 'Como ajustar o estoque (balanço)',
        steps: [
          'Na tela de Estoque de Solados, toque em "Editar".',
          'Selecione o modelo e cor a ajustar.',
          'Altere as quantidades por numeração.',
          'Toque em "Salvar Ajuste".'
        ]
      },
      {
        title: 'Como fazer pesagem e contagem',
        steps: [
          'Acesse PRODUÇÃO → Pesagem e Contagem.',
          'Selecione o modelo, cor e numeração.',
          'Informe o peso total da amostra.',
          'O sistema calcula automaticamente a quantidade de pares pelo peso unitário cadastrado.'
        ]
      },
      {
        title: 'Como imprimir etiquetas de solado',
        steps: [
          'No Estoque de Solados, localize o modelo desejado.',
          'Toque em "Imprimir" no card.',
          'Configure o layout da etiqueta (tamanhos, posição do QR Code).',
          'Confirme a impressão.'
        ]
      }
    ]
  },
  {
    id: 'products',
    icon: <Package size={20} />,
    color: 'bg-slate-600',
    title: 'Cadastro de Produtos',
    subtitle: 'Modelos, variações, grades e ficha técnica',
    topics: [
      {
        title: 'Como cadastrar um novo produto',
        steps: [
          'Acesse CONFIGURAÇÕES → Produtos → "+".',
          'Informe o Nome, Referência, Categoria e Fornecedor padrão.',
          'Selecione a Grade de tamanhos (ex: 37 ao 42).',
          'Defina o Tipo de Venda: Atacado ou Varejo.',
          'Adicione as Variações (cores) do produto.',
          'Para cada variação: informe o estoque inicial por tamanho (se houver).',
          'Salve o produto.'
        ]
      },
      {
        title: 'Como configurar a ficha técnica (consumos)',
        steps: [
          'Abra o produto cadastrado.',
          'Acesse a aba "Ficha Técnica" ou "Consumos".',
          'Adicione cada componente: nome, material, quantidade por par.',
          'Os consumos são usados para calcular a necessidade de compras e matéria-prima.',
          'Associe ferramentas (facas de corte) a cada peça se aplicável.'
        ]
      },
      {
        title: 'Como configurar o mapeamento de solados',
        steps: [
          'No cadastro do produto, localize "Mapeamento de Solados".',
          'Para cada numeração da grade, selecione qual solado (modelo + cor) deve ser usado.',
          'Este mapeamento é usado para calcular a Necessidade de Compras automaticamente.'
        ]
      },
      {
        title: 'Grades de tamanhos',
        steps: [
          'Acesse CONFIGURAÇÕES → Grades para gerenciar as grades disponíveis.',
          'Cada grade tem um nome, tipo (Forma, Solado, Faca ou Embalagem) e os tamanhos.',
          'Você pode configurar quantas peças de cada tamanho compõem uma grade (configuração de caixa).'
        ]
      }
    ]
  },
  {
    id: 'people',
    icon: <Users size={20} />,
    color: 'bg-rose-500',
    title: 'Clientes e Fornecedores',
    subtitle: 'Cadastro de pessoas e empresas',
    topics: [
      {
        title: 'Como cadastrar um cliente ou fornecedor',
        steps: [
          'Acesse CONFIGURAÇÕES → Pessoas → "+".',
          'Informe o nome, documento, telefone e e-mail.',
          'Marque se é Cliente, Fornecedor ou ambos.',
          'Para clientes: você pode vincular vendedores responsáveis pela conta.',
          'Salve. O cadastro fica disponível nos módulos de Venda e Compra.'
        ]
      },
      {
        title: 'Como vincular um vendedor a um cliente',
        steps: [
          'Abra o cadastro do cliente.',
          'Localize o campo "Vendedores Vinculados".',
          'Adicione um ou mais vendedores.',
          'Ao criar uma venda para este cliente, o vendedor vinculado será sugerido automaticamente.'
        ]
      },
      {
        title: 'Como ver o histórico de um cliente',
        steps: [
          'Acesse CONFIGURAÇÕES → Pessoas.',
          'Toque no cliente desejado.',
          'A tela de detalhes mostra todas as compras, pagamentos e observações.'
        ]
      }
    ]
  },
  {
    id: 'settings',
    icon: <Settings size={20} />,
    color: 'bg-slate-500',
    title: 'Configurações do Sistema',
    subtitle: 'Módulos, setores, backup e preferências',
    topics: [
      {
        title: 'Como ativar ou desativar módulos',
        steps: [
          'Acesse CONFIGURAÇÕES → Módulos.',
          'Ative ou desative: Vendas, Produção, Finanças Pessoais.',
          'Módulos desativados ficam ocultos no menu para simplificar a navegação.'
        ]
      },
      {
        title: 'Como configurar setores de produção',
        steps: [
          'Acesse PRODUÇÃO → Configurações → Setores.',
          'Crie um setor para cada etapa da sua fábrica (ex: Corte, Costura, Montagem, Acabamento).',
          'Defina a ordem e os status possíveis (FlowTags) de cada setor.',
          'Os setores são usados na rota de produção dos lotes.'
        ]
      },
      {
        title: 'Como fazer backup e restaurar dados',
        steps: [
          'Acesse CONFIGURAÇÕES → Backup.',
          'Toque em "Exportar Backup" para baixar um arquivo JSON com todos os dados.',
          'Para restaurar: toque em "Importar Backup" e selecione o arquivo.',
          'ATENÇÃO: a restauração substitui todos os dados atuais. Use com cuidado.'
        ]
      },
      {
        title: 'Modo escuro',
        steps: [
          'O modo escuro é ativado automaticamente pela preferência do dispositivo.',
          'Você também pode alternar manualmente em CONFIGURAÇÕES → Aparência.'
        ]
      }
    ]
  }
];

interface ManualViewProps {
  onBack: () => void;
  isDarkMode: boolean;
}

export default function ManualView({ onBack, isDarkMode }: ManualViewProps) {
  const [search, setSearch] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['overview']));
  const [openTopics, setOpenTopics] = useState<Set<string>>(new Set());

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTopic = (key: string) => {
    setOpenTopics(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return MANUAL_CONTENT;
    const q = search.toLowerCase();
    return MANUAL_CONTENT
      .map(section => ({
        ...section,
        topics: section.topics.filter(t =>
          t.title.toLowerCase().includes(q) ||
          t.info?.toLowerCase().includes(q) ||
          t.steps?.some(s => s.toLowerCase().includes(q))
        )
      }))
      .filter(s => s.topics.length > 0 || s.title.toLowerCase().includes(q));
  }, [search]);

  const tagStyle = (tag: ManualTopic['tag']) => {
    if (tag === 'novo') return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
    if (tag === 'dica') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    if (tag === 'atenção') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    return '';
  };

  const tagIcon = (tag: ManualTopic['tag']) => {
    if (tag === 'novo') return <Star size={10} />;
    if (tag === 'dica') return <Lightbulb size={10} />;
    if (tag === 'atenção') return <AlertCircle size={10} />;
    return null;
  };

  return (
    <div className={`flex flex-col h-full pb-32 px-1 overflow-y-auto overflow-x-hidden force-scrollbar ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-indigo-500" />
            <h2 className={`text-[13px] font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              Manual do Sistema
            </h2>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            Guia de uso atualizado
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar no manual..."
          aria-label="Buscar no manual"
          className={`w-full pl-10 pr-4 py-3 rounded-2xl border-2 text-xs font-black outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-100 text-slate-900 placeholder:text-slate-400'}`}
        />
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-3">
        {filtered.map(section => {
          const isOpen = openSections.has(section.id) || !!search.trim();
          return (
            <div
              key={section.id}
              className={`rounded-3xl border-2 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
            >
              {/* Section header */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className={`w-full flex items-center gap-4 p-5 text-left transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
              >
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-white ${section.color}`}>
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    {section.title}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    {section.subtitle}
                  </p>
                </div>
                <div className="shrink-0 text-slate-400">
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>

              {/* Topics */}
              {isOpen && (
                <div className={`border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  {section.topics.map((topic, ti) => {
                    const topicKey = `${section.id}-${ti}`;
                    const isTopicOpen = openTopics.has(topicKey) || !!search.trim();
                    return (
                      <div
                        key={ti}
                        className={`border-b last:border-b-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleTopic(topicKey)}
                          className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors ${isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/70'}`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <CheckCircle2 size={13} className={`shrink-0 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                            <span className={`text-[11px] font-black uppercase tracking-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                              {topic.title}
                            </span>
                            {topic.tag && (
                              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${tagStyle(topic.tag)}`}>
                                {tagIcon(topic.tag)} {topic.tag}
                              </span>
                            )}
                          </div>
                          <div className="shrink-0 text-slate-400 ml-2">
                            {isTopicOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        </button>

                        {isTopicOpen && (
                          <div className={`px-5 pb-4 ${isDarkMode ? 'bg-slate-800/20' : 'bg-slate-50/50'}`}>
                            {topic.info && (
                              <div className={`flex gap-2 p-3 rounded-xl mb-3 ${isDarkMode ? 'bg-indigo-900/20 border border-indigo-800/30' : 'bg-indigo-50 border border-indigo-100'}`}>
                                <Info size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                                <p className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300 leading-relaxed">
                                  {topic.info}
                                </p>
                              </div>
                            )}
                            {topic.steps && (
                              <ol className="flex flex-col gap-2">
                                {topic.steps.map((step, si) => (
                                  <li key={si} className="flex gap-2.5 items-start">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5 ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                                      {si + 1}
                                    </span>
                                    <p className={`text-[11px] font-medium leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                      {step}
                                    </p>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className={`py-16 rounded-3xl border-2 border-dashed flex flex-col items-center gap-3 ${isDarkMode ? 'border-slate-800 text-slate-700' : 'border-slate-100 text-slate-300'}`}>
            <FileText size={36} className="opacity-30" />
            <p className="text-xs font-black uppercase tracking-widest">Nenhum resultado</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tente buscar por outro termo</p>
          </div>
        )}
      </div>
    </div>
  );
}
