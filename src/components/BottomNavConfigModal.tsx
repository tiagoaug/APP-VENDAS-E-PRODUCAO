import {
  X, ShoppingCart, ShoppingBag, Factory, Building2, Truck, DollarSign, User as UserIcon, UserCog,
  Eye, EyeOff, ChevronUp, ChevronDown, LayoutDashboard, Settings, GripVertical,
  GanttChartSquare, Boxes, Users, BarChart3, Footprints, Database, ClipboardList, AlertTriangle,
} from 'lucide-react';
import { AppModulesConfig, BottomNavConfig, BottomNavItemId } from '../types';

interface BottomNavConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BottomNavConfig;
  onSave: (config: BottomNavConfig) => void;
  modulesConfig: AppModulesConfig;
  isDarkMode: boolean;
}

const CANDIDATES: { id: BottomNavItemId; label: string; icon: React.ReactNode; requiredModule: keyof AppModulesConfig; requiredModuleLabel: string }[] = [
  { id: 'purchases', label: 'Compras', icon: <ShoppingCart size={18} />, requiredModule: 'sales', requiredModuleLabel: 'Vendas' },
  { id: 'sales', label: 'Vendas', icon: <ShoppingBag size={18} />, requiredModule: 'sales', requiredModuleLabel: 'Vendas' },
  { id: 'production', label: 'Prod.', icon: <Factory size={18} />, requiredModule: 'production', requiredModuleLabel: 'Produção' },
  { id: 'bling', label: 'Bling', icon: <Building2 size={18} />, requiredModule: 'bling', requiredModuleLabel: 'Bling' },
  { id: 'entregas', label: 'Entregas', icon: <Truck size={18} />, requiredModule: 'entregas', requiredModuleLabel: 'Entregas' },
  { id: 'financial', label: 'Finan.', icon: <DollarSign size={18} />, requiredModule: 'sales', requiredModuleLabel: 'Vendas' },
  { id: 'personal', label: 'Pessoal', icon: <UserIcon size={18} />, requiredModule: 'personal', requiredModuleLabel: 'Pessoal' },
  { id: 'rh', label: 'RH', icon: <UserCog size={18} />, requiredModule: 'rh', requiredModuleLabel: 'RH' },
  { id: 'pcp', label: 'PCP', icon: <GanttChartSquare size={18} />, requiredModule: 'production', requiredModuleLabel: 'Produção' },
  { id: 'stock', label: 'Estoque', icon: <Boxes size={18} />, requiredModule: 'sales', requiredModuleLabel: 'Vendas' },
  { id: 'people', label: 'Pessoas', icon: <Users size={18} />, requiredModule: 'sales', requiredModuleLabel: 'Vendas' },
  { id: 'reports', label: 'Relatórios', icon: <BarChart3 size={18} />, requiredModule: 'sales', requiredModuleLabel: 'Vendas' },
  { id: 'soleStock', label: 'Solados', icon: <Footprints size={18} />, requiredModule: 'production', requiredModuleLabel: 'Produção' },
  { id: 'engineering', label: 'Engenharia', icon: <Database size={18} />, requiredModule: 'production', requiredModuleLabel: 'Produção' },
  { id: 'serviceOrder', label: 'OS', icon: <ClipboardList size={18} />, requiredModule: 'production', requiredModuleLabel: 'Produção' },
  { id: 'purchaseNeeds', label: 'Necessidades', icon: <AlertTriangle size={18} />, requiredModule: 'production', requiredModuleLabel: 'Produção' },
];

// Personalização da barra de navegação — Home e Mais são fixos (não entram aqui, ver
// App.tsx middleNavItems), o resto o usuário pode esconder e reordenar. Mudanças salvam na hora
// (mesmo padrão do ModuleConfigView), sem botão de "Confirmar" separado.
export default function BottomNavConfigModal({ isOpen, onClose, config, onSave, modulesConfig, isDarkMode }: BottomNavConfigModalProps) {
  if (!isOpen) return null;

  // Mesma lógica de ordenação usada em App.tsx (middleNavItems) — itens fora de `order` vão pro
  // fim, na ordem padrão de CANDIDATES, pra edição aqui bater com o que aparece na barra real.
  const orderedIds: BottomNavItemId[] = [];
  const seen = new Set<BottomNavItemId>();
  config.order.forEach(id => {
    if (CANDIDATES.some(c => c.id === id) && !seen.has(id)) { orderedIds.push(id); seen.add(id); }
  });
  CANDIDATES.forEach(c => { if (!seen.has(c.id)) { orderedIds.push(c.id); seen.add(c.id); } });

  const items = orderedIds.map(id => CANDIDATES.find(c => c.id === id)!);

  const toggleHidden = (id: BottomNavItemId) => {
    const isHidden = config.hidden.includes(id);
    onSave({
      ...config,
      hidden: isHidden ? config.hidden.filter(h => h !== id) : [...config.hidden, id],
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedIds.length) return;
    const newOrder = [...orderedIds];
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    onSave({ ...config, order: newOrder });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md max-h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-200 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
      >
        <div className="p-6 pb-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Personalizar Navegação</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Escolha e ordene os ícones da barra</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            aria-label="Fechar"
            className={`p-2 rounded-xl transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`}
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="px-6 pb-3 shrink-0">
          <div className={`flex items-center gap-2 p-3 rounded-2xl border text-[9px] font-bold uppercase tracking-widest ${isDarkMode ? 'bg-slate-800/50 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
            <LayoutDashboard size={14} className="shrink-0" />
            Home fica sempre primeiro
            <span className="mx-1">·</span>
            <Settings size={14} className="shrink-0" />
            Mais fica sempre por último
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2 custom-scrollbar">
          {items.map((item, index) => {
            const isHidden = config.hidden.includes(item.id);
            const moduleOff = !modulesConfig[item.requiredModule];
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${isHidden ? 'opacity-50' : ''} ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-100'}`}
              >
                <GripVertical size={14} className="text-slate-300 dark:text-slate-600 shrink-0" />
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-600 shadow-sm'}`}>
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.label}</p>
                  {moduleOff && (
                    <p className="text-[8px] font-bold text-amber-500 uppercase tracking-widest mt-0.5">Requer módulo {item.requiredModuleLabel} ativo</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    title="Mover pra cima"
                    aria-label={`Mover ${item.label} pra cima`}
                    className={`p-1.5 rounded-lg transition-all disabled:opacity-30 ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-400 shadow-sm'}`}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    title="Mover pra baixo"
                    aria-label={`Mover ${item.label} pra baixo`}
                    className={`p-1.5 rounded-lg transition-all disabled:opacity-30 ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-400 shadow-sm'}`}
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleHidden(item.id)}
                    title={isHidden ? 'Mostrar na barra' : 'Esconder da barra'}
                    aria-label={isHidden ? `Mostrar ${item.label} na barra` : `Esconder ${item.label} da barra`}
                    className={`p-1.5 rounded-lg transition-all ${isHidden ? (isDarkMode ? 'bg-slate-900 text-slate-500' : 'bg-white text-slate-300 shadow-sm') : 'bg-indigo-600 text-white'}`}
                  >
                    {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 pt-2 shrink-0">
          <p className="text-[9px] font-bold text-slate-400 text-center italic">
            As alterações salvam na hora e sincronizam em todos os dispositivos.
          </p>
        </div>
      </div>
    </div>
  );
}
