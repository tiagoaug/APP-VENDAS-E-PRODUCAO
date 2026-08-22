import { useEffect, useRef, useState } from 'react';
import { HelpCircle, X, ArrowRight } from 'lucide-react';
import { ViewType, ProductionScreenType } from '../types';
import { FIELD_HELP } from '../data/fieldHelp';

// "?" flutuante e arrastável — parte do modo "Me guie" (ver GuidedTourOverlay.tsx e
// src/data/fieldHelp.ts). Arraste até qualquer elemento marcado com data-guide-anchor e solte:
// mostra um popup explicando aquele campo especificamente. Solto fora de um anchor mapeado,
// avisa que ainda não tem explicação pra ali — não é erro, é o limite esperado do V1 (só cobre
// os anchors que os tours já usam).
//
// z-index (99005) mais alto que o GuidedTourOverlay (99000) de propósito: o "?" continua
// arrastável por cima mesmo com um tour automático rodando ao mesmo tempo (Pointer Capture
// garante que o arraste continue funcionando por cima dos blocos de scrim do tour). Os dois
// ficam bem acima do Modal que envolve as telas de formulário (zIndex padrão 50000 em
// Modal.tsx) — sem isso, o "?"/spotlight ficavam escondidos atrás de telas como Venda/Compra.

interface DraggableHelpPointProps {
  isDarkMode: boolean;
  onNavigate: (view: ViewType, params?: any, productionSubScreen?: ProductionScreenType) => void;
  // Modo 1 (padrão): soltar já mostra a explicação; toque de novo (sem arrastar) ou X fecha.
  // Modo 2: arrastar só reposiciona o "?", sem mostrar nada; um toque (sem arrastar) mostra,
  // outro toque fecha (ou X). Configurado na Central de Ajuda, ver App.tsx/HelpCenterModal.
  mode: 1 | 2;
}

type Explanation = { anchorKey: string; x: number; y: number };

// Deslocamento mínimo (px) pra diferenciar um arraste real de um toque no lugar.
const DRAG_THRESHOLD = 6;

