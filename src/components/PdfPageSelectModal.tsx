import { useEffect, useRef, useState } from 'react';
import { Check, FileStack, Maximize2, ChevronLeft, ChevronRight, Crop, Scissors, RotateCcw, Move, CheckCircle2 } from 'lucide-react';
import Modal from './Modal';
import { toast } from '../utils/toast';

/** Retângulo de recorte em FRAÇÕES (0..1) da página original — independe de resolução, então
 * o mesmo recorte relativo se aplica a qualquer página, mesmo se o pdf.js rasterizar cada uma
 * com um número de pixels ligeiramente diferente. */
export interface CropRect { x: number; y: number; w: number; h: number; }

export interface CroppedPage { dataUrl: string; crop: CropRect; }

interface PdfPageSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  pages: string[]; // PNG dataURLs, uma por página, em ordem
  widthMm: number;
  heightMm: number;
  onConfirm: (items: CroppedPage[]) => void;
}

const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };
const CENTER_CROP: CropRect = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };

function cropEquals(a: CropRect, b: CropRect): boolean {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001 && Math.abs(a.w - b.w) < 0.001 && Math.abs(a.h - b.h) < 0.001;
}
const PREVIEW_WIDTH = 280;
const RULER_SIZE = 16; // px — largura/altura da faixa de régua (% da página) fora do recorte
const RULER_TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a página'));
    img.src = src;
  });
}

type ResizeCorner = 'tl' | 'tr' | 'bl' | 'br';

function computeResizedCrop(corner: ResizeCorner, start: CropRect, dxFrac: number, dyFrac: number): CropRect {
  let { x, y, w, h } = start;
  if (corner === 'tl' || corner === 'bl') {
    const newX = Math.max(0, Math.min(x + w - 0.05, x + dxFrac));
    w = x + w - newX;
    x = newX;
  } else {
    w = Math.max(0.05, Math.min(1 - x, w + dxFrac));
  }
  if (corner === 'tl' || corner === 'tr') {
    const newY = Math.max(0, Math.min(y + h - 0.05, y + dyFrac));
    h = y + h - newY;
    y = newY;
  } else {
    h = Math.max(0.05, Math.min(1 - y, h + dyFrac));
  }
  return { x, y, w, h };
}

