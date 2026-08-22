import { useEffect, useMemo, useState } from 'react';
import { HelpCircle, Search, ChevronRight, ArrowRight, Compass, PlayCircle, Hand, MousePointerClick } from 'lucide-react';
import { ViewType } from '../types';
import { HelpTopic } from '../data/helpKnowledgeBase';
import { getTopicForView, searchHelp } from '../utils/helpMatching';
import { JOURNEYS } from '../data/journeys';
import Modal from './Modal';

// Central de Ajuda — assistente local, offline e determinístico (sem LLM, sem rede).
// Não confundir com o "Assistente IA" (AIAssistantModal.tsx), que é outro recurso, na nuvem.
// Ver docs/AGENT_CONTEXT_REACT.md para o porquê da separação.

interface HelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  currentView: ViewType;
  currentViewTitle: string;
  productionEnabled: boolean;
  onNavigate: (view: ViewType) => void;
  // Inicia um tour guiado (spotlight) — ver GuidedTourOverlay.tsx / src/data/journeys.ts.
  onStartJourney: (journeyId: string) => void;
  // "Me guie" — modo de treinamento: toca sozinho o tour da tela atual e libera o "?"
  // arrastável (DraggableHelpPoint.tsx). Estado vive em App.tsx (localStorage).
  guideModeEnabled: boolean;
  onToggleGuideMode: () => void;
  // Modo do "?" arrastável — 1: soltar já mostra a explicação (toque de novo fecha). 2: soltar
  // só reposiciona, um toque separado mostra/fecha. Ver DraggableHelpPoint.tsx.
  helpPointMode: 1 | 2;
  onChangeHelpPointMode: (mode: 1 | 2) => void;
}

