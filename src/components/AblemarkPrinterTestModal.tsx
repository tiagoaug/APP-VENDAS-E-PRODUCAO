import { useRef, useState } from 'react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Bluetooth, Printer, RefreshCw, CheckCircle2, XCircle, ImagePlus, X } from 'lucide-react';
import Modal from './Modal';
import {
  AbleMarkPairedDevice,
  listAbleMarkPairedDevices,
  connectAbleMarkPrinter,
  isAbleMarkPrinterConnected,
  printAbleMarkLabel,
} from '../lib/ablemarkPrinter';

interface AblemarkPrinterTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

// Mesmas dimensões (600x192 dots) da etiqueta de teste que usamos pra descobrir o protocolo —
// mantém a comparação byte-a-byte contra a captura original válida (largura/altura idênticas).
const TEST_WIDTH = 600;
const TEST_HEIGHT = 192;

function generateTestLabelDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = TEST_WIDTH;
  canvas.height = TEST_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, TEST_WIDTH, TEST_HEIGHT);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('teste', TEST_WIDTH / 2, TEST_HEIGHT / 2);
  return canvas.toDataURL('image/png');
}

// Ajusta uma foto/imagem qualquer (proporção e resolução arbitrárias) pro tamanho de etiqueta
// validado (600x192) — mantém a proporção original ("contain"), centralizada sobre fundo
// branco, deixando pro lado nativo (toPacked1bpp) o trabalho de converter pra 1bpp.
function fitImageToLabelDataUrl(sourceDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = TEST_WIDTH;
      canvas.height = TEST_HEIGHT;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, TEST_WIDTH, TEST_HEIGHT);
      const scale = Math.min(TEST_WIDTH / img.width, TEST_HEIGHT / img.height);
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      const offsetX = (TEST_WIDTH - drawWidth) / 2;
      const offsetY = (TEST_HEIGHT - drawHeight) / 2;
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem selecionada'));
    img.src = sourceDataUrl;
  });
}

