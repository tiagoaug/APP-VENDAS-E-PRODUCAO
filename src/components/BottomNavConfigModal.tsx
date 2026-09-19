import { Reorder, useDragControls } from 'motion/react';
import {
  X, ShoppingCart, ShoppingBag, Factory, Building2, Truck, DollarSign, User as UserIcon, UserCog,
  Eye, EyeOff, ChevronUp, ChevronDown, LayoutDashboard, Settings, GripVertical, Pin, PinOff,
  GanttChartSquare, Boxes, Users, BarChart3, Footprints, Database, AlertTriangle, Calculator, Printer,
  Inbox, Link2, Handshake, Package, CreditCard, ScanText, Sparkles, Scissors,
  PackagePlus, Layout, SlidersHorizontal, Wand2,
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

type NavCandidate = { id: BottomNavItemId; label: string; icon: React.ReactNode; requiredModule: keyof AppModulesConfig | 'any'; requiredModuleLabel: string };

const CANDIDATES: NavCandidate[] = [
  { id: 'purchases', label: 'Compras', icon: <ShoppingCart size={18} />, requiredModule: 'sales', requiredModuleLabel: 'Vendas' },
  { id: 'sales', label: 'Vendas', icon: <ShoppingBag size={18} />, requiredModule: 'sales', requiredModuleLabel: 'Vendas' },
  { id: 'management', label: 'Gerenciamento', icon: <PackagePlus size={18} />, requiredModule: 'sales', requiredModuleLabel: 'Vendas' },
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
  { id: 'fornecedores', label: 'Prestadores Terceirizados', icon: <Handshake size={18} />, requiredModule: 'production', requiredModuleLabel: 'Produção' },
  { id: 'products', label: 'Produtos Cadastrados', icon: <Package size={18} />, requiredModule: 'sales', requiredModuleLabel: 'Vendas' },
  { id: 'paymentMethods', label: 'Meios de Recebimento', icon: <CreditCard size={18} />, requiredModule: 'sales', requiredModuleLabel: 'Vendas' },
  { id: 'ocr', label: 'Extrator de Texto (OCR)', icon: <ScanText size={18} />, requiredModule: 'any', requiredModuleLabel: 'Qualquer' },
  { id: 'aiAssistant', label: 'Assistente de IA', icon: <Sparkles size={18} />, requiredModule: 'ai', requiredModuleLabel: 'IA' },
  { id: 'cuttingKnives', label: 'Facas de Corte', icon: <Scissors size={18} />, requiredModule: 'production', requiredModuleLabel: 'Produção' },
  { id: 'dashboardConfig', label: 'Organizar Dashboard', icon: <Layout size={18} />, requiredModule: 'any', requiredModuleLabel: 'Qualquer' },
  { id: 'accessibility', label: 'Acessibilidade e Personalização', icon: <SlidersHorizontal size={18} />, requiredModule: 'any', requiredModuleLabel: 'Qualquer' },
  { id: 'visualSetup', label: 'Assistente de Personalização Visual', icon: <Wand2 size={18} />, requiredModule: 'any', requiredModuleLabel: 'Qualquer' },
];

interface NavRowProps {
  item: NavCandidate;
  index: number;
  total: number;
  isHidden: boolean;
  isPinned: boolean;
  isDarkMode: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  onToggleHidden: (id: BottomNavItemId) => void;
  onTogglePinned: (id: BottomNavItemId) => void;
}

// Item arrastável — useDragControls precisa viver num componente próprio por linha (não dá pra
// chamar o hook direto dentro do .map do pai), mesmo padrão já usado em DashboardConfigView e
// DeliveryRouteBuilderView/DeliveryRouteDetailView (Reorder.Item + alça própria via onPointerDown,
// já testado em touch Android — nada de drag nativo HTML5, que não funciona em toque).
function NavRow({ item, index, total, isHidden, isPinned, isDarkMode, onMove, onToggleHidden, onTogglePinned }: NavRowProps) {
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
        {!isHidden && (
          <button
            type="button"
            onClick={() => onTogglePinned(item.id)}
            title={isPinned ? 'Fixo na barra — tocar pra deixar só na expansão' : 'Só aparece expandindo — tocar pra fixar na barra'}
            aria-label={isPinned ? `Desafixar ${item.label} da barra` : `Fixar ${item.label} na barra`}
            className={`p-1.5 rounded-lg transition-all ${isPinned ? 'bg-amber-500 text-white' : (isDarkMode ? 'bg-slate-900 text-slate-500' : 'bg-white text-slate-300 shadow-sm')}`}
          >
            {isPinned ? <Pin size={14} /> : <PinOff size={14} />}
          </button>
        )}
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
    (item.requiredModule === 'any' || modulesConfig[item.requiredModule]) &&
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

  // Sem nada fixado ainda (conta que nunca abriu essa tela), assume os primeiros visíveis como
  // fixos — mesmo padrão automático usado em App.tsx enquanto `pinned` não existir/estiver vazio,
  // só que aqui precisa de um número concreto pra já mostrar o estado real na tela (usa 6, que é
  // o tamanho de página típico da barra: 3 colunas x 2 linhas).
  const pinnedIds = new Set(config.pinned && config.pinned.length > 0 ? config.pinned : visibleIds.slice(0, 6));

  // Pra pré-visualização — segue a MESMA ordem/lista que aparece na barra real (visibleItems,
  // já na ordem configurada), só separada em fixado vs. resto.
  const previewPinnedItems = visibleItems.filter(item => pinnedIds.has(item.id));
  const previewExpandableItems = visibleItems.filter(item => !pinnedIds.has(item.id));

  const togglePinned = (id: BottomNavItemId) => {
    const current = config.pinned && config.pinned.length > 0 ? config.pinned : visibleIds.slice(0, 6);
    const isPinned = current.includes(id);
    onSave({
      ...config,
      pinned: isPinned ? current.filter(p => p !== id) : [...current, id],
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

        <div className="px-6 pb-3 shrink-0 flex flex-col gap-2">
          <div className={`flex items-center gap-2 p-3 rounded-2xl border text-[9px] font-bold uppercase tracking-widest ${isDarkMode ? 'bg-slate-800/50 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
            <LayoutDashboard size={14} className="shrink-0" />
            Home fica sempre primeiro
            <span className="mx-1">·</span>
            <Settings size={14} className="shrink-0" />
            Mais fica sempre por último
          </div>
          <div className={`flex items-center gap-2 p-3 rounded-2xl border text-[9px] font-bold uppercase tracking-widest ${isDarkMode ? 'bg-amber-900/20 border-amber-800/40 text-amber-300' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
            <Pin size={14} className="shrink-0" />
            Fixado aparece sempre na barra — o resto só ao expandir (seta pra cima)
          </div>

          {/* Pré-visualização — não é a barra de verdade (que ajusta colunas pela largura real
              da tela), só uma maquete pra dar uma ideia de como fica: fixados aparecem direto,
              o resto vira "+N ícones" que só aparecem expandindo. */}
          <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">Pré-visualização da barra</p>
            <div className={`flex items-stretch gap-1 p-1.5 rounded-[1.5rem] ${isDarkMode ? 'bg-slate-900' : 'bg-white shadow-sm'}`}>
              <div className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-2 rounded-xl bg-indigo-600 text-white shrink-0">
                <LayoutDashboard size={14} />
                <span className="text-[6px] font-black uppercase tracking-wide">Home</span>
              </div>
              <div className="flex-1 min-w-0 grid grid-cols-3 gap-0.5">
                {previewPinnedItems.length === 0 ? (
                  <div className="col-span-3 flex items-center justify-center text-center text-[7px] font-bold text-slate-400 uppercase tracking-wide py-2 px-1">
                    Nada fixado — tudo vai pra expansão
                  </div>
                ) : previewPinnedItems.map(item => (
                  <div key={item.id} className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {item.icon}
                    <span className="text-[6px] font-bold uppercase tracking-wide truncate max-w-full">{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-0.5 shrink-0 w-10">
                {previewExpandableItems.length > 0 && (
                  <div className={`flex-1 flex items-center justify-center rounded-full ${isDarkMode ? 'bg-white/10 text-indigo-400' : 'bg-black/5 text-indigo-600'}`}>
                    <ChevronUp size={12} strokeWidth={3} />
                  </div>
                )}
                <div className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl ${isDarkMode ? 'bg-white/10' : 'bg-black/5'}`}>
                  <Settings size={12} className={isDarkMode ? 'text-slate-300' : 'text-slate-600'} />
                  <span className={`text-[6px] font-black uppercase tracking-wide ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Mais</span>
                </div>
              </div>
            </div>
            {previewExpandableItems.length > 0 && (
              <p className="text-[7px] font-bold text-slate-400 mt-2 leading-relaxed">
                Ao expandir: {previewExpandableItems.map(i => i.label).join(', ')}
              </p>
            )}
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
              isPinned={pinnedIds.has(item.id)}
              isDarkMode={isDarkMode}
              onMove={move}
              onToggleHidden={toggleHidden}
              onTogglePinned={togglePinned}
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