export default function HelpCenterModal({
  isOpen, onClose, isDarkMode, currentView, currentViewTitle, productionEnabled, onNavigate, onStartJourney,
  guideModeEnabled, onToggleGuideMode, helpPointMode, onChangeHelpPointMode,
}: HelpCenterModalProps) {
  const [query, setQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState<HelpTopic | null>(null);

  // Reabrir sempre volta pro tópico da tela atual, sem digitar nada — resposta imediata.
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveTopic(getTopicForView(currentView, productionEnabled) ?? null);
    }
  }, [isOpen, currentView, productionEnabled]);

  const results = useMemo(
    () => searchHelp(query, productionEnabled, currentView),
    [query, productionEnabled, currentView],
  );
  const isSearching = query.trim().length > 0;
  const hasAnyResult = results.topics.length > 0 || results.faq.length > 0;

  const goToTopic = (topic: HelpTopic) => {
    setActiveTopic(topic);
    setQuery('');
  };

  const cardCls = `rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-800 bg-slate-800/40' : 'border-slate-100 bg-slate-50'}`;
  const rowCls = `w-full flex items-center justify-between gap-2 px-4 py-3 text-left transition-colors ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Central de Ajuda" icon={<HelpCircle size={20} />} maxWidth="max-w-lg" zIndex={98000}>
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Buscar ajuda (ex.: "${currentViewTitle.toLowerCase()}")...`}
            className={`w-full pl-11 pr-4 py-3 rounded-2xl text-sm font-bold outline-none border-2 transition-colors ${isDarkMode ? 'bg-slate-800 border-transparent focus:border-indigo-500 text-white placeholder:text-slate-500' : 'bg-slate-50 border-transparent focus:border-indigo-500 text-slate-900 placeholder:text-slate-400'}`}
          />
        </div>

        <label className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl cursor-pointer ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
          <div className="min-w-0">
            <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Me guie</p>
            <p className={`text-[10px] font-bold mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Toca o tour da tela sozinho e libera o "?" arrastável pra explicar campos</p>
          </div>
          <div className="relative shrink-0">
            <input
              type="checkbox"
              className="sr-only"
              checked={guideModeEnabled}
              aria-label="Ativar Me guie"
              onChange={onToggleGuideMode}
            />
            <div className={`w-10 h-5 rounded-full transition-colors ${guideModeEnabled ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${guideModeEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </div>
        </label>

        {guideModeEnabled && (
          <div className={`flex flex-col gap-2 px-4 py-3 rounded-2xl ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Comportamento do "?"</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChangeHelpPointMode(1)}
                className={`p-2.5 rounded-xl border-2 text-left transition-all ${helpPointMode === 1 ? 'bg-indigo-600 border-indigo-600 text-white' : (isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600')}`}
              >
                <span className="flex items-center gap-1.5">
                  <Hand size={13} className="shrink-0" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Mostra ao soltar</span>
                </span>
                <span className={`text-[8px] font-bold block mt-0.5 ${helpPointMode === 1 ? 'text-indigo-100' : 'opacity-70'}`}>Toque de novo ou X fecha</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeHelpPointMode(2)}
                className={`p-2.5 rounded-xl border-2 text-left transition-all ${helpPointMode === 2 ? 'bg-indigo-600 border-indigo-600 text-white' : (isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600')}`}
              >
                <span className="flex items-center gap-1.5">
                  <MousePointerClick size={13} className="shrink-0" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Toque pra mostrar</span>
                </span>
                <span className={`text-[8px] font-bold block mt-0.5 ${helpPointMode === 2 ? 'text-indigo-100' : 'opacity-70'}`}>Arrastar só posiciona</span>
              </button>
            </div>
          </div>
        )}

        {isSearching ? (
          <div className="flex flex-col gap-4">
            {!hasAnyResult && (
              <p className={`text-xs font-bold italic text-center py-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Não encontrei isso na ajuda ainda. Veja os tópicos abaixo, ou toque no ícone de ajuda em outra tela.
              </p>
            )}

            {results.faq.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className={`text-[10px] font-black uppercase tracking-widest px-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Perguntas frequentes</span>
                {results.faq.map(f => (
                  <div key={f.id} className={cardCls}>
                    <p className={`px-4 pt-3 text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{f.question}</p>
                    <p className={`px-4 pb-3 pt-1 text-xs font-medium leading-relaxed whitespace-pre-line ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{f.answer}</p>
                    {f.linkView && (
                      <button
                        type="button"
                        onClick={() => { onNavigate(f.linkView!); onClose(); }}
                        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-indigo-500 border-t border-indigo-500/10 hover:bg-indigo-500/5 transition-colors"
                      >
                        Ir para a tela relacionada <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {results.topics.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className={`text-[10px] font-black uppercase tracking-widest px-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Telas relacionadas</span>
                <div className={cardCls}>
                  {results.topics.map((t, i) => (
                    <button key={t.view} type="button" onClick={() => goToTopic(t)} className={`${rowCls} ${i > 0 ? `border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}` : ''}`}>
                      <div className="min-w-0">
                        <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.title}</p>
                        <p className={`text-[10px] font-medium truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.summary}</p>
                      </div>
                      <ChevronRight size={15} className="text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {activeTopic ? (
              <div className={cardCls}>
                <div className={`px-4 py-3 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Nesta tela</span>
                  <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{activeTopic.title}</p>
                  <p className={`text-[11px] font-medium mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{activeTopic.summary}</p>
                </div>
                <div className="px-4 py-3 flex flex-col gap-3">
                  {activeTopic.sections.map(s => (
                    <div key={s.heading}>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{s.heading}</p>
                      <p className={`text-xs font-medium leading-relaxed whitespace-pre-line mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{s.body}</p>
                    </div>
                  ))}
                </div>
                {!!activeTopic.relatedViews?.length && (
                  <div className={`px-4 py-3 border-t flex flex-wrap gap-1.5 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    {activeTopic.relatedViews.map(v => {
                      const relatedTopic = getTopicForView(v, productionEnabled);
                      if (!relatedTopic) return null;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => goToTopic(relatedTopic)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'bg-slate-900 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-100'}`}
                        >
                          {relatedTopic.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p className={`text-xs font-bold italic text-center py-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Ainda não tenho um tópico específico pra esta tela — busque acima ou veja os assuntos abaixo.
              </p>
            )}

            {(() => {
              const journeys = JOURNEYS.filter(j => !j.productionOnly || productionEnabled);
              if (journeys.length === 0) return null;
              return (
                <div className="flex flex-col gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-1 flex items-center gap-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    <Compass size={12} /> Guias
                  </span>
                  <div className={cardCls}>
                    {journeys.map((j, i) => (
                      <div key={j.id} className={`${rowCls} ${i > 0 ? `border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}` : ''}`}>
                        <span className={`text-xs font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{j.title}</span>
                        <button
                          type="button"
                          onClick={() => onStartJourney(j.id)}
                          className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-500 shrink-0"
                        >
                          <PlayCircle size={13} /> Iniciar tour
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </Modal>
  );
}