export default function AblemarkPrinterTestModal({ isOpen, onClose, isDarkMode }: AblemarkPrinterTestModalProps) {
  const [devices, setDevices] = useState<AbleMarkPairedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  // Foto/imagem real selecionada pelo usuário (dataURL original, antes do ajuste ao tamanho
  // da etiqueta) — quando presente, substitui a etiqueta de texto "teste" gerada por canvas.
  const [pickedImage, setPickedImage] = useState<string | null>(null);
  // Densidade de teste — só density=2 foi confirmado por captura real até agora; expõe 1 e 3
  // aqui pra testar rápido, sem precisar recompilar, caso a impressora tenha uma calibração
  // interna diferente da esperada.
  const [testDensity, setTestDensity] = useState<1 | 2 | 3>(2);
  // Guarda síncrona contra clique duplo/"ghost click" — o estado `printing` só reflete no botão
  // depois de um re-render do React, então dois eventos de clique quase simultâneos podem
  // passar pelo `disabled` antes disso. useRef muda na hora, sem esperar re-render.
  const printingRef = useRef(false);

  const pushLog = (msg: string) => setLog(prev => [...prev, msg]);

  const handleListDevices = async () => {
    setLoadingDevices(true);
    try {
      const list = await listAbleMarkPairedDevices();
      setDevices(list);
      pushLog(`${list.length} dispositivo(s) pareado(s) encontrado(s)`);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleConnect = async (address: string) => {
    setSelectedAddress(address);
    setConnecting(true);
    pushLog(`Conectando em ${address}...`);
    try {
      const { connected: ok, error } = await connectAbleMarkPrinter(address);
      setConnected(ok);
      pushLog(ok ? 'Conectado!' : `Falha ao conectar: ${error || '(sem detalhe)'}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleCheckConnection = async () => {
    const ok = await isAbleMarkPrinterConnected();
    setConnected(ok);
    pushLog(`Status atual: ${ok ? 'conectado' : 'desconectado'}`);
  };

  const handlePickImage = async () => {
    try {
      const photo = await Camera.getPhoto({
        source: CameraSource.Prompt,
        resultType: CameraResultType.DataUrl,
        quality: 85,
      });
      if (photo.dataUrl) {
        setPickedImage(photo.dataUrl);
        pushLog('Imagem real selecionada.');
      }
    } catch (err: any) {
      // Usuário cancelou o seletor de câmera/galeria — não é um erro a logar.
      const msg = String(err?.message || err || '');
      if (!/cancel/i.test(msg)) {
        pushLog('Erro ao selecionar imagem: ' + msg);
      }
    }
  };

  const handlePrintTest = async () => {
    if (printingRef.current) return;
    printingRef.current = true;
    setPrinting(true);
    pushLog(pickedImage ? 'Ajustando imagem à etiqueta...' : 'Gerando etiqueta de teste...');
    try {
      const dataUrl = pickedImage ? await fitImageToLabelDataUrl(pickedImage) : generateTestLabelDataUrl();
      const base64 = dataUrl.split('base64,')[1];
      const written = await Filesystem.writeFile({
        path: `ablemark_test_${Date.now()}.png`,
        data: base64,
        directory: Directory.Cache,
      });
      pushLog(`Imagem salva em ${written.uri}`);
      pushLog(`Enviando para a impressora (densidade ${testDensity})...`);
      const { sent, error } = await printAbleMarkLabel(written.uri, 2, testDensity);
      pushLog(sent ? 'Enviado! Confira a impressora.' : `Falha ao enviar: ${error || '(sem detalhe)'}`);
    } catch (err: any) {
      pushLog('Erro: ' + (err?.message || err));
    } finally {
      printingRef.current = false;
      setPrinting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Teste — Impressora Ablemark" icon={<Printer size={20} />} maxWidth="max-w-lg" zIndex={90000}>
      <div className="flex flex-col gap-5">
        <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-2xl border ${isDarkMode ? 'bg-amber-950/30 border-amber-900/50' : 'bg-amber-100/60 border-amber-200'}`}>
          <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-widest leading-relaxed">
            Ferramenta de teste — usada pra validar o protocolo da BR-L100 contra hardware real. Não é uma tela final de impressão.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleListDevices}
            disabled={loadingDevices}
            className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <RefreshCw size={14} className={loadingDevices ? 'animate-spin' : ''} /> Listar dispositivos pareados
          </button>

          {devices.map(d => (
            <button
              key={d.address}
              type="button"
              onClick={() => handleConnect(d.address)}
              disabled={connecting}
              className={`flex items-center justify-between gap-2 px-4 py-3 rounded-2xl border-2 transition-all ${
                selectedAddress === d.address
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Bluetooth size={14} className="text-indigo-500 shrink-0" />
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-xs font-black truncate">{d.name}</span>
                  <span className="text-[9px] font-bold text-slate-400">{d.address}</span>
                </div>
              </div>
              {selectedAddress === d.address && connected && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {pickedImage ? (
            <div className={`flex items-center gap-3 p-2.5 rounded-2xl border-2 ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
              <img
                src={pickedImage}
                alt="Imagem selecionada"
                className="w-16 h-auto max-h-12 object-contain rounded-lg bg-white shrink-0"
              />
              <span className="flex-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Imagem real selecionada</span>
              <button
                type="button"
                onClick={() => setPickedImage(null)}
                className={`p-2 rounded-xl shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handlePickImage}
              className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <ImagePlus size={14} /> Escolher imagem real (câmera/galeria)
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Densidade de teste</span>
          <div className="flex gap-2">
            {([1, 2, 3] as const).map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setTestDensity(d)}
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  testDensity === d ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {d}{d === 2 ? ' (padrão)' : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCheckConnection}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
          >
            {connected ? <CheckCircle2 size={14} className="text-emerald-500" /> : <XCircle size={14} className="text-rose-500" />}
            Status
          </button>
          <button
            type="button"
            onClick={handlePrintTest}
            disabled={!connected || printing}
            className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40 transition-all"
          >
            <Printer size={14} /> {printing ? 'Imprimindo...' : pickedImage ? 'Imprimir Imagem Selecionada' : 'Imprimir Etiqueta de Teste'}
          </button>
        </div>

        {log.length > 0 && (
          <div className={`p-3 rounded-2xl font-mono text-[10px] leading-relaxed max-h-48 overflow-y-auto ${isDarkMode ? 'bg-slate-950 text-slate-400' : 'bg-slate-50 text-slate-600'}`}>
            {log.map((l, i) => <div key={i}>{`> ${l}`}</div>)}
          </div>
        )}
      </div>
    </Modal>
  );
}