// ─── Editor de recorte reutilizável — usado no ajuste global (ímpar/par/todas) e no
// recorte manual de uma página específica dentro do visualizador. ──────────────────────────
function CropEditor({ imageSrc, crop, onChangeCrop, isDarkMode }: {
  imageSrc: string; crop: CropRect; onChangeCrop: (c: CropRect) => void; isDarkMode: boolean;
}) {
  const [aspect, setAspect] = useState(1);
  const [activeHandle, setActiveHandle] = useState<ResizeCorner | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: 'move' | ResizeCorner; pointerId: number; startPointerX: number; startPointerY: number; startCrop: CropRect; pxW: number; pxH: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadImageEl(imageSrc).then(img => { if (!cancelled) setAspect(img.naturalWidth / img.naturalHeight); }).catch(() => {});
    return () => { cancelled = true; };
  }, [imageSrc]);

  const beginDrag = (e: React.PointerEvent, mode: 'move' | ResizeCorner) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { mode, pointerId: e.pointerId, startPointerX: e.clientX, startPointerY: e.clientY, startCrop: { ...crop }, pxW: rect.width, pxH: rect.height };
    (e.target as Element).setPointerCapture(e.pointerId);
    if (mode !== 'move') setActiveHandle(mode);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dxFrac = (e.clientX - drag.startPointerX) / drag.pxW;
    const dyFrac = (e.clientY - drag.startPointerY) / drag.pxH;
    if (drag.mode === 'move') {
      onChangeCrop({
        ...drag.startCrop,
        x: Math.max(0, Math.min(1 - drag.startCrop.w, drag.startCrop.x + dxFrac)),
        y: Math.max(0, Math.min(1 - drag.startCrop.h, drag.startCrop.y + dyFrac)),
      });
    } else {
      onChangeCrop(computeResizedCrop(drag.mode, drag.startCrop, dxFrac, dyFrac));
    }
  };

  const endDrag = () => { dragRef.current = null; setActiveHandle(null); };
  const previewHeight = PREVIEW_WIDTH / aspect;

  // Posição (fração 0..1) da ponta que está sendo arrastada — usada pra centralizar a lupa
  // de zoom nela, pra verificar se o recorte não está cortando conteúdo útil bem na ponta.
  const cornerFrac = (h: ResizeCorner) => ({
    x: h === 'tl' || h === 'bl' ? crop.x : crop.x + crop.w,
    y: h === 'tl' || h === 'tr' ? crop.y : crop.y + crop.h,
  });
  // Alças maiores que o mínimo visual pra facilitar arrastar com o dedo (alvo de toque
  // recomendado ~40-44px) — o quadrado visível continua o mesmo tamanho, só a área
  // clicável/tocável cresce via padding, mantendo o alinhamento pelo centro do canto.
  const handleCls = 'absolute w-8 h-8 flex items-center justify-center';
  const handleDotCls = 'w-4 h-4 rounded-sm bg-indigo-500 border-2 border-white shadow-sm pointer-events-none';

  // Lupa fica numa faixa FIXA acima do canvas (não em cima do dedo) — assim nunca fica
  // escondida pela mão de quem está arrastando, nem se move durante o arraste.
  const MAG = 84;
  const ZOOM = 4;

  return (
    <div className="mx-auto" style={{ width: PREVIEW_WIDTH + RULER_SIZE }}>
      {/* Reserva o espaço da lupa sempre (mesmo sem arrastar), pra o resto do layout não
          "pular" quando ela aparece/desaparece. */}
      <div className="flex justify-end mb-1.5" style={{ height: MAG }}>
        {activeHandle && (() => {
          const pos = cornerFrac(activeHandle);
          const bgW = PREVIEW_WIDTH * ZOOM;
          const bgH = previewHeight * ZOOM;
          return (
            <div
              className="rounded-xl border-2 border-indigo-500 shadow-lg pointer-events-none overflow-hidden bg-white relative"
              style={{
                width: MAG, height: MAG,
                backgroundImage: `url(${imageSrc})`,
                backgroundSize: `${bgW}px ${bgH}px`,
                backgroundPosition: `${-(pos.x * bgW - MAG / 2)}px ${-(pos.y * bgH - MAG / 2)}px`,
                backgroundRepeat: 'no-repeat',
              }}
            >
              <div className="absolute left-1/2 top-1/2 w-4 h-0.5 bg-indigo-500 -translate-x-1/2 -translate-y-1/2" />
              <div className="absolute left-1/2 top-1/2 w-0.5 h-4 bg-indigo-500 -translate-x-1/2 -translate-y-1/2" />
            </div>
          );
        })()}
      </div>

      {/* Régua (% da página) FORA da área de recorte — topo e esquerda, como referência de
          escala; marca de 10 em 10%, incluindo os extremos 0/100 (bordas da página). */}
      <div className="flex">
        <div style={{ width: RULER_SIZE }} />
        <div className="relative" style={{ width: PREVIEW_WIDTH, height: RULER_SIZE }}>
          {RULER_TICKS.map(t => (
            <div key={t} className="absolute top-0 flex flex-col items-center" style={{ left: `${t}%`, transform: t === 100 ? 'translateX(-100%)' : t === 0 ? 'none' : 'translateX(-50%)' }}>
              <span className="text-[7px] font-bold text-slate-400 leading-none">{t}</span>
              <div className="w-px h-1.5 bg-slate-300" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex">
        <div className="relative shrink-0" style={{ width: RULER_SIZE, height: previewHeight }}>
          {RULER_TICKS.map(t => (
            <div key={t} className="absolute left-0 flex items-center gap-0.5" style={{ top: `${t}%`, transform: t === 100 ? 'translateY(-100%)' : t === 0 ? 'none' : 'translateY(-50%)' }}>
              <span className="text-[7px] font-bold text-slate-400 leading-none">{t}</span>
              <div className="w-1.5 h-px bg-slate-300" />
            </div>
          ))}
        </div>
        <div
          ref={canvasRef}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="relative touch-none select-none shrink-0"
          style={{ width: PREVIEW_WIDTH, height: previewHeight }}
        >
          {/* Só essa camada corta (overflow-hidden) — imagem + sombra. As alças ficam FORA
              dela, como irmãs, senão o overflow-hidden corta as pontas que "vazam" pra fora
              do recorte (ficavam praticamente invisíveis/impossíveis de tocar nos cantos). */}
          <div className="absolute inset-0 bg-white rounded-lg border-2 border-slate-300 overflow-hidden pointer-events-none">
            <img src={imageSrc} alt="" className="absolute inset-0 w-full h-full" draggable={false} />
            {/* Sombra fora da área recortada (4 tiras), pra destacar o que vai ficar */}
            <div className="absolute inset-x-0 top-0 bg-black/40" style={{ height: `${crop.y * 100}%` }} />
            <div className="absolute inset-x-0 bottom-0 bg-black/40" style={{ height: `${(1 - crop.y - crop.h) * 100}%` }} />
            <div className="absolute left-0 bg-black/40" style={{ top: `${crop.y * 100}%`, height: `${crop.h * 100}%`, width: `${crop.x * 100}%` }} />
            <div className="absolute right-0 bg-black/40" style={{ top: `${crop.y * 100}%`, height: `${crop.h * 100}%`, width: `${(1 - crop.x - crop.w) * 100}%` }} />
          </div>
          <div
            onPointerDown={e => beginDrag(e, 'move')}
            className="absolute outline outline-2 outline-indigo-500 cursor-move"
            style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
          >
            <div onPointerDown={e => beginDrag(e, 'tl')} className={`${handleCls} -left-4 -top-4 cursor-nwse-resize`}><div className={handleDotCls} /></div>
            <div onPointerDown={e => beginDrag(e, 'tr')} className={`${handleCls} -right-4 -top-4 cursor-nesw-resize`}><div className={handleDotCls} /></div>
            <div onPointerDown={e => beginDrag(e, 'bl')} className={`${handleCls} -left-4 -bottom-4 cursor-nesw-resize`}><div className={handleDotCls} /></div>
            <div onPointerDown={e => beginDrag(e, 'br')} className={`${handleCls} -right-4 -bottom-4 cursor-nwse-resize`}><div className={handleDotCls} /></div>
            {/* Alça central de mover — maior que a área do próprio recorte (que às vezes fica
                pequena demais pra arrastar com o dedo com precisão). Arrastar de qualquer ponto
                dentro do recorte também move, essa aqui só facilita quando o recorte está pequeno. */}
            <div
              onPointerDown={e => beginDrag(e, 'move')}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-indigo-500/90 border-2 border-white shadow-lg flex items-center justify-center cursor-move"
            >
              <Move size={18} className="text-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type CropGroup = 'all' | 'odd' | 'even';

/** PDF de várias páginas importado como etiqueta, em duas etapas:
 * 1) Selecionar Páginas — escolhe quais páginas do PDF viram etiqueta (clique ou visualizador).
 * 2) Recortar — desenha um recorte (crop) ajustável, com alças nos 4 cantos, sobre a página de
 *    referência. Pode ser um recorte único pra todas, ou um recorte diferente pra páginas
 *    ímpares e outro pra pares (replicado em cada grupo). Cada página também pode ganhar um
 *    recorte manual próprio pelo visualizador (sobrepõe o recorte do grupo só pra ela). */
export default function PdfPageSelectModal({
  isOpen, onClose, isDarkMode, pages, widthMm, heightMm, onConfirm,
}: PdfPageSelectModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(pages.map((_, i) => i)));
  // Qual atalho (Todas/Nenhuma/Ímpares/Pares) foi clicado por último — feedback visual de
  // qual opção está "marcada" (o tamanho de `selected` sozinho não diferencia "Nenhuma" de
  // "Só pares com uma página só", por exemplo). Some quando o usuário mexe manualmente numa
  // miniatura, já que aí nenhum atalho descreve mais o estado exato da seleção.
  const [lastSelectAction, setLastSelectAction] = useState<'all' | 'none' | 'odd' | 'even' | null>('all');
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [viewerCropMode, setViewerCropMode] = useState(false);
  const [viewerCrop, setViewerCrop] = useState<CropRect>(FULL_CROP);

  const [splitOddEven, setSplitOddEven] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CropGroup>('all');
  const [groupCrops, setGroupCrops] = useState<Record<CropGroup, CropRect>>({ all: FULL_CROP, odd: FULL_CROP, even: FULL_CROP });
  const [pageOverrides, setPageOverrides] = useState<Record<number, CropRect>>({});
  // Quais grupos (all/odd/even) o usuário já bateu o martelo "esse recorte está bom" — só
  // feedback visual/confiança, o recorte já vale mesmo sem confirmar (é aplicado ao vivo);
  // isso aqui não bloqueia nada, só sinaliza "revisado".
  const [confirmedGroups, setConfirmedGroups] = useState<Set<CropGroup>>(new Set());
  // Qual página mostrar como referência no editor de recorte — por padrão a 1ª do grupo, mas
  // pode ser trocada (ver botões Anterior/Próxima) pra ajustar olhando outra página, já que
  // o problema pode não aparecer logo na primeira (ex.: só a 2ª página precisa de ajuste fino).
  const [manualRefIndex, setManualRefIndex] = useState<number | null>(null);

  // Reseta tudo sempre que a modal reabre com um PDF novo.
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelected(new Set(pages.map((_, i) => i)));
      setLastSelectAction('all');
      setSplitOddEven(false);
      setEditingGroup('all');
      setGroupCrops({ all: FULL_CROP, odd: FULL_CROP, even: FULL_CROP });
      setPageOverrides({});
      setConfirmedGroups(new Set());
    }
  }, [isOpen, pages]);

  const toggle = (idx: number) => {
    setLastSelectAction(null);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const quickCls = (active: boolean) =>
    `flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
      active ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
    }`;

  const selectedIndexes = Array.from(selected).sort((a, b) => a - b);

  // Resolve o recorte "efetivo" de uma página: override manual dela > recorte do grupo
  // (ímpar/par) se separado > recorte único.
  const resolveCropForIndex = (idx: number): CropRect => {
    if (pageOverrides[idx]) return pageOverrides[idx];
    if (splitOddEven) return idx % 2 === 0 ? groupCrops.odd : groupCrops.even;
    return groupCrops.all;
  };

  // Páginas do grupo sendo editado (só ímpares, só pares, ou todas as selecionadas) — a
  // referência mostrada no editor pode ser qualquer uma dessas, não só a primeira.
  const groupIndexes = splitOddEven
    ? selectedIndexes.filter(i => (i % 2 === 0) === (editingGroup === 'odd')) // "ímpar" (1-indexed) = índice par (0-based)
    : selectedIndexes;
  const referenceIndex = (manualRefIndex !== null && groupIndexes.includes(manualRefIndex)) ? manualRefIndex : groupIndexes[0];
  const referencePage = referenceIndex !== undefined ? pages[referenceIndex] : null;
  const refPos = referenceIndex !== undefined ? groupIndexes.indexOf(referenceIndex) : -1;

  const activeGroupKey: CropGroup = splitOddEven ? editingGroup : 'all';
  const activeCrop = groupCrops[activeGroupKey];
  const setActiveCrop = (c: CropRect) => {
    setGroupCrops(prev => ({ ...prev, [activeGroupKey]: c }));
    // Qualquer ajuste depois de confirmado invalida a confirmação — evita mostrar "confirmado"
    // pra um recorte que já mudou de novo.
    setConfirmedGroups(prev => { if (!prev.has(activeGroupKey)) return prev; const next = new Set(prev); next.delete(activeGroupKey); return next; });
  };
  const isActiveGroupConfirmed = confirmedGroups.has(activeGroupKey);

  const renderThumb = (idx: number) => {
    const isSel = selected.has(idx);
    const hasOverride = !!pageOverrides[idx];
    return (
      <div
        key={idx}
        className={`relative rounded-xl overflow-hidden border-2 transition-all ${
          isSel ? 'border-indigo-500' : isDarkMode ? 'border-slate-800' : 'border-slate-200'
        }`}
      >
        <button type="button" onClick={() => toggle(idx)} className="block w-full">
          <img src={pages[idx]} alt={`Página ${idx + 1}`} className="w-full h-20 object-contain bg-white" />
          <div className={`text-[8px] font-black text-center py-0.5 ${isDarkMode ? 'bg-slate-900/80 text-slate-300' : 'bg-white/90 text-slate-600'}`}>
            Pág. {idx + 1} · <span className={idx % 2 === 0 ? 'text-indigo-400' : 'text-amber-500'}>{idx % 2 === 0 ? 'Í' : 'P'}</span>
          </div>
        </button>
        {isSel && (
          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center pointer-events-none">
            <Check size={10} className="text-white" strokeWidth={3} />
          </div>
        )}
        {hasOverride && (
          <div className="absolute bottom-6 right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center pointer-events-none" title="Recorte manual">
            <Scissors size={9} className="text-white" />
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setViewingIndex(idx);
            setViewerCropMode(false);
            setViewerCrop(resolveCropForIndex(idx));
          }}
          title="Ampliar página"
          className="absolute top-1 left-1 w-5 h-5 rounded-full bg-slate-900/70 flex items-center justify-center"
        >
          <Maximize2 size={10} className="text-white" />
        </button>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 1 ? 'Selecionar Páginas' : 'Recortar Etiqueta'}
      icon={step === 1 ? <FileStack size={20} /> : <Crop size={20} />}
      maxWidth="max-w-md"
      zIndex={97000}
    >
      <div className="flex flex-col gap-4">
        {step === 1 ? (
          <>
            <p className="text-[10px] font-bold text-center text-slate-400 uppercase tracking-widest">
              {pages.length} página(s) no PDF — marque as que você quer importar
            </p>

            <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
              {pages.map((_, idx) => renderThumb(idx))}
            </div>

            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => setStep(2)}
              className="flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
            >
              Próximo — {selected.size} selecionada(s)
            </button>
          </>
        ) : (
          <>
            <p className="text-[10px] font-bold text-center text-slate-400 uppercase tracking-widest">
              Arraste pra mover, use os cantos pra redimensionar
            </p>

            {/* Atalhos — refinam a seleção feita no passo 1 */}
            <div className="flex gap-1.5">
              <button type="button" onClick={() => { setLastSelectAction('all'); setSelected(new Set(pages.map((_, i) => i))); }} className={quickCls(lastSelectAction === 'all')}>
                Todas
              </button>
              <button type="button" onClick={() => { setLastSelectAction('none'); setSelected(new Set()); }} className={quickCls(lastSelectAction === 'none')}>
                Nenhuma
              </button>
              <button type="button" onClick={() => { setLastSelectAction('odd'); setSelected(prev => new Set(Array.from(prev).filter(i => i % 2 === 0))); }} className={quickCls(lastSelectAction === 'odd')}>
                Manter só ímpares
              </button>
              <button type="button" onClick={() => { setLastSelectAction('even'); setSelected(prev => new Set(Array.from(prev).filter(i => i % 2 === 1))); }} className={quickCls(lastSelectAction === 'even')}>
                Manter só pares
              </button>
            </div>

            {/* Recorte único vs separado por ímpar/par */}
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setSplitOddEven(false)} className={quickCls(!splitOddEven)}>
                Mesmo recorte pra todas
              </button>
              <button type="button" onClick={() => setSplitOddEven(true)} className={quickCls(splitOddEven)}>
                Recorte diferente ímpar/par
              </button>
            </div>
            {splitOddEven && (
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setEditingGroup('odd')} className={quickCls(editingGroup === 'odd')}>
                  Editando: Ímpares
                </button>
                <button type="button" onClick={() => setEditingGroup('even')} className={quickCls(editingGroup === 'even')}>
                  Editando: Pares
                </button>
              </div>
            )}

            {referencePage ? (
              <>
                {groupIndexes.length > 1 && (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={refPos <= 0}
                      onClick={() => setManualRefIndex(groupIndexes[refPos - 1])}
                      className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest disabled:opacity-30 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                    >
                      <ChevronLeft size={13} /> Anterior
                    </button>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      Vendo pág. {referenceIndex! + 1} ({refPos + 1}/{groupIndexes.length})
                    </span>
                    <button
                      type="button"
                      disabled={refPos >= groupIndexes.length - 1}
                      onClick={() => setManualRefIndex(groupIndexes[refPos + 1])}
                      className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest disabled:opacity-30 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                    >
                      Próxima <ChevronRight size={13} />
                    </button>
                  </div>
                )}
                <CropEditor imageSrc={referencePage} crop={activeCrop} onChangeCrop={setActiveCrop} isDarkMode={isDarkMode} />

                <button
                  type="button"
                  onClick={() => {
                    setConfirmedGroups(prev => new Set(prev).add(activeGroupKey));
                    toast.show(splitOddEven ? `Recorte para ${editingGroup === 'odd' ? 'ímpares' : 'pares'} confirmado!` : 'Recorte confirmado!');
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    isActiveGroupConfirmed ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'
                  }`}
                >
                  <CheckCircle2 size={14} /> {isActiveGroupConfirmed ? 'Recorte confirmado' : 'Confirmar recorte'}
                </button>
              </>
            ) : (
              <p className="text-center text-[10px] font-bold text-slate-400 py-4">Selecione ao menos uma página pra recortar.</p>
            )}

            <div className="flex gap-1.5">
              <button type="button" onClick={() => setActiveCrop(FULL_CROP)} className={quickCls(cropEquals(activeCrop, FULL_CROP))}>
                Página inteira
              </button>
              <button type="button" onClick={() => setActiveCrop(CENTER_CROP)} className={quickCls(cropEquals(activeCrop, CENTER_CROP))}>
                Recorte central
              </button>
            </div>

            <p className="text-[9px] font-bold text-center text-slate-400">
              Etiquetas com <Scissors size={9} className="inline text-amber-500" /> âmbar têm recorte manual próprio (ajuste pelo visualizador, ícone de lupa)
            </p>

            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {selectedIndexes.length > 0
                ? selectedIndexes.map(idx => renderThumb(idx))
                : <p className="col-span-3 text-center text-[10px] font-bold text-slate-400 py-4">Nenhuma página selecionada.</p>}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`px-4 flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                <ChevronLeft size={16} /> Voltar
              </button>
              <button
                type="button"
                disabled={selected.size === 0}
                onClick={() => onConfirm(selectedIndexes.map(i => ({ dataUrl: pages[i], crop: resolveCropForIndex(i) })))}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
              >
                Importar {selected.size} página(s)
              </button>
            </div>
          </>
        )}
      </div>

      {/* Visualizador em tamanho grande — abre ao ampliar uma miniatura, em qualquer passo.
          No passo 2, também permite um recorte manual só dessa página (sobrepõe o do grupo). */}
      {viewingIndex !== null && (
        <Modal isOpen onClose={() => setViewingIndex(null)} title={`Página ${viewingIndex + 1} de ${pages.length}`} maxWidth="max-w-lg" zIndex={99000}>
          <div className="flex flex-col gap-3">
            {viewerCropMode ? (
              <>
                <CropEditor imageSrc={pages[viewingIndex]} crop={viewerCrop} onChangeCrop={setViewerCrop} isDarkMode={isDarkMode} />
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setViewerCrop(FULL_CROP)} className={quickCls(cropEquals(viewerCrop, FULL_CROP))}>Página inteira</button>
                  <button type="button" onClick={() => setViewerCrop(CENTER_CROP)} className={quickCls(cropEquals(viewerCrop, CENTER_CROP))}>Recorte central</button>
                </div>
                <button
                  type="button"
                  onClick={() => { setPageOverrides(prev => ({ ...prev, [viewingIndex]: viewerCrop })); setViewerCropMode(false); }}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-indigo-600 text-white"
                >
                  <Check size={16} /> Salvar recorte desta página
                </button>
              </>
            ) : (
              <img
                src={pages[viewingIndex]}
                alt={`Página ${viewingIndex + 1}`}
                className={`w-full rounded-xl bg-white border-2 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}
              />
            )}

            {step === 2 && !viewerCropMode && (
              <button
                type="button"
                onClick={() => { setViewerCrop(resolveCropForIndex(viewingIndex)); setViewerCropMode(true); }}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-amber-500 text-white"
              >
                <Scissors size={16} /> Recortar esta página
              </button>
            )}
            {step === 2 && !viewerCropMode && pageOverrides[viewingIndex] && (
              <button
                type="button"
                onClick={() => setPageOverrides(prev => { const next = { ...prev }; delete next[viewingIndex]; return next; })}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                <RotateCcw size={13} /> Usar recorte padrão (remover o manual)
              </button>
            )}
            {!viewerCropMode && (
              <button
                type="button"
                onClick={() => { toggle(viewingIndex); setViewingIndex(null); }}
                className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-widest ${
                  selected.has(viewingIndex) ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-500' : 'bg-indigo-600 text-white'
                }`}
              >
                {selected.has(viewingIndex) ? 'Remover da seleção' : 'Selecionar esta página'}
              </button>
            )}
          </div>
        </Modal>
      )}
    </Modal>
  );
}
