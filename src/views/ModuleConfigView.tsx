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
  Store,
  Truck
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { AppModulesConfig, ViewType } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';

interface ModuleConfigViewProps {
  config: AppModulesConfig;
  onSave: (config: AppModulesConfig) => void;
  onNavigate: (view: ViewType) => void;
  isDarkMode: boolean;
}

export default function ModuleConfigView({ config, onSave, onNavigate, isDarkMode }: ModuleConfigViewProps) {
  
  const [pendingModule, setPendingModule] = useState<keyof AppModulesConfig | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");

  const toggleModule = (module: keyof AppModulesConfig) => {
    const isActivating = !config[module];
    
    if (isActivating) {
      if (module === 'production' && !config.sales) {
        setConfirmTitle("Requisito Necessário");
        setConfirmMessage("O Módulo de Produção requer que o Módulo de Vendas esteja ativo para funcionar corretamente.");
        setPendingModule(null);
        setIsConfirmOpen(true);
        return;
      }
      if (module === 'entregas' && !config.sales) {
        setConfirmTitle("Requisito Necessário");
        setConfirmMessage("O Módulo de Entregas requer que o Módulo de Vendas esteja ativo para funcionar corretamente.");
        setPendingModule(null);
        setIsConfirmOpen(true);
        return;
      }
      if (module === 'marketplace') {
        setConfirmTitle("Atualização Futura");
        setConfirmMessage("O Módulo Marketplace está em atualização e será liberado em uma versão futura.");
        setPendingModule(null);
        setIsConfirmOpen(true);
        return;
      }

      // Activation is usually safe
      const newConfig = { ...config };
      newConfig[module] = true;
      onSave(newConfig);
    } else {
      // Deactivation requires warning
      setPendingModule(module);
      if (module === 'sales' && (config.production || config.marketplace || config.entregas)) {
        const dependents = [config.production && 'Produção', config.marketplace && 'Marketplace', config.entregas && 'Entregas'].filter(Boolean).join(' e ');
        setConfirmTitle("Desativar Vendas");
        setConfirmMessage(`Ao desativar o Módulo de Vendas, o Módulo de ${dependents} também será desativado automaticamente. Deseja continuar?`);
      } else {
        const moduleName = module === 'personal' ? 'Pessoal' : module === 'sales' ? 'Vendas' : module === 'production' ? 'Produção' : module === 'entregas' ? 'Entregas' : 'Marketplace';
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
    if (pendingModule === 'sales') {
      newConfig.sales = false;
      newConfig.production = false;
      newConfig.marketplace = false;
      newConfig.entregas = false;
    } else {
      newConfig[pendingModule] = false;
    }

    onSave(newConfig);
    setIsConfirmOpen(false);
    setPendingModule(null);
  };

  const modules = [
    {
      id: 'personal',
      name: 'Módulo Pessoal',
      description: 'Finanças pessoais, família e contatos privados.',
      icon: <Users size={28} />,
      active: config.personal,
      color: 'bg-amber-500',
      features: ['Financeiro Pessoal', 'Membros da Família', 'Categorias Pessoais']
    },
    {
      id: 'sales',
      name: 'Módulo Vendas',
      description: 'Gestão comercial, estoque de produtos, compras e vendas.',
      icon: <ShoppingBag size={28} />,
      active: config.sales,
      color: 'bg-emerald-500',
      features: ['Vendas e Orçamentos', 'Compras de Mercadoria', 'Estoque de Produtos', 'Financeiro Empresarial']
    },
    {
      id: 'production',
      name: 'Módulo Produção',
      description: 'Controle de fábrica, insumos, ficha técnica e PCP.',
      icon: <Factory size={28} />,
      active: config.production,
      disabled: !config.sales,
      color: 'bg-indigo-600',
      features: ['Engenharia de Produto', 'Estoque de Insumos', 'Controle de PCP', 'Necessidade de Compras']
    },
    {
      id: 'marketplace',
      name: 'Módulo Marketplace',
      description: 'Integração com plataformas externas (Shopee) — pedidos e estoque.',
      icon: <Store size={28} />,
      active: config.marketplace,
      disabled: !config.marketplace,
      locked: true,
      color: 'bg-orange-500',
      features: ['Pedidos Shopee', 'Sincronização de Estoque', 'Devoluções']
    },
    {
      id: 'entregas',
      name: 'Módulo Entregas',
      description: 'Roteirização de entregas com mapa, prioridade e navegação.',
      icon: <Truck size={28} />,
      active: config.entregas,
      disabled: !config.sales,
      color: 'bg-teal-600',
      features: ['Mapa e Geocodificação', 'Rotas Otimizadas', 'Navegação Google/Apple Maps']
    }
  ];

  const shortcuts = [
    { label: 'Organizar Dashboard', icon: <Layout size={20} />, view: ViewType.DASHBOARD_CONFIG, module: 'any' },
    { label: 'Ajustes Técnicos', icon: <Database size={20} />, view: ViewType.BACKUP, module: 'any' },
    { label: 'Gerenciar Contas', icon: <Wallet size={20} />, view: ViewType.ACCOUNTS, module: 'sales' },
    { label: 'Relatórios', icon: <BarChart3 size={20} />, view: ViewType.REPORTS, module: 'sales' },
    { label: 'Config. Produção', icon: <Settings size={20} />, view: ViewType.PRODUCTION_CONFIG, module: 'production' },
    { label: 'Config. Marketplace', icon: <Store size={20} />, view: ViewType.MARKETPLACE_CONNECTION, module: 'marketplace' },
    { label: 'Config. Entregas', icon: <Truck size={20} />, view: ViewType.DELIVERY_CONFIG, module: 'entregas' },
    { label: 'Estoque Central', icon: <Boxes size={20} />, view: ViewType.STOCK, module: 'sales' },
    { label: 'Finanças Pessoais', icon: <Users size={20} />, view: ViewType.PERSONAL_FINANCIAL, module: 'personal' },
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
            onClick={() => toggleModule(module.id as keyof AppModulesConfig)}
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
                  <Lock size={12} /> {module.locked ? 'Atualização Futura' : 'Requer Vendas'}
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
            const isVisible = shortcut.module === 'any' || config[shortcut.module as keyof AppModulesConfig];
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
