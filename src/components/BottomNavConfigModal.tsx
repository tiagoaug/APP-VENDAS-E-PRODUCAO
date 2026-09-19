import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  X, ShoppingCart, ShoppingBag, Factory, Building2, Truck, DollarSign, User as UserIcon, UserCog,
  Eye, EyeOff, LayoutDashboard, Settings, Pin, PinOff, Maximize2,
  GanttChartSquare, Boxes, Users, BarChart3, Footprints, Database, AlertTriangle, Calculator, Printer,
  Inbox, Link2, Handshake, Package, CreditCard, ScanText, Sparkles, Scissors,
  PackagePlus, Layout, SlidersHorizontal, Wand2, Smartphone,
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
  { id: 'headerSpace', label: 'Espaço no Topo', icon: <Smartphone size={18} />, requiredModule: 'any', requiredModuleLabel: 'Qualquer' },
];

interface NavRowProps {
  item: NavCandidate;
  isHidden: boolean;
  isPinned: boolean;
  isDarkMode: boolean;
  onToggleHidden: (id: BottomNavItemId) => void;
  onTogglePinned: (id: BottomNavItemId) => void;
  // Tile menor pra caber na fileira da barra fixa (junto de Home/Mais); a expansível usa o
  // tamanho normal, igual ao painel "Mais" de verdade.
  compact?: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  isDragging?: boolean;
  dragStyle?: React.CSSProperties;
}

