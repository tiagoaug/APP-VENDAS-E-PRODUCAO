import { useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Clipboard } from '@capacitor/clipboard';
import { Share } from '@capacitor/share';
import { ArrowLeft, ScanText, Camera as CameraIcon, Image as ImageIcon, ClipboardPaste, Copy, Share2, Trash2, Loader2, Check } from 'lucide-react';
import { textRecognitionService } from '../services/textRecognitionService';
import { toast } from '../utils/toast';

interface OcrTextExtractorViewProps {
  onBack: () => void;
  isDarkMode: boolean;
}

// Ferramenta avulsa de OCR — diferente do "Colar Pedido Digitado" (PasteOrderModal), aqui não
// tem catálogo/produto/cliente envolvido, é só ler uma imagem por vez e devolver o texto pra
// editar/copiar/exportar. Por isso cada nova leitura SUBSTITUI o texto atual (lá, cada leitura
// ANEXA, pra juntar vários prints do mesmo pedido — não faz sentido aqui).
export default function OcrTextExtractorView({ onBack, isDarkMode }: OcrTextExtractorViewProps) {
  const [text, setText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const runOcr = async (path: string, previewSrc: string) => {
    setLoading(true);
    try {
      const extracted = await textRecognitionService.extractText(path);
      if (!extracted) return; // serviço já avisou (toast) ou o usuário cancelou
      setText(extracted);
      setImagePreview(previewSrc);
    } catch (err: any) {
      toast.show('Erro ao ler a imagem: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handlePickPhoto = async (source: CameraSource) => {
    setLoading(true);
    try {
      const photo = await Camera.getPhoto({ source, resultType: CameraResultType.Uri, quality: 90 });
      const path = photo.path || photo.webPath;
      if (!path) { setLoading(false); return; }
      await runOcr(path, photo.webPath || path);
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (!/cancel/i.test(msg)) toast.show('Erro ao selecionar imagem: ' + msg);
      setLoading(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    setLoading(true);
    try {
      const { value, type } = await Clipboard.read();
      if (!value || !type?.startsWith('image/')) {
        toast.show('Nenhuma imagem encontrada na área de transferência. Copie um print e tente de novo.');
        setLoading(false);
        return;
      }
      const dataUrl = value.includes('base64,') ? value : `data:${type};base64,${value}`;
      const base64 = dataUrl.split('base64,')[1];
      const written = await Filesystem.writeFile({ path: `ocr_tool_${Date.now()}.png`, data: base64, directory: Directory.Cache });
      await runOcr(written.uri, dataUrl);
    } catch (err: any) {
      toast.show('Não foi possível colar a imagem: ' + (err?.message || err));
      setLoading(false);
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

  const handleClear = () => {
    setText('');
    setImagePreview(null);
  };

  return (
    <div className={`flex flex-col h-full pb-10 px-1 overflow-y-auto overflow-x-hidden force-scrollbar ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>

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
            Escolha uma imagem — o texto reconhecido aparece abaixo, pronto pra editar, copiar
            ou exportar. Ler uma nova imagem substitui o texto atual.
          </p>

          <div className="flex gap-2" data-guide-anchor="ocrTool.entrada">
            <button
              type="button"
              onClick={() => handlePickPhoto(CameraSource.Camera)}
              disabled={loading}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CameraIcon size={14} />} Tirar Foto
            </button>
            <button
              type="button"
              onClick={() => handlePickPhoto(CameraSource.Photos)}
              disabled={loading}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />} Galeria
            </button>
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              disabled={loading}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ClipboardPaste size={14} />} Colar Print
            </button>
          </div>
          {loading && (
            <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest text-center">Lendo imagem...</p>
          )}
        </div>

        {imagePreview && (
          <div className={`p-3 rounded-[2rem] border flex items-center gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
            <img src={imagePreview} alt="Imagem lida" className="w-16 h-16 rounded-2xl object-cover shrink-0" />
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Imagem usada nesta leitura</p>
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
                onClick={handleClear}
                data-guide-anchor="ocrTool.limpar"
                title="Limpar"
                aria-label="Limpar texto e imagem"
                className={`px-4 flex items-center justify-center rounded-xl transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-rose-400' : 'bg-slate-100 text-slate-400 hover:text-rose-500'}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ) : (
          !loading && (
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
