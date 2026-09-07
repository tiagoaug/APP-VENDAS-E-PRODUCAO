import { useState, useEffect } from 'react';
import { Bookmark, Layout, ShoppingBag, Factory, Tags, Check } from 'lucide-react';
import { ViewType, DashboardCardConfig } from '../types';
import { CardPreview } from './DashboardConfigView';

interface NewUserDefaultsViewProps {
  onNavigate: (view: ViewType, params?: Record<string, any>) => void;
  isDarkMode: boolean;
  allCards: DashboardCardConfig[];
  cardModuleOverrides: Record<string, string>;
  onSaveCardModuleOverrides: (overrides: Record<string, string>) => void | Promise<void>;
}

const MODULE_OPTIONS: { value: string; label: string }[] = [
  { value: 'sales', label: 'Vendas' },
  { value: 'production', label: 'Produção' },
  { value: 'sales_production', label: 'Ambos (Vendas e Produção)' },
  { value: 'personal', label: 'Pessoal' },
  { value: 'entregas', label: 'Entregas' },
  { value: 'bling', label: 'Bling' },
  { value: 'rh', label: 'RH' },
  { value: 'ai', label: 'IA' },
  { value: 'any', label: 'Qualquer' },
];

// Tela só da conta de desenvolvimento (ver isTemplateAdmin()/fabricananet@gmail.com) — ponto
// único pra reunir toda configuração "padrão" que uma conta nova herda ao ativar um módulo pela
// primeira vez, e também a correção do módulo de cada card (alguns nasceram marcados errado no
// código, ex.: um card de Produção marcado como Vendas). Futuras seções de "padrão pra conta
// nova" entram aqui do mesmo jeito, sem espalhar isso pelo resto de Configurações.
export default function NewUserDefaultsView({ onNavigate, isDarkMode, allCards, cardModuleOverrides, onSaveCardModuleOverrides }: NewUserDefaultsViewProps) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [isSaved, setIsSaved] = useState(true);

  useEffect(() => {
    setDraft(cardModuleOverrides);
  }, [cardModuleOverrides]);

  const effectiveModule = (card: DashboardCardConfig) => draft[card.id] ?? card.module ?? 'any';

  const handleChangeModule = (cardId: string, value: string) => {
    setDraft(prev => ({ ...prev, [cardId]: value }));
    setIsSaved(false);
  };

  const handleSave = async () => {
    await onSaveCardModuleOverrides(draft);
    setIsSaved(true);
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className={`p-5 rounded-2xl border flex items-start gap-4 ${isDarkMode ? 'bg-violet-900/10 border-violet-900/30' : 'bg-violet-50/50 border-violet-100'}`}>
        <Bookmark size={20} className="text-violet-500 mt-0.5 shrink-0" />
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-relaxed">
          Só você vê esta tela. Tudo aqui define o que <span className="text-violet-600 dark:text-violet-400 font-black">contas novas</span> recebem
          de largada — nunca muda quem já personalizou o próprio app.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-1">
          <Layout size={14} className="text-slate-400" />
          <h2 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Layout do Dashboard</h2>
        </div>

        <button
          onClick={() => onNavigate(ViewType.DASHBOARD_CONFIG, { editingDefaultProfile: 'sales' })}
          title="Editar padrão recomendado para Vendas"
          className={`p-5 rounded-3xl border shadow-sm flex items-center gap-4 text-left transition-all active:scale-[0.98] ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/50' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
        >
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
            <ShoppingBag size={20} />
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Padrão: Vendas</p>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Cards recomendados pra quem ativa Vendas</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate(ViewType.DASHBOARD_CONFIG, { editingDefaultProfile: 'production' })}
          title="Editar padrão recomendado para Produção"
          className={`p-5 rounded-3xl border shadow-sm flex items-center gap-4 text-left transition-all active:scale-[0.98] ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/50' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
        >
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
            <Factory size={20} />
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Padrão: Produção</p>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Cards recomendados pra quem ativa Produção</p>
          </div>
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Tags size={14} className="text-slate-400" />
            <h2 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Módulo de Cada Card</h2>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaved}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              isSaved
                ? (isDarkMode ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-300')
                : 'bg-indigo-600 text-white active:scale-95'
            }`}
          >
            <Check size={14} /> {isSaved ? 'Salvo' : 'Salvar'}
          </button>
        </div>
        <p className="text-[10px] font-bold text-slate-400 leading-relaxed px-1">
          Corrige em qual módulo cada card do Dashboard só pode aparecer — vale pra todas as contas do app, não só as novas.
        </p>

        <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
          {allCards.map((card, idx) => (
            <div
              key={card.id}
              className={`flex flex-col gap-2 p-4 ${idx > 0 ? (isDarkMode ? 'border-t border-slate-800' : 'border-t border-slate-50') : ''}`}
            >
              <div>
                <p className={`text-[11px] font-black uppercase tracking-tight leading-snug ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{card.label}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {card.id}</p>
              </div>
              <CardPreview id={card.id} isDarkMode={isDarkMode} mini={false} />
              <select
                value={effectiveModule(card)}
                onChange={(e) => handleChangeModule(card.id, e.target.value)}
                title={`Módulo de ${card.label}`}
                aria-label={`Módulo de ${card.label}`}
                className={`w-full text-[10px] font-black uppercase tracking-widest rounded-xl px-3 py-2.5 border outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
              >
                {MODULE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
