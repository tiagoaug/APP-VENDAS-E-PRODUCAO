import {
  Users,
  ShoppingBag,
  Factory,
  CheckCircle2,
  Circle,
  ArrowRight,
  Shield,
  Layout,
  Settings,
  Database,
  BarChart3,
  Wallet,
  Boxes,
  Lock,
  AlertTriangle,
  Sparkles,
  Truck,
  Building2,
  UserCog,
  Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { AppModulesConfig, ViewType } from '../types';
import { PRODUCTION_TRIAL_DAYS, SALES_TRIAL_DAYS, PERSONAL_TRIAL_DAYS } from '../constants';
import { isTemplateAdmin } from '../utils/templateAdmin';
import ConfirmDialog from '../components/ConfirmDialog';

// Contagem regressiva de verdade (dd:hh:mm:ss, atualizando a cada segundo) pro teste grátis de
// um módulo — antes só mostrava "Xd restantes" estático, sem avisar de forma visível quando o
// prazo está quase acabando. Fica vermelho/pulsante nas últimas 24h pra chamar atenção antes de
// travar o módulo (ver efeito de auto-expiração em App.tsx).
function TrialCountdownBadge({ endsAt, isDarkMode }: { endsAt: number; isDarkMode: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, endsAt - now);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const isUrgent = remainingMs < 24 * 60 * 60 * 1000;
  const label = days > 0
    ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return (
    <span className={`self-start mb-2 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 tabular-nums ${
      isUrgent
        ? (isDarkMode ? 'bg-rose-500/20 text-rose-300 animate-pulse' : 'bg-rose-100 text-rose-600 animate-pulse')
        : (isDarkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-600')
    }`}>
      <Clock size={10} strokeWidth={2.5} />
      Teste: {label}
    </span>
  );
}

interface ModuleConfigViewProps {
  config: AppModulesConfig;
  onSave: (config: AppModulesConfig) => void;
  onNavigate: (view: ViewType) => void;
  isDarkMode: boolean;
}

// Chaves booleanas de AppModulesConfig que dá pra ligar/desligar no toggle abaixo — exclui os
// campos de controle dos testes grátis (productionTrialStartedAt/productionPurchased/
// salesTrialStartedAt/salesPurchased), que não são módulos e nunca são atribuídos como
// true/false direto por aqui.
type ToggleableModule = Exclude<keyof AppModulesConfig, 'productionTrialStartedAt' | 'productionPurchased' | 'salesTrialStartedAt' | 'salesPurchased' | 'personalTrialStartedAt' | 'personalPurchased'>;

export default function ModuleConfigView({ config, onSave, onNavigate, isDarkMode }: ModuleConfigViewProps) {

  const [pendingModule, setPendingModule] = useState<ToggleableModule | null>(null);
  const [pendingAction, setPendingAction] = useState<'deactivate' | 'startProductionTrial' | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");

  // Produção é add-on pago comprado à parte de Vendas — quem já tem Vendas ativo pode testar
  // grátis por PRODUCTION_TRIAL_DAYS antes de precisar comprar. `productionTrialStartedAt` só é
  // gravado uma vez (na primeira ativação) e nunca resetado, então desligar/religar o módulo
  // dentro do prazo não reinicia a contagem, e o prazo vencido não dá um teste novo de graça.
  const trialStartedAt = config.productionTrialStartedAt ?? null;
  const trialEndsAt = trialStartedAt ? trialStartedAt + PRODUCTION_TRIAL_DAYS * 24 * 60 * 60 * 1000 : null;
  const isProductionPurchased = !!config.productionPurchased;
  const isProductionTrialActive = !isProductionPurchased && !!trialEndsAt && Date.now() < trialEndsAt;
  const isProductionTrialExpired = !isProductionPurchased && !!trialEndsAt && Date.now() >= trialEndsAt;

  // Vendas é o módulo base, também assinado — mas ao contrário de Produção, o teste começa
  // sozinho na criação da conta (ver App.tsx), não por um toggle manual aqui.
  // salesTrialStartedAt ausente = conta criada antes dessa assinatura existir, nunca expira.
  const salesTrialStartedAt = config.salesTrialStartedAt ?? null;
  const salesTrialEndsAt = salesTrialStartedAt ? salesTrialStartedAt + SALES_TRIAL_DAYS * 24 * 60 * 60 * 1000 : null;
  const isSalesPurchased = !!config.salesPurchased;
  const isSalesTrialActive = !isSalesPurchased && !!salesTrialEndsAt && Date.now() < salesTrialEndsAt;
  const isSalesTrialExpired = !isSalesPurchased && !!salesTrialEndsAt && Date.now() >= salesTrialEndsAt;

  // Pessoal nasce ativo igual Vendas (não é um toggle manual como Produção) — mesmo padrão de
  // trial acima. personalTrialStartedAt ausente = conta criada antes dessa assinatura existir,
  // nunca expira sozinha.
  const personalTrialStartedAt = config.personalTrialStartedAt ?? null;
  const personalTrialEndsAt = personalTrialStartedAt ? personalTrialStartedAt + PERSONAL_TRIAL_DAYS * 24 * 60 * 60 * 1000 : null;
  const isPersonalPurchased = !!config.personalPurchased;
  const isPersonalTrialActive = !isPersonalPurchased && !!personalTrialEndsAt && Date.now() < personalTrialEndsAt;
  const isPersonalTrialExpired = !isPersonalPurchased && !!personalTrialEndsAt && Date.now() >= personalTrialEndsAt;

  const toggleModule = (module: ToggleableModule) => {
    const isActivating = !config[module];

    if (isActivating) {
      if (module === 'sales' && !isSalesPurchased && isSalesTrialExpired) {
        setConfirmTitle("Assinatura Necessária");
        setConfirmMessage(`Seu teste grátis de ${SALES_TRIAL_DAYS} dias do Módulo Vendas já acabou. A assinatura direto pelo app ainda está sendo implementada — em breve você poderá reativar aqui mesmo.`);
        setPendingModule(null);
        setPendingAction(null);
        setIsConfirmOpen(true);
        return;
      }
      if (module === 'personal' && !isPersonalPurchased && isPersonalTrialExpired) {
        setConfirmTitle("Assinatura Necessária");
        setConfirmMessage(`Seu teste grátis de ${PERSONAL_TRIAL_DAYS} dias do Módulo Pessoal já acabou. A assinatura direto pelo app ainda está sendo implementada — em breve você poderá reativar aqui mesmo.`);
        setPendingModule(null);
        setPendingAction(null);
        setIsConfirmOpen(true);
        return;
      }
      if (module === 'production' && !config.sales) {
        setConfirmTitle("Requisito Necessário");
        setConfirmMessage("O Módulo de Produção é um complemento pago do Módulo de Vendas — ative Vendas primeiro para poder testar ou adquirir Produção.");
        setPendingModule(null);
        setPendingAction(null);
        setIsConfirmOpen(true);
        return;
      }
      if (module === 'production' && !isProductionPurchased && isProductionTrialExpired) {
        setConfirmTitle("Teste Grátis Encerrado");
        setConfirmMessage(`Seu teste grátis de ${PRODUCTION_TRIAL_DAYS} dias do Módulo Produção já acabou. A compra do módulo direto pelo app ainda está sendo implementada — em breve você poderá adquiri-lo aqui mesmo.`);
        setPendingModule(null);
        setPendingAction(null);
        setIsConfirmOpen(true);
        return;
      }
      if (module === 'production' && !isProductionPurchased && !trialStartedAt) {
        setConfirmTitle("Testar Módulo Produção");
        setConfirmMessage(`O Módulo Produção é vendido separado de Vendas. Você pode testar todas as funções de fábrica (Engenharia de Produto, Insumos, PCP) grátis por ${PRODUCTION_TRIAL_DAYS} dias a partir de agora. Depois desse prazo, o módulo trava até a compra ser confirmada. Quer começar o teste agora?`);
        setPendingModule('production');
        setPendingAction('startProductionTrial');
        setIsConfirmOpen(true);
        return;
      }
      if (module === 'entregas' && !config.sales) {
        setConfirmTitle("Requisito Necessário");
        setConfirmMessage("O Módulo de Entregas requer que o Módulo de Vendas esteja ativo para funcionar corretamente.");
        setPendingModule(null);
        setPendingAction(null);
        setIsConfirmOpen(true);
        return;
      }
      if (module === 'bling' && !config.sales) {
        setConfirmTitle("Requisito Necessário");
        setConfirmMessage("O Módulo Bling requer que o Módulo de Vendas esteja ativo — a vinculação de produtos e os pedidos vêm do seu catálogo de Vendas.");
        setPendingModule(null);
        setPendingAction(null);
        setIsConfirmOpen(true);
        return;
      }
      if (module === 'rh' && !config.sales) {
        setConfirmTitle("Requisito Necessário");
        setConfirmMessage("O Módulo RH requer que o Módulo de Vendas esteja ativo — ele é pensado pra colaboradores de uma operação comercial, não pra uso pessoal.");
        setPendingModule(null);
        setPendingAction(null);
        setIsConfirmOpen(true);
        return;
      }
      // Activation is usually safe (Produção com teste ainda ativo/já comprado cai aqui direto)
      const newConfig = { ...config };
      newConfig[module] = true;
      onSave(newConfig);
    } else {
      // Deactivation requires warning
      setPendingModule(module);
      setPendingAction('deactivate');
      if (module === 'sales' && (config.production || config.entregas || config.bling || config.rh)) {
        const dependents = [config.production && 'Produção', config.entregas && 'Entregas', config.bling && 'Bling', config.rh && 'RH'].filter(Boolean).join(', ');
        setConfirmTitle("Desativar Vendas");
        setConfirmMessage(`Ao desativar o Módulo de Vendas, o Módulo de ${dependents} também será desativado automaticamente. Deseja continuar?`);
      } else {
        const moduleName = module === 'personal' ? 'Pessoal' : module === 'sales' ? 'Vendas' : module === 'production' ? 'Produção' : module === 'entregas' ? 'Entregas' : module === 'bling' ? 'Bling' : module === 'rh' ? 'RH' : 'Assistente de IA';
        setConfirmTitle(`Desativar ${moduleName}`);
        setConfirmMessage(`Tem certeza que deseja ocultar o Módulo ${moduleName}? Os dados não serão apagados, mas as funções ficarão inacessíveis.`);
      }
      setIsConfirmOpen(true);
    }
  };

  const confirmToggle = () => {
    if (!pendingModule) {
      setIsConfirmOpen(false);
      return;
    }

    const newConfig = { ...config };
    if (pendingAction === 'startProductionTrial') {
      newConfig.production = true;
      newConfig.productionTrialStartedAt = Date.now();
    } else if (pendingModule === 'sales') {
      newConfig.sales = false;
      newConfig.production = false;
      newConfig.entregas = false;
      newConfig.bling = false;
      newConfig.rh = false;
    } else {
      newConfig[pendingModule] = false;
    }

    onSave(newConfig);
    setIsConfirmOpen(false);
    setPendingModule(null);
    setPendingAction(null);
  };

  const modules = [
    {
      id: 'personal',
      name: 'Módulo Pessoal',
      description: isPersonalPurchased || !personalTrialStartedAt
        ? 'Pra controlar SUAS finanças fora do negócio — contas, cartões, gastos e receitas da família, separados do dinheiro da empresa. Funciona mesmo sem nenhum outro módulo ativo, pra quem só quer organizar a vida financeira pessoal.'
        : `Pra controlar SUAS finanças fora do negócio — contas, cartões, gastos e receitas da família, separados do dinheiro da empresa. Teste grátis de ${PERSONAL_TRIAL_DAYS} dias antes de exigir assinatura.`,
      icon: <Users size={28} />,
      active: config.personal,
      disabled: isPersonalTrialExpired && !isPersonalPurchased,
      lockLabel: 'Assinatura Necessária',
      trialEndsAt: isPersonalTrialActive ? personalTrialEndsAt! : undefined,
      color: 'bg-amber-500',
      features: ['Financeiro Pessoal', 'Membros da Família', 'Categorias Pessoais', 'Orçamentos']
    },
    {
      id: 'sales',
      name: 'Módulo Vendas',
      description: isSalesPurchased || !salesTrialStartedAt
        ? 'Gestão comercial, estoque de produtos, compras e vendas.'
        : `Gestão comercial, estoque de produtos, compras e vendas. Módulo base do sistema, com teste grátis de ${SALES_TRIAL_DAYS} dias antes de exigir assinatura.`,
      icon: <ShoppingBag size={28} />,
      active: config.sales,
      disabled: isSalesTrialExpired && !isSalesPurchased,
      lockLabel: 'Assinatura Necessária',
      trialEndsAt: isSalesTrialActive ? salesTrialEndsAt! : undefined,
      color: 'bg-emerald-500',
      features: ['Vendas e Orçamentos', 'Compras de Mercadoria', 'Estoque de Produtos', 'Financeiro Empresarial']
    },
    {
      id: 'production',
      name: 'Módulo Produção',
      description: isProductionPurchased
        ? 'Controle de fábrica, insumos, ficha técnica e PCP.'
        : `Controle de fábrica, insumos, ficha técnica e PCP. É um complemento pago do Módulo Vendas — teste grátis por ${PRODUCTION_TRIAL_DAYS} dias antes de decidir adquirir.`,
      icon: <Factory size={28} />,
      active: config.production,
      disabled: !config.sales || (isProductionTrialExpired && !isProductionPurchased),
      lockLabel: !config.sales ? 'Requer Vendas' : 'Teste Expirado',
      trialEndsAt: isProductionTrialActive ? trialEndsAt! : undefined,
      color: 'bg-indigo-600',
      features: ['Engenharia de Produto', 'Estoque de Insumos', 'Controle de PCP', 'Necessidade de Compras']
    },
    // Assistente de IA ainda não é oferecido pra contas normais (só consultas de leitura, sem
    // cadastro/edição — ver diagnóstico feito com o usuário) — o card só aparece pra conta de
    // desenvolvimento, pra não anunciar uma função que contas novas não podem usar.
    ...(isTemplateAdmin() ? [{
      id: 'ai',
      name: 'Módulo Assistente de IA',
      description: 'Assistente inteligente no cabeçalho e no Dashboard, com prompts rápidos e consultas ao seu negócio.',
      icon: <Sparkles size={28} />,
      active: config.ai,
      color: 'bg-violet-600',
      features: ['Perguntas sobre o Negócio', 'Prompts Rápidos', 'Relatórios sob Demanda']
    }] : []),
    {
      id: 'entregas',
      name: 'Módulo Entregas',
      description: 'Roteirização de entregas com mapa, prioridade e navegação.',
      icon: <Truck size={28} />,
      active: config.entregas,
      disabled: !config.sales,
      color: 'bg-teal-600',
      features: ['Mapa e Geocodificação', 'Rotas Otimizadas', 'Navegação Google/Apple Maps']
    },
    // Bling agora é exclusivo da conta de desenvolvimento (mesmo motivo/mesmo padrão do card de
    // IA acima) — App.tsx força config.bling de volta pra false pra qualquer conta que não seja
    // isTemplateAdmin(), então nem faz sentido anunciar o card pra quem não pode manter ligado.
    ...(isTemplateAdmin() ? [{
      id: 'bling',
      name: 'Módulo Bling',
      description: 'Integração com o ERP Bling — vinculação de produtos e emissão de notas fiscais.',
      icon: <Building2 size={28} />,
      active: config.bling,
      disabled: !config.sales,
      color: 'bg-green-700',
      features: ['Vinculação de Produtos', 'Pedidos de Marketplaces', 'Emissão de NF-e']
    }] : []),
    {
      id: 'rh',
      name: 'Módulo RH',
      description: 'Cadastro de colaboradores, permissões de acesso e folha de pagamento.',
      icon: <UserCog size={28} />,
      active: config.rh,
      disabled: !config.sales,
      color: 'bg-fuchsia-600',
      features: ['Colaboradores', 'Permissões por Setor', 'Folha de Pagamento']
    }
  ];

  const shortcuts = [
    { label: 'Organizar Dashboard', icon: <Layout size={20} />, view: ViewType.DASHBOARD_CONFIG, module: 'any' },
    { label: 'Ajustes Técnicos', icon: <Database size={20} />, view: ViewType.BACKUP, module: 'any' },
    { label: 'Gerenciar Contas', icon: <Wallet size={20} />, view: ViewType.ACCOUNTS, module: 'sales' },
    { label: 'Relatórios', icon: <BarChart3 size={20} />, view: ViewType.REPORTS, module: 'sales' },
    { label: 'Config. Produção', icon: <Settings size={20} />, view: ViewType.PRODUCTION_CONFIG, module: 'production' },
    { label: 'Config. Entregas', icon: <Truck size={20} />, view: ViewType.DELIVERY_CONFIG, module: 'entregas' },
    { label: 'Conexão Bling', icon: <Building2 size={20} />, view: ViewType.BLING_CONNECTION, module: 'bling' },
    { label: 'Estoque Central', icon: <Boxes size={20} />, view: ViewType.STOCK, module: 'sales' },
    { label: 'Finanças Pessoais', icon: <Users size={20} />, view: ViewType.PERSONAL_FINANCIAL, module: 'personal' },
    { label: 'RH', icon: <UserCog size={20} />, view: ViewType.RH_MENU, module: 'rh' },
  ];

  return (
    <div className="flex flex-col gap-8 pb-10 max-w-4xl mx-auto">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            <Shield size={24} />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Central de Módulos</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed italic">
          Configure quais áreas do sistema estarão ativas. O programa se adapta automaticamente para ocultar o que você não usa.
        </p>
      </header>

      {/* Module Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {modules.map((module) => (
          <button
            key={module.id}
            onClick={() => toggleModule(module.id as ToggleableModule)}
            disabled={module.disabled}
            className={`relative flex flex-col text-left p-6 rounded-[2.5rem] border-2 transition-all duration-300 group ${
              module.active 
                ? (isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-xl shadow-slate-200/50') 
                : (isDarkMode ? 'bg-slate-950 border-slate-900 opacity-60' : 'bg-slate-50 border-slate-100 opacity-60')
            } ${module.disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:border-indigo-500/30'}`}
          >
            <div className={`w-14 h-14 rounded-2xl ${module.active ? module.color : 'bg-slate-200 dark:bg-slate-800'} text-white flex items-center justify-center mb-6 shadow-lg transition-transform group-hover:scale-110`}>
              {module.icon}
            </div>
            
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-lg font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{module.name}</h3>
              {module.active ? (
                <CheckCircle2 className="text-indigo-500" size={20} />
              ) : (
                <Circle className="text-slate-300" size={20} />
              )}
            </div>

            {'trialEndsAt' in module && module.trialEndsAt && (
              <TrialCountdownBadge endsAt={module.trialEndsAt} isDarkMode={isDarkMode} />
            )}

            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed mb-6 flex-1">
              {module.description}
            </p>

            <div className="flex flex-wrap gap-1.5 mt-auto">
              {module.features.map((feature, i) => (
                <span key={i} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {feature}
                </span>
              ))}
            </div>

            {module.disabled && (
              <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px] rounded-[2.5rem] flex items-center justify-center">
                <div className="bg-slate-900/90 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Lock size={12} /> {'lockLabel' in module && module.lockLabel ? module.lockLabel : 'Requer Vendas'}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Shortcuts Central */}
      <section className="flex flex-col gap-4 mt-4">
        <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Atalhos Rápidos</h3>
        <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-[2.5rem] border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          {shortcuts.map((shortcut, idx) => {
            // Bling/RH exigem Vendas ligado (ver toggleModule acima) — checado de novo aqui
            // pra contas antigas que ficaram com Bling/RH ligados sem Vendas, de antes dessa
            // regra existir.
            const requiresSales = shortcut.module === 'bling' || shortcut.module === 'rh';
            const isVisible = shortcut.module === 'any' || (config[shortcut.module as keyof AppModulesConfig] && (!requiresSales || config.sales));
            if (!isVisible) return null;
            
            return (
              <button
                key={idx}
                onClick={() => onNavigate(shortcut.view)}
                className={`flex items-center gap-3 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700`}
              >
                <div className="text-indigo-600 dark:text-indigo-400">
                  {shortcut.icon}
                </div>
                <div className="text-left">
                  <p className={`text-[11px] font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {shortcut.label}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className={`p-8 rounded-[3rem] border-2 border-dashed ${isDarkMode ? 'border-slate-800' : 'border-slate-100'} text-center`}>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Configuração do Sistema</p>
        <p className="text-xs text-slate-400 font-medium italic max-w-md mx-auto leading-relaxed">
          As alterações feitas aqui são aplicadas instantaneamente e sincronizadas com sua conta em todos os dispositivos.
        </p>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={pendingModule ? "Confirmar" : "OK"}
        cancelLabel={pendingModule ? "Cancelar" : undefined}
        onConfirm={pendingModule ? confirmToggle : () => setIsConfirmOpen(false)}
        onCancel={() => setIsConfirmOpen(false)}
        isDanger={!!pendingModule}
      />
    </div>
  );
}
