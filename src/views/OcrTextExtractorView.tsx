import { useRef, useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Clipboard } from '@capacitor/clipboard';
import { Share } from '@capacitor/share';
import { ArrowLeft, ScanText, Camera as CameraIcon, Image as ImageIcon, ClipboardPaste, Copy, Share2, Trash2, Loader2, Check, Paintbrush, Eraser, X, ScanSearch, ShoppingBag, Minimize2, Maximize2, Lock, Unlock } from 'lucide-react';
import { textRecognitionService } from '../services/textRecognitionService';
import { toast } from '../utils/toast';

interface OcrTextExtractorViewProps {
  onBack: () => void;
  isDarkMode: boolean;
  // Manda o texto atual pra Vendas, abrindo "Colar Pedido Digitado" já preenchido pra revisar
  // antes de criar o pedido (ver App.tsx: navigateTo(ViewType.SALES, { prefillPasteText })).
  onExportToSales: (text: string) => void;
}

interface RegionOverlay {
  id: string;
  x: number; // caixa delimitadora da seleção, em pixel NATURAL da imagem
  y: number;
  w: number;
  h: number;
  text: string;
  loading: boolean;
}

const MASK_COLOR = '#fbbf24'; // só a cor de exibição — pra reveal/OCR só o alfa importa

// Lupa retangular fixa no canto da imagem, ativa só durante o arrasto — o dedo cobre
// exatamente o que se está pintando, então mostra uma versão ampliada da área embaixo do
// toque (imagem + máscara + um círculo do tamanho real do pincel) num cantinho fixo, sem
// seguir o dedo pela tela.
const LOUPE_W = 260;
const LOUPE_H = 180;
const LOUPE_ZOOM = 2.5;