export default function DraggableHelpPoint({ isDarkMode, onNavigate, mode }: DraggableHelpPointProps) {
  const [position, setPosition] = useState(() => ({
    x: Math.max(12, window.innerWidth - 76),
    y: Math.max(12, window.innerHeight - 260),
  }));
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  // Toque solto fora de qualquer anchor mapeado — mostra um "!" vermelho no canto do botão por
  // alguns segundos em vez de um toast (menos intrusivo, mesma ideia).
  const [showNotFound, setShowNotFound] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const draggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const notFoundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (notFoundTimeoutRef.current) clearTimeout(notFoundTimeoutRef.current); }, []);

  const clamp = (v: number, max: number) => Math.min(Math.max(v, 8), max - 8);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    draggingRef.current = true;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    setShowNotFound(false);
    btnRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    setPosition({
      x: clamp(e.clientX - 24, window.innerWidth - 48),
      y: clamp(e.clientY - 24, window.innerHeight - 48),
    });
  };

  // Enxerga através do próprio botão E de qualquer scrim de tour guiado (GuidedTourOverlay)
  // que esteja passando por cima do ponto — sem isso, um tour rodando ao mesmo tempo (ex.:
  // "Cadastre uma Venda" da Configuração Inicial) bloqueia o hit-test em qualquer campo fora
  // do recorte dele, e o "?" nunca acha o campo real por baixo.
  const revealAt = (x: number, y: number) => {
    const btn = btnRef.current;
    const hidden: HTMLElement[] = [];
    if (btn) { btn.style.visibility = 'hidden'; hidden.push(btn); }
    let el = document.elementFromPoint(x, y) as HTMLElement | null;
    let guard = 0;
    while (el?.closest('[data-tour-scrim]') && guard < 10) {
      const scrim = el.closest('[data-tour-scrim]') as HTMLElement;
      scrim.style.visibility = 'hidden';
      hidden.push(scrim);
      el = document.elementFromPoint(x, y) as HTMLElement | null;
      guard++;
    }
    hidden.forEach(node => { node.style.visibility = 'visible'; });
    const anchorEl = el?.closest('[data-guide-anchor]') as HTMLElement | null;
    const anchorKey = anchorEl?.getAttribute('data-guide-anchor');
    if (anchorKey && FIELD_HELP[anchorKey]) {
      setExplanation({ anchorKey, x, y });
    } else {
      setShowNotFound(true);
      if (notFoundTimeoutRef.current) clearTimeout(notFoundTimeoutRef.current);
      notFoundTimeoutRef.current = setTimeout(() => setShowNotFound(false), 2500);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const moved = Math.hypot(e.clientX - startPosRef.current.x, e.clientY - startPosRef.current.y) > DRAG_THRESHOLD;

    // Modo 2 + arraste real: só reposiciona, não mexe na explicação.
    if (mode === 2 && moved) return;

    // Toque no lugar (sem arrastar) com popup já aberto: fecha — nos dois modos.
    if (!moved && explanation) {
      setExplanation(null);
      return;
    }

    // Modo 1 + arraste real (mostra no ponto novo), ou toque no lugar com popup fechado
    // (mostra/alterna) — nos dois modos.
    revealAt(e.clientX, e.clientY);
  };

  const entry = explanation ? FIELD_HELP[explanation.anchorKey] : null;

  return (
    <>
      {/* pointer-events-none aqui de propósito: esse wrapper só existe pra posicionar o badge
          de "!" no canto do botão. Sem isso, ele mesmo (mesmo sem nada visível) fica na frente
          do elementFromPoint no momento do drop e o hit-test nunca enxerga o campo real embaixo —
          o botão recupera o pointer-events com pointer-events-auto explícito. */}
      <div style={{ position: 'fixed', left: position.x, top: position.y }} className="z-[99005] pointer-events-none">
        <button
          ref={btnRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: 'none' }}
          className="pointer-events-auto relative w-12 h-12 rounded-full bg-indigo-600 text-white shadow-2xl flex items-center justify-center active:scale-95 transition-transform border-4 border-white dark:border-slate-800"
          aria-label="Arraste até um campo para ver a explicação"
          title="Arraste até um campo para ver a explicação"
        >
          <HelpCircle size={20} strokeWidth={2.5} />
        </button>
        {showNotFound && (
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-lg pointer-events-none">
            !
          </span>
        )}
      </div>

      {entry && explanation && (() => {
        // Estimativa de altura do popup — se não couber embaixo do ponto largado (perto do
        // rodapé, onde o "?" costuma ficar), mostra em cima em vez de tampar o próprio "?".
        const POPUP_HEIGHT_ESTIMATE = 200;
        const fitsBelow = explanation.y + 16 + POPUP_HEIGHT_ESTIMATE <= window.innerHeight;
        const top = fitsBelow
          ? explanation.y + 16
          : Math.max(12, explanation.y - POPUP_HEIGHT_ESTIMATE - 16);
        return (
        <div className="fixed inset-0 z-[99005]" onClick={() => setExplanation(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: Math.min(Math.max(explanation.x - 140, 12), window.innerWidth - 300),
              top,
            }}
            className={`max-w-xs rounded-2xl shadow-2xl border p-4 flex flex-col gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <HelpCircle size={13} className="text-indigo-500 shrink-0" />
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Explicação</span>
              </div>
              <button type="button" onClick={() => setExplanation(null)} aria-label="Fechar" className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>
                <X size={14} strokeWidth={3} />
              </button>
            </div>
            <p className={`text-xs font-bold leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{entry.text}</p>
            {entry.relatedView && (
              <button
                type="button"
                onClick={() => { onNavigate(entry.relatedView!, entry.relatedParams, entry.relatedProductionSubScreen); setExplanation(null); }}
                className="self-start flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-500"
              >
                Ir para {entry.relatedLabel || 'a tela relacionada'} <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
        );
      })()}
    </>
  );
}
