import { useEffect, useRef, useState } from 'react';
import { Move } from 'lucide-react';

/** Retângulo de recorte em FRAÇÕES (0..1) da imagem original — independe de resolução, então
 * o mesmo recorte relativo se aplica a qualquer imagem, mesmo com pixels ligeiramente diferentes. */
export interface CropRect { x: number; y: number; w: number; h: number; }

export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };
export const CENTER_CROP: CropRect = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };

export function cropEquals(a: CropRect, b: CropRect): boolean {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001 && Math.abs(a.w - b.w) < 0.001 && Math.abs(a.h - b.h) < 0.001;
}

const PREVIEW_WIDTH = 280;
const RULER_SIZE = 16; // px — largura/altura da faixa de régua (% da imagem) fora do recorte
const RULER_TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem'));
    img.src = src;
  });
}

/** Recorta `src` segundo `crop` (frações 0..1) e devolve só a região recortada como um novo
 * PNG dataURL — usado quando o recorte precisa ser "assado" de vez na imagem (ex.: crop de uma
 * imagem solta no editor de etiqueta, sem crop-por-referência como no import de PDF). */
export async function cropImageToDataUrl(src: string, crop: CropRect): Promise<string> {
  const img = await loadImageEl(src);
  const sx = crop.x * img.naturalWidth;
  const sy = crop.y * img.naturalHeight;
  const sw = crop.w * img.naturalWidth;
  const sh = crop.h * img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
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

// ─── Editor de recorte reutilizável — arrastar/redimensionar por ponteiro, lupa fixa acima do
// canvas (nunca em cima do dedo) e régua percentual fora da área recortada. Usado no import de
// PDF (recorte por página) e no recorte de uma imagem solta no editor de etiqueta geral. ──────
export default function CropEditor({ imageSrc, crop, onChangeCrop, isDarkMode }: {
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

      {/* Régua (% da imagem) FORA da área de recorte — topo e esquerda, como referência de
          escala; marca de 10 em 10%, incluindo os extremos 0/100 (bordas da imagem). */}
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