// Ferramenta avulsa de OCR — diferente do "Colar Pedido Digitado" (PasteOrderModal), aqui não
// tem catálogo/produto/cliente envolvido, é só ler uma imagem e devolver o texto pra editar/
// copiar/exportar. Além do OCR da imagem inteira, dá pra pintar com o dedo (pincel circular,
// diâmetro ajustável) só a área que interessa — o ML Kit não tem API de "rodar OCR numa
// máscara", então o recorte enviado é montado na hora: fundo branco + a imagem original
// revelada só onde foi pintado (destination-in com a máscara), de qualquer formato, não só
// retângulo.
export default function OcrTextExtractorView({ onBack, isDarkMode, onExportToSales }: OcrTextExtractorViewProps) {
  const [text, setText] = useState('');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [loading, setLoading] = useState(false); // carregando/lendo imagem inteira
  const [extracting, setExtracting] = useState(false); // extraindo texto da seleção pintada
  const [copied, setCopied] = useState(false);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState(28);
  const [hasPaint, setHasPaint] = useState(false);
  const [overlays, setOverlays] = useState<RegionOverlay[]>([]);
  // No celular, arrastar É o gesto de rolar a tela — como o canvas de pintura precisa capturar
  // esse mesmo gesto pra desenhar, dá pra ficar "preso" dentro da imagem sem conseguir rolar
  // até o Pincel/Borracha/Extrair abaixo. Minimizar esconde a imagem (sem perder a pintura
  // feita — só troca o CSS, não desmonta o canvas) liberando a tela pra rolar normal.
  const [previewMinimized, setPreviewMinimized] = useState(false);
  const [loupeVisible, setLoupeVisible] = useState(false);
  // Travado = a imagem para de capturar o toque pra pintar, e o arrasto em cima dela volta a
  // rolar a tela normalmente (o mesmo gesto de sempre no celular) — outra saída além de
  // minimizar pra quem só quer rolar até os controles sem perder a pintura já feita.
  const [locked, setLocked] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const loadImage = (path: string, previewSrc: string) => {
    setSourcePath(path);
    setImageSrc(previewSrc);
    setNaturalSize(null);
    setOverlays([]);
    setHasPaint(false);
    setText('');
  };

  const handlePickPhoto = async (source: CameraSource) => {
    setLoading(true);
    try {
      const photo = await Camera.getPhoto({ source, resultType: CameraResultType.Uri, quality: 90 });
      const path = photo.path || photo.webPath;
      if (!path) return;
      loadImage(path, photo.webPath || path);
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (!/cancel/i.test(msg)) toast.show('Erro ao selecionar imagem: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  // Mesmo mecanismo do fix aplicado em PasteOrderModal.tsx: plugin nativo @capacitor/clipboard
  // (não navigator.clipboard, que o WebView do Android bloqueia sem nunca pedir permissão).
  const handlePasteFromClipboard = async () => {
    setLoading(true);
    try {
      const { value, type } = await Clipboard.read();
      if (!value || !type?.startsWith('image/')) {
        toast.show('Nenhuma imagem encontrada na área de transferência. Copie um print e tente de novo.');
        return;
      }
      const dataUrl = value.includes('base64,') ? value : `data:${type};base64,${value}`;
      const base64 = dataUrl.split('base64,')[1];
      const written = await Filesystem.writeFile({ path: `ocr_tool_${Date.now()}.png`, data: base64, directory: Directory.Cache });
      loadImage(written.uri, dataUrl);
    } catch (err: any) {
      toast.show('Não foi possível colar a imagem: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
  };

  // ── Pintura da máscara (pincel circular livre + borracha) ─────────────────────────────────
  const naturalPointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale, scale };
  };

  const stampCircle = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, erase: boolean) => {
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.fillStyle = MASK_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawSegment = (ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, radius: number, erase: boolean) => {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(dist / Math.max(2, radius * 0.5)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      stampCircle(ctx, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, radius, erase);
    }
  };

  // Lupa retangular fixa no canto — o dedo cobre exatamente onde se está pintando, então
  // mostra uma versão ampliada da imagem + máscara embaixo do toque, com um círculo do
  // tamanho real do pincel, sem seguir o dedo pela tela (fica sempre no mesmo canto).
  const drawLoupe = (natX: number, natY: number, radius: number) => {
    const loupe = loupeCanvasRef.current;
    const img = imgRef.current;
    const mask = maskCanvasRef.current;
    if (!loupe || !img || !mask || !naturalSize) return;
    const ctx = loupe.getContext('2d');
    if (!ctx) return;
    const srcW = LOUPE_W / LOUPE_ZOOM;
    const srcH = LOUPE_H / LOUPE_ZOOM;
    const sx = Math.min(Math.max(0, natX - srcW / 2), Math.max(0, naturalSize.w - srcW));
    const sy = Math.min(Math.max(0, natY - srcH / 2), Math.max(0, naturalSize.h - srcH));
    ctx.clearRect(0, 0, LOUPE_W, LOUPE_H);
    ctx.drawImage(img, sx, sy, srcW, srcH, 0, 0, LOUPE_W, LOUPE_H);
    ctx.globalAlpha = 0.45;
    ctx.drawImage(mask, sx, sy, srcW, srcH, 0, 0, LOUPE_W, LOUPE_H);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = tool === 'eraser' ? '#f43f5e' : '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc((natX - sx) * LOUPE_ZOOM, (natY - sy) * LOUPE_ZOOM, radius * LOUPE_ZOOM, 0, Math.PI * 2);
    ctx.stroke();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!naturalSize) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const ctx = maskCanvasRef.current!.getContext('2d');
    if (!ctx) return;
    const p = naturalPointFromEvent(e);
    const radius = (brushSize / 2) * p.scale;
    isDrawingRef.current = true;
    lastPointRef.current = p;
    stampCircle(ctx, p.x, p.y, radius, tool === 'eraser');
    setLoupeVisible(true);
    drawLoupe(p.x, p.y, radius);
    if (tool === 'brush') setHasPaint(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !naturalSize) return;
    const ctx = maskCanvasRef.current!.getContext('2d');
    if (!ctx) return;
    const p = naturalPointFromEvent(e);
    const radius = (brushSize / 2) * p.scale;
    drawSegment(ctx, lastPointRef.current || p, p, radius, tool === 'eraser');
    lastPointRef.current = p;
    drawLoupe(p.x, p.y, radius);
    if (tool === 'brush') setHasPaint(true);
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
    setLoupeVisible(false);
  };

  const handleClearSelection = () => {
    const canvas = maskCanvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasPaint(false);
  };

  // ── Extração ────────────────────────────────────────────────────────────────────────────
  const handleWholeImageOcr = async () => {
    if (!sourcePath) return;
    setExtracting(true);
    try {
      const extracted = await textRecognitionService.extractText(sourcePath);
      if (!extracted) return;
      setText(prev => (prev.trim() ? `${prev.trim()}\n${extracted}` : extracted));
    } catch (err: any) {
      toast.show('Erro ao ler a imagem: ' + (err?.message || err));
    } finally {
      setExtracting(false);
    }
  };

  const handleExtractSelection = async () => {
    const maskCanvas = maskCanvasRef.current;
    const img = imgRef.current;
    if (!hasPaint || !naturalSize || !maskCanvas || !img) return;
    setExtracting(true);
    try {
      const { w, h } = naturalSize;
      const maskCtx = maskCanvas.getContext('2d')!;
      const imageData = maskCtx.getImageData(0, 0, w, h);
      const data = imageData.data;

      // Acha a caixa delimitadora da área pintada — amostra em passos pra não travar em fotos
      // grandes (celular tira foto de 10+ megapixels).
      let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
      const step = Math.max(1, Math.floor(Math.max(w, h) / 800));
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          if (data[(y * w + x) * 4 + 3] > 10) {
            found = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (!found) {
        toast.show('Nenhuma área pintada pra extrair.');
        return;
      }
      const pad = Math.round(Math.max(w, h) * 0.01);
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX = Math.min(w, maxX + pad); maxY = Math.min(h, maxY + pad);

      // Recorte "livre": imagem original revelada só onde há máscara, sobre fundo branco — o
      // ML Kit só enxerga texto dentro da área pintada, de qualquer formato.
      const revealCanvas = document.createElement('canvas');
      revealCanvas.width = w; revealCanvas.height = h;
      const revealCtx = revealCanvas.getContext('2d')!;
      revealCtx.drawImage(img, 0, 0, w, h);
      revealCtx.globalCompositeOperation = 'destination-in';
      revealCtx.drawImage(maskCanvas, 0, 0);

      const outCanvas = document.createElement('canvas');
      outCanvas.width = w; outCanvas.height = h;
      const outCtx = outCanvas.getContext('2d')!;
      outCtx.fillStyle = '#ffffff';
      outCtx.fillRect(0, 0, w, h);
      outCtx.drawImage(revealCanvas, 0, 0);

      const dataUrl = outCanvas.toDataURL('image/jpeg', 0.92);
      const base64 = dataUrl.split('base64,')[1];
      const written = await Filesystem.writeFile({ path: `ocr_tool_sel_${Date.now()}.jpg`, data: base64, directory: Directory.Cache });

      const overlayId = `${Date.now()}`;
      setOverlays(prev => [...prev, { id: overlayId, x: minX, y: minY, w: maxX - minX, h: maxY - minY, text: '', loading: true }]);
      handleClearSelection();

      const extracted = await textRecognitionService.extractText(written.uri);
      setOverlays(prev => prev.map(o => o.id === overlayId ? { ...o, text: extracted || '(nenhum texto encontrado)', loading: false } : o));
      if (extracted) setText(prev => (prev.trim() ? `${prev.trim()}\n${extracted}` : extracted));
    } catch (err: any) {
      toast.show('Erro ao extrair texto da seleção: ' + (err?.message || err));
    } finally {
      setExtracting(false);
    }
  };

  const handleCopy = async () => {
    if (!text.trim()) return;
    try {
      await Clipboard.write({ string: text });
      setCopied(true);
      toast.show('Texto copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err: any) {
      toast.show('Erro ao copiar: ' + (err?.message || err));
    }
  };

  const handleExport = async () => {
    if (!text.trim()) return;
    try {
      await Share.share({ title: 'Texto Extraído', text, dialogTitle: 'Exportar texto' });
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (!/cancel/i.test(msg)) toast.show('Erro ao exportar: ' + msg);
    }
  };

  const handleClearAll = () => {
    setText('');
    setImageSrc(null);
    setSourcePath(null);
    setNaturalSize(null);
    setOverlays([]);
    setHasPaint(false);
  };

  const busy = loading || extracting;

  return (
    <div className={`flex flex-col h-full pb-32 px-1 overflow-y-auto overflow-x-hidden force-scrollbar ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <ScanText size={18} className="text-indigo-500" />
            <h2 className={`text-[13px] font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              Extrator de Texto (OCR)
            </h2>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
            Leia o texto de uma foto ou print
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className={`p-5 rounded-[2rem] border flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-relaxed">
            Escolha uma imagem. Depois, pinte só a área que quer ler (opcional) ou use "OCR da
            Imagem Inteira".
          </p>

          <div className="flex gap-2" data-guide-anchor="ocrTool.entrada">
            <button
              type="button"
              onClick={() => handlePickPhoto(CameraSource.Camera)}
              disabled={busy}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CameraIcon size={14} />} Tirar Foto
            </button>
            <button
              type="button"
              onClick={() => handlePickPhoto(CameraSource.Photos)}
              disabled={busy}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />} Galeria
            </button>
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              disabled={busy}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ClipboardPaste size={14} />} Colar Print
            </button>
          </div>
        </div>

        {imageSrc && (
          <div className={`p-4 rounded-[2rem] border flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLocked(v => !v)}
                data-guide-anchor="ocrTool.travar"
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  locked ? 'bg-amber-500 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {locked ? <Lock size={12} /> : <Unlock size={12} />}
                {locked ? 'Destravar pra Pintar' : 'Travar pra Rolar'}
              </button>
              <button
                type="button"
                onClick={() => setPreviewMinimized(v => !v)}
                data-guide-anchor="ocrTool.minimizar"
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
              >
                {previewMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
                {previewMinimized ? 'Mostrar Imagem' : 'Minimizar Imagem'}
              </button>
            </div>

            {/* Altura e largura limitadas de propósito: a imagem em resolução cheia ocupava a
                tela toda e não sobrava espaço fora dela pra rolar até o Pincel/Borracha/Extrair
                abaixo. No celular, arrastar É o gesto de rolar — como o canvas de pintura
                precisa capturar esse mesmo gesto pra desenhar (touchAction: none), só encolher
                não resolve sozinho; por isso também tem o botão de minimizar acima. */}
            <div className={`px-4 ${previewMinimized ? 'hidden' : ''}`}>
              <div className="relative mx-auto w-fit max-w-full rounded-2xl overflow-hidden bg-slate-950/5">
                <img ref={imgRef} src={imageSrc} onLoad={handleImgLoad} alt="Imagem carregada" style={{ maxHeight: '48vh', width: 'auto', maxWidth: '100%' }} className="block select-none" draggable={false} />
                {naturalSize && (
                  <canvas
                    ref={maskCanvasRef}
                    width={naturalSize.w}
                    height={naturalSize.h}
                    onPointerDown={locked ? undefined : handlePointerDown}
                    onPointerMove={locked ? undefined : handlePointerMove}
                    onPointerUp={locked ? undefined : handlePointerUp}
                    onPointerCancel={locked ? undefined : handlePointerUp}
                    className="absolute inset-0 w-full h-full"
                    style={{ touchAction: locked ? 'pan-y' : 'none', opacity: 0.45, cursor: locked ? 'default' : 'crosshair', pointerEvents: locked ? 'none' : 'auto' }}
                  />
                )}
                {naturalSize && (
                  <canvas
                    ref={loupeCanvasRef}
                    width={LOUPE_W}
                    height={LOUPE_H}
                    className={`absolute top-2 right-2 w-[130px] h-[90px] rounded-lg border-2 border-white shadow-lg pointer-events-none ${loupeVisible ? '' : 'hidden'}`}
                  />
                )}
                {naturalSize && overlays.map(o => (
                <div
                  key={o.id}
                  className="absolute p-2 rounded-xl bg-slate-950/85 text-white text-[10px] font-bold leading-snug shadow-lg"
                  style={{ left: `${(o.x / naturalSize.w) * 100}%`, top: `${(o.y / naturalSize.h) * 100}%`, maxWidth: '75%', minWidth: '90px' }}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 break-words">
                      {o.loading ? <Loader2 size={12} className="animate-spin" /> : (o.text || '(nenhum texto encontrado)')}
                    </div>
                    {!o.loading && (
                      <button
                        type="button"
                        onClick={() => setOverlays(prev => prev.filter(x => x.id !== o.id))}
                        className="shrink-0 text-slate-400 hover:text-white"
                        title="Descartar card"
                        aria-label="Descartar este card de texto"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
                ))}
              </div>
            </div>

            {naturalSize && (
              <div className="flex flex-col gap-3" data-guide-anchor="ocrTool.pincel">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTool('brush')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      tool === 'brush'
                        ? 'bg-amber-500 text-white'
                        : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Paintbrush size={14} /> Pincel
                  </button>
                  <button
                    type="button"
                    onClick={() => setTool('eraser')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      tool === 'eraser'
                        ? 'bg-amber-500 text-white'
                        : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Eraser size={14} /> Borracha
                  </button>
                </div>

                <div className="flex items-center gap-3 px-1" data-guide-anchor="ocrTool.diametro">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">Diâmetro</span>
                  <input
                    type="range"
                    min={8}
                    max={60}
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-[10px] font-black text-slate-400 w-9 text-right shrink-0">{brushSize}px</span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    disabled={!hasPaint || busy}
                    data-guide-anchor="ocrTool.limparSelecao"
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                  >
                    Limpar Seleção
                  </button>
                  <button
                    type="button"
                    onClick={handleExtractSelection}
                    disabled={!hasPaint || busy}
                    data-guide-anchor="ocrTool.extrairSelecao"
                    className="flex-[1.4] flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40 active:scale-95 transition-all"
                  >
                    {extracting ? <Loader2 size={14} className="animate-spin" /> : <ScanSearch size={14} />} Extrair Texto da Seleção
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleWholeImageOcr}
                  disabled={busy}
                  data-guide-anchor="ocrTool.ocrImagemInteira"
                  className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                >
                  OCR da Imagem Inteira
                </button>

                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-relaxed px-1">
                  Descartar um card (×) só remove ele da tela — o texto já anexado abaixo você
                  edita/apaga direto no campo, se quiser.
                </p>
              </div>
            )}
          </div>
        )}

        {text.trim() ? (
          <div className={`p-5 rounded-[2rem] border flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`} data-guide-anchor="ocrTool.textoExtraido">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder="O texto reconhecido aparece aqui — edite à vontade."
              className={`w-full p-4 rounded-2xl text-sm font-medium resize-none outline-none border-2 focus:border-indigo-400 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                data-guide-anchor="ocrTool.copiar"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white active:scale-95 transition-all"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado!' : 'Copiar'}
              </button>
              <button
                type="button"
                onClick={handleExport}
                data-guide-anchor="ocrTool.exportar"
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                <Share2 size={14} /> Exportar
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                data-guide-anchor="ocrTool.limpar"
                title="Limpar tudo"
                aria-label="Limpar texto e imagem"
                className={`px-4 flex items-center justify-center rounded-xl transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-rose-400' : 'bg-slate-100 text-slate-400 hover:text-rose-500'}`}
              >
                <Trash2 size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => onExportToSales(text)}
              data-guide-anchor="ocrTool.exportarVendas"
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white active:scale-95 transition-all"
            >
              <ShoppingBag size={14} /> Exportar para Vendas
            </button>
          </div>
        ) : (
          !imageSrc && !loading && (
            <div className={`p-12 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center text-center gap-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-300">
                <ScanText size={32} />
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Escolha uma imagem pra começar</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