// Tile de exibição — o arrasto de verdade é controlado pelo DraggableNavGrid (pai), que faz
// hit-test manual em pixels; motion.js `Reorder` foi trocado por isso porque seu algoritmo de
// reordenação só funciona bem em LISTA de eixo único, não numa grade com quebra de linha (o
// arrasto ficava "travado"/não reordenava direito ao mover entre linhas — reportado pelo
// Tiago). `layout` anima a realocação suave dos tiles parados; o tile sendo arrastado sai do
// fluxo da grade (position: fixed) e segue o dedo livremente, abrindo espaço onde estava.
function NavRow({ item, isHidden, isPinned, isDarkMode, onToggleHidden, onTogglePinned, compact, onPointerDown, isDragging, dragStyle }: NavRowProps) {
  return (
    <motion.div
      layout={!isDragging}
      data-item-id={item.id}
      onPointerDown={onPointerDown}
      style={dragStyle}
      className={`relative flex flex-col items-center gap-1 rounded-2xl border select-none touch-none ${isDragging ? 'cursor-grabbing shadow-2xl scale-105 z-50' : 'cursor-grab transition-colors'} ${compact ? 'p-1.5' : 'p-2.5'} ${isHidden ? 'opacity-40' : ''} ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-100'} ${isDragging ? (isDarkMode ? 'bg-slate-800' : 'bg-white') : ''}`}
    >
      {!isHidden && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onTogglePinned(item.id); }}
          title={isPinned ? 'Fixo na barra — tocar pra deixar só na expansão' : 'Só aparece expandindo — tocar pra fixar na barra'}
          aria-label={isPinned ? `Desafixar ${item.label} da barra` : `Fixar ${item.label} na barra`}
          className={`absolute -top-1.5 -left-1.5 z-10 w-5 h-5 rounded-full flex items-center justify-center shadow transition-all ${isPinned ? 'bg-amber-500 text-white' : (isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-white text-slate-400')}`}
        >
          {isPinned ? <Pin size={11} /> : <PinOff size={11} />}
        </button>
      )}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onToggleHidden(item.id); }}
        title={isHidden ? 'Mostrar na barra' : 'Esconder da barra'}
        aria-label={isHidden ? `Mostrar ${item.label} na barra` : `Esconder ${item.label} da barra`}
        className={`absolute -top-1.5 -right-1.5 z-10 w-5 h-5 rounded-full flex items-center justify-center shadow transition-all ${isHidden ? (isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-white text-slate-400') : 'bg-indigo-600 text-white'}`}
      >
        {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
      </button>
      <div className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-600 shadow-sm'}`}>
        {item.icon}
      </div>
      <p className={`text-[7px] font-black tracking-tight uppercase text-center leading-tight truncate max-w-full ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.label}</p>
    </motion.div>
  );
}

interface DraggableNavGridProps {
  items: NavCandidate[];
  onReorder: (newOrder: NavCandidate[]) => void;
  hidden: BottomNavItemId[];
  pinnedIds: Set<BottomNavItemId>;
  isDarkMode: boolean;
  onToggleHidden: (id: BottomNavItemId) => void;
  onTogglePinned: (id: BottomNavItemId) => void;
  compact?: boolean;
  className?: string;
}

// Grade com arrasto livre 2D de verdade: segura um ícone, arrasta pra qualquer posição da
// grade (não só cima/baixo) e ele troca de lugar com o que estiver por baixo do dedo,
// empurrando os outros e abrindo espaço — pedido explícito do Tiago depois que o Reorder do
// framer-motion se mostrou não confiável numa grade com quebra de linha. Hit-test manual via
// getBoundingClientRect de cada tile a cada pointermove; o tile arrastado vira position:fixed
// (sai do fluxo da grade, abrindo o buraco) e segue o dedo por transform; os outros usam
// `layout` do framer-motion pra deslizar suavemente pro novo lugar.
function DraggableNavGrid({ items, onReorder, hidden, pinnedIds, isDarkMode, onToggleHidden, onTogglePinned, compact, className }: DraggableNavGridProps) {
  const [order, setOrder] = useState(items);
  const orderRef = useRef(order);
  orderRef.current = order;
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<BottomNavItemId | null>(null);
  const draggingIdRef = useRef<BottomNavItemId | null>(null);
  const dragOriginRef = useRef({ left: 0, top: 0, width: 0, height: 0 });
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Só resincroniza com o pai quando NÃO tem arrasto em andamento (ver draggingIdRef) — evita
    // que um re-render por outro motivo (ex.: toggle de ocultar/fixar num outro tile) interrompa
    // um arrasto ativo nesta grade.
    if (!draggingIdRef.current) setOrder(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const handlePointerDown = (id: BottomNavItemId, e: React.PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const rect = target.getBoundingClientRect();
    dragOriginRef.current = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    draggingIdRef.current = id;
    setDraggingId(id);
    setDragDelta({ x: 0, y: 0 });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const dragId = draggingIdRef.current;
    if (!dragId) return;
    setDragDelta({ x: e.clientX - pointerStartRef.current.x, y: e.clientY - pointerStartRef.current.y });

    const nodes = containerRef.current?.querySelectorAll<HTMLElement>('[data-item-id]');
    if (!nodes) return;
    for (const node of nodes) {
      const targetId = node.getAttribute('data-item-id');
      if (!targetId || targetId === dragId) continue;
      const rect = node.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const current = orderRef.current;
        const fromIdx = current.findIndex(i => i.id === dragId);
        const toIdx = current.findIndex(i => i.id === targetId);
        if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
          const next = [...current];
          const [moved] = next.splice(fromIdx, 1);
          next.splice(toIdx, 0, moved);
          setOrder(next);
        }
        break;
      }
    }
  };

  const endDrag = () => {
    if (draggingIdRef.current) onReorder(orderRef.current);
    draggingIdRef.current = null;
    setDraggingId(null);
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={className}
    >
      {order.map(item => {
        const isDragging = draggingId === item.id;
        return (
          <NavRow
            key={item.id}
            item={item}
            compact={compact}
            isHidden={hidden.includes(item.id)}
            isPinned={pinnedIds.has(item.id)}
            isDarkMode={isDarkMode}
            onToggleHidden={onToggleHidden}
            onTogglePinned={onTogglePinned}
            onPointerDown={(e) => handlePointerDown(item.id, e)}
            isDragging={isDragging}
            dragStyle={isDragging ? {
              position: 'fixed',
              left: dragOriginRef.current.left + dragDelta.x,
              top: dragOriginRef.current.top + dragDelta.y,
              width: dragOriginRef.current.width,
              height: dragOriginRef.current.height,
            } : undefined}
          />
        );
      })}
    </div>
  );
}

// Personalização da barra de navegação — Home e Mais são fixos (não entram aqui, ver
// App.tsx middleNavItems), o resto o usuário pode esconder e reordenar. Mudanças salvam na hora
// (mesmo padrão do ModuleConfigView), sem botão de "Confirmar" separado.
export default function BottomNavConfigModal({ isOpen, onClose, config, onSave, modulesConfig, isDarkMode }: BottomNavConfigModalProps) {
  // Tela cheia — mais espaço pra arrastar os ícones sem ficar espremido numa silhueta de
  // celular pequena; precisa vir antes do `if (!isOpen) return null` pra não violar as regras
  // de hooks (senão o useState só é chamado condicionalmente).
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  const togglePinned = (id: BottomNavItemId) => {
    const current = config.pinned && config.pinned.length > 0 ? config.pinned : visibleIds.slice(0, 6);
    const isPinned = current.includes(id);
    onSave({
      ...config,
      pinned: isPinned ? current.filter(p => p !== id) : [...current, id],
    });
  };

  // Prévia dividida nas MESMAS duas zonas da barra de verdade (ver App.tsx <nav>): fixados
  // aparecem direto (junto de Home/Mais, que nunca entram aqui pra reordenar) e o resto só ao
  // expandir — Tiago pediu fidelidade visual a essa separação, em vez de uma grade única com
  // tudo junto. Cada zona reordena só entre si; fixar/ocultar (botão no ícone) que move um item
  // de uma zona pra outra.
  const pinnedItems = visibleItems.filter(item => pinnedIds.has(item.id));
  const expandableItems = visibleItems.filter(item => !pinnedIds.has(item.id));

  const mergeSubOrder = (subsetIds: Set<BottomNavItemId>, newSubOrder: BottomNavItemId[]): BottomNavItemId[] => {
    let idx = 0;
    return visibleIds.map(id => subsetIds.has(id) ? newSubOrder[idx++] : id);
  };
  const reorderPinned = (newOrder: NavCandidate[]) => {
    onSave({ ...config, order: mergeOrder(mergeSubOrder(pinnedIds, newOrder.map(i => i.id))) });
  };
  const reorderExpandable = (newOrder: NavCandidate[]) => {
    const expandableIds = new Set(expandableItems.map(i => i.id));
    onSave({ ...config, order: mergeOrder(mergeSubOrder(expandableIds, newOrder.map(i => i.id))) });
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 ${isFullscreen ? '' : 'p-4'}`} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-200 ${isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-lg max-h-[90vh] rounded-[2.5rem]'} ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
      >
        <div className="p-6 pb-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Personalizar Navegação</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Arraste os ícones pra posicionar — toque no olho/pin pra ocultar ou fixar</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsFullscreen(v => !v)}
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia — mais espaço pra arrastar'}
              aria-label={isFullscreen ? 'Sair da tela cheia' : 'Abrir em tela cheia'}
              className={`p-2 rounded-xl transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`}
            >
              {isFullscreen ? <X size={20} strokeWidth={2.5} /> : <Maximize2 size={20} strokeWidth={2.5} />}
            </button>
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
        </div>

        <div className="px-6 pb-3 shrink-0 flex flex-col gap-2">
          <div className={`flex items-center gap-2 p-3 rounded-2xl border text-[9px] font-bold uppercase tracking-widest ${isDarkMode ? 'bg-amber-900/20 border-amber-800/40 text-amber-300' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
            <Pin size={14} className="shrink-0" />
            Fixado aparece sempre na barra — o resto só ao expandir (seta pra cima)
          </div>
        </div>

        {/* Prévia interativa — celular representativo com as MESMAS duas camadas da barra de
            verdade: a barra fixa (Home + fixados + Mais) embaixo, e o painel expansível (o
            resto) acima dela, exatamente como aparece na tela real ao tocar na seta pra cima.
            Arrasta pra reposicionar dentro de cada camada, toca no olho/pin de cada ícone pra
            ocultar/fixar (o que move o item de uma camada pra outra). */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 min-h-0">
          <div className={`relative mx-auto rounded-[2.3rem] p-2.5 shadow-xl ${isFullscreen ? 'max-w-[420px]' : 'max-w-[290px]'} ${isDarkMode ? 'bg-slate-700' : 'bg-slate-900'}`}>
            <div className="absolute left-1/2 -translate-x-1/2 top-2 w-16 h-4 rounded-full bg-black z-10" />
            <div className={`relative rounded-[1.7rem] pt-8 px-3 pb-3 flex flex-col gap-3 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
              {/* Painel expansível — some antes de aparecer a barra fixa na tela real (a seta
                  pra cima "abre" ele por cima do conteúdo); aqui já fica sempre visível pra dar
                  pra editar. */}
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5 px-1">Painel expansível (seta pra cima)</p>
                <div className={`rounded-2xl p-2 shadow-sm ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                  {expandableItems.length === 0 ? (
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide text-center py-3">Tudo fixado — nada pra expandir</p>
                  ) : (
                    <DraggableNavGrid
                      items={expandableItems}
                      onReorder={reorderExpandable}
                      hidden={config.hidden}
                      pinnedIds={pinnedIds}
                      isDarkMode={isDarkMode}
                      onToggleHidden={toggleHidden}
                      onTogglePinned={togglePinned}
                      className="grid grid-cols-3 gap-2"
                    />
                  )}
                </div>
              </div>

              {/* Barra fixa — Home e Mais são fixos (não arrastam), só os fixados no meio
                  reordenam entre si. */}
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5 px-1">Barra fixa</p>
                <div className={`flex items-stretch gap-1.5 p-1.5 rounded-2xl ${isDarkMode ? 'bg-slate-900' : 'bg-white shadow-sm'}`}>
                  <div className="flex flex-col items-center justify-center gap-0.5 w-12 shrink-0 rounded-xl bg-indigo-600 text-white py-1.5">
                    <LayoutDashboard size={14} />
                    <span className="text-[6px] font-black uppercase tracking-wide">Home</span>
                  </div>
                  {pinnedItems.length === 0 ? (
                    <div className="flex-1 min-w-0 flex items-center justify-center text-center text-[7px] font-bold text-slate-400 uppercase tracking-wide px-1">
                      Nada fixado
                    </div>
                  ) : (
                    <DraggableNavGrid
                      items={pinnedItems}
                      onReorder={reorderPinned}
                      hidden={config.hidden}
                      pinnedIds={pinnedIds}
                      isDarkMode={isDarkMode}
                      onToggleHidden={toggleHidden}
                      onTogglePinned={togglePinned}
                      compact
                      className="flex-1 min-w-0 grid grid-cols-3 gap-1"
                    />
                  )}
                  <div className="flex flex-col items-center justify-center gap-0.5 w-12 shrink-0 rounded-xl bg-black/5 dark:bg-white/10 py-1.5">
                    <Settings size={14} className={isDarkMode ? 'text-slate-300' : 'text-slate-600'} />
                    <span className={`text-[6px] font-black uppercase tracking-wide ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Mais</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
