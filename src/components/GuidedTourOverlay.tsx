import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { ViewType } from '../types';
import { JourneyStep } from '../data/journeys';

// Motor genérico de tours guiados (spotlight) — ver docs/SPEC_ASSISTENTE_LOCAL.md seção 3-B e
// o plano em C:\Users\SISTEMAS-PC\.claude\plans\lazy-seeking-sun.md. Localiza o elemento alvo por
// atributo `data-guide-anchor="<anchorKey>"` (nenhuma outra tela precisa saber que existe um
// tour rodando) e mede a posição em runtime via getBoundingClientRect, nunca coordenada fixa.
//
// Bloqueio de toque: 4 divs cobrem a tela toda ao redor do recorte — não sobra nenhum elemento
// por cima do alvo real, então o clique chega 100% normal nele, sem pointer-events trick nenhum.
// O avanço de um passo `highlight_tap` acontece sozinho: um listener de clique em fase de
// captura no document detecta o toque no elemento do anchorKey da vez.
//
// `title`/`steps` recebidos soltos (não um `Journey` inteiro) porque este motor alimenta dois
// contextos diferentes: o tour avulso da Central de Ajuda (steps = Journey.steps) e o micro-guia
// de cada etapa da Configuração Inicial (steps = onboardingSteps[i].guideSteps).

interface GuidedTourOverlayProps {
  title: string;
  steps: JourneyStep[];
  stepIndex: number;
  currentView: ViewType;
  isDarkMode: boolean;
  onAdvance: () => void;
  onExit: () => void;
}

type Rect = { top: number; left: number; width: number; height: number };

const PADDING = 6;
const RADIUS = 16;

export default function GuidedTourOverlay({ title, steps, stepIndex, currentView, isDarkMode, onAdvance, onExit }: GuidedTourOverlayProps) {
  const step = steps[stepIndex];
  const isHighlight = step?.type === 'highlight_tap';
  const screenMatches = isHighlight && (!step.screen || step.screen === currentView);
  const [rect, setRect] = useState<Rect | null>(null);

  // Loop de medição — encontra o elemento pelo data-guide-anchor e acompanha sua posição/tamanho
  // enquanto o passo highlight_tap estiver ativo (reflow, scroll, resize, troca de tela).
  useEffect(() => {
    if (!isHighlight || !screenMatches) { setRect(null); return; }
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(`[data-guide-anchor="${step.anchorKey}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setRect(null);
      }
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [isHighlight, screenMatches, step]);

  // Avança sozinho quando o usuário toca no elemento real do anchorKey atual.
  useEffect(() => {
    if (!isHighlight || !screenMatches) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(`[data-guide-anchor="${step.anchorKey}"]`)) {
        onAdvance();
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHighlight, screenMatches, step, onAdvance]);

  if (!step) return null;

  const balloonCls = `pointer-events-auto max-w-xs rounded-2xl shadow-2xl border p-4 flex flex-col gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`;
  const textCls = `text-xs font-bold leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`;

  const header = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <Sparkles size={13} className="text-indigo-500 shrink-0" />
        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 truncate">{title}</span>
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">
        {stepIndex + 1}/{steps.length}
      </span>
    </div>
  );

  const exitButton = (
    <button
      type="button"
      onClick={onExit}
      className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-rose-500 ${isDarkMode ? 'hover:text-rose-400' : 'hover:text-rose-600'}`}
    >
      <X size={12} strokeWidth={3} /> Sair do tour
    </button>
  );

  // Passo "message": scrim cheio, balão centralizado, avanço manual via "Entendi".
  if (step.type === 'message') {
    return (
      <div data-tour-scrim="true" className="fixed inset-0 z-[99000] flex items-center justify-center p-6 bg-black/60 pointer-events-auto">
        <div className={balloonCls}>
          {header}
          <p className={textCls}>{step.text}</p>
          <div className="flex items-center justify-between gap-2 pt-1">
            {exitButton}
            <button
              type="button"
              onClick={onAdvance}
              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 transition-all active:scale-95"
            >
              Entendi
            </button>
          </div>
        </div>
      </div>
    );
  }

  // highlight_tap sem tela correspondente ainda (aguardando navegação) — nada desenhado.
  if (!screenMatches || !rect) return null;

  const top = rect.top - PADDING;
  const left = rect.left - PADDING;
  const width = rect.width + PADDING * 2;
  const height = rect.height + PADDING * 2;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const balloonBelow = top + height + 140 < vh;
  const balloonTop = balloonBelow ? Math.min(top + height + 12, vh - 20) : undefined;
  const balloonBottom = !balloonBelow ? Math.max(vh - top + 12, 20) : undefined;
  const balloonLeft = Math.min(Math.max(left, 12), Math.max(vw - 300, 12));

  return (
    <div className="fixed inset-0 z-[99000] pointer-events-none">
      {/* 4 blocos de scrim ao redor do recorte — nada cobre o alvo real. Marcados com
          data-tour-scrim pra o "?" arrastável (DraggableHelpPoint) saber ignorá-los no
          hit-test e enxergar o campo real por baixo, mesmo com um tour rodando ao mesmo tempo. */}
      <div data-tour-scrim="true" className="absolute bg-black/60 pointer-events-auto" style={{ top: 0, left: 0, right: 0, height: Math.max(top, 0) }} />
      <div data-tour-scrim="true" className="absolute bg-black/60 pointer-events-auto" style={{ top: top + height, left: 0, right: 0, bottom: 0 }} />
      <div data-tour-scrim="true" className="absolute bg-black/60 pointer-events-auto" style={{ top, left: 0, width: Math.max(left, 0), height }} />
      <div data-tour-scrim="true" className="absolute bg-black/60 pointer-events-auto" style={{ top, left: left + width, right: 0, height }} />

      {/* Anel pulsante — decorativo, não bloqueia o toque */}
      <motion.div
        key={step.anchorKey}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: [1, 1.03, 1] }}
        transition={{ scale: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } }}
        className="absolute pointer-events-none ring-4 ring-indigo-400"
        style={{ top, left, width, height, borderRadius: RADIUS }}
      />

      <div
        className={balloonCls}
        style={{ position: 'absolute', left: balloonLeft, top: balloonTop, bottom: balloonBottom }}
      >
        {header}
        <p className={textCls}>{step.text}</p>
        <div className="flex items-center justify-between gap-2 pt-1">
          {exitButton}
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Toque no destaque para continuar</span>
        </div>
      </div>
    </div>
  );
}
