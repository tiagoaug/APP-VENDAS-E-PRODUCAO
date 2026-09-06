import { Reorder, useDragControls } from 'motion/react';
import {
  X, ShoppingCart, ShoppingBag, Factory, Building2, Truck, DollarSign, User as UserIcon, UserCog,
  Eye, EyeOff, ChevronUp, ChevronDown, LayoutDashboard, Settings, GripVertical,
  GanttChartSquare, Boxes, Users, BarChart3, Footprints, Database, AlertTriangle, Calculator, Printer,
  Inbox, Link2, Handshake,
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

type NavCandidate = { id: BottomNavItemId; label: string; icon: React.ReactNode; requiredModule: keyof AppModulesConfig; requiredModuleLabel: string };

const CANDIDATES: NavCandidate[] = [
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
  { id: 'purchaseNeeds', label: 'Necessidades', icon: <AlertTriangle size={18} />, requiredModule: 'production', requiredModuleLabel: 'Produção' },
  { id: 'ruleOfThree', label: 'Regra de Três', icon: <Calculator size={18} />, requiredModule: 'sales', requiredModuleLabel: 'Vendas' },
  { id: 'labelPrintStudio', label: 'Ajustes de PDF e JPG', icon: <Printer size={18} />, requiredModule: 'production', requiredModuleLabel: 'Produção' },
  { id: 'catalogRequests', label: 'Pedidos de Catálogo', icon: <Inbox size={18} />, requiredModule: 'sales', requiredModuleLabel: 'Vendas' },
  { id: 'sendCatalog', label: 'Enviar Catálogo', icon: <Link2 size={18} />, requiredModule: 'sales', requiredModuleLabel: 'Vendas' },
  { id: 'fornecedores', label: 'Fornecedores', icon: <Handshake size={18} />, requiredModule: 'production', requiredModuleLabel: 'Produção' },
];

interface NavRowProps {
  item: NavCandidate;
  index: number;
  total: number;
  isHidden: boolean;
  isDarkMode: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  onToggleHidden: (id: BottomNavItemId) => void;
}

// Item arrastável — useDragControls precisa viver num componente próprio por linha (não dá pra
// chamar o hook direto dentro do .map do pai), mesmo padrão já usado em DashboardConfigView e
// DeliveryRouteBuilderView/DeliveryRouteDetailView (Reorder.Item + alça própria via onPointerDown,
// já testado em touch Android — nada de drag nativo HTML5, que não funciona em toque).
function NavRow({ item, index, total, isHidden, isDarkMode, onMove, onToggleHidden }: NavRowProps) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${isHidden ? 'opacity-50' : ''} ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-100'}`}
    >
      <div
        onPointerDown={(e) => { e.preventDefault(); controls.start(e); }}
        className="p-1.5 -ml-1.5 rounded-lg cursor-grab active:cursor-grabbing select-none touch-none shrink-0"
        title="Arrastar para reordenar"
        aria-label={`Arrastar ${item.label} para reordenar`}
      >
        <GripVertical size={16} className="text-slate-300 dark:text-slate-600" />
      </div>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-600 shadow-sm'}`}>
        {item.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.label}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onMove(index, -1)}
          disabled={index === 0}
          title="Mover pra cima"
          aria-label={`Mover ${item.label} pra cima`}
          className={`p-1.5 rounded-lg transition-all disabled:opacity-30 ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-400 shadow-sm'}`}
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1}
          title="Mover pra baixo"
          aria-label={`Mover ${item.label} pra baixo`}
          className={`p-1.5 rounded-lg transition-all disabled:opacity-30 ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-400 shadow-sm'}`}
        >
          <ChevronDown size={14} />
        </button>
        <button
          type="button"
          onClick={() => onToggleHidden(item.id)}
          title={isHidden ? 'Mostrar na barra' : 'Esconder da barra'}
          aria-label={isHidden ? `Mostrar ${item.label} na barra` : `Esconder ${item.label} da barra`}
          className={`p-1.5 rounded-lg transition-all ${isHidden ? (isDarkMode ? 'bg-slate-900 text-slate-500' : 'bg-white text-slate-300 shadow-sm') : 'bg-indigo-600 text-white'}`}
        >
          {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </Reorder.Item>
  );
}

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

  // Itens cujo módulo requerido está desativado nem aparecem aqui pra reordenar/esconder —
  // não tem o que configurar pra algo que não pode ser usado. As posições deles em
  // config.order ficam intactas (mergeOrder), só a ordem dos visíveis muda.
  // Bling e RH também dependem de Vendas estar ativo (mesma regra do ModuleConfigView) — não
  // fazem sentido soltos junto do módulo Pessoal, por exemplo.
  const visibleItems = items.filter(item =>
    modulesConfig[item.requiredModule] &&
    ((item.requiredModule !== 'bling' && item.requiredModule !== 'rh') || modulesConfig.sales)
  );
  const visibleIds = visibleItems.map(i => i.id);

  const mergeOrder = (newVisibleOrder: BottomNavItemId[]): BottomNavItemId[] => {
    const visibleSet = new Set(visibleIds);
    let vIdx = 0;
    return orderedIds.map(id => visibleSet.has(id) ? newVisibleOrder[vIdx++] : id);
  };

  const toggleHidden = (id: BottomNavItemId) => {
    const isHidden = config.hidden.includes(id);
    onSave({
      ...config,
      hidden: isHidden ? config.hidden.filter(h => h !== id) : [...config.hidden, id],
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= visibleIds.length) return;
    const newVisibleOrder = [...visibleIds];
    [newVisibleOrder[index], newVisibleOrder[targetIndex]] = [newVisibleOrder[targetIndex], newVisibleOrder[index]];
    onSave({ ...config, order: mergeOrder(newVisibleOrder) });
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
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Arraste pela alça ou use as setas pra reordenar</p>
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

        <Reorder.Group
          axis="y"
          values={visibleItems}
          onReorder={(newOrder) => onSave({ ...config, order: mergeOrder(newOrder.map(i => i.id)) })}
          className="flex-1 overflow-y-auto px-6 pb-6 space-y-2 custom-scrollbar"
        >
          {visibleItems.map((item, index) => (
            <NavRow
              key={item.id}
              item={item}
              index={index}
              total={visibleItems.length}
              isHidden={config.hidden.includes(item.id)}
              isDarkMode={isDarkMode}
              onMove={move}
              onToggleHidden={toggleHidden}
            />
          ))}
        </Reorder.Group>

        <div className="p-6 pt-2 shrink-0">
          <p className="text-[9px] font-bold text-slate-400 text-center italic">
            As alterações salvam na hora e sincronizam em todos os dispositivos.
          </p>
        </div>
      </div>
    </div>
  );
}
