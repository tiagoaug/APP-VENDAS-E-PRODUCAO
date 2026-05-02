import { useState, useEffect } from 'react';
import { DashboardConfig, DashboardCardConfig } from '../types';
import { Layout, Eye, EyeOff, Save, CheckCircle2, ChevronLeft, GripVertical, RefreshCcw } from 'lucide-react';
import { motion, Reorder, AnimatePresence, useDragControls } from 'motion/react';

interface DashboardConfigViewProps {
  config: DashboardConfig;
  onSave: (config: DashboardConfig) => void;
  onBack: () => void;
  isDarkMode: boolean;
}

interface CardItemProps {
  card: DashboardCardConfig;
  isDarkMode: boolean;
  onToggleVisibility: (id: string) => void;
  key?: string | number;
}

function CardItem({ card, isDarkMode, onToggleVisibility }: CardItemProps) {
  const controls = useDragControls();

  return (
    <Reorder.Item 
      value={card}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`p-4 rounded-[1.8rem] border flex items-center justify-between transition-shadow ${
        !card.visible 
          ? (isDarkMode ? 'bg-slate-900/40 border-slate-800/50 opacity-60' : 'bg-slate-50/50 border-slate-100 opacity-60')
          : (isDarkMode ? 'bg-slate-900 border-slate-800 shadow-xl shadow-black/10' : 'bg-white border-slate-200 shadow-sm')
      }`}
    >
      <div className="flex items-center gap-4 flex-1">
        <div 
          onPointerDown={(e) => {
            e.preventDefault();
            controls.start(e);
          }}
          className={`p-3 rounded-xl cursor-grab active:cursor-grabbing transition-colors select-none touch-none ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'} text-slate-400`}
        >
          <GripVertical size={20} />
        </div>
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${card.visible ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <p className={`text-[11px] font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{card.label}</p>
          </div>
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 ml-4">
            ID: {card.id}
          </p>
        </div>
      </div>

      <button 
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility(card.id);
        }}
        className={`p-3 rounded-xl transition-all ${
          card.visible 
            ? (isDarkMode ? 'text-indigo-400 bg-indigo-500/10' : 'text-indigo-600 bg-indigo-50') 
            : (isDarkMode ? 'text-slate-600 bg-slate-800' : 'text-slate-300 bg-slate-100')
        }`}
        title={card.visible ? "Ocultar" : "Mostrar"}
      >
        {card.visible ? <Eye size={18} strokeWidth={2.5} /> : <EyeOff size={18} strokeWidth={2.5} />}
      </button>
    </Reorder.Item>
  );
}

export default function DashboardConfigView({ config, onSave, onBack, isDarkMode }: DashboardConfigViewProps) {
  const [localCards, setLocalCards] = useState<DashboardCardConfig[]>(
    [...config.cards].sort((a, b) => a.order - b.order)
  );
  const [isSaved, setIsSaved] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showReloadPrompt, setShowReloadPrompt] = useState(false);

  useEffect(() => {
    // Só reseta do config externo se:
    // 1. Não estivermos salvando
    // 2. Não houver alterações locais pendentes (isSaved === true)
    // 3. O conteúdo realmente for diferente
    const localContent = localCards.map(c => `${c.id}:${c.visible}`).sort().join('|');
    const incomingContent = config.cards.map(c => `${c.id}:${c.visible}`).sort().join('|');
    
    if (!isSaving && isSaved && localContent !== incomingContent) {
      setLocalCards([...config.cards].sort((a, b) => a.order - b.order));
    }
  }, [config, isSaving, isSaved, localCards]);

  const handleToggleVisibility = (id: string) => {
    setLocalCards(prev => prev.map(card => 
      card.id === id ? { ...card, visible: !card.visible } : card
    ));
    setIsSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Update order based on current list position
    const updatedCards = localCards.map((card, index) => ({ ...card, order: index }));
    await onSave({ cards: updatedCards });
    setIsSaved(true);
    setIsSaving(false);
    setShowReloadPrompt(true);
    // Remove the timeout that resets isSaved to false, so the "Salvo!" state persists until next change
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#fafafa] dark:bg-slate-950">
      {/* Fixed Header */}
      <div className={`px-4 pt-12 pb-4 border-b shrink-0 flex items-center justify-between ${isDarkMode ? 'bg-slate-950 border-slate-800/60' : 'bg-white border-slate-100 shadow-sm'}`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className={`p-2 rounded-xl transition-all ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}
            title="Voltar"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Layout</h2>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">Painel Principal</p>
          </div>
        </div>
        
        <button 
          onClick={handleSave}
          className={`${isSaved ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-indigo-600 shadow-indigo-500/20'} text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 active:scale-95`}
        >
          {isSaved ? (
            <><CheckCircle2 size={14} strokeWidth={3} /> Salvo!</>
          ) : (
            <><Save size={14} strokeWidth={3} /> Salvar</>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto force-scrollbar px-4 pt-6 pb-32 flex flex-col gap-6">

        <div className="mt-2">
          <div className={`p-5 rounded-[2rem] border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-indigo-50/30 border-indigo-100/50'} mb-6`}>
             <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
              Arraste os itens pelo ícone lateral para mudar a ordem. O corpo do cartão agora permite a rolagem da tela.
            </p>
          </div>

          <Reorder.Group 
            axis="y" 
            values={localCards} 
            onReorder={(newOrder) => {
              setLocalCards(newOrder);
              setIsSaved(false);
            }} 
            className="flex flex-col gap-3"
          >
            {localCards.map((card) => (
              <CardItem 
                key={card.id} 
                card={card} 
                isDarkMode={isDarkMode} 
                onToggleVisibility={handleToggleVisibility} 
              />
            ))}
          </Reorder.Group>
        </div>


      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 p-6 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-4"
      >
        <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center ${isDarkMode ? 'bg-slate-900 text-indigo-500' : 'bg-indigo-50 text-indigo-600'}`}>
          <Layout size={28} strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Configuração de Interface</p>
          <p className="text-[11px] text-slate-400 font-bold mt-2 leading-relaxed italic max-w-[240px]">
            Personalize sua experiência visual deixando apenas o essencial à vista.
          </p>
        </div>
      </motion.div>

      </div>

      <AnimatePresence>
        {showReloadPrompt && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-4 right-4 z-50"
          >
            <div className={`p-5 rounded-[2rem] shadow-2xl border flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-indigo-500/30' : 'bg-white border-indigo-100'}`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <RefreshCcw size={24} strokeWidth={2.5} className="animate-spin-slow" />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Atualização Necessária</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest leading-tight mt-0.5">Recarregue para aplicar todas as mudanças perfeitamente.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowReloadPrompt(false)}
                  className={`flex-1 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}
                >
                  Mais Tarde
                </button>
                <button 
                  onClick={handleReload}
                  className="flex-[2] py-3.5 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCcw size={14} strokeWidth={3} />
                  Recarregar Agora
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
